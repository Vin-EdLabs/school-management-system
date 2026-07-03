import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, getClient } from '../db/connection.js';
import { postStudentActivationTermFee, tryPostStudentActivationTermFee } from '../services/ledgerPaymentService.js';
import { getStudentLedgerStatement } from '../services/studentLedgerStatementService.js';
import { buildAdmissionLetterContent, saveAdmissionLetter } from '../services/admissionLetterService.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  resolveActorFromRequest,
  resolveClassName,
  resolveStudentLabel,
  withActor,
} from '../utils/auditResolve.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getActiveAcademicTermId } from '../services/studentTermTrackingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

async function ensureParentPortalAccountForStudent(
  tenantId: number,
  studentPk: number,
  loginId: string
): Promise<void> {
  const portalLoginId = String(loginId || '').trim();
  if (!portalLoginId) return;
  const passwordHash = await bcrypt.hash(portalLoginId, 10);
  await query(
    `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, student_id) DO NOTHING`,
    [tenantId, studentPk, passwordHash]
  );
}

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit for Base64

const router = express.Router();

function isMissingStudentTermTrackingColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return err?.code === '42703'
    || /inactivated_(at|academic_term_id)|admission_academic_term_id/i.test(String(err?.message || ''));
}

async function tryRecordStudentInactivation(
  tenantId: number,
  studentId: string,
  priorStatus: string
): Promise<void> {
  if (String(priorStatus).toLowerCase() === 'inactive') return;
  try {
    const inactivationTermId = await getActiveAcademicTermId(tenantId);
    await query(
      `UPDATE students
       SET inactivated_at = CURRENT_TIMESTAMP,
           inactivated_academic_term_id = $1
       WHERE id = $2 AND tenant_id = $3`,
      [inactivationTermId, studentId, tenantId]
    );
  } catch (error) {
    if (isMissingStudentTermTrackingColumn(error)) return;
    console.warn('[students] inactivation term tracking skipped:', (error as Error)?.message || error);
  }
}

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

