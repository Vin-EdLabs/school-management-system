import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { requireBoardingEnabled } from '../middleware/requireBoardingEnabled.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import {
  applyBoardingFeeToStudent,
  removeBoardingFeeFromStudent,
  syncAllBoardingFees,
  getBoardingTermFee,
  upsertBoardingTermFee,
  getAppliedBoardingFeeBreakdown,
} from '../services/boardingFeeService.js';
import { validateEnrollmentGenderMatch } from '../services/boardingGenderService.js';
import { logBedAssignment, closeBedHistory, getBedHistory } from '../services/boardingBedHistoryService.js';
import {
  requireBoardingAdmin,
  requireBoardingStaff,
  requireHouseMasterPlus,
  BOARDING_ADMIN_ROLES,
} from '../middleware/boardingRoleMiddleware.js';
import { buildDormLayout } from '../services/boardingDormLayoutService.js';
import { getWeeklyMenu, saveWeeklyMenu } from '../services/boardingMenuService.js';
import boardingStaffRoutes from './boardingStaffRoutes.js';

const router = express.Router();

const ADMIN_ROLES = BOARDING_ADMIN_ROLES;

async function getCurrentTermId(tenantId: number): Promise<number | null> {
  const result = await query(
    'SELECT id FROM terms WHERE tenant_id = $1 AND is_current = true LIMIT 1',
    [tenantId]
  );
  return result.rows[0]?.id ?? null;
}

function emitBoardingChanged(tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: `boarding-${entity}`,
      action,
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

async function auditBoarding(
  req: AuthRequest,
  tenantId: number,
  action: string,
  entityType: string,
  entityId: number,
  summary: string,
  details?: Record<string, unknown>
) {
  const actor = await resolveActorFromRequest(req);
  await writeAuditLog({
    tenantId,
    userId: req.user!.id,
    userRole: req.user!.role,
    action,
    entityType,
    entityId,
    module: 'boarding',
    summary: withActor(summary, actor),
    details: details ?? {},
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') || null,
  });
}

async function verifyDormTenant(dormId: number, tenantId: number): Promise<boolean> {
  const result = await query('SELECT id FROM boarding_dorms WHERE id = $1 AND tenant_id = $2', [
    dormId,
    tenantId,
  ]);
  return result.rows.length > 0;
}

async function verifyRoomTenant(roomId: number, tenantId: number): Promise<boolean> {
  const result = await query(
    `SELECT br.id FROM boarding_rooms br
     JOIN boarding_dorms bd ON br.dorm_id = bd.id
     WHERE br.id = $1 AND bd.tenant_id = $2`,
    [roomId, tenantId]
  );
  return result.rows.length > 0;
}

async function verifyBedTenant(bedId: number, tenantId: number): Promise<boolean> {
  const result = await query(
    `SELECT bb.id FROM boarding_beds bb
     JOIN boarding_rooms br ON bb.room_id = br.id
     JOIN boarding_dorms bd ON br.dorm_id = bd.id
     WHERE bb.id = $1 AND bd.tenant_id = $2`,
    [bedId, tenantId]
  );
  return result.rows.length > 0;
}

async function freeBed(bedId: number | null | undefined): Promise<void> {
  if (!bedId) return;
  await query('UPDATE boarding_beds SET is_occupied = false WHERE id = $1', [bedId]);
}

async function occupyBed(bedId: number, tenantId: number): Promise<{ ok: boolean; error?: string }> {
  const check = await query(
    `SELECT bb.id, bb.is_occupied FROM boarding_beds bb
     JOIN boarding_rooms br ON bb.room_id = br.id
     JOIN boarding_dorms bd ON br.dorm_id = bd.id
     WHERE bb.id = $1 AND bd.tenant_id = $2`,
    [bedId, tenantId]
  );
  if (check.rows.length === 0) {
    return { ok: false, error: 'Bed not found' };
  }
  if (check.rows[0].is_occupied) {
    return { ok: false, error: 'Bed is already occupied' };
  }
  await query('UPDATE boarding_beds SET is_occupied = true WHERE id = $1', [bedId]);
  return { ok: true };
}

async function studentHasApprovedExeat(
  tenantId: number,
  studentId: number,
  onDate: string
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM boarding_exeats
     WHERE tenant_id = $1 AND student_id = $2
       AND status IN ('approved', 'signed_out', 'returned')
       AND departure_date <= $3::date
       AND COALESCE(actual_return_date, return_date) >= $3::date
     LIMIT 1`,
    [tenantId, studentId, onDate]
  );
  return result.rows.length > 0;
}

async function seedRollCallEntries(
  rollCallId: number,
  tenantId: number,
  dormId: number | null
): Promise<number> {
  const termId = await getCurrentTermId(tenantId);
  if (!termId) return 0;

  const boarders = await query(
    `SELECT be.student_id
     FROM boarding_enrollments be
     WHERE be.tenant_id = $1
       AND be.term_id = $2
       AND be.status = 'boarder'
       AND ($3::int IS NULL OR be.dorm_id = $3)
     ORDER BY be.student_id ASC`,
    [tenantId, termId, dormId]
  );

  let seeded = 0;
  for (const row of boarders.rows) {
    const studentId = Number(row.student_id);
    const inserted = await query(
      `INSERT INTO boarding_roll_call_entries (roll_call_id, student_id, status, flagged)
       VALUES ($1, $2, 'present', false)
       ON CONFLICT (roll_call_id, student_id) DO NOTHING
       RETURNING id`,
      [rollCallId, studentId]
    );
    if (inserted.rows.length > 0) seeded++;
  }
  return seeded;
}

async function fetchRollCallEntries(rollCallId: number) {
  return query(
    `SELECT e.*,
       s.first_name, s.last_name, s.passport_photo_url,
       c.class_name,
       bb.bed_number
     FROM boarding_roll_call_entries e
     JOIN students s ON e.student_id = s.id
     LEFT JOIN classes c ON s.class_assigned_id = c.id
     LEFT JOIN boarding_enrollments be ON be.student_id = s.id
       AND be.status = 'boarder'
       AND be.term_id = (SELECT id FROM terms WHERE tenant_id = s.tenant_id AND is_current = true LIMIT 1)
     LEFT JOIN boarding_beds bb ON be.bed_id = bb.id
     WHERE e.roll_call_id = $1
     ORDER BY s.first_name ASC, s.last_name ASC`,
    [rollCallId]
  );
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
router.use(requireBoardingEnabled);
attachWritableTermGuard(router);

// ----------------------------------------------------
// OVERVIEW
// ----------------------------------------------------
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = await getCurrentTermId(tenantId);

    const boardersRes = await query(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(s.gender, ''))) = 'male')::int AS boys,
         COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(s.gender, ''))) = 'female')::int AS girls
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       WHERE be.tenant_id = $1 AND be.status = 'boarder'
         AND ($2::int IS NULL OR be.term_id = $2)`,
      [tenantId, termId]
    );

    const bedsRes = await query(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE bb.is_occupied)::int AS occupied
       FROM boarding_beds bb
       JOIN boarding_rooms br ON bb.room_id = br.id
       JOIN boarding_dorms bd ON br.dorm_id = bd.id
       WHERE bd.tenant_id = $1`,
      [tenantId]
    );

    const pendingExeatsRes = await query(
      `SELECT COUNT(*)::int AS count FROM boarding_exeats
       WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId]
    );

    const overdueExeatsRes = await query(
      `SELECT COUNT(*)::int AS count FROM boarding_exeats
       WHERE tenant_id = $1
         AND status IN ('approved', 'signed_out')
         AND return_date < CURRENT_DATE
         AND actual_return_date IS NULL`,
      [tenantId]
    );

    const rollCallRes = await query(
      `SELECT COUNT(*)::int AS count FROM boarding_roll_calls
       WHERE tenant_id = $1 AND roll_call_date = CURRENT_DATE`,
      [tenantId]
    );

    const sickBayRes = await query(
      `SELECT COUNT(*)::int AS count FROM boarding_sick_bay
       WHERE tenant_id = $1 AND status = 'resting'`,
      [tenantId]
    );

    const activityRes = await query(
      `SELECT id, action, entity_type, entity_id, summary, created_at
       FROM audit_logs
       WHERE tenant_id = $1 AND module = 'boarding'
       ORDER BY created_at DESC
       LIMIT 15`,
      [tenantId]
    );

    const totalBeds = bedsRes.rows[0]?.total ?? 0;
    const occupiedBeds = bedsRes.rows[0]?.occupied ?? 0;

    const openComplaintsRes = await query(
      `SELECT COUNT(*)::int AS count FROM boarding_complaints
       WHERE tenant_id = $1 AND status IN ('pending', 'under_review')`,
      [tenantId]
    );

    res.json({
      total_boarders: boardersRes.rows[0]?.total ?? 0,
      boys_count: boardersRes.rows[0]?.boys ?? 0,
      girls_count: boardersRes.rows[0]?.girls ?? 0,
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      vacant_beds: Math.max(0, totalBeds - occupiedBeds),
      pending_exeats: pendingExeatsRes.rows[0]?.count ?? 0,
      overdue_exeats: overdueExeatsRes.rows[0]?.count ?? 0,
      open_complaints: openComplaintsRes.rows[0]?.count ?? 0,
      todays_roll_call_done: (rollCallRes.rows[0]?.count ?? 0) > 0,
      sick_bay_active_count: sickBayRes.rows[0]?.count ?? 0,
      recent_activity: activityRes.rows,
    });
  } catch (error) {
    console.error('Boarding overview error:', error);
    res.status(500).json({ error: 'Failed to fetch boarding overview' });
  }
});

