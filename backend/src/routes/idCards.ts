import express from 'express';
import { query } from '../db/connection.js';
import {
  authenticate,
  requireTenant,
  AuthRequest,
  requireRole,
  requirePrimaryAdminOrSuperAdmin,
} from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getIdCardTemplate,
  updateIdCardTemplate,
  getSchoolCardContext,
  formatIdCardAcademicYear,
  mapTemplateToApi,
  buildDefaultCardDataFromTemplate,
  mergeCardDataWithTemplate,
  type CardTypeKey,
} from '../services/idCardService.js';
import { buildIdCardVerifyUrl } from '../utils/idCardVerifyUrl.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

function normalizeRole(role: string | null | undefined): string {
  const v = String(role || '').toLowerCase().trim();
  if (v === 'superadmin') return 'super-admin';
  if (v === 'admin') return 'administrator';
  return v;
}

function canManageCards(role: string): boolean {
  return role === 'super-admin' || role === 'administrator';
}

function mapTemplate(row: Awaited<ReturnType<typeof getIdCardTemplate>>) {
  return {
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    footerBg: row.footer_bg || row.primary_color,
    poweredByColor: row.powered_by_color || row.accent_color,
  };
}

function buildVerifyUrl(req: AuthRequest, slug: string, entityType: string, entityId: number): string {
  return buildIdCardVerifyUrl(slug, entityType, entityId, req);
}

async function academicYearLabel(tenantId: number): Promise<string> {
  const ctx = await getSchoolCardContext(tenantId);
  return formatIdCardAcademicYear(ctx?.current_year ?? new Date().getFullYear());
}