function resolveTenantId(req: AuthRequest): number {
  const fromUser = req.user?.tenantId;
  if (fromUser != null && !Number.isNaN(Number(fromUser))) return Number(fromUser);
  const q = req.query.tenantId;
  if (q != null && String(q).trim() !== '') {
    const parsed = parseInt(String(q), 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new Error('School context required');
}

/** Last graduated class + date when class_assigned_id was cleared on graduation. */
const STUDENT_SELECT_FIELDS = `
  s.*,
  COALESCE(c.class_name, gc.class_name) AS class_name,
  COALESCE(c.level, gc.level) AS level,
  c.stream,
  COALESCE(c.id, gc.class_id) AS resolved_class_id,
  gc.graduated_at
`;

/** List view — omit heavy passport_photo_url payload; expose has_passport_photo instead. */
const STUDENT_LIST_SELECT_FIELDS = `
  s.id, s.tenant_id, s.first_name, s.last_name, s.gender, s.date_of_birth, s.nationality,
  s.student_id, s.admission_number, s.class_assigned_id, s.guardian_name, s.guardian_contact,
  s.guardian_2_name, s.guardian_2_contact, s.guardian_2_relationship,
  s.home_address, s.number_of_siblings, s.names_of_siblings, s.previous_school, s.date_of_admission,
  s.notes, s.is_beneficiary, s.beneficiary_type, s.discount_type, s.discount_value, s.beneficiary_notes,
  s.enrollment_status, s.created_at, s.updated_at,
  s.admission_academic_term_id, s.inactivated_at, s.inactivated_academic_term_id,
  (CASE WHEN s.passport_photo_url IS NOT NULL AND length(s.passport_photo_url) > 0 THEN true ELSE false END) AS has_passport_photo,
  COALESCE(c.class_name, gc.class_name) AS class_name,
  COALESCE(c.level, gc.level) AS level,
  c.stream,
  COALESCE(c.id, gc.class_id) AS resolved_class_id,
  gc.graduated_at
`;

const STUDENT_FROM_JOINS = `
  FROM students s
  LEFT JOIN classes c ON s.class_assigned_id = c.id
  LEFT JOIN LATERAL (
    SELECT cl.class_name, cl.level, cl.id AS class_id, gd.graduated_at
    FROM graduation_details gd
    JOIN classes cl ON cl.id = gd.class_id
    WHERE gd.student_id = s.id AND gd.tenant_id = s.tenant_id
    ORDER BY gd.graduated_at DESC, gd.id DESC
    LIMIT 1
  ) gc ON true
`;

const STUDENT_FROM_JOINS_LEGACY = `
  FROM students s
  LEFT JOIN classes c ON s.class_assigned_id = c.id
`;

const STUDENT_SELECT_LEGACY = `
  s.*,
  c.class_name,
  c.level,
  c.stream
`;

const STUDENT_LIST_SELECT_LEGACY = `
  s.id, s.tenant_id, s.first_name, s.last_name, s.gender, s.date_of_birth, s.nationality,
  s.student_id, s.admission_number, s.class_assigned_id, s.guardian_name, s.guardian_contact,
  s.guardian_2_name, s.guardian_2_contact, s.guardian_2_relationship,
  s.home_address, s.number_of_siblings, s.names_of_siblings, s.previous_school, s.date_of_admission,
  s.notes, s.is_beneficiary, s.beneficiary_type, s.discount_type, s.discount_value, s.beneficiary_notes,
  s.enrollment_status, s.created_at, s.updated_at,
  (CASE WHEN s.passport_photo_url IS NOT NULL AND length(s.passport_photo_url) > 0 THEN true ELSE false END) AS has_passport_photo,
  c.class_name,
  c.level,
  c.stream
`;

async function queryStudentsList(
  tenantId: number,
  status: string,
  classId?: string
): Promise<any[]> {
  const params: any[] = [tenantId, status];
  let classFilter = '';
  if (classId) {
    classFilter = ` AND s.class_assigned_id = $${params.length + 1}`;
    params.push(classId);
  }

  try {
    const result = await query(
      `SELECT ${STUDENT_LIST_SELECT_FIELDS}
       ${STUDENT_FROM_JOINS}
       WHERE s.tenant_id = $1
         AND ($2::text = 'all' OR COALESCE(s.enrollment_status, 'active') = $2)
       ${classFilter}
       ORDER BY s.created_at DESC`,
      params
    );
    return result.rows;
  } catch (advancedErr) {
    console.warn('Students list advanced query failed, using legacy:', (advancedErr as Error)?.message);
    try {
      const result = await query(
        `SELECT ${STUDENT_LIST_SELECT_LEGACY}
         ${STUDENT_FROM_JOINS_LEGACY}
         WHERE s.tenant_id = $1
           AND ($2::text = 'all' OR COALESCE(s.enrollment_status, 'active') = $2)
         ${classFilter}
         ORDER BY s.created_at DESC`,
        params
      );
      return result.rows;
    } catch {
      const result = await query(
        `SELECT ${STUDENT_LIST_SELECT_LEGACY}
         ${STUDENT_FROM_JOINS_LEGACY}
         WHERE s.tenant_id = $1
         ${classFilter}
         ORDER BY s.created_at DESC`,
        classId ? [tenantId, classId] : [tenantId]
      );
      return result.rows;
    }
  }
}

async function queryStudentById(tenantId: number, id: string): Promise<any | null> {
  try {
    const result = await query(
      `SELECT ${STUDENT_SELECT_FIELDS}
       ${STUDENT_FROM_JOINS}
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  } catch {
    const result = await query(
      `SELECT ${STUDENT_SELECT_LEGACY}
       ${STUDENT_FROM_JOINS_LEGACY}
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  }
}

// Get all students
// Default: active students only
// ?status=inactive: inactive students
// ?status=graduated: alumni only
// ?status=all: all students
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    const statusParam = String(req.query.status || 'active').toLowerCase();
    const status = ['active', 'inactive', 'pending', 'all', 'graduated'].includes(statusParam) ? statusParam : 'active';

    const rows = await queryStudentsList(tenantId, status, classId ? String(classId) : undefined);
    res.json(rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student passport photo only (lazy-loaded in list views)
router.get('/:id/photo', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      'SELECT passport_photo_url FROM students WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ passport_photo_url: result.rows[0].passport_photo_url || null });
  } catch (error) {
    console.error('Get student photo error:', error);
    res.status(500).json({ error: 'Failed to fetch student photo' });
  }
});

// Student ledger statement — sole financial source for records page
router.get('/:id/ledger-statement', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const rawTermId = req.query.term_id;
    const rawYearId = req.query.academic_year_id;
    const allTerms = String(req.query.all_terms || '').toLowerCase() === 'true';
    const currentTermOnly = String(req.query.current_term || '').toLowerCase() === 'true';
    const termId =
      rawTermId != null && String(rawTermId).trim() !== ''
        ? parseInt(String(rawTermId), 10)
        : null;
    const academicYearId =
      rawYearId != null && String(rawYearId).trim() !== ''
        ? parseInt(String(rawYearId), 10)
        : null;

    const statement = await getStudentLedgerStatement(null, tenantId, studentId, {
      allTerms,
      currentTermOnly,
      termId: termId != null && !Number.isNaN(termId) ? termId : null,
      academicYearId:
        academicYearId != null && !Number.isNaN(academicYearId) ? academicYearId : null,
    });

    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json(statement);
  } catch (error) {
    console.error('Student ledger statement error:', error);
    res.status(500).json({ error: 'Failed to load ledger statement' });
  }
});

