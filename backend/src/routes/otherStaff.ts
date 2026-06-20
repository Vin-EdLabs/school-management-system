import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

function emitChanged(tenantId: number, action: 'created' | 'updated' | 'deleted') {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'other-staff',
      action,
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

async function nextOtherStaffId(tenantId: number): Promise<string> {
  const res = await query(
    `SELECT staff_id FROM other_staff WHERE tenant_id = $1
     AND (staff_id LIKE 'STF%' OR staff_id LIKE 'OTH%' OR staff_id LIKE 'STAFF%')`,
    [tenantId]
  );
  const parseNum = (id: string) => {
    const m = String(id).match(/^(?:STF|OTH|STAFF)(\d+)$/i);
    return m ? parseInt(m[1], 10) || 0 : 0;
  };
  if (res.rows.length === 0) return 'STF001';
  const maxNum = Math.max(
    ...res.rows.map((r: { staff_id: string }) => parseNum(r.staff_id))
  );
  return `STF${String(maxNum + 1).padStart(3, '0')}`;
}

const ALL_STAFF_SQL = `
  SELECT
    t.id,
    t.tenant_id,
    t.staff_id,
    t.full_name,
    t.gender,
    t.phone_number,
    t.email,
    t.employment_date,
    COALESCE(NULLIF(LOWER(TRIM(t.employment_status)), ''), 'active') AS employment_status,
    t.monthly_salary,
    COALESCE(t.ssnit_enabled, false) AS ssnit_enabled,
    t.emergency_contact_name,
    t.emergency_contact_phone,
    t.emergency_contact_relationship,
    t.bank_name,
    t.bank_account_number,
    t.bank_branch,
    t.bank_account_name,
    'teacher' AS staff_type,
    ARRAY_TO_STRING(t.subjects_taught, ', ') AS position,
    NULL::varchar AS department,
    t.passport_photo_url
  FROM teachers t
  WHERE t.tenant_id = $1
    AND COALESCE(NULLIF(LOWER(TRIM(t.employment_status)), ''), 'active') IN ('active', 'suspended')

  UNION ALL

  SELECT
    o.id,
    o.tenant_id,
    o.staff_id,
    o.full_name,
    o.gender,
    o.phone_number,
    o.email,
    o.employment_date,
    COALESCE(NULLIF(LOWER(TRIM(o.employment_status)), ''), 'active') AS employment_status,
    o.monthly_salary,
    COALESCE(o.ssnit_enabled, false) AS ssnit_enabled,
    o.emergency_contact_name,
    o.emergency_contact_phone,
    o.emergency_contact_relationship,
    o.bank_name,
    o.bank_account_number,
    o.bank_branch,
    o.bank_account_name,
    'other' AS staff_type,
    o.position,
    o.department,
    o.passport_photo_url
  FROM other_staff o
  WHERE o.tenant_id = $1
    AND COALESCE(NULLIF(LOWER(TRIM(o.employment_status)), ''), 'active') = 'active'

  ORDER BY full_name ASC
`;

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

router.get('/all-staff', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const statusFilter = String(req.query.status || 'active').toLowerCase();
    const typeFilter = String(req.query.type || 'all').toLowerCase();

    let sql = `
      SELECT * FROM (
        SELECT
          t.id, t.tenant_id, t.staff_id, t.full_name, t.gender, t.phone_number, t.email,
          t.employment_date,
          COALESCE(NULLIF(LOWER(TRIM(t.employment_status)), ''), 'active') AS employment_status,
          t.monthly_salary, COALESCE(t.ssnit_enabled, false) AS ssnit_enabled,
          t.emergency_contact_name, t.emergency_contact_phone, t.emergency_contact_relationship,
          t.bank_name, t.bank_account_number, t.bank_branch, t.bank_account_name,
          'teacher' AS staff_type,
          ARRAY_TO_STRING(t.subjects_taught, ', ') AS position,
          NULL::varchar AS department,
          t.passport_photo_url
        FROM teachers t
        WHERE t.tenant_id = $1

        UNION ALL

        SELECT
          o.id, o.tenant_id, o.staff_id, o.full_name, o.gender, o.phone_number, o.email,
          o.employment_date,
          COALESCE(NULLIF(LOWER(TRIM(o.employment_status)), ''), 'active') AS employment_status,
          o.monthly_salary, COALESCE(o.ssnit_enabled, false) AS ssnit_enabled,
          o.emergency_contact_name, o.emergency_contact_phone, o.emergency_contact_relationship,
          o.bank_name, o.bank_account_number, o.bank_branch, o.bank_account_name,
          'other' AS staff_type,
          o.position, o.department, o.passport_photo_url
        FROM other_staff o
        WHERE o.tenant_id = $1
      ) combined
      WHERE 1=1`;

    const params: unknown[] = [tenantId];
    let p = 2;

    if (typeFilter === 'teacher') {
      sql += ` AND staff_type = 'teacher'`;
    } else if (typeFilter === 'other') {
      sql += ` AND staff_type = 'other'`;
    }

    if (statusFilter === 'active') {
      sql += ` AND employment_status IN ('active', 'suspended')`;
    } else if (statusFilter === 'inactive') {
      sql += ` AND employment_status NOT IN ('active', 'suspended')`;
    }

    sql += ' ORDER BY full_name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({ error: 'Failed to fetch all staff' });
  }
});