router.get('/dorm-layout', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = await getCurrentTermId(tenantId);
    const dorm_layout = await buildDormLayout(tenantId, termId);
    res.json(dorm_layout);
  } catch (error) {
    console.error('Boarding dorm layout error:', error);
    res.status(500).json({ error: 'Failed to fetch dorm layout' });
  }
});

// ----------------------------------------------------
// DORMS CRUD
// ----------------------------------------------------
router.get('/dorms', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT d.*,
         (SELECT COUNT(*)::int FROM boarding_rooms r WHERE r.dorm_id = d.id) AS room_count,
         (SELECT COUNT(*)::int FROM boarding_beds b
          JOIN boarding_rooms r ON b.room_id = r.id WHERE r.dorm_id = d.id) AS bed_count,
         (SELECT COUNT(*)::int FROM boarding_beds b
          JOIN boarding_rooms r ON b.room_id = r.id
          WHERE r.dorm_id = d.id AND b.is_occupied) AS occupied_beds
       FROM boarding_dorms d
       WHERE d.tenant_id = $1
       ORDER BY d.name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List dorms error:', error);
    res.status(500).json({ error: 'Failed to fetch dorms' });
  }
});

router.post('/dorms', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { name, gender } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Dorm name is required' });
    }
    if (gender && !['boys', 'girls'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be boys or girls' });
    }

    const result = await query(
      `INSERT INTO boarding_dorms (tenant_id, name, gender)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, String(name).trim(), gender || null]
    );

    const dorm = result.rows[0];
    await auditBoarding(req, tenantId, 'CREATE', 'BOARDING_DORM', dorm.id, `Dorm created: ${dorm.name}`);
    emitBoardingChanged(tenantId, 'dorm', 'created');
    res.status(201).json(dorm);
  } catch (error) {
    console.error('Create dorm error:', error);
    res.status(500).json({ error: 'Failed to create dorm' });
  }
});

router.put('/dorms/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const dormId = parseInt(req.params.id, 10);
    const { name, gender } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Dorm name is required' });
    }
    if (gender && !['boys', 'girls'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be boys or girls' });
    }

    const result = await query(
      `UPDATE boarding_dorms
       SET name = $1, gender = $2
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [String(name).trim(), gender || null, dormId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dorm not found' });
    }

    const dorm = result.rows[0];
    await auditBoarding(req, tenantId, 'UPDATE', 'BOARDING_DORM', dorm.id, `Dorm updated: ${dorm.name}`);
    emitBoardingChanged(tenantId, 'dorm', 'updated');
    res.json(dorm);
  } catch (error) {
    console.error('Update dorm error:', error);
    res.status(500).json({ error: 'Failed to update dorm' });
  }
});

router.delete('/dorms/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const dormId = parseInt(req.params.id, 10);

    const result = await query(
      `DELETE FROM boarding_dorms WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [dormId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dorm not found' });
    }

    const dorm = result.rows[0];
    await auditBoarding(req, tenantId, 'DELETE', 'BOARDING_DORM', dorm.id, `Dorm deleted: ${dorm.name}`);
    emitBoardingChanged(tenantId, 'dorm', 'deleted');
    res.json({ message: 'Dorm deleted successfully' });
  } catch (error) {
    console.error('Delete dorm error:', error);
    res.status(500).json({ error: 'Failed to delete dorm' });
  }
});

// ----------------------------------------------------
// ROOMS
// ----------------------------------------------------
router.get('/dorms/:dormId/rooms', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const dormId = parseInt(req.params.dormId, 10);

    if (!(await verifyDormTenant(dormId, tenantId))) {
      return res.status(404).json({ error: 'Dorm not found' });
    }

    const result = await query(
      `SELECT r.*,
         (SELECT COUNT(*)::int FROM boarding_beds b WHERE b.room_id = r.id) AS bed_count,
         (SELECT COUNT(*)::int FROM boarding_beds b WHERE b.room_id = r.id AND b.is_occupied) AS occupied_beds
       FROM boarding_rooms r
       WHERE r.dorm_id = $1
       ORDER BY r.room_name ASC`,
      [dormId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.post('/dorms/:dormId/rooms', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const dormId = parseInt(req.params.dormId, 10);
    const { room_name, capacity } = req.body;

    if (!(await verifyDormTenant(dormId, tenantId))) {
      return res.status(404).json({ error: 'Dorm not found' });
    }
    if (!room_name || !String(room_name).trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    const cap = parseInt(String(capacity), 10);
    if (!Number.isFinite(cap) || cap < 1) {
      return res.status(400).json({ error: 'Valid capacity is required' });
    }

    const result = await query(
      `INSERT INTO boarding_rooms (dorm_id, room_name, capacity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dormId, String(room_name).trim(), cap]
    );

    const room = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_ROOM',
      room.id,
      `Room created: ${room.room_name}`
    );
    emitBoardingChanged(tenantId, 'room', 'created');
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.put('/rooms/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const roomId = parseInt(req.params.id, 10);
    const { room_name, capacity } = req.body;

    if (!(await verifyRoomTenant(roomId, tenantId))) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!room_name || !String(room_name).trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    const cap = parseInt(String(capacity), 10);
    if (!Number.isFinite(cap) || cap < 1) {
      return res.status(400).json({ error: 'Valid capacity is required' });
    }

    const result = await query(
      `UPDATE boarding_rooms SET room_name = $1, capacity = $2 WHERE id = $3 RETURNING *`,
      [String(room_name).trim(), cap, roomId]
    );

    const room = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_ROOM',
      room.id,
      `Room updated: ${room.room_name}`
    );
    emitBoardingChanged(tenantId, 'room', 'updated');
    res.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