router.get('/search', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = normalizeRole(req.user!.role);
    const type = String(req.query.type || 'student').toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const like = `%${q}%`;

    if (type === 'staff') {
      if (!canManageCards(role) && role !== 'teacher' && role !== 'staff') {
        return res.status(403).json({ error: 'Not allowed' });
      }
      const params: Array<string | number> = [tenantId, q, like];
      let teacherUserFilter = '';
      if (role === 'teacher') {
        teacherUserFilter = 'AND t.user_id = $4';
        params.push(Number(req.user!.id));
      }

      const result = await query(
        `SELECT * FROM (
          SELECT t.id, t.full_name, t.staff_id AS id_number, t.passport_photo_url AS photo_url,
                 'TEACHER'::text AS position, 'ACADEMIC'::text AS department, 'teacher'::text AS staff_type
          FROM teachers t
          WHERE t.tenant_id = $1 AND COALESCE(t.status, 'active') = 'active' ${teacherUserFilter}
          UNION ALL
          SELECT o.id, o.full_name, o.staff_id, o.passport_photo_url, o.position, o.department, 'other'::text
          FROM other_staff o
          WHERE o.tenant_id = $1 AND COALESCE(o.employment_status, 'active') = 'active'
        ) staff
        WHERE ($2 = '' OR LOWER(staff.full_name) LIKE $3 OR LOWER(staff.id_number) LIKE $3
               OR LOWER(COALESCE(staff.position, '')) LIKE $3 OR LOWER(COALESCE(staff.department, '')) LIKE $3)
        ORDER BY staff.full_name ASC
        LIMIT 50`,
        params
      );

      const rows = await Promise.all(
        result.rows.map(async (row: Record<string, unknown>) => {
          const gen = await query(
            `SELECT id FROM generated_id_cards
             WHERE tenant_id = $1 AND entity_type = 'STAFF' AND entity_id = $2 AND status = 'ACTIVE'
             ORDER BY generated_at DESC LIMIT 1`,
            [tenantId, row.id]
          );
          return {
            id: Number(row.id),
            fullName: String(row.full_name),
            idNumber: String(row.id_number),
            photoUrl: row.photo_url ? String(row.photo_url) : null,
            position: row.position ? String(row.position) : undefined,
            department: row.department ? String(row.department) : undefined,
            staffType: row.staff_type as 'teacher' | 'other',
            hasGeneratedCard: gen.rows.length > 0,
          };
        })
      );
      return res.json(rows);
    }

    if (!canManageCards(role)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const result = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.passport_photo_url,
              c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE s.tenant_id = $1
         AND COALESCE(s.enrollment_status, 'active') = 'active'
         AND ($2 = '' OR LOWER(s.first_name || ' ' || s.last_name) LIKE $3
              OR LOWER(s.student_id) LIKE $3 OR LOWER(COALESCE(c.name, '')) LIKE $3)
       ORDER BY s.first_name, s.last_name
       LIMIT 50`,
      [tenantId, q, like]
    );

    const year = await academicYearLabel(tenantId);
    const rows = await Promise.all(
      result.rows.map(async (row: Record<string, unknown>) => {
        const gen = await query(
          `SELECT id FROM generated_id_cards
           WHERE tenant_id = $1 AND entity_type = 'STUDENT' AND entity_id = $2 AND status = 'ACTIVE'
           ORDER BY generated_at DESC LIMIT 1`,
          [tenantId, row.id]
        );
        return {
          id: Number(row.id),
          fullName: `${String(row.first_name)} ${String(row.last_name)}`.trim(),
          idNumber: String(row.student_id),
          photoUrl: row.passport_photo_url ? String(row.passport_photo_url) : null,
          className: row.class_name ? String(row.class_name) : undefined,
          academicYear: year,
          hasGeneratedCard: gen.rows.length > 0,
        };
      })
    );
    res.json(rows);
  } catch (error) {
    console.error('ID card search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/student/:studentId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!canManageCards(normalizeRole(req.user!.role))) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const studentId = parseInt(req.params.studentId, 10);
    const studentRes = await query(
      `SELECT s.*, c.name AS class_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    const student = studentRes.rows[0];
    const ctx = await getSchoolCardContext(tenantId);
    const template = await getIdCardTemplate(tenantId, 'STUDENT');
    const slug = String(ctx?.slug || 'school');
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    const phone = String(ctx?.contact_phone || ctx?.phone_number || ctx?.contact || '');
    const year = await academicYearLabel(tenantId);

    const latest = await query(
      `SELECT g.id, g.status, g.generated_at, g.card_data, u.full_name AS generated_by_name
       FROM generated_id_cards g
       LEFT JOIN users u ON u.id = g.generated_by
       WHERE g.tenant_id = $1 AND g.entity_type = 'STUDENT' AND g.entity_id = $2
       ORDER BY g.generated_at DESC LIMIT 1`,
      [tenantId, studentId]
    );

    const lostReports = await query(
      `SELECT id, reported_at, status, found_location
       FROM lost_card_reports
       WHERE tenant_id = $1 AND entity_type = 'STUDENT' AND entity_id = $2
       ORDER BY reported_at DESC LIMIT 10`,
      [tenantId, studentId]
    );

    const saved = latest.rows[0]?.card_data as Record<string, unknown> | undefined;
    const verifyUrl = buildVerifyUrl(req, slug, 'student', studentId);

    const cardData = mergeCardDataWithTemplate(
      template,
      {
        schoolName,
        slug,
        phone,
        email: String(ctx?.email || ''),
        logoUrl: ctx?.logo_url ? String(ctx.logo_url) : null,
      },
      {
        photoUrl: student.passport_photo_url ? String(student.passport_photo_url) : saved?.photoUrl ?? null,
        photoBase64: saved?.photoBase64 ?? null,
        fullName: `${String(student.first_name)} ${String(student.last_name)}`.trim().toUpperCase(),
        idNumber: String(student.student_id),
        academicYear: formatIdCardAcademicYear(
          (saved?.academicYear as string | undefined) ?? year
        ),
        className: student.class_name ? String(student.class_name) : undefined,
      },
      verifyUrl
    );

    res.json({
      entityType: 'STUDENT',
      entityId: studentId,
      colors: mapTemplate(template),
      cardData,
      isSnapshot: !!latest.rows[0],
      cardMeta: latest.rows[0]
        ? {
            id: Number(latest.rows[0].id),
            status: String(latest.rows[0].status),
            generatedAt: new Date(String(latest.rows[0].generated_at)).toISOString(),
            generatedByName: latest.rows[0].generated_by_name ? String(latest.rows[0].generated_by_name) : null,
          }
        : null,
      profile: {
        dateOfBirth: student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : null,
        gender: student.gender ? String(student.gender) : null,
        className: student.class_name ? String(student.class_name) : null,
      },
      lostReports: lostReports.rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        reportedAt: new Date(String(r.reported_at)).toISOString(),
        status: String(r.status),
        message: r.found_location ? String(r.found_location) : null,
      })),
    });
  } catch (error) {
    console.error('Get student card error:', error);
    res.status(500).json({ error: 'Failed to load student card' });
  }
});