router.get('/without-users', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT o.id, o.staff_id, o.full_name, o.position, o.department, o.passport_photo_url
       FROM other_staff o
       WHERE o.tenant_id = $1
         AND COALESCE(NULLIF(LOWER(TRIM(o.employment_status)), ''), 'active') = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM users u
           WHERE u.tenant_id = o.tenant_id AND u.other_staff_id = o.id AND COALESCE(u.is_active, true) = true
         )
       ORDER BY o.full_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get staff without users error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { status } = req.query;
    let sql = 'SELECT * FROM other_staff WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (status && String(status) !== 'all') {
      sql += ` AND COALESCE(NULLIF(LOWER(TRIM(employment_status)), ''), 'active') = $2`;
      params.push(String(status).toLowerCase());
    }
    sql += ' ORDER BY full_name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List other staff error:', error);
    res.status(500).json({ error: 'Failed to fetch other staff' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(String(req.params.id), 10);
    const result = await query('SELECT * FROM other_staff WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get other staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const d = req.body;
    if (!d.full_name?.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const staffId = await nextOtherStaffId(tenantId);
    const result = await query(
      `INSERT INTO other_staff (
        tenant_id, staff_id, full_name, gender, date_of_birth, phone_number, email,
        home_address, national_id, position, department, employment_type, employment_date,
        monthly_salary, ssnit_number, ssnit_enabled,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        bank_name, bank_account_number, bank_branch, bank_account_name,
        employment_status, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
      ) RETURNING *`,
      [
        tenantId,
        staffId,
        d.full_name.trim(),
        d.gender || null,
        d.date_of_birth || null,
        d.phone_number || null,
        d.email || null,
        d.home_address || null,
        d.national_id || null,
        d.position || null,
        d.department || null,
        d.employment_type || null,
        d.employment_date || null,
        d.monthly_salary != null ? parseFloat(d.monthly_salary) : 0,
        d.ssnit_number || null,
        d.ssnit_enabled === true,
        d.emergency_contact_name || null,
        d.emergency_contact_phone || null,
        d.emergency_contact_relationship || null,
        d.bank_name || null,
        d.bank_account_number || null,
        d.bank_branch || null,
        d.bank_account_name || null,
        (d.employment_status || 'active').toLowerCase(),
        d.notes || null,
      ]
    );

    const row = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    const pos = [row.position, row.department].filter(Boolean).join(', ');
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'OTHER_STAFF',
      entityId: row.id,
      module: 'staff',
      summary: withActor(
        `Non-teaching staff added — ${row.full_name}${pos ? ` (${pos})` : ''}`,
        actor
      ),
      details: { fullName: row.full_name, staffId: row.staff_id, position: row.position, department: row.department },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitChanged(tenantId, 'created');
    try {
      const { ensureGeneratedIdCard } = await import('../services/idCardAutoService.js');
      await ensureGeneratedIdCard({
        tenantId,
        entityType: 'STAFF',
        entityId: Number(row.id),
        generatedAt: row.employment_date || row.created_at,
        generatedBy: null,
      });
    } catch (cardErr) {
      console.error('[create-other-staff] Auto ID card failed:', cardErr);
    }
    res.status(201).json(row);
  } catch (error: unknown) {
    console.error('Create other staff error:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') return res.status(409).json({ error: 'Staff ID already exists' });
    res.status(500).json({ error: 'Failed to add staff member', detail: err.message });
  }
});

router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(String(req.params.id), 10);
    const updates = req.body;
    const allowed = [
      'full_name', 'gender', 'date_of_birth', 'phone_number', 'email', 'home_address', 'national_id',
      'position', 'department', 'employment_type', 'employment_date', 'monthly_salary', 'ssnit_number',
      'ssnit_enabled', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
      'bank_name', 'bank_account_number', 'bank_branch', 'bank_account_name', 'employment_status', 'notes',
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${p++}`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, tenantId);
    const result = await query(
      `UPDATE other_staff SET ${fields.join(', ')} WHERE id = $${p++} AND tenant_id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'OTHER_STAFF',
      entityId: id,
      module: 'staff',
      summary: withActor(`Staff profile updated — ${result.rows[0].full_name}`, actor),
      details: { staffId: result.rows[0].staff_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitChanged(tenantId, 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update other staff error:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(String(req.params.id), 10);
    const result = await query(
      `UPDATE other_staff SET employment_status = 'inactive', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'OTHER_STAFF',
      entityId: id,
      module: 'staff',
      summary: withActor(`Staff deactivated — ${result.rows[0].full_name}`, actor),
      details: { staffId: result.rows[0].staff_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitChanged(tenantId, 'deleted');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Deactivate other staff error:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

router.post(
  '/:id/photo',
  requireRole('super-admin', 'administrator'),
  upload.single('photo'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const id = parseInt(String(req.params.id), 10);
      if (!req.file) return res.status(400).json({ error: 'Photo file required' });
      const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const result = await query(
        `UPDATE other_staff SET passport_photo_url = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3 RETURNING id`,
        [b64, id, tenantId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
      res.json({ ok: true });
    } catch (error) {
      console.error('Upload staff photo error:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

router.post('/:id/create-user', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(String(req.params.id), 10);
    const { username, password, role } = req.body;
    if (!username?.trim() || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    const allowedRoles = ['staff', 'finance', 'administrator'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role for staff user' });
    }

    const staffRes = await query('SELECT * FROM other_staff WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (staffRes.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const existing = await query(
      `SELECT id FROM users WHERE tenant_id = $1 AND other_staff_id = $2 AND COALESCE(is_active, true) = true`,
      [tenantId, id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This staff member already has a user account' });
    }

    const staff = staffRes.rows[0];
    const passwordHash = await bcrypt.hash(String(password), 10);
    const insertRes = await query(
      `INSERT INTO users (tenant_id, username, password_hash, role, full_name, phone, other_staff_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (tenant_id, username) DO NOTHING
       RETURNING id`,
      [tenantId, String(username).trim(), passwordHash, role, staff.full_name, staff.phone_number, id]
    );
    if (insertRes.rows.length === 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'USER',
      entityId: id,
      module: 'users',
      summary: withActor(
        `User account created for ${staff.full_name} — Role: ${role}`,
        actor
      ),
      details: { username, role, staffId: staff.staff_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.status(201).json({ ok: true, username: String(username).trim(), role });
  } catch (error) {
    console.error('Create staff user error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to create user account', detail });
  }
});

export { ALL_STAFF_SQL };
export default router;