router.delete('/rooms/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const roomId = parseInt(req.params.id, 10);

    if (!(await verifyRoomTenant(roomId, tenantId))) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await query(`DELETE FROM boarding_rooms WHERE id = $1 RETURNING *`, [roomId]);
    const room = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'DELETE',
      'BOARDING_ROOM',
      room.id,
      `Room deleted: ${room.room_name}`
    );
    emitBoardingChanged(tenantId, 'room', 'deleted');
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ----------------------------------------------------
// BEDS
// ----------------------------------------------------
router.get('/rooms/:roomId/beds', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const roomId = parseInt(req.params.roomId, 10);

    if (!(await verifyRoomTenant(roomId, tenantId))) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await query(
      `SELECT b.*,
         be.student_id,
         s.first_name,
         s.last_name
       FROM boarding_beds b
       LEFT JOIN boarding_enrollments be ON be.bed_id = b.id AND be.status = 'boarder'
       LEFT JOIN students s ON be.student_id = s.id
       WHERE b.room_id = $1
       ORDER BY b.bed_number ASC`,
      [roomId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List beds error:', error);
    res.status(500).json({ error: 'Failed to fetch beds' });
  }
});

router.post('/rooms/:roomId/beds', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const roomId = parseInt(req.params.roomId, 10);
    const { bed_number } = req.body;

    if (!(await verifyRoomTenant(roomId, tenantId))) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!bed_number || !String(bed_number).trim()) {
      return res.status(400).json({ error: 'Bed number is required' });
    }

    const result = await query(
      `INSERT INTO boarding_beds (room_id, bed_number)
       VALUES ($1, $2)
       RETURNING *`,
      [roomId, String(bed_number).trim()]
    );

    const bed = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_BED',
      bed.id,
      `Bed created: ${bed.bed_number}`
    );
    emitBoardingChanged(tenantId, 'bed', 'created');
    res.status(201).json(bed);
  } catch (error: any) {
    console.error('Create bed error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bed number already exists in this room' });
    }
    res.status(500).json({ error: 'Failed to create bed' });
  }
});

router.put('/beds/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const bedId = parseInt(req.params.id, 10);
    const { bed_number } = req.body;

    if (!(await verifyBedTenant(bedId, tenantId))) {
      return res.status(404).json({ error: 'Bed not found' });
    }
    if (!bed_number || !String(bed_number).trim()) {
      return res.status(400).json({ error: 'Bed number is required' });
    }

    const result = await query(
      `UPDATE boarding_beds SET bed_number = $1 WHERE id = $2 RETURNING *`,
      [String(bed_number).trim(), bedId]
    );

    const bed = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_BED',
      bed.id,
      `Bed updated: ${bed.bed_number}`
    );
    emitBoardingChanged(tenantId, 'bed', 'updated');
    res.json(bed);
  } catch (error: any) {
    console.error('Update bed error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bed number already exists in this room' });
    }
    res.status(500).json({ error: 'Failed to update bed' });
  }
});

router.delete('/beds/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const bedId = parseInt(req.params.id, 10);

    if (!(await verifyBedTenant(bedId, tenantId))) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    const existing = await query('SELECT * FROM boarding_beds WHERE id = $1', [bedId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    if (existing.rows[0].is_occupied) {
      await freeBed(bedId);
    }

    const result = await query(`DELETE FROM boarding_beds WHERE id = $1 RETURNING *`, [bedId]);
    const bed = result.rows[0];
    await auditBoarding(
      req,
      tenantId,
      'DELETE',
      'BOARDING_BED',
      bed.id,
      `Bed deleted: ${bed.bed_number}`
    );
    emitBoardingChanged(tenantId, 'bed', 'deleted');
    res.json({ message: 'Bed deleted successfully' });
  } catch (error) {
    console.error('Delete bed error:', error);
    res.status(500).json({ error: 'Failed to delete bed' });
  }
});

