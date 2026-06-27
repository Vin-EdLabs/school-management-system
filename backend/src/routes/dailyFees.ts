import express from 'express';
import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { formatMoneyGhs, resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolvePaymentAccountForTransaction } from '../services/paymentAccountService.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  getClassOverviewReport,
  getStudentReport,
} from '../services/dailyFeeReportService.js';
import {
  calculateCoverageEndDate,
  calculateNextDueDate,
  getDailyFeeStructure,
  getFirstSchoolDayOnOrAfter,
  getStudentStatusForDate,
  listStudentsInClass,
  rateForPaymentType,
  recalculatePaymentsOnClosureChange,
  schoolDaysForPaymentType,
  upsertCollectionRecordsForPayment,
  serializeDailyFeeStructureForApi,
  type DailyPaymentType,
} from '../services/dailyFeeService.js';

const router = express.Router();

function emitChanged(tenantId: number) {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'daily-fees',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

async function generateReceiptNumber(tenantId: number): Promise<string> {
  const settingsRes = await query(
    `SELECT receipt_prefix FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const prefix = settingsRes.rows[0]?.receipt_prefix || 'R';
  const client = await getClient();
  try {
    const res = await client.query(
      `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id) DO UPDATE SET
         last_number = receipt_number_seq.last_number + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING last_number`,
      [tenantId]
    );
    const lastNum = res.rows.length > 0 ? parseInt(String(res.rows[0].last_number), 10) : 1;
    return `${prefix}${String(lastNum).padStart(8, '0')}`;
  } finally {
    client.release();
  }
}

async function resolveTermContext(tenantId: number) {
  const { ledgerTermId, academicYearId, termLabel } = await resolveActiveLedgerTerm(query, tenantId);
  if (!ledgerTermId || !academicYearId) {
    throw new Error('No active term set. Configure an active term in Settings first.');
  }
  return { termId: ledgerTermId, academicYearId, termLabel };
}

type RecordPaymentInput = {
  tenantId: number;
  userId: number;
  studentId: number;
  classId: number;
  paymentType: DailyPaymentType;
  amountPaid?: number;
  paymentDate: string;
  paymentMethod?: string;
  paymentAccountId?: number | null;
  notes?: string | null;
};

async function recordDailyFeePayment(client: pg.PoolClient, input: RecordPaymentInput) {
  const {
    tenantId,
    userId,
    studentId: sid,
    classId: cid,
    paymentType: pType,
    amountPaid,
    paymentDate,
    paymentMethod,
    paymentAccountId,
    notes,
  } = input;

  const { termId, academicYearId, termLabel } = await resolveTermContext(tenantId);
  const structure = await getDailyFeeStructure(query, tenantId, cid, termId);
  if (!structure) {
    throw new Error('Daily fee structure not configured for this class');
  }

  const payDate = String(paymentDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const schoolDays = schoolDaysForPaymentType(pType, structure);
  const coverageStart = await getFirstSchoolDayOnOrAfter(query, tenantId, termId, payDate);
  const coverageEnd = await calculateCoverageEndDate(query, tenantId, termId, coverageStart, schoolDays);
  const nextDue = await calculateNextDueDate(query, tenantId, termId, coverageEnd);

  const expectedAmount = rateForPaymentType(pType, structure);
  const amount = Number(amountPaid) > 0 ? Number(amountPaid) : expectedAmount;
  if (amount <= 0) throw new Error('Amount must be greater than zero');

  const resolved = await resolvePaymentAccountForTransaction(
    tenantId,
    paymentAccountId ? parseInt(String(paymentAccountId), 10) : null,
    paymentMethod
  );

  const studentRes = await query(
    `SELECT first_name, last_name, student_id FROM students WHERE id = $1 AND tenant_id = $2`,
    [sid, tenantId]
  );
  if (studentRes.rows.length === 0) throw new Error('Student not found');
  const studentName = `${studentRes.rows[0].first_name} ${studentRes.rows[0].last_name}`.trim();
  const paymentNotes = `Daily Fee (${pType}) — ${studentName}`;

  const payIns = await client.query(
    `INSERT INTO daily_fee_payments
       (tenant_id, student_id, class_id, term_id, academic_year_id, payment_type, amount_paid,
        payment_date, coverage_start_date, coverage_end_date, school_days_covered, next_due_date,
        payment_method, payment_account_id, receipt_number, notes, recorded_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10::date,$11,$12::date,$13,$14,NULL,$15,$16)
     RETURNING *`,
    [
      tenantId,
      sid,
      cid,
      termId,
      academicYearId,
      pType,
      amount,
      payDate,
      coverageStart,
      coverageEnd,
      schoolDays,
      nextDue,
      resolved.paymentMethod,
      resolved.paymentAccountId,
      notes || null,
      userId,
    ]
  );

  const dailyPayment = payIns.rows[0];

  await upsertCollectionRecordsForPayment(
    client,
    tenantId,
    Number(dailyPayment.id),
    sid,
    cid,
    termId,
    coverageStart,
    coverageEnd
  );

  await client.query(
    `INSERT INTO payments
       (tenant_id, student_id, amount, payment_date, payment_method, payment_account_id, term, term_id, notes, receipt_number, base_receipt_number, receipt_snapshot, is_voided, payment_category)
     VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,NULL,NULL,NULL,false,'daily_fee')`,
    [
      tenantId,
      sid,
      amount,
      payDate,
      resolved.paymentMethod,
      resolved.paymentAccountId,
      termLabel,
      termId,
      paymentNotes,
    ]
  );

  return {
    payment: dailyPayment,
    coverageEndDate: coverageEnd,
    nextDueDate: nextDue,
    studentName,
    termLabel,
    amount,
    paymentType: pType,
  };
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

router.get('/classes', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { termId } = await resolveTermContext(tenantId);
    const result = await query(
      `SELECT c.id, c.class_name, COALESCE(c.fee_mode, 'term') AS fee_mode,
              dfs.id AS structure_id,
              dfs.daily_rate, dfs.weekly_rate, dfs.monthly_rate, dfs.termly_rate, dfs.school_days_count
       FROM classes c
       LEFT JOIN LATERAL (
         SELECT d.id, d.daily_rate, d.weekly_rate, d.monthly_rate, d.termly_rate, d.school_days_count
         FROM daily_fee_structures d
         WHERE d.class_id = c.id AND d.tenant_id = c.tenant_id
         ORDER BY (d.term_id = $2) DESC, d.updated_at DESC NULLS LAST, d.id DESC
         LIMIT 1
       ) dfs ON true
       WHERE c.tenant_id = $1 AND COALESCE(c.fee_mode, 'term') = 'daily'
       ORDER BY c.class_name`,
      [tenantId, termId]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Daily fees classes error:', error);
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to fetch daily fee classes',
    });
  }
});

router.get('/structures', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { termId, termLabel } = await resolveTermContext(tenantId);
    const result = await query(
      `SELECT dfs.id, dfs.class_id, dfs.term_id, dfs.school_days_count,
              dfs.daily_rate, dfs.weekly_rate, dfs.monthly_rate, dfs.termly_rate,
              dfs.updated_at,
              c.class_name,
              COALESCE(c.fee_mode, 'term') AS fee_mode
       FROM daily_fee_structures dfs
       JOIN classes c ON c.id = dfs.class_id AND c.tenant_id = dfs.tenant_id
       WHERE dfs.tenant_id = $1 AND dfs.term_id = $2
       ORDER BY c.class_name`,
      [tenantId, termId]
    );
    res.json({ termId, termLabel, structures: result.rows });
  } catch (error: any) {
    console.error('Daily fee structures list error:', error);
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to fetch daily fee structures',
    });
  }
});

router.get('/structure/:classId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.params.classId), 10);
    const { termId } = await resolveTermContext(tenantId);

    const classRes = await query(
      `SELECT id, class_name, COALESCE(fee_mode, 'term') AS fee_mode FROM classes WHERE id = $1 AND tenant_id = $2`,
      [classId, tenantId]
    );
    if (classRes.rows.length === 0) return res.status(404).json({ error: 'Class not found' });

    const structure = await getDailyFeeStructure(query, tenantId, classId, termId);
    res.json({
      class: classRes.rows[0],
      structure: serializeDailyFeeStructureForApi(structure),
      termId,
    });
  } catch (error: any) {
    console.error('Get daily fee structure error:', error);
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to fetch daily fee structure',
    });
  }
});

router.post('/structure', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const {
      classId,
      dailyRate,
      weeklyRate,
      monthlyRate,
      termlyRate,
      schoolDaysCount,
      feeMode,
    } = req.body;

    const cid = parseInt(String(classId), 10);
    if (!cid) return res.status(400).json({ error: 'classId is required' });

    const { termId, academicYearId } = await resolveTermContext(tenantId);
    const actor = await resolveActorFromRequest(req);

    if (feeMode === 'term') {
      await query(
        `UPDATE classes SET fee_mode = 'term', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
        [cid, tenantId]
      );
      await writeAuditLog({
        tenantId,
        userId,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'class_fee_mode',
        entityId: cid,
        module: 'finance',
        summary: withActor('Class switched to term fee mode', actor),
        details: { classId: cid, feeMode: 'term' },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent'),
      });
      emitChanged(tenantId);
      return res.json({ feeMode: 'term' });
    }

    const days = parseInt(String(schoolDaysCount), 10);
    if (!days || days < 1) {
      return res.status(400).json({ error: 'Total school days for this term is required (minimum 1)' });
    }

    const upsert = await query(
      `INSERT INTO daily_fee_structures
         (tenant_id, class_id, term_id, academic_year_id, daily_rate, weekly_rate, monthly_rate, termly_rate, school_days_count, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (tenant_id, class_id, term_id) DO UPDATE SET
         daily_rate = EXCLUDED.daily_rate,
         weekly_rate = EXCLUDED.weekly_rate,
         monthly_rate = EXCLUDED.monthly_rate,
         termly_rate = EXCLUDED.termly_rate,
         school_days_count = EXCLUDED.school_days_count,
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        cid,
        termId,
        academicYearId,
        Number(dailyRate) || 0,
        Number(weeklyRate) || 0,
        Number(monthlyRate) || 0,
        Number(termlyRate) || 0,
        days,
        userId,
      ]
    );

    await query(
      `UPDATE classes SET fee_mode = 'daily', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [cid, tenantId]
    );

    await writeAuditLog({
      tenantId,
      userId,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'daily_fee_structure',
      entityId: Number(upsert.rows[0].id),
      module: 'finance',
      summary: withActor('Daily fee structure saved', actor),
      details: { classId: cid, termId, schoolDaysCount: days },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    await writeAuditLog({
      tenantId,
      userId,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'class_fee_mode',
      entityId: cid,
      module: 'finance',
      summary: withActor('Class switched to daily fee mode', actor),
      details: { classId: cid, feeMode: 'daily' },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    emitChanged(tenantId);
    res.json({ structure: upsert.rows[0], feeMode: 'daily' });
  } catch (error: any) {
    console.error('Save daily fee structure error:', error);
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to save daily fee structure',
    });
  }
});

