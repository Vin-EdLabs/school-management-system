import express from 'express';
import { query, getClient } from '../db/connection.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  requireBoardingStaff,
  requireHouseMasterPlus,
  requireBoardingAdmin,
  requireBoardingComplaintResolver,
  isBoardingComplaintResolver,
  isBoardingComplaintFiler,
  BOARDING_COMPLAINT_FILER_ROLES,
} from '../middleware/boardingRoleMiddleware.js';
import { requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import { getIO } from '../socket.js';
import {
  applyBoardingFeeToStudent,
  getBoardingFeeBreakdownForStudent,
} from '../services/boardingFeeService.js';
import { getStudentBalanceFromLedger } from '../services/ledgerBalanceService.js';
import { notifyHighSeverityComplaintWhatsApp } from '../services/boardingWhatsAppService.js';
import { logBedAssignment } from '../services/boardingBedHistoryService.js';

const router = express.Router();

async function getCurrentTermId(tenantId: number): Promise<number | null> {
  const result = await query(
    'SELECT id FROM terms WHERE tenant_id = $1 AND is_current = true LIMIT 1',
    [tenantId]
  );
  return result.rows[0]?.id ?? null;
}

function emitBoardingChanged(tenantId: number, entity: string, action: string) {
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

const PARENT_COMPLAINT_SUMMARY =
  'A behavioral concern was logged on this date. Please contact the school for details.';

const requireBoardingComplaintReader = requireRole(
  ...BOARDING_COMPLAINT_FILER_ROLES,
  'administrator',
  'super-admin',
  'headmaster'
);

const requireBoardingComplaintFile = requireRole(...BOARDING_COMPLAINT_FILER_ROLES);

function complaintSummaryRows(rows: Array<{ status: string; severity: string }>) {
  let pending = 0;
  let under_review = 0;
  let resolved = 0;
  let high_severity = 0;
  for (const r of rows) {
    if (r.status === 'pending') pending++;
    if (r.status === 'under_review') under_review++;
    if (r.status === 'resolved') resolved++;
    if (r.severity === 'high' && r.status !== 'resolved') high_severity++;
  }
  return {
    total: rows.length,
    pending,
    under_review,
    resolved,
    high_severity,
  };
}

// ── COMPLAINTS ───────────────────────────────────────────────────────────────

router.get('/complaints', requireBoardingComplaintReader, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = String(req.user!.role || '').toLowerCase();
    const resolver = isBoardingComplaintResolver(role);
    const statusFilter = String(req.query.status || '');

    const params: unknown[] = [tenantId];
    const conditions = ['bc.tenant_id = $1'];

    if (!resolver) {
      conditions.push('bc.filed_by = $2');
      params.push(req.user!.id);
    }

    if (statusFilter === 'active') {
      conditions.push("bc.status IN ('pending', 'under_review')");
    } else if (statusFilter === 'resolved') {
      conditions.push("bc.status = 'resolved'");
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(bc.title ILIKE $${params.length} OR bc.description ILIKE $${params.length} OR s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length})`
      );
    }

    const result = await query(
      `SELECT bc.*,
         s.first_name, s.last_name, s.passport_photo_url, s.student_id AS student_code,
         c.class_name,
         fu.full_name AS filed_by_name,
         ru.full_name AS resolved_by_name
       FROM boarding_complaints bc
       JOIN students s ON bc.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN users fu ON bc.filed_by = fu.id
       LEFT JOIN users ru ON bc.resolved_by = ru.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY bc.created_at DESC`,
      params
    );

    const allForSummary = resolver
      ? await query(
          `SELECT status, severity FROM boarding_complaints WHERE tenant_id = $1`,
          [tenantId]
        )
      : await query(
          `SELECT status, severity FROM boarding_complaints WHERE tenant_id = $1 AND filed_by = $2`,
          [tenantId, req.user!.id]
        );

    res.json({
      items: result.rows,
      summary: complaintSummaryRows(allForSummary.rows),
      can_resolve: resolver,
      can_file: isBoardingComplaintFiler(role),
    });
  } catch (error) {
    console.error('List boarding complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

router.get('/complaints/:id', requireBoardingComplaintReader, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const complaintId = parseInt(req.params.id, 10);
    const role = String(req.user!.role || '').toLowerCase();
    const resolver = isBoardingComplaintResolver(role);

    const result = await query(
      `SELECT bc.*,
         s.first_name, s.last_name, s.passport_photo_url, s.student_id AS student_code,
         c.class_name,
         fu.full_name AS filed_by_name,
         ru.full_name AS resolved_by_name
       FROM boarding_complaints bc
       JOIN students s ON bc.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN users fu ON bc.filed_by = fu.id
       LEFT JOIN users ru ON bc.resolved_by = ru.id
       WHERE bc.id = $1 AND bc.tenant_id = $2`,
      [complaintId, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });
    const row = result.rows[0];
    if (!resolver && row.filed_by !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(row);
  } catch (error) {
    console.error('Get boarding complaint error:', error);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

router.post('/complaints', requireBoardingComplaintFile, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, title, description, severity } = req.body;
    if (!student_id || !title || !description) {
      return res.status(400).json({ error: 'Student, title, and description are required' });
    }
    const sev = ['low', 'medium', 'high'].includes(severity) ? severity : 'low';

    const result = await query(
      `INSERT INTO boarding_complaints
         (tenant_id, student_id, filed_by, title, description, parent_summary, severity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        tenantId,
        student_id,
        req.user!.id,
        String(title).trim(),
        String(description).trim(),
        PARENT_COMPLAINT_SUMMARY,
        sev,
      ]
    );
    emitBoardingChanged(tenantId, 'complaint', 'created');

    if (sev === 'high') {
      const studentRes = await query(
        `SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
        [student_id, tenantId]
      );
      const studentName = studentRes.rows[0]
        ? `${studentRes.rows[0].first_name} ${studentRes.rows[0].last_name}`.trim()
        : 'Student';
      void notifyHighSeverityComplaintWhatsApp({
        tenantId,
        studentId: student_id,
        studentName,
        complaintId: result.rows[0].id,
        title: String(title).trim(),
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create boarding complaint error:', error);
    res.status(500).json({ error: 'Failed to file complaint' });
  }
});

router.patch('/complaints/:id/status', requireBoardingComplaintResolver, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'School context required' });

    const complaintId = parseInt(req.params.id, 10);
    if (!Number.isFinite(complaintId)) {
      return res.status(400).json({ error: 'Invalid complaint id' });
    }

    const { status, note } = req.body ?? {};
    const nextStatus = String(status || '').trim();

    if (!['under_review', 'resolved'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Status must be under_review or resolved' });
    }
    if (nextStatus === 'resolved' && (!note || String(note).trim().length < 20)) {
      return res.status(400).json({ error: 'Resolution note required (min 20 characters)' });
    }

    const existing = await query(
      'SELECT id, status, resolved_by FROM boarding_complaints WHERE id = $1 AND tenant_id = $2',
      [complaintId, tenantId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });

    const currentStatus = String(existing.rows[0].status || '');
    if (currentStatus === 'resolved') {
      return res.status(400).json({ error: 'This complaint is already resolved' });
    }
    if (nextStatus === 'under_review' && currentStatus === 'under_review') {
      return res.json(existing.rows[0]);
    }

    const resolvedBy = nextStatus === 'resolved' ? req.user!.id : existing.rows[0].resolved_by;

    const result = await query(
      `UPDATE boarding_complaints
       SET status = $1::varchar,
           resolution_note = CASE WHEN $1::varchar = 'resolved' THEN $2 ELSE resolution_note END,
           resolved_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [nextStatus, note ? String(note).trim() : null, resolvedBy, complaintId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    emitBoardingChanged(tenantId, 'complaint', 'updated');
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update boarding complaint status error:', error);
    if (error?.code === '23514') {
      return res.status(400).json({
        error: 'Complaint status could not be saved. Please run database migrations and try again.',
      });
    }
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// Legacy PUT kept for compatibility — resolver only
router.put('/complaints/:id', requireBoardingComplaintResolver, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const complaintId = parseInt(req.params.id, 10);
    const { status, resolution_note } = req.body;

    const existing = await query(
      'SELECT * FROM boarding_complaints WHERE id = $1 AND tenant_id = $2',
      [complaintId, tenantId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });

    const row = existing.rows[0];
    const newStatus = status || row.status;
    if (!['under_review', 'resolved'].includes(String(newStatus))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const resolvedBy = newStatus === 'resolved' ? req.user!.id : row.resolved_by;

    const result = await query(
      `UPDATE boarding_complaints
       SET status = $1,
           resolution_note = COALESCE($2, resolution_note),
           resolved_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [newStatus, resolution_note || null, resolvedBy, complaintId, tenantId]
    );
    emitBoardingChanged(tenantId, 'complaint', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update boarding complaint error:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// ── FINANCE ──────────────────────────────────────────────────────────────────

router.get('/finance', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = req.query.term_id
      ? parseInt(String(req.query.term_id), 10)
      : await getCurrentTermId(tenantId);
    if (!termId) return res.status(400).json({ error: 'No current term' });

    const enrollments = await query(
      `SELECT be.student_id, be.dorm_id,
         s.first_name, s.last_name, s.gender,
         c.class_name,
         bd.name AS dorm_name, bd.gender AS dorm_gender
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN boarding_dorms bd ON be.dorm_id = bd.id
       WHERE be.tenant_id = $1 AND be.term_id = $2 AND be.status = 'boarder'
       ORDER BY bd.gender, bd.name, s.last_name, s.first_name`,
      [tenantId, termId]
    );

    const rows = [];
    let totalExpected = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let fullyPaid = 0;
    let partial = 0;
    let unpaid = 0;

    for (const e of enrollments.rows) {
      const studentId = Number(e.student_id);
      const feeBreakdown = await getBoardingFeeBreakdownForStudent(tenantId, studentId, termId);
      const balance = await getStudentBalanceFromLedger(null, tenantId, studentId, termId);
      const boardingExpected = feeBreakdown.total;
      const boardingPaid = Math.min(
        boardingExpected,
        Math.max(0, balance.paymentsMade - Math.max(0, balance.totalDue - boardingExpected))
      );
      const outstanding = Math.max(0, boardingExpected - boardingPaid);
      let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (boardingExpected <= 0) paymentStatus = 'Paid';
      else if (outstanding <= 0.001) {
        paymentStatus = 'Paid';
        fullyPaid++;
      } else if (boardingPaid > 0) {
        paymentStatus = 'Partial';
        partial++;
      } else {
        unpaid++;
      }

      totalExpected += boardingExpected;
      totalPaid += boardingPaid;
      totalOutstanding += outstanding;

      rows.push({
        student_id: studentId,
        first_name: e.first_name,
        last_name: e.last_name,
        class_name: e.class_name,
        dorm_name: e.dorm_name,
        dorm_gender: e.dorm_gender,
        boarding_fee: boardingExpected,
        amount_paid: boardingPaid,
        outstanding,
        payment_status: paymentStatus,
        fee_breakdown: feeBreakdown,
      });
    }

    res.json({
      term_id: termId,
      summary: {
        total_expected: Math.round(totalExpected * 100) / 100,
        total_collected: Math.round(totalPaid * 100) / 100,
        total_outstanding: Math.round(totalOutstanding * 100) / 100,
        fully_paid: fullyPaid,
        partial,
        unpaid,
        boarder_count: rows.length,
      },
      boarders: rows,
    });
  } catch (error) {
    console.error('Boarding finance list error:', error);
    res.status(500).json({ error: 'Failed to fetch boarding finance' });
  }
});

router.get('/finance/:studentId', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(req.params.studentId, 10);
    const termId = req.query.term_id
      ? parseInt(String(req.query.term_id), 10)
      : await getCurrentTermId(tenantId);
    if (!termId) return res.status(400).json({ error: 'No current term' });

    const feeBreakdown = await getBoardingFeeBreakdownForStudent(tenantId, studentId, termId);
    const balance = await getStudentBalanceFromLedger(null, tenantId, studentId, termId);
    res.json({ term_id: termId, student_id: studentId, fee_breakdown: feeBreakdown, balance });
  } catch (error) {
    console.error('Boarding finance student error:', error);
    res.status(500).json({ error: 'Failed to fetch student boarding finance' });
  }
});

// ── PRINT ────────────────────────────────────────────────────────────────────

async function buildHouseListData(tenantId: number, termId: number) {
  const [schoolRes, termRes, bedsRes] = await Promise.all([
    query('SELECT name, logo_url FROM tenants WHERE id = $1', [tenantId]),
    query(
      `SELECT t.name AS term_name, ay.name AS year_name
       FROM terms t JOIN academic_years ay ON t.academic_year_id = ay.id
       WHERE t.id = $1`,
      [termId]
    ),
    query(
      `SELECT bb.bed_number, bb.is_occupied,
         bd.id AS dorm_id, bd.name AS dorm_name, bd.gender,
         br.room_name,
         s.first_name, s.last_name, c.class_name, be.student_id
       FROM boarding_beds bb
       JOIN boarding_rooms br ON bb.room_id = br.id
       JOIN boarding_dorms bd ON br.dorm_id = bd.id
       LEFT JOIN boarding_enrollments be ON be.bed_id = bb.id
         AND be.tenant_id = $1 AND be.term_id = $2 AND be.status = 'boarder'
       LEFT JOIN students s ON be.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE bd.tenant_id = $1
       ORDER BY bd.gender, bd.name, br.room_name, bb.bed_number`,
      [tenantId, termId]
    ),
  ]);

  type BedRow = {
    bed_number: string;
    student_name: string | null;
    class_name: string | null;
    room_name: string;
  };

  type DormBlock = {
    dorm_id: number;
    dorm_name: string;
    rooms: Array<{ room_name: string; beds: BedRow[] }>;
  };

  const malesDorms = new Map<number, DormBlock & { roomsMap: Map<string, BedRow[]> }>();
  const femalesDorms = new Map<number, DormBlock & { roomsMap: Map<string, BedRow[]> }>();

  let malesCount = 0;
  let femalesCount = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;

  for (const bed of bedsRes.rows) {
    totalBeds++;
    const isFemale = bed.gender === 'girls';
    const map = isFemale ? femalesDorms : malesDorms;
    const dormId = Number(bed.dorm_id);

    if (!map.has(dormId)) {
      map.set(dormId, {
        dorm_id: dormId,
        dorm_name: bed.dorm_name,
        rooms: [],
        roomsMap: new Map(),
      });
    }
    const dorm = map.get(dormId)!;
    if (!dorm.roomsMap.has(bed.room_name)) {
      dorm.roomsMap.set(bed.room_name, []);
    }

    let studentName: string | null = null;
    if (bed.is_occupied && bed.student_id) {
      occupiedBeds++;
      if (isFemale) femalesCount++;
      else malesCount++;
      studentName = `${bed.first_name || ''} ${bed.last_name || ''}`.trim();
    }

    dorm.roomsMap.get(bed.room_name)!.push({
      bed_number: bed.bed_number,
      student_name: studentName,
      class_name: bed.class_name,
      room_name: bed.room_name,
    });
  }

  const packDorms = (map: Map<number, DormBlock & { roomsMap: Map<string, BedRow[]> }>) =>
    [...map.values()].map((d) => ({
      dorm_id: d.dorm_id,
      dorm_name: d.dorm_name,
      rooms: [...d.roomsMap.entries()].map(([room_name, beds]) => ({ room_name, beds })),
    }));

  return {
    school_name: schoolRes.rows[0]?.name || 'School',
    logo_url: schoolRes.rows[0]?.logo_url || null,
    term_name: termRes.rows[0]?.term_name || '',
    year_name: termRes.rows[0]?.year_name || '',
    generated_at: new Date().toISOString(),
    males: { dorms: packDorms(malesDorms), total: malesCount },
    females: { dorms: packDorms(femalesDorms), total: femalesCount },
    summary: {
      total_boarders: malesCount + femalesCount,
      males_count: malesCount,
      females_count: femalesCount,
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      vacant_beds: totalBeds - occupiedBeds,
    },
  };
}

router.get('/print/houselist', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = req.query.term_id
      ? parseInt(String(req.query.term_id), 10)
      : await getCurrentTermId(tenantId);
    if (!termId) return res.status(400).json({ error: 'No current term' });
    const data = await buildHouseListData(tenantId, termId);
    res.json(data);
  } catch (error) {
    console.error('Print houselist error:', error);
    res.status(500).json({ error: 'Failed to generate house list' });
  }
});

router.get('/print/dorm/:dormId', requireBoardingStaff, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const dormId = parseInt(req.params.dormId, 10);
    const termId = req.query.term_id
      ? parseInt(String(req.query.term_id), 10)
      : await getCurrentTermId(tenantId);
    if (!termId) return res.status(400).json({ error: 'No current term' });
    const full = await buildHouseListData(tenantId, termId);
    const inMale = full.males.dorms.some((d) => d.dorm_id === dormId);
    const inFemale = full.females.dorms.some((d) => d.dorm_id === dormId);
    res.json({
      ...full,
      males: { ...full.males, dorms: full.males.dorms.filter((d) => d.dorm_id === dormId) },
      females: { ...full.females, dorms: full.females.dorms.filter((d) => d.dorm_id === dormId) },
    });
  } catch (error) {
    console.error('Print dorm list error:', error);
    res.status(500).json({ error: 'Failed to generate dorm list' });
  }
});

// ── TERM ROLLOVER ────────────────────────────────────────────────────────────

router.post('/rollover', requireBoardingAdmin, async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const fromTermId = parseInt(String(req.body.fromTermId), 10);
    const toTermId = parseInt(String(req.body.toTermId), 10);
    if (!fromTermId || !toTermId) {
      return res.status(400).json({ error: 'fromTermId and toTermId are required' });
    }

    const boarders = await query(
      `SELECT * FROM boarding_enrollments
       WHERE tenant_id = $1 AND term_id = $2 AND status = 'boarder'`,
      [tenantId, fromTermId]
    );

    await client.query('BEGIN');
    let carried = 0;
    const errors: string[] = [];
    const skipped: number[] = [];

    for (const b of boarders.rows) {
      try {
        const exists = await client.query(
          `SELECT id FROM boarding_enrollments WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
          [tenantId, b.student_id, toTermId]
        );
        if (exists.rows.length > 0) {
          skipped.push(b.student_id);
          continue;
        }

        await client.query(
          `INSERT INTO boarding_enrollments
             (tenant_id, student_id, term_id, status, dorm_id, room_id, bed_id, start_date)
           VALUES ($1, $2, $3, 'boarder', $4, $5, $6, CURRENT_DATE)`,
          [tenantId, b.student_id, toTermId, b.dorm_id, b.room_id, b.bed_id]
        );

        if (b.bed_id) {
          await client.query('UPDATE boarding_beds SET is_occupied = true WHERE id = $1', [b.bed_id]);
          await logBedAssignment(client, {
            bedId: b.bed_id,
            studentId: b.student_id,
            tenantId,
            termId: toTermId,
            reason: 'term_end',
          });
        }

        carried++;
      } catch (err) {
        errors.push(`Student ${b.student_id}: ${(err as Error).message}`);
      }
    }

    for (const b of boarders.rows) {
      if (!skipped.includes(b.student_id)) {
        try {
          await applyBoardingFeeToStudent(tenantId, b.student_id, toTermId);
        } catch (err) {
          errors.push(`Fee apply ${b.student_id}: ${(err as Error).message}`);
        }
      }
    }

    const rollover = await client.query(
      `INSERT INTO boarding_term_rollover (tenant_id, from_term_id, to_term_id, rolled_over_by, students_carried)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, fromTermId, toTermId, req.user!.id, carried]
    );

    await client.query('COMMIT');

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'BOARDING_ROLLOVER',
      entityId: rollover.rows[0].id,
      module: 'boarding',
      summary: withActor(`Boarding rollover: ${carried} boarders carried to new term`, actor),
      details: { fromTermId, toTermId, carried, skipped, errors },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitBoardingChanged(tenantId, 'rollover', 'created');
    res.json({
      students_carried: carried,
      skipped: skipped.length,
      skipped_student_ids: skipped,
      errors,
      rollover: rollover.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Boarding rollover error:', error);
    res.status(500).json({ error: 'Failed to roll over boarders' });
  } finally {
    client.release();
  }
});

export default router;