// ----------------------------------------------------
// ENROLLMENTS
// ----------------------------------------------------
router.get('/enrollments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { term_id, dorm_id, class_id } = req.query;

    const conditions = ['be.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let p = 2;

    if (term_id) {
      conditions.push(`be.term_id = $${p++}`);
      params.push(parseInt(String(term_id), 10));
    }
    if (dorm_id) {
      conditions.push(`be.dorm_id = $${p++}`);
      params.push(parseInt(String(dorm_id), 10));
    }
    if (class_id) {
      conditions.push(`s.class_assigned_id = $${p++}`);
      params.push(parseInt(String(class_id), 10));
    }

    const result = await query(
      `SELECT be.*,
         s.first_name, s.last_name, s.passport_photo_url, s.gender,
         c.class_name, c.level, s.class_assigned_id,
         bd.name AS dorm_name,
         br.room_name,
         bb.bed_number,
         (
           SELECT COALESCE(btf.lodging_amount, 0) + COALESCE(btf.feeding_amount, 0)
           FROM boarding_term_fees btf
           WHERE btf.tenant_id = be.tenant_id
             AND btf.term_id = be.term_id
             AND btf.is_active = true
           LIMIT 1
         ) AS boarding_fee_configured,
         (
           SELECT COALESCE(SUM(
             CASE
               WHEN sl.entry_type IN ('boarding_fee', 'boarding_feeding') THEN sl.debit
               WHEN sl.entry_type IN ('boarding_fee_void', 'boarding_feeding_void') THEN -sl.credit
               ELSE 0
             END
           ), 0)
           FROM student_ledger sl
           WHERE sl.tenant_id = be.tenant_id
             AND sl.student_id = be.student_id
             AND sl.term_id = be.term_id
             AND sl.entry_type IN (
               'boarding_fee', 'boarding_fee_void',
               'boarding_feeding', 'boarding_feeding_void'
             )
         ) AS boarding_fee_applied
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN boarding_dorms bd ON be.dorm_id = bd.id
       LEFT JOIN boarding_rooms br ON be.room_id = br.id
       LEFT JOIN boarding_beds bb ON be.bed_id = bb.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.first_name ASC, s.last_name ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

router.get('/fees/term', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    let termId = req.query.term_id ? parseInt(String(req.query.term_id), 10) : null;
    if (!termId) {
      termId = await getCurrentTermId(tenantId);
    }
    if (!termId) {
      return res.status(400).json({ error: 'No current term found' });
    }

    const row = await getBoardingTermFee(tenantId, termId);
    res.json({
      term_id: termId,
      amount: row?.amount ?? 0,
      lodging_amount: row?.lodging_amount ?? 0,
      feeding_amount: row?.feeding_amount ?? 0,
      is_active: row?.is_active ?? false,
      is_configured: Boolean(row?.is_active && Number(row?.amount) > 0),
    });
  } catch (error) {
    console.error('Get boarding term fee error:', error);
    res.status(500).json({ error: 'Failed to fetch boarding fee' });
  }
});

router.put('/fees/term', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { amount, lodging_amount, lodgingAmount, feeding_amount, feedingAmount, is_active } = req.body ?? {};
    const parsedLodging = Number(lodging_amount ?? lodgingAmount);
    const parsedFeeding = Number(feeding_amount ?? feedingAmount);
    const parsedLegacyAmount = Number(amount);
    let lodging = parsedLodging;
    let feeding = parsedFeeding;
    if (!Number.isFinite(lodging) && Number.isFinite(parsedLegacyAmount)) {
      lodging = parsedLegacyAmount;
      feeding = 0;
    }
    if (!Number.isFinite(lodging)) lodging = 0;
    if (!Number.isFinite(feeding)) feeding = 0;
    if (lodging <= 0 && feeding <= 0) {
      return res.status(400).json({ error: 'Enter at least one amount greater than 0 (lodging or feeding)' });
    }

    let termId = req.body?.term_id ? parseInt(String(req.body.term_id), 10) : null;
    if (!termId) {
      termId = await getCurrentTermId(tenantId);
    }
    if (!termId) {
      return res.status(400).json({ error: 'No current term found' });
    }

    const saved = await upsertBoardingTermFee(
      tenantId,
      termId,
      lodging,
      feeding,
      typeof is_active === 'boolean' ? is_active : true
    );

    res.json({
      term_id: saved.term_id,
      amount: saved.amount,
      lodging_amount: saved.lodging_amount,
      feeding_amount: saved.feeding_amount,
      is_active: saved.is_active,
      is_configured: saved.is_active && saved.amount > 0,
    });
  } catch (error) {
    console.error('Save boarding term fee error:', error);
    res.status(500).json({ error: 'Failed to save boarding fee' });
  }
});

router.get('/fees/preview', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.query.student_id ?? ''), 10);
    if (!studentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    let termId = req.query.term_id ? parseInt(String(req.query.term_id), 10) : null;
    if (!termId) {
      termId = await getCurrentTermId(tenantId);
    }
    if (!termId) {
      return res.status(400).json({ error: 'No current term found' });
    }

    const configured = await getBoardingTermFee(tenantId, termId);
    const applied = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);

    res.json({
      student_id: studentId,
      term_id: termId,
      configured_amount: configured?.amount ?? 0,
      configured_lodging: configured?.lodging_amount ?? 0,
      configured_feeding: configured?.feeding_amount ?? 0,
      applied_amount: applied.total,
      applied_lodging: applied.lodging,
      applied_feeding: applied.feeding,
      is_configured: (configured?.amount ?? 0) > 0,
      is_applied: applied.total > 0,
    });
  } catch (error) {
    console.error('Boarding fee preview error:', error);
    res.status(500).json({ error: 'Failed to preview boarding fee' });
  }
});

router.post('/enrollments', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, status, dorm_id, room_id, bed_id, start_date, term_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'Student is required' });
    }
    const enrollmentStatus = status === 'boarder' ? 'boarder' : 'day';
    const resolvedTermId = term_id ? parseInt(String(term_id), 10) : await getCurrentTermId(tenantId);

    if (!resolvedTermId) {
      return res.status(400).json({ error: 'No current term found. Specify term_id.' });
    }

    const studentCheck = await query(
      'SELECT id, first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (enrollmentStatus === 'boarder') {
      if (!dorm_id || !room_id || !bed_id) {
        return res.status(400).json({ error: 'Dorm, room, and bed are required for boarders' });
      }
      const genderError = await validateEnrollmentGenderMatch(
        parseInt(String(student_id), 10),
        parseInt(String(dorm_id), 10),
        tenantId
      );
      if (genderError) {
        return res.status(400).json({ error: genderError });
      }
      if (!(await verifyBedTenant(parseInt(String(bed_id), 10), tenantId))) {
        return res.status(400).json({ error: 'Bed not found' });
      }
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT * FROM boarding_enrollments WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
      [tenantId, student_id, resolvedTermId]
    );

    if (existing.rows.length > 0 && existing.rows[0].bed_id) {
      await closeBedHistory(client, {
        bedId: existing.rows[0].bed_id,
        studentId: existing.rows[0].student_id,
        tenantId,
        reason: 'transferred',
      });
      await freeBed(existing.rows[0].bed_id);
    }

    let enrollment;
    if (existing.rows.length > 0) {
      const upd = await client.query(
        `UPDATE boarding_enrollments
         SET status = $1, dorm_id = $2, room_id = $3, bed_id = $4, start_date = $5
         WHERE id = $6
         RETURNING *`,
        [
          enrollmentStatus,
          dorm_id || null,
          room_id || null,
          bed_id || null,
          start_date || null,
          existing.rows[0].id,
        ]
      );
      enrollment = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO boarding_enrollments
           (tenant_id, student_id, term_id, status, dorm_id, room_id, bed_id, start_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          student_id,
          resolvedTermId,
          enrollmentStatus,
          dorm_id || null,
          room_id || null,
          bed_id || null,
          start_date || null,
        ]
      );
      enrollment = ins.rows[0];
    }

    if (enrollmentStatus === 'boarder' && bed_id) {
      const occupy = await occupyBed(parseInt(String(bed_id), 10), tenantId);
      if (!occupy.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: occupy.error });
      }
      await logBedAssignment(client, {
        bedId: parseInt(String(bed_id), 10),
        studentId: parseInt(String(student_id), 10),
        tenantId,
        termId: resolvedTermId,
        assignedDate: start_date || null,
        reason: 'enrolled',
      });
    }

    await client.query('COMMIT');

    const studentName = `${studentCheck.rows[0].first_name} ${studentCheck.rows[0].last_name}`;
    let feeResult: Awaited<ReturnType<typeof applyBoardingFeeToStudent>> | Awaited<
      ReturnType<typeof removeBoardingFeeFromStudent>
    > | null = null;

    if (enrollmentStatus === 'boarder' && bed_id) {
      feeResult = await applyBoardingFeeToStudent(tenantId, parseInt(String(student_id), 10), resolvedTermId);
    } else {
      feeResult = await removeBoardingFeeFromStudent(
        tenantId,
        parseInt(String(student_id), 10),
        resolvedTermId,
        { studentName, notifyAdmin: true }
      );
    }

    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_ENROLLMENT',
      enrollment.id,
      `Boarding enrollment: ${studentName} (${enrollmentStatus})`,
      { studentId: student_id, status: enrollmentStatus, termId: resolvedTermId, feeResult }
    );
    emitBoardingChanged(tenantId, 'enrollment', 'created');
    res.status(201).json({ ...enrollment, feeResult });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create enrollment error:', error);
    res.status(500).json({ error: 'Failed to create enrollment' });
  } finally {
    client.release();
  }
});

router.put('/enrollments/:id/convert', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const enrollmentId = parseInt(req.params.id, 10);
    const { status, dorm_id, room_id, bed_id, start_date } = req.body;

    const existingRes = await query(
      `SELECT be.*, s.first_name, s.last_name
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       WHERE be.id = $1 AND be.tenant_id = $2`,
      [enrollmentId, tenantId]
    );
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const existing = existingRes.rows[0];
    const newStatus = status === 'boarder' ? 'boarder' : 'day';
    const prevStatus = existing.status;
    const prevBedId = existing.bed_id ? parseInt(String(existing.bed_id), 10) : null;
    const newBedId = bed_id ? parseInt(String(bed_id), 10) : null;

    if (newStatus === 'boarder') {
      if (!dorm_id || !room_id || !bed_id) {
        return res.status(400).json({ error: 'Dorm, room, and bed are required for boarders' });
      }
      const genderError = await validateEnrollmentGenderMatch(
        existing.student_id,
        parseInt(String(dorm_id), 10),
        tenantId
      );
      if (genderError) {
        return res.status(400).json({ error: genderError });
      }
      if (!(await verifyBedTenant(newBedId!, tenantId))) {
        return res.status(400).json({ error: 'Bed not found' });
      }
    }

    await client.query('BEGIN');

    if (prevBedId && (newStatus === 'day' || newBedId !== prevBedId)) {
      await closeBedHistory(client, {
        bedId: prevBedId,
        studentId: existing.student_id,
        tenantId,
        reason: newStatus === 'day' ? 'converted_to_day' : 'transferred',
      });
      await client.query('UPDATE boarding_beds SET is_occupied = false WHERE id = $1', [prevBedId]);
    }

    const result = await client.query(
      `UPDATE boarding_enrollments
       SET status = $1, dorm_id = $2, room_id = $3, bed_id = $4, start_date = $5,
           converted_from = $6
       WHERE id = $7
       RETURNING *`,
      [
        newStatus,
        newStatus === 'boarder' ? dorm_id : null,
        newStatus === 'boarder' ? room_id : null,
        newStatus === 'boarder' ? bed_id : null,
        start_date || existing.start_date,
        prevStatus !== newStatus ? prevStatus : existing.converted_from,
        enrollmentId,
      ]
    );

    const enrollment = result.rows[0];
    const studentName = `${existing.first_name} ${existing.last_name}`.trim();
    let feeResult: Awaited<ReturnType<typeof applyBoardingFeeToStudent>> | Awaited<
      ReturnType<typeof removeBoardingFeeFromStudent>
    > | null = null;

    if (newStatus === 'boarder' && newBedId) {
      const occupyCheck = await client.query(
        `SELECT is_occupied FROM boarding_beds WHERE id = $1`,
        [newBedId]
      );
      if (occupyCheck.rows[0]?.is_occupied && newBedId !== prevBedId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Bed is already occupied' });
      }
      await client.query('UPDATE boarding_beds SET is_occupied = true WHERE id = $1', [newBedId]);
      if (newBedId !== prevBedId) {
        await logBedAssignment(client, {
          bedId: newBedId,
          studentId: existing.student_id,
          tenantId,
          termId: existing.term_id,
          reason: prevStatus === 'boarder' ? 'transferred' : 'enrolled',
        });
      }
      feeResult = await applyBoardingFeeToStudent(tenantId, existing.student_id, existing.term_id);
    } else if (prevStatus === 'boarder' && newStatus === 'day') {
      feeResult = await removeBoardingFeeFromStudent(tenantId, existing.student_id, existing.term_id, {
        studentName,
        notifyAdmin: true,
      });
    }

    await client.query('COMMIT');

    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_ENROLLMENT',
      enrollment.id,
      `Boarding status converted: ${studentName} (${prevStatus} → ${newStatus})`,
      { studentId: existing.student_id, from: prevStatus, to: newStatus, feeResult }
    );
    emitBoardingChanged(tenantId, 'enrollment', 'updated');
    res.json({ ...enrollment, feeResult });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Convert enrollment error:', error);
    res.status(500).json({ error: 'Failed to convert enrollment' });
  } finally {
    client.release();
  }
});

router.delete('/enrollments/:id', requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const enrollmentId = parseInt(req.params.id, 10);

    const existingRes = await query(
      `SELECT be.*, s.first_name, s.last_name
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       WHERE be.id = $1 AND be.tenant_id = $2`,
      [enrollmentId, tenantId]
    );
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const existing = existingRes.rows[0];
    const studentName = `${existing.first_name} ${existing.last_name}`.trim();
    let feeResult: Awaited<ReturnType<typeof removeBoardingFeeFromStudent>> | null = null;

    await client.query('BEGIN');

    if (existing.bed_id) {
      await closeBedHistory(client, {
        bedId: existing.bed_id,
        studentId: existing.student_id,
        tenantId,
        reason: 'unenrolled',
      });
      await client.query('UPDATE boarding_beds SET is_occupied = false WHERE id = $1', [
        existing.bed_id,
      ]);
    }

    if (existing.status === 'boarder') {
      feeResult = await removeBoardingFeeFromStudent(tenantId, existing.student_id, existing.term_id, {
        studentName,
        notifyAdmin: true,
      });
    }

    await client.query('DELETE FROM boarding_enrollments WHERE id = $1', [enrollmentId]);
    await client.query('COMMIT');

    await auditBoarding(
      req,
      tenantId,
      'DELETE',
      'BOARDING_ENROLLMENT',
      enrollmentId,
      `Boarding enrollment removed: ${studentName}`,
      { studentId: existing.student_id, feeResult }
    );
    emitBoardingChanged(tenantId, 'enrollment', 'deleted');
    res.json({ message: 'Enrollment deleted successfully', feeResult });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete enrollment error:', error);
    res.status(500).json({ error: 'Failed to delete enrollment' });
  } finally {
    client.release();
  }
});

/** POST /api/boarding/sync-fees — repair boarding fee lines for all enrollments in a term */
router.post('/sync-fees', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    let termId = req.body?.term_id ? parseInt(String(req.body.term_id), 10) : null;
    if (!termId) {
      termId = await getCurrentTermId(tenantId);
    }
    if (!termId) {
      return res.status(400).json({ error: 'No current term found' });
    }

    const result = await syncAllBoardingFees(tenantId, termId);
    emitBoardingChanged(tenantId, 'fees', 'updated');
    res.json(result);
  } catch (error) {
    console.error('Sync boarding fees error:', error);
    res.status(500).json({ error: 'Failed to sync boarding fees' });
  }
});

// ----------------------------------------------------
// EXEATS
// ----------------------------------------------------
router.get('/exeats/overdue', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT e.*,
         s.first_name, s.last_name, s.passport_photo_url,
         c.class_name,
         GREATEST(0, CURRENT_DATE - e.return_date)::int AS days_overdue
       FROM boarding_exeats e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE e.tenant_id = $1 AND e.status = 'overdue'
       ORDER BY e.return_date ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Overdue exeats error:', error);
    res.status(500).json({ error: 'Failed to fetch overdue exeats' });
  }
});

router.get('/exeats', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { status } = req.query;

    const conditions = ['e.tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (status) {
      conditions.push('e.status = $2');
      params.push(String(status));
    }

    const result = await query(
      `SELECT e.*,
         s.first_name, s.last_name, s.passport_photo_url,
         c.class_name,
         u.full_name AS approved_by_name
       FROM boarding_exeats e
       JOIN students s ON e.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN users u ON e.approved_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List exeats error:', error);
    res.status(500).json({ error: 'Failed to fetch exeats' });
  }
});