router.delete('/structure/:classId', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.params.classId), 10);
    const actor = await resolveActorFromRequest(req);

    await query(
      `UPDATE classes SET fee_mode = 'term', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [classId, tenantId]
    );

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'class_fee_mode',
      entityId: classId,
      module: 'finance',
      summary: withActor('Class switched back to term fee mode', actor),
      details: { classId, feeMode: 'term' },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    emitChanged(tenantId);
    res.json({ feeMode: 'term' });
  } catch (error) {
    console.error('Delete daily fee structure error:', error);
    res.status(500).json({ error: 'Failed to reset class fee mode' });
  }
});

router.get('/closure-days', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { termId } = await resolveTermContext(tenantId);
    const result = await query(
      `SELECT id, closure_date, reason, created_at
       FROM school_closure_days
       WHERE tenant_id = $1 AND term_id = $2
       ORDER BY closure_date`,
      [tenantId, termId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to fetch closure days',
    });
  }
});

router.post('/closure-days', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { closureDate, reason } = req.body;
    if (!closureDate) return res.status(400).json({ error: 'closureDate is required' });

    const { termId } = await resolveTermContext(tenantId);
    const actor = await resolveActorFromRequest(req);

    const ins = await query(
      `INSERT INTO school_closure_days (tenant_id, term_id, closure_date, reason, created_by)
       VALUES ($1, $2, $3::date, $4, $5)
       ON CONFLICT (tenant_id, term_id, closure_date) DO UPDATE SET reason = EXCLUDED.reason
       RETURNING *`,
      [tenantId, termId, closureDate, reason || null, req.user!.id]
    );

    await recalculatePaymentsOnClosureChange(tenantId, termId, String(closureDate).slice(0, 10), 'add');

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'school_closure_day',
      entityId: Number(ins.rows[0].id),
      module: 'finance',
      summary: withActor(`School closure marked for ${closureDate}`, actor),
      details: { closureDate, reason },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    emitChanged(tenantId);
    res.json(ins.rows[0]);
  } catch (error: any) {
    console.error('Add closure day error:', error);
    res.status(500).json({ error: error?.message || 'Failed to mark closure day' });
  }
});

router.delete('/closure-days/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(String(req.params.id), 10);
    const actor = await resolveActorFromRequest(req);

    const existing = await query(
      `SELECT id, closure_date::text AS closure_date, term_id FROM school_closure_days WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Closure day not found' });

    const closureDate = String(existing.rows[0].closure_date).slice(0, 10);
    const termId = Number(existing.rows[0].term_id);

    await query(`DELETE FROM school_closure_days WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    await recalculatePaymentsOnClosureChange(tenantId, termId, closureDate, 'remove');

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'school_closure_day',
      entityId: id,
      module: 'finance',
      summary: withActor(`School closure removed for ${closureDate}`, actor),
      details: { closureDate },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    emitChanged(tenantId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete closure day error:', error);
    res.status(500).json({ error: error?.message || 'Failed to remove closure day' });
  }
});

router.get('/collections', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.query.classId), 10);
    const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

    if (!classId) return res.status(400).json({ error: 'classId is required' });

    const { termId } = await resolveTermContext(tenantId);

    const studentRows = await listStudentsInClass(query, tenantId, classId);

    const structure = await getDailyFeeStructure(query, tenantId, classId, termId);

    const rows = [];
    for (const s of studentRows) {
      const status = await getStudentStatusForDate(query, tenantId, s.id, termId, date);
      const lastPayRes = await query(
        `SELECT payment_type, payment_date::text AS payment_date,
                coverage_start_date::text AS coverage_start_date,
                coverage_end_date::text AS coverage_end_date,
                next_due_date::text AS next_due_date,
                receipt_number, amount_paid::text AS amount_paid, payment_method
         FROM daily_fee_payments
         WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
         ORDER BY payment_date DESC, id DESC LIMIT 1`,
        [tenantId, s.id, termId]
      );
      const last = lastPayRes.rows[0];

      rows.push({
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        studentCode: String(s.student_id || ''),
        admissionNumber: s.admission_number || null,
        hasPassportPhoto: s.has_passport_photo,
        status: status.status,
        currentPaymentType: status.paymentType || null,
        paidUntil: status.paidUntil || null,
        nextDueDate: status.nextDueDate ?? (last?.next_due_date ? String(last.next_due_date).slice(0, 10) : null),
        lastPaymentType: last?.payment_type || null,
        lastPaymentDate: last?.payment_date ? String(last.payment_date).slice(0, 10) : null,
        lastPaidUntil: status.lastPaidUntil || null,
        lastReceiptNumber: last?.receipt_number || null,
        lastPaymentAmount: last?.amount_paid ? parseFloat(String(last.amount_paid)) : null,
        lastCoverageStart: last?.coverage_start_date ? String(last.coverage_start_date).slice(0, 10) : null,
        lastCoverageEnd: last?.coverage_end_date ? String(last.coverage_end_date).slice(0, 10) : null,
        lastPaymentMethod: last?.payment_method || null,
      });
    }

    res.json({
      date,
      classId,
      termId,
      hasStructure: !!structure,
      structure: serializeDailyFeeStructureForApi(structure),
      students: rows,
    });
  } catch (error: any) {
    console.error('Daily collections error:', error);
    res.status(error?.message?.includes('active term') ? 400 : 500).json({
      error: error?.message || 'Failed to fetch collections',
    });
  }
});

router.post('/payments', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const {
      studentId,
      classId,
      paymentType,
      amountPaid,
      paymentDate,
      paymentMethod,
      paymentAccountId,
      notes,
    } = req.body;

    const sid = parseInt(String(studentId), 10);
    const cid = parseInt(String(classId), 10);
    const pType = String(paymentType) as DailyPaymentType;
    if (!sid || !cid || !pType) {
      return res.status(400).json({ error: 'studentId, classId, and paymentType are required' });
    }

    const actor = await resolveActorFromRequest(req);
    await client.query('BEGIN');

    const result = await recordDailyFeePayment(client, {
      tenantId,
      userId,
      studentId: sid,
      classId: cid,
      paymentType: pType,
      amountPaid,
      paymentDate,
      paymentMethod,
      paymentAccountId,
      notes,
    });

    await client.query('COMMIT');

    await writeAuditLog({
      tenantId,
      userId,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'daily_fee_payment',
      entityId: Number(result.payment.id),
      module: 'finance',
      summary: withActor(
        `Daily fee ${pType} payment of ${formatMoneyGhs(result.amount)} for ${result.studentName}`,
        actor
      ),
      details: { studentId: sid, classId: cid, paymentType: pType, amount: result.amount, coverageEnd: result.coverageEndDate },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent'),
    });

    emitChanged(tenantId);

    res.status(201).json(result);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Record daily fee payment error:', error);
    res.status(500).json({ error: error?.message || 'Failed to record payment' });
  } finally {
    client.release();
  }
});

router.post('/payments/batch', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const { classId, paymentDate, paymentMethod, paymentAccountId, items, notes } = req.body;

    const cid = parseInt(String(classId), 10);
    if (!cid || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'classId and items array are required' });
    }

    const actor = await resolveActorFromRequest(req);
    await client.query('BEGIN');

    const saved = [];
    for (const item of items) {
      const sid = parseInt(String(item.studentId), 10);
      const pType = String(item.paymentType) as DailyPaymentType;
      if (!sid || !pType) continue;

      const result = await recordDailyFeePayment(client, {
        tenantId,
        userId,
        studentId: sid,
        classId: cid,
        paymentType: pType,
        amountPaid: item.amountPaid,
        paymentDate,
        paymentMethod,
        paymentAccountId,
        notes,
      });
      saved.push(result);
    }

    await client.query('COMMIT');

    if (saved.length > 0) {
      await writeAuditLog({
        tenantId,
        userId,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'daily_fee_payment_batch',
        entityId: Number(saved[0].payment.id),
        module: 'finance',
        summary: withActor(`Batch daily fee collection — ${saved.length} payment(s)`, actor),
        details: { classId: cid, count: saved.length },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent'),
      });
      emitChanged(tenantId);
    }

    res.status(201).json({ saved: saved.length, payments: saved });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Batch daily fee payment error:', error);
    res.status(500).json({ error: error?.message || 'Failed to record payments' });
  } finally {
    client.release();
  }
});

router.post('/payments/:id/receipt', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const paymentId = parseInt(String(req.params.id), 10);
    if (!paymentId) return res.status(400).json({ error: 'Invalid payment id' });

    const payRes = await query(
      `SELECT dfp.*, s.first_name, s.last_name, s.student_id AS student_code, s.admission_number, c.class_name
       FROM daily_fee_payments dfp
       JOIN students s ON s.id = dfp.student_id AND s.tenant_id = dfp.tenant_id
       JOIN classes c ON c.id = dfp.class_id AND c.tenant_id = dfp.tenant_id
       WHERE dfp.id = $1 AND dfp.tenant_id = $2`,
      [paymentId, tenantId]
    );
    if (payRes.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const payment = payRes.rows[0];
    const studentName = `${payment.first_name} ${payment.last_name}`.trim();
    const actor = await resolveActorFromRequest(req);

    let receiptNumber = payment.receipt_number as string | null;
    const receiptSnapshot = {
      type: 'daily_fee',
      paymentType: payment.payment_type,
      coverageStart: String(payment.coverage_start_date).slice(0, 10),
      coverageEnd: String(payment.coverage_end_date).slice(0, 10),
      nextDueDate: payment.next_due_date ? String(payment.next_due_date).slice(0, 10) : null,
      studentName,
      recordedBy: actor,
    };

    await client.query('BEGIN');

    if (!receiptNumber) {
      receiptNumber = await generateReceiptNumber(tenantId);
      await client.query(
        `UPDATE daily_fee_payments SET receipt_number = $1 WHERE id = $2 AND tenant_id = $3`,
        [receiptNumber, paymentId, tenantId]
      );
      await client.query(
        `UPDATE payments
         SET receipt_number = $1, base_receipt_number = $1, receipt_snapshot = $2::jsonb
         WHERE id = (
           SELECT id FROM payments
           WHERE tenant_id = $3 AND student_id = $4 AND payment_date = $5::date
             AND amount = $6 AND notes LIKE 'Daily Fee%'
             AND (receipt_number IS NULL OR receipt_number = '')
           ORDER BY id DESC
           LIMIT 1
         )`,
        [receiptNumber, JSON.stringify(receiptSnapshot), tenantId, payment.student_id, payment.payment_date, payment.amount_paid]
      );
    }

    await client.query('COMMIT');

    res.json({
      receiptNumber,
      receiptSnapshot,
      studentName,
      studentCode: payment.student_code,
      admissionNumber: payment.admission_number,
      className: payment.class_name,
      amount: parseFloat(String(payment.amount_paid)),
      paymentDate: String(payment.payment_date).slice(0, 10),
      paymentMethod: payment.payment_method,
      paymentType: payment.payment_type,
      coverageStart: receiptSnapshot.coverageStart,
      coverageEnd: receiptSnapshot.coverageEnd,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Generate daily fee receipt error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate receipt' });
  } finally {
    client.release();
  }
});

router.get('/payments/summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
    const { termId } = await resolveTermContext(tenantId);

    const params: unknown[] = [tenantId, date, termId];
    let classFilter = '';
    if (classId) {
      params.push(classId);
      classFilter = ` AND class_id = $${params.length}`;
    }

    const collectedRes = await query(
      `SELECT COALESCE(SUM(amount_paid), 0)::numeric AS total, COUNT(*)::int AS count
       FROM daily_fee_payments
       WHERE tenant_id = $1 AND payment_date = $2::date AND term_id = $3${classFilter}`,
      params
    );

    let totalStudents = 0;
    let pendingToday = 0;
    let coveredCount = 0;

    if (classId) {
      const studentRows = await listStudentsInClass(query, tenantId, classId);
      totalStudents = studentRows.length;

      for (const s of studentRows) {
        try {
          const st = await getStudentStatusForDate(query, tenantId, s.id, termId, date);
          if (st.status === 'covered' || st.status === 'paid') coveredCount += 1;
          else if (st.status === 'pending' || st.status === 'expired') pendingToday += 1;
        } catch (statusErr) {
          console.error('Daily fee summary status error for student', s.id, statusErr);
        }
      }
    }

    res.json({
      totalCollected: Number(collectedRes.rows[0]?.total || 0),
      paidToday: Number(collectedRes.rows[0]?.count || 0),
      totalStudents,
      pendingToday,
      coveredCount,
    });
  } catch (error: any) {
    console.error('Daily fee payments summary error:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch summary' });
  }
});

router.get('/payments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : null;
    const studentId = req.query.studentId ? parseInt(String(req.query.studentId), 10) : null;
    const termIdQ = req.query.termId ? parseInt(String(req.query.termId), 10) : null;
    const paymentType = req.query.paymentType ? String(req.query.paymentType) : null;
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 25), 10)));
    const offset = (page - 1) * limit;

    const { termId: activeTermId } = await resolveTermContext(tenantId);
    const termId = termIdQ || activeTermId;

    const params: unknown[] = [tenantId, termId];
    const where: string[] = ['dfp.tenant_id = $1', 'dfp.term_id = $2'];

    if (classId) {
      params.push(classId);
      where.push(`dfp.class_id = $${params.length}`);
    }
    if (studentId) {
      params.push(studentId);
      where.push(`dfp.student_id = $${params.length}`);
    }
    if (paymentType) {
      params.push(paymentType);
      where.push(`dfp.payment_type = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      where.push(`dfp.payment_date >= $${params.length}::date`);
    }
    if (endDate) {
      params.push(endDate);
      where.push(`dfp.payment_date <= $${params.length}::date`);
    }

    const whereSql = where.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM daily_fee_payments dfp WHERE ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const listRes = await query(
      `SELECT dfp.*,
              s.first_name, s.last_name, s.student_id AS student_code, s.admission_number,
              c.class_name
       FROM daily_fee_payments dfp
       JOIN students s ON s.id = dfp.student_id AND s.tenant_id = dfp.tenant_id
       JOIN classes c ON c.id = dfp.class_id AND c.tenant_id = dfp.tenant_id
       WHERE ${whereSql}
       ORDER BY dfp.payment_date DESC, dfp.id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const breakdownRes = await query(
      `SELECT payment_type, COALESCE(SUM(amount_paid), 0)::numeric AS total, COUNT(*)::int AS count
       FROM daily_fee_payments dfp WHERE ${whereSql}
       GROUP BY payment_type`,
      params
    );

    res.json({
      payments: listRes.rows,
      total: countRes.rows[0]?.c || 0,
      page,
      limit,
      breakdown: breakdownRes.rows,
      totalCollected: breakdownRes.rows.reduce((s: number, r: { total: string }) => s + Number(r.total), 0),
    });
  } catch (error: any) {
    console.error('List daily fee payments error:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch payments' });
  }
});

router.get('/reports/class-overview', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(String(req.query.classId ?? ''), 10);
    const termIdParam = parseInt(String(req.query.termId ?? ''), 10);
    if (Number.isNaN(classId) || Number.isNaN(termIdParam)) {
      return res.status(400).json({ error: 'classId and termId are required' });
    }
    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId, termIdParam);
    if (!ledgerTermId) {
      return res.status(400).json({ error: 'Term not found' });
    }
    const data = await getClassOverviewReport(tenantId, classId, ledgerTermId);
    res.json(data);
  } catch (error: any) {
    console.error('Daily fee class overview report error:', error);
    res.status(error?.message === 'Class not found' || error?.message === 'Term not found' ? 404 : 500).json({
      error: error?.message || 'Failed to load class overview report',
    });
  }
});

router.get('/reports/student', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.query.studentId ?? ''), 10);
    const termIdParam = parseInt(String(req.query.termId ?? ''), 10);
    if (Number.isNaN(studentId) || Number.isNaN(termIdParam)) {
      return res.status(400).json({ error: 'studentId and termId are required' });
    }
    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId, termIdParam);
    if (!ledgerTermId) {
      return res.status(400).json({ error: 'Term not found' });
    }
    const data = await getStudentReport(tenantId, studentId, ledgerTermId);
    res.json(data);
  } catch (error: any) {
    console.error('Daily fee student report error:', error);
    res.status(error?.message === 'Student not found' || error?.message === 'Term not found' ? 404 : 500).json({
      error: error?.message || 'Failed to load student report',
    });
  }
});

export default router;