// Get student ledger statement with running balance per entry (legacy alias)
router.get('/:id/statement', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const termId = req.query.term_id != null ? parseInt(String(req.query.term_id), 10) : null;
    const academicYearId =
      req.query.academic_year_id != null ? parseInt(String(req.query.academic_year_id), 10) : null;

    const statement = await getStudentLedgerStatement(null, tenantId, studentId, {
      termId: termId != null && !Number.isNaN(termId) ? termId : null,
      academicYearId:
        academicYearId != null && !Number.isNaN(academicYearId) ? academicYearId : null,
    });

    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json({ statement });
  } catch (error) {
    console.error('Student ledger statement error:', error);
    res.status(500).json({ error: 'Failed to load student statement' });
  }
});

// Get single student
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const row = await queryStudentById(tenantId, id);

    if (!row) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(row);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

async function nextStudentIdentifiers(tenantId: number, bump = 0): Promise<{ studentId: string; admissionNumber: string }> {
  const year = new Date().getFullYear();
  const yearShort = year.toString().slice(-2);

  const seqRes = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 5) AS INTEGER)), 0) AS mx
     FROM students
     WHERE tenant_id = $1 AND student_id ~ ('^' || $2 || '[0-9]{4}$')`,
    [tenantId, String(year)]
  );
  const seq = parseInt(seqRes.rows[0]?.mx || '0', 10) + 1 + bump;

  const admRes = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM 6) AS INTEGER)), 0) AS mx
     FROM students
     WHERE tenant_id = $1 AND admission_number ~ ('^ADM' || $2 || '[0-9]{3}$')`,
    [tenantId, yearShort]
  );
  const admSeq = parseInt(admRes.rows[0]?.mx || '0', 10) + 1 + bump;

  return {
    studentId: `${year}${seq.toString().padStart(4, '0')}`,
    admissionNumber: `ADM${yearShort}${admSeq.toString().padStart(3, '0')}`,
  };
}