router.post('/exeats', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const {
      student_id,
      guardian_name,
      guardian_phone,
      destination,
      departure_date,
      return_date,
      notes,
      type,
    } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'Student is required' });
    }

    const studentCheck = await query(
      'SELECT id, first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const exeatType = type === 'weekend' ? 'weekend' : 'exeat';

    const result = await query(
      `INSERT INTO boarding_exeats
         (tenant_id, student_id, guardian_name, guardian_phone, destination, departure_date, return_date, notes, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        student_id,
        guardian_name || null,
        guardian_phone || null,
        destination || null,
        departure_date || null,
        return_date || null,
        notes || null,
        exeatType,
      ]
    );

    const exeat = result.rows[0];
    const studentName = `${studentCheck.rows[0].first_name} ${studentCheck.rows[0].last_name}`;
    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_EXEAT',
      exeat.id,
      `Exeat requested: ${studentName}`,
      { studentId: student_id }
    );
    emitBoardingChanged(tenantId, 'exeat', 'created');
    res.status(201).json(exeat);
  } catch (error) {
    console.error('Create exeat error:', error);
    res.status(500).json({ error: 'Failed to create exeat' });
  }
});

router.put('/exeats/:id/approve', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const exeatId = parseInt(req.params.id, 10);
    const role = String(req.user!.role || '').toLowerCase();

    const pending = await query(
      `SELECT type FROM boarding_exeats WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [exeatId, tenantId]
    );
    if (pending.rows.length === 0) {
      return res.status(404).json({ error: 'Pending exeat not found' });
    }
    const exeatType = String(pending.rows[0].type || 'exeat');
    if (exeatType === 'exeat' && !['house-master', 'administrator', 'super-admin'].includes(role)) {
      return res.status(403).json({ error: 'Official exeats require House Master or Admin approval' });
    }

    const result = await query(
      `UPDATE boarding_exeats
       SET status = 'approved', approved_by = $1
       WHERE id = $2 AND tenant_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user!.id, exeatId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending exeat not found' });
    }

    await auditBoarding(req, tenantId, 'UPDATE', 'BOARDING_EXEAT', exeatId, 'Exeat approved');
    emitBoardingChanged(tenantId, 'exeat', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Approve exeat error:', error);
    res.status(500).json({ error: 'Failed to approve exeat' });
  }
});

router.put('/exeats/:id/reject', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const exeatId = parseInt(req.params.id, 10);
    const { notes } = req.body ?? {};

    const result = await query(
      `UPDATE boarding_exeats
       SET status = 'rejected', approved_by = $1, notes = COALESCE($2, notes)
       WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
       RETURNING *`,
      [req.user!.id, notes || null, exeatId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending exeat not found' });
    }

    await auditBoarding(req, tenantId, 'UPDATE', 'BOARDING_EXEAT', exeatId, 'Exeat rejected');
    emitBoardingChanged(tenantId, 'exeat', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Reject exeat error:', error);
    res.status(500).json({ error: 'Failed to reject exeat' });
  }
});

router.put('/exeats/:id/signout', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const exeatId = parseInt(req.params.id, 10);

    const result = await query(
      `UPDATE boarding_exeats
       SET status = 'signed_out'
       WHERE id = $1 AND tenant_id = $2 AND status = 'approved'
       RETURNING *`,
      [exeatId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approved exeat not found' });
    }

    await auditBoarding(req, tenantId, 'UPDATE', 'BOARDING_EXEAT', exeatId, 'Student signed out on exeat');
    emitBoardingChanged(tenantId, 'exeat', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Sign out exeat error:', error);
    res.status(500).json({ error: 'Failed to sign out exeat' });
  }
});

router.put('/exeats/:id/return', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const exeatId = parseInt(req.params.id, 10);
    const { actual_return_date } = req.body ?? {};

    const result = await query(
      `UPDATE boarding_exeats
       SET status = 'returned', actual_return_date = COALESCE($1::date, CURRENT_DATE)
       WHERE id = $2 AND tenant_id = $3 AND status IN ('approved', 'signed_out')
       RETURNING *`,
      [actual_return_date || null, exeatId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active exeat not found' });
    }

    await auditBoarding(req, tenantId, 'UPDATE', 'BOARDING_EXEAT', exeatId, 'Student returned from exeat');
    emitBoardingChanged(tenantId, 'exeat', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Return exeat error:', error);
    res.status(500).json({ error: 'Failed to record exeat return' });
  }
});

// ----------------------------------------------------
// ROLL CALL
// ----------------------------------------------------
router.get('/rollcall', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { dorm_id, from, to, date } = req.query;
    const dateFilter = date || from;

    const conditions = ['rc.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let p = 2;

    if (dorm_id) {
      conditions.push(`rc.dorm_id = $${p++}`);
      params.push(parseInt(String(dorm_id), 10));
    }
    if (dateFilter) {
      conditions.push(`rc.roll_call_date = $${p++}::date`);
      params.push(String(dateFilter));
    } else {
      if (from) {
        conditions.push(`rc.roll_call_date >= $${p++}`);
        params.push(String(from));
      }
      if (to) {
        conditions.push(`rc.roll_call_date <= $${p++}`);
        params.push(String(to));
      }
    }

    const result = await query(
      `SELECT rc.*,
         bd.name AS dorm_name,
         u.full_name AS created_by_name,
         (SELECT COUNT(*)::int FROM boarding_roll_call_entries e WHERE e.roll_call_id = rc.id) AS entry_count,
         (SELECT COUNT(*)::int FROM boarding_roll_call_entries e
          WHERE e.roll_call_id = rc.id AND e.status = 'present') AS present_count,
         (SELECT COUNT(*)::int FROM boarding_roll_call_entries e
          WHERE e.roll_call_id = rc.id AND e.status = 'absent') AS absent_count
       FROM boarding_roll_calls rc
       LEFT JOIN boarding_dorms bd ON rc.dorm_id = bd.id
       LEFT JOIN users u ON rc.created_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY rc.roll_call_date DESC, rc.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List roll calls error:', error);
    res.status(500).json({ error: 'Failed to fetch roll calls' });
  }
});