router.get('/staff/:staffId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = normalizeRole(req.user!.role);
    const staffId = parseInt(req.params.staffId, 10);
    const staffType = String(req.query.staffType || 'teacher');

    let staff: Record<string, unknown> | null = null;
    if (staffType === 'other') {
      const r = await query(`SELECT * FROM other_staff WHERE id = $1 AND tenant_id = $2`, [staffId, tenantId]);
      staff = r.rows[0] || null;
    } else {
      const r = await query(`SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2`, [staffId, tenantId]);
      staff = r.rows[0] || null;
    }
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (!canManageCards(role)) {
      if (role === 'teacher') {
        const link = await query(`SELECT id FROM teachers WHERE id = $1 AND user_id = $2`, [staffId, req.user!.id]);
        if (link.rows.length === 0) return res.status(403).json({ error: 'Not allowed' });
      } else {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }

    const ctx = await getSchoolCardContext(tenantId);
    const template = await getIdCardTemplate(tenantId, 'STAFF');
    const slug = String(ctx?.slug || 'school');
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    const phone = String(ctx?.contact_phone || ctx?.phone_number || ctx?.contact || '');

    const latest = await query(
      `SELECT g.id, g.status, g.generated_at, g.card_data, u.full_name AS generated_by_name
       FROM generated_id_cards g
       LEFT JOIN users u ON u.id = g.generated_by
       WHERE g.tenant_id = $1 AND g.entity_type = 'STAFF' AND g.entity_id = $2
       ORDER BY g.generated_at DESC LIMIT 1`,
      [tenantId, staffId]
    );

    const lostReports = await query(
      `SELECT id, reported_at, status, found_location
       FROM lost_card_reports
       WHERE tenant_id = $1 AND entity_type = 'STAFF' AND entity_id = $2
       ORDER BY reported_at DESC LIMIT 10`,
      [tenantId, staffId]
    );

    const saved = latest.rows[0]?.card_data as Record<string, unknown> | undefined;
    const verifyUrl = buildVerifyUrl(req, slug, 'staff', staffId);

    const position =
      staffType === 'other'
        ? String(staff.position || 'STAFF')
        : 'TEACHER';
    const department = staffType === 'other' ? String(staff.department || 'ACADEMIC') : 'ACADEMIC';

    const cardData = mergeCardDataWithTemplate(
      template,
      {
        schoolName,
        slug,
        phone,
        email: String(ctx?.email || ''),
        logoUrl: ctx?.logo_url ? String(ctx.logo_url) : null,
      },
      {
        photoUrl: staff.passport_photo_url ? String(staff.passport_photo_url) : saved?.photoUrl ?? null,
        photoBase64: saved?.photoBase64 ?? null,
        fullName: String(staff.full_name).toUpperCase(),
        idNumber: String(staff.staff_id),
        position: position.toUpperCase(),
        department: department.toUpperCase(),
      },
      verifyUrl
    );

    res.json({
      entityType: 'STAFF',
      entityId: staffId,
      staffType,
      colors: mapTemplate(template),
      cardData,
      isSnapshot: !!latest.rows[0],
      readOnly: !canManageCards(role),
      cardMeta: latest.rows[0]
        ? {
            id: Number(latest.rows[0].id),
            status: String(latest.rows[0].status),
            generatedAt: new Date(String(latest.rows[0].generated_at)).toISOString(),
            generatedByName: latest.rows[0].generated_by_name ? String(latest.rows[0].generated_by_name) : null,
          }
        : null,
      profile: {
        dateOfBirth: staff.date_of_birth ? String(staff.date_of_birth).slice(0, 10) : null,
        gender: staff.gender ? String(staff.gender) : null,
        position: staffType === 'other' ? String(staff.position || '') : 'TEACHER',
        department: staffType === 'other' ? String(staff.department || '') : 'ACADEMIC',
      },
      lostReports: lostReports.rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        reportedAt: new Date(String(r.reported_at)).toISOString(),
        status: String(r.status),
        message: r.found_location ? String(r.found_location) : null,
      })),
    });
  } catch (error) {
    console.error('Get staff card error:', error);
    res.status(500).json({ error: 'Failed to load staff card' });
  }
});