// Create student
router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    let tenantId: number;
    try {
      tenantId = resolveTenantId(req);
    } catch {
      return res.status(400).json({ error: 'School context required. Select a school first.' });
    }
    const studentData = req.body;
    const requestedStatus = String(studentData.enrollment_status || 'active').toLowerCase().trim();
    const enrollmentStatus = requestedStatus === 'pending' ? 'pending' : 'active';
    const admissionTermId = await getActiveAcademicTermId(tenantId);

    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { studentId, admissionNumber } = await nextStudentIdentifiers(tenantId, attempt);
      try {
        const result = await query(
      `INSERT INTO students (
        tenant_id, first_name, last_name, gender, date_of_birth, nationality,
        student_id, admission_number, class_assigned_id, guardian_name,
        guardian_contact, guardian_2_name, guardian_2_contact, guardian_2_relationship,
        home_address, number_of_siblings, names_of_siblings,
        previous_school, date_of_admission, notes, passport_photo_url,
        is_beneficiary, beneficiary_type, discount_type, discount_value, beneficiary_notes,
        enrollment_status, admission_academic_term_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28
      ) RETURNING *`,
      [
        tenantId,
        studentData.first_name,
        studentData.last_name,
        studentData.gender || null,
        studentData.date_of_birth || null,
        studentData.nationality || null,
        studentId,
        admissionNumber,
        enrollmentStatus === 'pending' ? studentData.class_assigned_id || null : studentData.class_assigned_id || null,
        studentData.guardian_name || null,
        studentData.guardian_contact || null,
        studentData.guardian_2_name || null,
        studentData.guardian_2_contact || null,
        studentData.guardian_2_relationship || null,
        studentData.home_address || null,
        studentData.number_of_siblings || 0,
        studentData.names_of_siblings || null,
        studentData.previous_school || null,
        studentData.date_of_admission || null,
        studentData.notes || null,
        studentData.passport_photo_url || null,
        studentData.is_beneficiary || false,
        studentData.beneficiary_type || null,
        studentData.discount_type || null,
        studentData.discount_value || 0,
        studentData.beneficiary_notes || null,
        enrollmentStatus,
        admissionTermId,
      ]
        );

        const auditAction = enrollmentStatus === 'pending' ? 'STUDENT_PENDING' : 'CREATE';
        const auditSummary =
          enrollmentStatus === 'pending'
            ? `Saved pending admission: ${studentData.first_name} ${studentData.last_name} (${admissionNumber})`
            : `Registered student: ${studentData.first_name} ${studentData.last_name} (${admissionNumber})`;

        await writeAuditLog({
          tenantId,
          userId: req.user!.id,
          userRole: req.user!.role,
          action: auditAction,
          entityType: 'STUDENT',
          entityId: result.rows[0].id,
          module: 'academics',
          summary: auditSummary,
          details: {
            studentId,
            admissionNumber,
            enrollmentStatus,
            classAssignedId: studentData.class_assigned_id || null,
          },
          afterValues: result.rows[0],
          ipAddress: getClientIp(req),
          userAgent: req.get('user-agent') || null,
        });
        emitTenantDataChanged(tenantId, 'student', 'created');

        if (enrollmentStatus === 'active') {
          try {
            const { ensureGeneratedIdCard } = await import('../services/idCardAutoService.js');
            await ensureGeneratedIdCard({
              tenantId,
              entityType: 'STUDENT',
              entityId: Number(result.rows[0].id),
              generatedAt: result.rows[0].date_of_admission || result.rows[0].created_at,
              generatedBy: null,
            });
          } catch (cardErr) {
            console.error('[create-student] Auto ID card failed:', cardErr);
          }

          try {
            await ensureParentPortalAccountForStudent(tenantId, Number(result.rows[0].id), studentId);
          } catch (portalErr) {
            console.error('[create-student] Parent portal account setup failed:', portalErr);
          }
        }

        let billing: Awaited<ReturnType<typeof tryPostStudentActivationTermFee>> | null = null;
        if (enrollmentStatus === 'active' && result.rows[0].class_assigned_id) {
          try {
            billing = await tryPostStudentActivationTermFee(
              tenantId,
              result.rows[0].id,
              req.user!.id,
              'enrollment'
            );
            if (billing.posted) {
              emitTenantDataChanged(tenantId, 'finance', 'updated');
            }
          } catch (feeErr) {
            console.error('[create-student] Term fee posting failed:', feeErr);
          }
        }

        return res.status(201).json({
          ...result.rows[0],
          billing: billing
            ? {
                posted: billing.posted,
                amount: billing.amount,
                warning: billing.message,
                skippedReason: billing.skippedReason,
              }
            : null,
        });
      } catch (insertErr: any) {
        lastError = insertErr;
        if (insertErr.code === '23505' && attempt < 2) continue;
        throw insertErr;
      }
    }
    throw lastError;
  } catch (error: any) {
    console.error('Create student error:', error?.message || error, error?.code);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Student ID or admission number already exists' });
    }
    if (error.code === '42703') {
      return res.status(500).json({
        error: 'Failed to create student',
        hint: 'Database schema out of date — run npm run schema:ensure on the server.',
      });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Upload student passport photo
router.post('/:id/photo', requireRole('super-admin', 'administrator'), upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Convert to Base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await query(
      'UPDATE students SET passport_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [base64Image, id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Update student
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;

    const existing = await queryStudentById(tenantId, id);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const priorStatus = String(existing.enrollment_status || 'active').toLowerCase();
    const nextStatus = updates.enrollment_status !== undefined
      ? String(updates.enrollment_status).toLowerCase()
      : priorStatus;

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'first_name', 'last_name', 'gender', 'date_of_birth', 'nationality',
      'class_assigned_id', 'guardian_name', 'guardian_contact',
      'guardian_2_name', 'guardian_2_contact', 'guardian_2_relationship',
      'home_address',
      'number_of_siblings', 'names_of_siblings', 'previous_school',
      'date_of_admission', 'notes', 'passport_photo_url',
      'is_beneficiary', 'beneficiary_type', 'discount_type', 'discount_value', 'beneficiary_notes',
      'enrollment_status',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const baseFields = [...updateFields];
    const baseValues = [...values];
    const baseParamCount = paramCount;

    if (nextStatus === 'inactive' && priorStatus !== 'inactive') {
      const inactivationTermId = await getActiveAcademicTermId(tenantId);
      updateFields.push(`inactivated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`inactivated_academic_term_id = $${paramCount}`);
      values.push(inactivationTermId);
      paramCount++;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);

    let result;
    try {
      result = await query(
        `UPDATE students SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
        values
      );
    } catch (error) {
      if (!isMissingStudentTermTrackingColumn(error) || nextStatus !== 'inactive' || priorStatus === 'inactive') {
        throw error;
      }
      const fallbackFields = [...baseFields, `updated_at = CURRENT_TIMESTAMP`];
      const fallbackValues = [...baseValues, tenantId, id];
      result = await query(
        `UPDATE students SET ${fallbackFields.join(', ')} WHERE tenant_id = $${baseParamCount} AND id = $${baseParamCount + 1} RETURNING *`,
        fallbackValues
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const updated = result.rows[0];
    let className = '';
    if (updated.class_assigned_id) {
      const classRes = await query(
        'SELECT class_name FROM classes WHERE id = $1 AND tenant_id = $2',
        [updated.class_assigned_id, tenantId]
      );
      className = classRes.rows[0]?.class_name || '';
    }
    const studentName = `${updated.first_name || ''} ${updated.last_name || ''}`.trim();
    let studentLabel = studentName;
    if (className) studentLabel += ` · ${className}`;
    if (updated.admission_number) studentLabel += ` (${updated.admission_number})`;

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'STUDENT',
      entityId: parseInt(id, 10),
      module: 'academics',
      summary: `Updated student — ${studentLabel}`,
      afterValues: updated,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'student', 'updated');

    let billing: Awaited<ReturnType<typeof tryPostStudentActivationTermFee>> | null = null;
    const priorClassId = existing.class_assigned_id != null ? Number(existing.class_assigned_id) : null;
    const newClassId =
      updated.class_assigned_id != null ? Number(updated.class_assigned_id) : null;
    const isActive = String(updated.enrollment_status || existing.enrollment_status || 'active').toLowerCase() === 'active';
    const classChanged = updates.class_assigned_id !== undefined && newClassId !== priorClassId;

    if (isActive && classChanged && newClassId) {
      try {
        billing = await tryPostStudentActivationTermFee(
          tenantId,
          parseInt(id, 10),
          req.user!.id,
          'enrollment'
        );
        if (billing.posted) {
          emitTenantDataChanged(tenantId, 'finance', 'updated');
        }
      } catch (feeErr) {
        console.error('[update-student] Term fee posting failed:', feeErr);
      }
    }

    res.json({
      ...updated,
      billing: billing
        ? {
            posted: billing.posted,
            amount: billing.amount,
            warning: billing.message,
            skippedReason: billing.skippedReason,
          }
        : null,
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Set student enrollment status (soft inactive / reactivate — never delete)
router.patch('/:id/status', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    const existing = await queryStudentById(tenantId, id);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const priorStatus = String(existing.enrollment_status || 'active').toLowerCase();

    const result = await query(
      `UPDATE students
       SET enrollment_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (status === 'inactive' && priorStatus !== 'inactive') {
      await tryRecordStudentInactivation(tenantId, id, priorStatus);
    }

    const row = (await queryStudentById(tenantId, id)) || result.rows[0];
    let billing: Awaited<ReturnType<typeof postStudentActivationTermFee>> | null = null;

    if (status === 'active' && priorStatus !== 'active') {
      const client = await getClient();
      try {
        billing = await postStudentActivationTermFee(
          client,
          tenantId,
          parseInt(id, 10),
          req.user!.id,
          priorStatus === 'pending' ? 'enrollment' : 'reactivation'
        );
      } catch (feeErr) {
        console.error('[reactivate] Term fee posting failed:', feeErr);
      } finally {
        client.release();
      }

      if (billing?.posted) {
        await writeAuditLog({
          tenantId,
          userId: req.user!.id,
          userRole: req.user!.role,
          action: priorStatus === 'pending' ? 'STUDENT_ENROLLED_AND_BILLED' : 'STUDENT_REACTIVATED_AND_BILLED',
          entityType: 'STUDENT',
          entityId: parseInt(id, 10),
          module: 'finance',
          summary: `Term fee GHS ${billing.amount.toFixed(2)} posted for ${row.first_name} ${row.last_name} on ${billing.termName || 'current term'}`,
          details: {
            priorStatus,
            termName: billing.termName,
            amount: billing.amount,
            className: billing.className,
          },
          beforeValues: existing,
          afterValues: row,
          ipAddress: getClientIp(req),
          userAgent: req.get('user-agent') || null,
        });
        emitTenantDataChanged(tenantId, 'fee', 'updated');
        emitTenantDataChanged(tenantId, 'finance', 'updated');
      } else if (
        billing &&
        (billing.skippedReason === 'no_fee_structure' || billing.skippedReason === 'no_class')
      ) {
        await writeAuditLog({
          tenantId,
          userId: req.user!.id,
          userRole: req.user!.role,
          action: priorStatus === 'pending' ? 'STUDENT_ENROLLED_NO_FEE' : 'STUDENT_REACTIVATED_NO_FEE',
          entityType: 'STUDENT',
          entityId: parseInt(id, 10),
          module: 'finance',
          summary: billing.message || 'Student activated without term fee posted',
          details: {
            priorStatus,
            skippedReason: billing.skippedReason,
            termName: billing.termName,
            className: billing.className,
            message: billing.message,
          },
          beforeValues: existing,
          afterValues: row,
          ipAddress: getClientIp(req),
          userAgent: req.get('user-agent') || null,
        });
      }
    } else {
      try {
        const auditAction = status === 'inactive' ? 'DEACTIVATE' : 'REACTIVATE';
        const studentLabel = await resolveStudentLabel(tenantId, parseInt(id, 10));
        const actor = await resolveActorFromRequest(req);
        await writeAuditLog({
          tenantId,
          userId: req.user!.id,
          userRole: req.user!.role,
          action: auditAction,
          entityType: 'STUDENT',
          entityId: parseInt(id, 10),
          module: 'academics',
          summary: withActor(
            status === 'inactive'
              ? `Student deactivated — ${studentLabel}`
              : `Student reactivated — ${studentLabel}`,
            actor
          ),
          details: { enrollment_status: status, studentName: studentLabel },
          ipAddress: getClientIp(req),
          userAgent: req.get('user-agent') ?? null,
        });
      } catch (auditErr) {
        console.error('[status] audit log failed:', auditErr);
      }
    }

    emitTenantDataChanged(tenantId, 'student', 'updated');

    res.json({
      ...row,
      billing: billing
        ? {
            posted: billing.posted,
            amount: billing.amount,
            warning: billing.message,
            skippedReason: billing.skippedReason,
          }
        : null,
    });
  } catch (error) {
    console.error('Update student status error:', error);
    res.status(500).json({ error: 'Failed to update student status' });
  }
});

// Promote student
router.post('/:id/promote', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { new_class_id, current_term, academic_year } = req.body;

    if (!new_class_id) {
      return res.status(400).json({ error: 'New class ID is required' });
    }

    // Get current class
    const studentResult = await query(
      'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const oldClassId = studentResult.rows[0].class_assigned_id;

    const client = await (await import('../db/connection.js')).getClient();

    try {
      await client.query('BEGIN');

      // Update student class
      const result = await client.query(
        'UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [new_class_id, id, tenantId]
      );

      // Fee carryover (outstanding→arrears, credit→student_credits) is handled by
      // processFeesForClassPromotion API, called by frontend BEFORE promote.

      await client.query('COMMIT');

      const studentLabel = await resolveStudentLabel(tenantId, parseInt(id, 10));
      const oldClassName = oldClassId
        ? await resolveClassName(tenantId, Number(oldClassId))
        : 'Unassigned';
      const newClassName = await resolveClassName(tenantId, Number(new_class_id));
      const actor = await resolveActorFromRequest(req);
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'PROMOTE',
        entityType: 'STUDENT',
        entityId: parseInt(id, 10),
        module: 'academics',
        summary: withActor(
          `Student promoted — ${studentLabel}: ${oldClassName} → ${newClassName}`,
          actor
        ),
        details: {
          studentName: studentLabel,
          oldClassName,
          newClassName,
          new_class_id,
          old_class_id: oldClassId,
        },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') ?? null,
      });

      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Promote student error:', error);
    res.status(500).json({ error: 'Failed to promote student' });
  }
});

// Approve pending admission → active enrolled student
router.post('/:id/approve-admission', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const classAssignedId = parseInt(String(req.body.class_assigned_id), 10);
    if (!classAssignedId || Number.isNaN(classAssignedId)) {
      return res.status(400).json({ error: 'Class assignment is required to approve admission' });
    }

    const existing = await queryStudentById(tenantId, id);
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    if (String(existing.enrollment_status || 'active').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'Only pending students can be approved for enrollment' });
    }

    const classCheck = await query(
      'SELECT id, class_name FROM classes WHERE id = $1 AND tenant_id = $2',
      [classAssignedId, tenantId]
    );
    if (classCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Selected class not found' });
    }

    const admissionTermId = await getActiveAcademicTermId(tenantId);

    const result = await query(
      `UPDATE students
       SET enrollment_status = 'active',
           class_assigned_id = $1,
           updated_at = CURRENT_TIMESTAMP,
           admission_academic_term_id = COALESCE(admission_academic_term_id, $4)
       WHERE id = $2 AND tenant_id = $3 AND COALESCE(enrollment_status, 'active') = 'pending'
       RETURNING *`,
      [classAssignedId, id, tenantId, admissionTermId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Could not approve student — they may no longer be pending' });
    }

    const row = result.rows[0];

    try {
      await ensureParentPortalAccountForStudent(
        tenantId,
        Number(row.id),
        String(row.student_id || row.admission_number || '')
      );
    } catch (portalErr) {
      console.error('[approve-admission] Parent portal account setup failed:', portalErr);
    }

    const client = await getClient();
    let feePosted: Awaited<ReturnType<typeof postStudentActivationTermFee>> = { posted: false, amount: 0 };
    try {
      feePosted = await postStudentActivationTermFee(
        client,
        tenantId,
        parseInt(id, 10),
        req.user!.id,
        'enrollment'
      );
    } catch (feeErr) {
      console.error('[approve-admission] Mid-term fee posting failed:', feeErr);
    } finally {
      client.release();
    }

    if (feePosted.posted) {
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'STUDENT_ENROLLED_AND_BILLED',
        entityType: 'STUDENT',
        entityId: parseInt(id, 10),
        module: 'finance',
        summary: `Approved admission and posted term fee GHS ${feePosted.amount.toFixed(2)} for ${row.first_name} ${row.last_name}`,
        details: {
          classAssignedId,
          className: classCheck.rows[0].class_name,
          admissionNumber: row.admission_number,
          termFeeAmount: feePosted.amount,
          termName: feePosted.termName,
        },
        beforeValues: existing,
        afterValues: row,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
    } else if (feePosted.skippedReason === 'no_fee_structure' || feePosted.skippedReason === 'no_class') {
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'STUDENT_ENROLLED_NO_FEE',
        entityType: 'STUDENT',
        entityId: parseInt(id, 10),
        module: 'finance',
        summary: feePosted.message || `Approved admission for ${row.first_name} ${row.last_name} without term fee`,
        details: {
          classAssignedId,
          className: classCheck.rows[0].class_name,
          skippedReason: feePosted.skippedReason,
          message: feePosted.message,
        },
        beforeValues: existing,
        afterValues: row,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
    } else {
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'STUDENT_ENROLLED',
        entityType: 'STUDENT',
        entityId: parseInt(id, 10),
        module: 'academics',
        summary: `Approved pending admission: ${row.first_name} ${row.last_name} → ${classCheck.rows[0].class_name}`,
        details: {
          classAssignedId,
          className: classCheck.rows[0].class_name,
          admissionNumber: row.admission_number,
          termFeePosted: feePosted.posted,
          termFeeAmount: feePosted.amount,
          skippedReason: feePosted.skippedReason,
        },
        beforeValues: existing,
        afterValues: row,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
    }
    emitTenantDataChanged(tenantId, 'student', 'updated');
    try {
      const { ensureGeneratedIdCard } = await import('../services/idCardAutoService.js');
      await ensureGeneratedIdCard({
        tenantId,
        entityType: 'STUDENT',
        entityId: parseInt(id, 10),
        generatedAt: row.date_of_admission || row.created_at,
        generatedBy: null,
      });
    } catch (cardErr) {
      console.error('[approve-admission] Auto ID card failed:', cardErr);
    }
    if (feePosted.posted) {
      emitTenantDataChanged(tenantId, 'fee', 'updated');
      emitTenantDataChanged(tenantId, 'finance', 'updated');
    }

    // Auto-generate admission letter
    try {
      const letterContent = await buildAdmissionLetterContent(tenantId, parseInt(id, 10));
      if (letterContent) {
        await saveAdmissionLetter({
          tenantId,
          studentId: parseInt(id, 10),
          userId: req.user!.id,
          userRole: req.user!.role,
          letterContent,
        });
      }
    } catch (letterErr) {
      console.error('[approve-admission] Admission letter generation failed:', letterErr);
    }

    res.json({
      ...row,
      billing: {
        posted: feePosted.posted,
        amount: feePosted.amount,
        warning: feePosted.message,
        skippedReason: feePosted.skippedReason,
      },
    });
  } catch (error) {
    console.error('Approve admission error:', error);
    res.status(500).json({ error: 'Failed to approve admission' });
  }
});

// Reject pending admission (removes pending record; logged in audit)
router.post('/:id/reject-admission', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const reason = String(req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const existing = await queryStudentById(tenantId, id);
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    if (String(existing.enrollment_status || 'active').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'Only pending students can be rejected' });
    }

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'STUDENT_REJECTED',
      entityType: 'STUDENT',
      entityId: parseInt(id, 10),
      module: 'academics',
      summary: `Rejected pending admission: ${existing.first_name} ${existing.last_name}`,
      details: { reason, admissionNumber: existing.admission_number, studentId: existing.student_id },
      beforeValues: existing,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    await query('DELETE FROM students WHERE id = $1 AND tenant_id = $2 AND COALESCE(enrollment_status, \'active\') = \'pending\'', [
      id,
      tenantId,
    ]);
    emitTenantDataChanged(tenantId, 'student', 'deleted');
    res.json({ success: true, message: 'Pending admission rejected and removed' });
  } catch (error) {
    console.error('Reject admission error:', error);
    res.status(500).json({ error: 'Failed to reject admission' });
  }
});

// --- Admission Letters ---

router.get('/:id/admission-letters', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { listAdmissionLetters } = await import('../services/admissionLetterService.js');
    const letters = await listAdmissionLetters(tenantId, parseInt(id, 10));
    res.json(letters);
  } catch (error) {
    console.error('List admission letters error:', error);
    res.status(500).json({ error: 'Failed to list admission letters' });
  }
});

router.get('/:id/admission-letters/:letterId/download', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id, letterId } = req.params;
    const { getAdmissionLetterPdf } = await import('../services/admissionLetterService.js');
    const letter = await getAdmissionLetterPdf(tenantId, parseInt(id, 10), parseInt(letterId, 10));
    if (!letter) return res.status(404).json({ error: 'Admission letter not found' });
    res.json(letter.letter_content);
  } catch (error) {
    console.error('Download admission letter error:', error);
    res.status(500).json({ error: 'Failed to download admission letter' });
  }
});

router.post('/:id/admission-letters/generate', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { buildAdmissionLetterContent, saveAdmissionLetter } = await import('../services/admissionLetterService.js');
    const letterContent = await buildAdmissionLetterContent(tenantId, parseInt(id, 10));
    if (!letterContent) return res.status(404).json({ error: 'Student not found' });
    const saved = await saveAdmissionLetter({
      tenantId,
      studentId: parseInt(id, 10),
      userId: req.user!.id,
      userRole: req.user!.role,
      letterContent,
    });
    emitTenantDataChanged(tenantId, 'student', 'updated');
    res.json(saved);
  } catch (error) {
    console.error('Generate admission letter error:', error);
    res.status(500).json({ error: 'Failed to generate admission letter' });
  }
});

export default router;