router.post('/rollcall', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { dorm_id, roll_call_date } = req.body;

    if (dorm_id && !(await verifyDormTenant(parseInt(String(dorm_id), 10), tenantId))) {
      return res.status(404).json({ error: 'Dorm not found' });
    }

    const result = await query(
      `INSERT INTO boarding_roll_calls (tenant_id, dorm_id, roll_call_date, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4)
       ON CONFLICT (tenant_id, dorm_id, roll_call_date) DO UPDATE SET created_by = EXCLUDED.created_by
       RETURNING *`,
      [tenantId, dorm_id || null, roll_call_date || null, req.user!.id]
    );

    const rollCall = result.rows[0];
    await seedRollCallEntries(rollCall.id, tenantId, rollCall.dorm_id ?? null);

    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_ROLL_CALL',
      rollCall.id,
      `Roll call session created for ${roll_call_date || 'today'}`
    );
    emitBoardingChanged(tenantId, 'rollcall', 'created');
    res.status(201).json(rollCall);
  } catch (error) {
    console.error('Create roll call error:', error);
    res.status(500).json({ error: 'Failed to create roll call' });
  }
});

router.get('/rollcall/:id/entries', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rollCallId = parseInt(req.params.id, 10);

    const rollCallCheck = await query(
      'SELECT id FROM boarding_roll_calls WHERE id = $1 AND tenant_id = $2',
      [rollCallId, tenantId]
    );
    if (rollCallCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Roll call not found' });
    }

    const rollCallMeta = await query(
      'SELECT dorm_id, tenant_id FROM boarding_roll_calls WHERE id = $1',
      [rollCallId]
    );
    const dormId = rollCallMeta.rows[0]?.dorm_id ?? null;
    const rollTenantId = rollCallMeta.rows[0]?.tenant_id;

    let result = await fetchRollCallEntries(rollCallId);
    if (result.rows.length === 0 && rollTenantId) {
      await seedRollCallEntries(rollCallId, rollTenantId, dormId);
      result = await fetchRollCallEntries(rollCallId);
    }
    res.json(result.rows);
  } catch (error) {
    console.error('List roll call entries error:', error);
    res.status(500).json({ error: 'Failed to fetch roll call entries' });
  }
});

