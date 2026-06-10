import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit for Base64

const router = express.Router();

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
      `SELECT ${STUDENT_SELECT_FIELDS}
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
        `SELECT ${STUDENT_SELECT_LEGACY}
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
        `SELECT ${STUDENT_SELECT_LEGACY}
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
    const status = ['active', 'inactive', 'all', 'graduated'].includes(statusParam) ? statusParam : 'active';

    const rows = await queryStudentsList(tenantId, status, classId ? String(classId) : undefined);
    res.json(rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
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

  // Use max existing sequence for this year — COUNT(*) + 1 reuses IDs after deletes and causes 409.
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

    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { studentId, admissionNumber } = await nextStudentIdentifiers(tenantId, attempt);
      try {
        const result = await query(
      `INSERT INTO students (
        tenant_id, first_name, last_name, gender, date_of_birth, nationality,
        student_id, admission_number, class_assigned_id, guardian_name,
        guardian_contact, home_address, number_of_siblings, names_of_siblings,
        previous_school, date_of_admission, notes, passport_photo_url,
        is_beneficiary, beneficiary_type, discount_type, discount_value, beneficiary_notes,
        enrollment_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, 'active'
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
        studentData.class_assigned_id || null,
        studentData.guardian_name || null,
        studentData.guardian_contact || null,
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
      ]
        );

        await query(
          'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
          [tenantId, req.user!.id, 'CREATE', 'STUDENT', result.rows[0].id]
        ).catch(() => undefined);
        emitTenantDataChanged(tenantId, 'student', 'created');

        return res.status(201).json(result.rows[0]);
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

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'first_name', 'last_name', 'gender', 'date_of_birth', 'nationality',
      'class_assigned_id', 'guardian_name', 'guardian_contact', 'home_address',
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

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);

    const result = await query(
      `UPDATE students SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'STUDENT', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'student', 'updated');

    res.json(result.rows[0]);
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

    const result = await query(
      'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [status, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const auditAction = status === 'inactive' ? 'DEACTIVATE' : 'REACTIVATE';
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, auditAction, 'STUDENT', parseInt(id), JSON.stringify({ enrollment_status: status })]
    );
    emitTenantDataChanged(tenantId, 'student', 'updated');

    res.json(result.rows[0]);
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

      // Log promotion
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, req.user!.id, 'PROMOTE', 'STUDENT', parseInt(id), JSON.stringify({ new_class_id, old_class_id: oldClassId })]
      );

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

export default router;