router.post('/generate', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const entityType = String(req.body?.entityType || '').toUpperCase() as CardTypeKey;
    const entityId = parseInt(String(req.body?.entityId), 10);
    const clientData = req.body?.cardData as Record<string, unknown> | undefined;
    if (!['STUDENT', 'STAFF'].includes(entityType) || Number.isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const ctx = await getSchoolCardContext(tenantId);
    const template = await getIdCardTemplate(tenantId);
    const slug = String(ctx?.slug || 'school');
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    const phone = String(ctx?.contact_phone || ctx?.phone_number || ctx?.contact || '');
    const logoUrl = ctx?.logo_url ? String(ctx.logo_url) : null;
    const verifyUrl = buildVerifyUrl(
      req,
      slug,
      entityType.toLowerCase(),
      entityId
    );

    let cardData: Record<string, unknown>;

    if (entityType === 'STUDENT') {
      const studentRes = await query(
        `SELECT s.*, c.name AS class_name FROM students s
         LEFT JOIN classes c ON c.id = s.class_assigned_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [entityId, tenantId]
      );
      if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
      const student = studentRes.rows[0];
      const year = await academicYearLabel(tenantId);
      cardData = mergeCardDataWithTemplate(
        template,
        { schoolName, slug, phone, email: String(ctx?.email || ''), logoUrl },
        {
          photoUrl: student.passport_photo_url ? String(student.passport_photo_url) : null,
          photoBase64: clientData?.photoBase64 ?? null,
          fullName: `${String(student.first_name)} ${String(student.last_name)}`.trim().toUpperCase(),
          idNumber: String(student.student_id),
          academicYear: formatIdCardAcademicYear(
            (clientData?.academicYear as string | undefined) ?? year
          ),
          className: student.class_name ? String(student.class_name) : undefined,
        },
        verifyUrl
      );
    } else {
      const staffType = String(req.body?.staffType || clientData?.staffType || 'teacher');
      let staff: Record<string, unknown> | null = null;
      if (staffType === 'other') {
        const r = await query(`SELECT * FROM other_staff WHERE id = $1 AND tenant_id = $2`, [entityId, tenantId]);
        staff = r.rows[0] || null;
      } else {
        const r = await query(`SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2`, [entityId, tenantId]);
        staff = r.rows[0] || null;
      }
      if (!staff) return res.status(404).json({ error: 'Staff not found' });

      const position =
        staffType === 'other'
          ? String(clientData?.position || staff.position || 'STAFF')
          : String(clientData?.position || 'TEACHER');
      const department =
        staffType === 'other'
          ? String(clientData?.department || staff.department || 'ACADEMIC')
          : String(clientData?.department || 'ACADEMIC');

      cardData = mergeCardDataWithTemplate(
        template,
        { schoolName, slug, phone, email: String(ctx?.email || ''), logoUrl },
        {
          photoUrl: staff.passport_photo_url ? String(staff.passport_photo_url) : null,
          photoBase64: clientData?.photoBase64 ?? null,
          fullName: String(staff.full_name).toUpperCase(),
          idNumber: String(staff.staff_id),
          position: position.toUpperCase(),
          department: department.toUpperCase(),
        },
        verifyUrl
      );
    }

    await query(
      `UPDATE generated_id_cards SET status = 'SUPERSEDED'
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'ACTIVE'`,
      [tenantId, entityType, entityId]
    );

    const inserted = await query(
      `INSERT INTO generated_id_cards (tenant_id, entity_type, entity_id, card_data, generated_by, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       RETURNING id, generated_at`,
      [tenantId, entityType, entityId, JSON.stringify(cardData), req.user!.id]
    );
    res.status(201).json({
      id: inserted.rows[0].id,
      generatedAt: inserted.rows[0].generated_at,
      cardData,
    });
  } catch (error) {
    console.error('Generate ID card error:', error);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

router.get('/history', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM generated_id_cards WHERE tenant_id = $1`,
      [tenantId]
    );
    const result = await query(
      `SELECT g.*, u.full_name AS generated_by_name,
              COALESCE(g.card_data->>'fullName', '') AS full_name,
              COALESCE(g.card_data->>'idNumber', '') AS id_number
       FROM generated_id_cards g
       LEFT JOIN users u ON u.id = g.generated_by
       WHERE g.tenant_id = $1
       ORDER BY g.generated_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    res.json({
      items: result.rows.map((row: Record<string, unknown>) => ({
        id: Number(row.id),
        entityType: String(row.entity_type),
        entityId: Number(row.entity_id),
        cardData: row.card_data,
        generatedBy: row.generated_by != null ? Number(row.generated_by) : null,
        generatedByName: row.generated_by_name ? String(row.generated_by_name) : null,
        generatedAt: new Date(String(row.generated_at)).toISOString(),
        status: String(row.status),
        fullName: String(row.full_name),
        idNumber: String(row.id_number),
      })),
      page,
      total: Number(countRes.rows[0]?.total || 0),
      totalPages: Math.ceil(Number(countRes.rows[0]?.total || 0) / limit),
    });
  } catch (error) {
    console.error('ID card history error:', error);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

router.post('/revoke', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const entityType = String(req.body?.entityType || '').toUpperCase();
    const entityId = parseInt(String(req.body?.entityId), 10);
    if (!['STUDENT', 'STAFF'].includes(entityType) || Number.isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const result = await query(
      `UPDATE generated_id_cards SET status = 'REVOKED'
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'ACTIVE'
       RETURNING id`,
      [tenantId, entityType, entityId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No active card found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Revoke card error:', error);
    res.status(500).json({ error: 'Failed to revoke card' });
  }
});

router.post('/reactivate', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const entityType = String(req.body?.entityType || '').toUpperCase();
    const entityId = parseInt(String(req.body?.entityId), 10);
    if (!['STUDENT', 'STAFF'].includes(entityType) || Number.isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const result = await query(
      `UPDATE generated_id_cards SET status = 'ACTIVE'
       WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'REVOKED'
       RETURNING id`,
      [tenantId, entityType, entityId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No revoked card found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Reactivate card error:', error);
    res.status(500).json({ error: 'Failed to reactivate card' });
  }
});

router.get('/colors', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const student = mapTemplate(await getIdCardTemplate(tenantId, 'STUDENT'));
    const staff = mapTemplate(await getIdCardTemplate(tenantId, 'STAFF'));
    res.json({ student, staff });
  } catch (error) {
    console.error('Get ID card colors error:', error);
    res.status(500).json({ error: 'Failed to load colors' });
  }
});

router.patch('/colors', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const cardType = String(req.body?.cardType || 'STUDENT').toUpperCase() as CardTypeKey;
    if (!['STUDENT', 'STAFF'].includes(cardType)) {
      return res.status(400).json({ error: 'Invalid card type' });
    }
    const updated = await updateIdCardTemplate(tenantId, cardType, {
      primary_color: req.body?.primaryColor,
      accent_color: req.body?.accentColor,
      footer_bg: req.body?.footerBg,
      powered_by_color: req.body?.poweredByColor,
    });
    res.json(mapTemplate(updated));
  } catch (error) {
    console.error('Update ID card colors error:', error);
    res.status(500).json({ error: 'Failed to update colors' });
  }
});

router.get('/template', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const ctx = await getSchoolCardContext(tenantId);
    const template = await getIdCardTemplate(tenantId);
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    res.json({
      schoolName,
      ...mapTemplateToApi(template),
    });
  } catch (error) {
    console.error('Get ID card template error:', error);
    res.status(500).json({ error: 'Failed to load template' });
  }
});

router.patch('/template', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const instructions = req.body?.instructions ?? req.body?.studentInstructions ?? req.body?.staffInstructions;

    const updated = await updateIdCardTemplate(tenantId, 'SCHOOL', {
      primary_color: req.body?.primaryColor,
      accent_color: req.body?.accentColor,
      footer_bg: req.body?.footerBg,
      powered_by_color: req.body?.poweredByColor,
      school_slogan: req.body?.schoolSlogan,
      school_phone: req.body?.schoolPhone,
      school_website: req.body?.schoolWebsite,
      school_code: req.body?.schoolCode,
      school_email: req.body?.schoolEmail,
      back_header_text: req.body?.backHeaderText,
      ...(Array.isArray(instructions) ? { instructions } : {}),
    });
    const ctx = await getSchoolCardContext(tenantId);
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    res.json({
      schoolName,
      ...mapTemplateToApi(updated),
    });
  } catch (error) {
    console.error('Update ID card template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

export default router;