router.post('/rollcall/:id/entries', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rollCallId = parseInt(req.params.id, 10);
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const rollCallRes = await query(
      'SELECT * FROM boarding_roll_calls WHERE id = $1 AND tenant_id = $2',
      [rollCallId, tenantId]
    );
    if (rollCallRes.rows.length === 0) {
      return res.status(404).json({ error: 'Roll call not found' });
    }

    const rollCall = rollCallRes.rows[0];
    const rollDate = rollCall.roll_call_date;

    const saved = [];
    for (const entry of entries) {
      const studentId = parseInt(String(entry.student_id), 10);
      const entryStatus = entry.status === 'absent' ? 'absent' : 'present';
      let flagged = false;

      if (entryStatus === 'absent') {
        if (entry.flagged === true || entry.flagged === false) {
          flagged = Boolean(entry.flagged);
        } else {
          const hasExeat = await studentHasApprovedExeat(tenantId, studentId, rollDate);
          flagged = !hasExeat;
        }
      }

      const result = await query(
        `INSERT INTO boarding_roll_call_entries (roll_call_id, student_id, status, flagged, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (roll_call_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, flagged = EXCLUDED.flagged, note = EXCLUDED.note
         RETURNING *`,
        [rollCallId, studentId, entryStatus, flagged, entry.note || null]
      );
      saved.push(result.rows[0]);
    }

    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_ROLL_CALL',
      rollCallId,
      `Roll call entries saved (${saved.length})`
    );
    emitBoardingChanged(tenantId, 'rollcall', 'updated');
    res.json(saved);
  } catch (error) {
    console.error('Save roll call entries error:', error);
    res.status(500).json({ error: 'Failed to save roll call entries' });
  }
});

// ----------------------------------------------------
// FEEDING — weekly menu (Mon–Fri)
// ----------------------------------------------------
router.get('/feeding/menu', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const menu = await getWeeklyMenu(tenantId);
    res.json(menu);
  } catch (error) {
    console.error('Get weekly menu error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly menu' });
  }
});

router.put('/feeding/menu', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const menu = await saveWeeklyMenu(tenantId, items);
    emitBoardingChanged(tenantId, 'feeding', 'updated');
    res.json(menu);
  } catch (error) {
    console.error('Save weekly menu error:', error);
    res.status(500).json({ error: 'Failed to save weekly menu' });
  }
});

// Legacy meal attendance (kept for data migration; not used in UI)
router.get('/feeding', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { from, to, meal_type } = req.query;

    const conditions = ['ma.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let p = 2;

    if (from) {
      conditions.push(`ma.meal_date >= $${p++}`);
      params.push(String(from));
    }
    if (to) {
      conditions.push(`ma.meal_date <= $${p++}`);
      params.push(String(to));
    }
    if (meal_type) {
      conditions.push(`ma.meal_type = $${p++}`);
      params.push(String(meal_type));
    }

    const result = await query(
      `SELECT ma.*,
         s.first_name, s.last_name, s.passport_photo_url,
         c.class_name
       FROM boarding_meal_attendance ma
       JOIN students s ON ma.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ma.meal_date DESC, ma.meal_type ASC, s.first_name ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List feeding records error:', error);
    res.status(500).json({ error: 'Failed to fetch feeding records' });
  }
});

router.post('/feeding', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { meal_date, entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const date = meal_date || new Date().toISOString().slice(0, 10);
    const saved = [];

    for (const entry of entries) {
      const studentId = parseInt(String(entry.student_id), 10);
      const mealType = entry.meal_type;
      const mealStatus = entry.status === 'absent' ? 'absent' : 'present';

      if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
        continue;
      }

      const studentCheck = await query(
        'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
        [studentId, tenantId]
      );
      if (studentCheck.rows.length === 0) continue;

      const result = await query(
        `INSERT INTO boarding_meal_attendance (tenant_id, student_id, meal_date, meal_type, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, student_id, meal_date, meal_type)
         DO UPDATE SET status = EXCLUDED.status
         RETURNING *`,
        [tenantId, studentId, date, mealType, mealStatus]
      );
      saved.push(result.rows[0]);
    }

    if (saved.length === 0) {
      return res.status(400).json({ error: 'No valid entries to save' });
    }

    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_FEEDING',
      0,
      `Meal attendance recorded (${saved.length} entries)`
    );
    emitBoardingChanged(tenantId, 'feeding', 'updated');
    res.status(201).json(saved);
  } catch (error) {
    console.error('Save feeding records error:', error);
    res.status(500).json({ error: 'Failed to save feeding records' });
  }
});

// ----------------------------------------------------
// SICK BAY
// ----------------------------------------------------
router.get('/sickbay', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { status } = req.query;

    const conditions = ['sb.tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (status) {
      conditions.push('sb.status = $2');
      params.push(String(status));
    }

    const result = await query(
      `SELECT sb.*,
         s.first_name, s.last_name, s.passport_photo_url,
         c.class_name,
         bd.name AS dorm_name,
         u.full_name AS created_by_name
       FROM boarding_sick_bay sb
       JOIN students s ON sb.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN boarding_enrollments be ON be.student_id = s.id
         AND be.tenant_id = sb.tenant_id
         AND be.status = 'boarder'
         AND be.term_id = (SELECT id FROM terms WHERE tenant_id = sb.tenant_id AND is_current = true LIMIT 1)
       LEFT JOIN boarding_dorms bd ON be.dorm_id = bd.id
       LEFT JOIN users u ON sb.created_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sb.reported_date DESC, sb.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List sick bay records error:', error);
    res.status(500).json({ error: 'Failed to fetch sick bay records' });
  }
});

router.post('/sickbay', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, reported_date, symptoms, action_taken, status } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'Student is required' });
    }

    const studentCheck = await query(
      'SELECT id, first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await query(
      `INSERT INTO boarding_sick_bay
         (tenant_id, student_id, reported_date, symptoms, action_taken, status, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [
        tenantId,
        student_id,
        reported_date || null,
        symptoms || null,
        action_taken || null,
        status || 'resting',
        req.user!.id,
      ]
    );

    const record = result.rows[0];
    const studentName = `${studentCheck.rows[0].first_name} ${studentCheck.rows[0].last_name}`;
    await auditBoarding(
      req,
      tenantId,
      'CREATE',
      'BOARDING_SICK_BAY',
      record.id,
      `Sick bay admission: ${studentName}`
    );
    emitBoardingChanged(tenantId, 'sickbay', 'created');
    res.status(201).json(record);
  } catch (error) {
    console.error('Create sick bay record error:', error);
    res.status(500).json({ error: 'Failed to create sick bay record' });
  }
});

router.put('/sickbay/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const recordId = parseInt(req.params.id, 10);
    const { symptoms, action_taken, status, resolved_date } = req.body;

    const resolvedStatus = status || 'resting';
    const resolvedDateValue =
      resolved_date ||
      (['sent_home', 'recovered'].includes(resolvedStatus) ? new Date().toISOString().slice(0, 10) : null);

    const result = await query(
      `UPDATE boarding_sick_bay
       SET symptoms = COALESCE($1, symptoms),
           action_taken = COALESCE($2, action_taken),
           status = $3,
           resolved_date = COALESCE($4::date, resolved_date)
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [symptoms || null, action_taken || null, resolvedStatus, resolvedDateValue, recordId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sick bay record not found' });
    }

    await auditBoarding(
      req,
      tenantId,
      'UPDATE',
      'BOARDING_SICK_BAY',
      recordId,
      `Sick bay record updated (${resolvedStatus})`
    );
    emitBoardingChanged(tenantId, 'sickbay', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update sick bay record error:', error);
    res.status(500).json({ error: 'Failed to update sick bay record' });
  }
});

// ----------------------------------------------------
// STUDENT SUMMARY
// ----------------------------------------------------
router.get('/students/:studentId/summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(req.params.studentId, 10);

    const studentCheck = await query(
      'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
      [studentId, tenantId]
    );
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const termId = await getCurrentTermId(tenantId);

    const enrollmentRes = await query(
      `SELECT be.*,
         bd.name AS dorm_name,
         br.room_name,
         bb.bed_number
       FROM boarding_enrollments be
       LEFT JOIN boarding_dorms bd ON be.dorm_id = bd.id
       LEFT JOIN boarding_rooms br ON be.room_id = br.id
       LEFT JOIN boarding_beds bb ON be.bed_id = bb.id
       WHERE be.tenant_id = $1 AND be.student_id = $2
         AND ($3::int IS NULL OR be.term_id = $3)
       ORDER BY be.created_at DESC
       LIMIT 1`,
      [tenantId, studentId, termId]
    );

    const exeatsRes = await query(
      `SELECT * FROM boarding_exeats
       WHERE tenant_id = $1 AND student_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [tenantId, studentId]
    );

    const sickBayRes = await query(
      `SELECT * FROM boarding_sick_bay
       WHERE tenant_id = $1 AND student_id = $2
       ORDER BY reported_date DESC
       LIMIT 10`,
      [tenantId, studentId]
    );

    const rollSummaryRes = await query(
      `SELECT e.status,
         COUNT(*)::int AS count
       FROM boarding_roll_call_entries e
       JOIN boarding_roll_calls rc ON e.roll_call_id = rc.id
       WHERE rc.tenant_id = $1 AND e.student_id = $2
         AND rc.roll_call_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY e.status`,
      [tenantId, studentId]
    );

    const rollSummaryRows = rollSummaryRes.rows;
    let rollPresent = 0;
    let rollAbsent = 0;
    let rollFlagged = 0;
    for (const r of rollSummaryRows) {
      if (r.status === 'present') rollPresent += Number(r.count) || 0;
      if (r.status === 'absent') rollAbsent += Number(r.count) || 0;
    }

    const flaggedRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM boarding_roll_call_entries e
       JOIN boarding_roll_calls rc ON e.roll_call_id = rc.id
       WHERE rc.tenant_id = $1 AND e.student_id = $2
         AND rc.roll_call_date >= CURRENT_DATE - INTERVAL '30 days'
         AND e.flagged = true`,
      [tenantId, studentId]
    );
    rollFlagged = flaggedRes.rows[0]?.count ?? 0;

    const complaintsRes = await query(
      `SELECT id, title, severity, status, parent_summary, created_at
       FROM boarding_complaints
       WHERE tenant_id = $1 AND student_id = $2
       ORDER BY created_at DESC LIMIT 10`,
      [tenantId, studentId]
    );

    const weeklyMenu = await getWeeklyMenu(tenantId);

    res.json({
      enrollment: enrollmentRes.rows[0] || null,
      recent_exeats: exeatsRes.rows,
      sick_bay_records: sickBayRes.rows,
      roll_call_summary: { present: rollPresent, absent: rollAbsent, flagged: rollFlagged },
      weekly_menu: weeklyMenu,
      complaints: complaintsRes.rows,
      // legacy keys for older clients
      exeats: exeatsRes.rows,
      sick_bay: sickBayRes.rows,
      roll_call_summary_rows: rollSummaryRows,
    });
  } catch (error) {
    console.error('Student boarding summary error:', error);
    res.status(500).json({ error: 'Failed to fetch student boarding summary' });
  }
});

router.get('/beds/:id/history', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const bedId = parseInt(req.params.id, 10);
    if (!(await verifyBedTenant(bedId, tenantId))) {
      return res.status(404).json({ error: 'Bed not found' });
    }
    const history = await getBedHistory(bedId, tenantId);
    res.json(history);
  } catch (error) {
    console.error('Bed history error:', error);
    res.status(500).json({ error: 'Failed to fetch bed history' });
  }
});

router.use(boardingStaffRoutes);

export default router;
