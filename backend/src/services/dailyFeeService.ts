import type pg from 'pg';
import { query, getClient } from '../db/connection.js';

type QueryFn = typeof query;

export type DailyPaymentType = 'daily' | 'weekly' | 'monthly' | 'termly';
export type DailyStudentStatus = 'covered' | 'paid' | 'pending' | 'school_closed' | 'expired';

export type DailyFeeStructure = {
  id: number;
  classId: number;
  termId: number;
  academicYearId: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  termlyRate: number;
  schoolDaysCount: number;
};

export type DailyFeeStructureApi = {
  id: number;
  class_id: number;
  term_id: number;
  academic_year_id: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  termly_rate: number;
  school_days_count: number;
};

export function serializeDailyFeeStructureForApi(
  row: DailyFeeStructure | null
): DailyFeeStructureApi | null {
  if (!row) return null;
  return {
    id: row.id,
    class_id: row.classId,
    term_id: row.termId,
    academic_year_id: row.academicYearId,
    daily_rate: row.dailyRate,
    weekly_rate: row.weeklyRate,
    monthly_rate: row.monthlyRate,
    termly_rate: row.termlyRate,
    school_days_count: row.schoolDaysCount,
  };
}

function mapStructureRow(r: Record<string, unknown>): DailyFeeStructure {
  return {
    id: Number(r.id),
    classId: Number(r.class_id),
    termId: Number(r.term_id),
    academicYearId: Number(r.academic_year_id),
    dailyRate: Number(r.daily_rate),
    weeklyRate: Number(r.weekly_rate),
    monthlyRate: Number(r.monthly_rate),
    termlyRate: Number(r.termly_rate),
    schoolDaysCount: Number(r.school_days_count),
  };
}

export type StudentDailyStatus = {
  status: DailyStudentStatus;
  paidUntil?: string;
  paymentType?: string;
  lastPaidUntil?: string;
  nextDueDate?: string | null;
};

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addCalendarDays(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

export function isWeekend(dateStr: string): boolean {
  const day = parseDateOnly(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

export async function getClosureDates(
  run: QueryFn,
  tenantId: number,
  termId: number
): Promise<Set<string>> {
  const res = await run(
    `SELECT closure_date::text AS closure_date
     FROM school_closure_days
     WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, termId]
  );
  return new Set(res.rows.map((r) => String(r.closure_date).slice(0, 10)));
}

export function isSchoolDay(dateStr: string, closureDates: Set<string>): boolean {
  if (isWeekend(dateStr)) return false;
  return !closureDates.has(dateStr.slice(0, 10));
}

export async function calculateCoverageEndDate(
  run: QueryFn,
  tenantId: number,
  termId: number,
  startDate: string,
  schoolDaysToCover: number
): Promise<string> {
  if (schoolDaysToCover <= 0) return startDate.slice(0, 10);
  const closureDates = await getClosureDates(run, tenantId, termId);
  let current = startDate.slice(0, 10);
  let counted = 0;

  while (counted < schoolDaysToCover) {
    if (isSchoolDay(current, closureDates)) {
      counted += 1;
      if (counted === schoolDaysToCover) return current;
    }
    current = addCalendarDays(current, 1);
    if (counted === 0 && parseDateOnly(current).getTime() - parseDateOnly(startDate).getTime() > 366 * 24 * 3600 * 1000) {
      break;
    }
    if (parseDateOnly(current).getTime() - parseDateOnly(startDate).getTime() > 400 * 24 * 3600 * 1000) break;
  }
  return current;
}

export async function calculateNextDueDate(
  run: QueryFn,
  tenantId: number,
  termId: number,
  afterDate: string
): Promise<string | null> {
  const closureDates = await getClosureDates(run, tenantId, termId);
  let current = addCalendarDays(afterDate.slice(0, 10), 1);
  for (let i = 0; i < 400; i += 1) {
    if (isSchoolDay(current, closureDates)) return current;
    current = addCalendarDays(current, 1);
  }
  return null;
}

export function schoolDaysForPaymentType(
  paymentType: DailyPaymentType,
  structure: Pick<DailyFeeStructure, 'schoolDaysCount'>
): number {
  switch (paymentType) {
    case 'daily':
      return 1;
    case 'weekly':
      return 5;
    case 'monthly':
      return 20;
    case 'termly':
      return Math.max(1, structure.schoolDaysCount);
    default:
      return 1;
  }
}

export function rateForPaymentType(
  paymentType: DailyPaymentType,
  structure: DailyFeeStructure
): number {
  switch (paymentType) {
    case 'daily':
      return Number(structure.dailyRate);
    case 'weekly':
      return Number(structure.weeklyRate);
    case 'monthly':
      return Number(structure.monthlyRate);
    case 'termly':
      return Number(structure.termlyRate);
    default:
      return Number(structure.dailyRate);
  }
}

export async function getFirstSchoolDayOnOrAfter(
  run: QueryFn,
  tenantId: number,
  termId: number,
  dateStr: string
): Promise<string> {
  const closureDates = await getClosureDates(run, tenantId, termId);
  let current = dateStr.slice(0, 10);
  for (let i = 0; i < 30; i += 1) {
    if (isSchoolDay(current, closureDates)) return current;
    current = addCalendarDays(current, 1);
  }
  return dateStr.slice(0, 10);
}

export async function listSchoolDaysInRange(
  run: QueryFn,
  tenantId: number,
  termId: number,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const closureDates = await getClosureDates(run, tenantId, termId);
  const days: string[] = [];
  let current = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  while (parseDateOnly(current).getTime() <= parseDateOnly(end).getTime()) {
    if (isSchoolDay(current, closureDates)) days.push(current);
    current = addCalendarDays(current, 1);
  }
  return days;
}

export async function getStudentStatusForDate(
  run: QueryFn,
  tenantId: number,
  studentId: number,
  termId: number,
  dateStr: string
): Promise<StudentDailyStatus> {
  const date = dateStr.slice(0, 10);
  const closureDates = await getClosureDates(run, tenantId, termId);

  if (!isSchoolDay(date, closureDates)) {
    return { status: 'school_closed' };
  }

  const onDateRes = await run(
    `SELECT payment_type, coverage_end_date::text AS coverage_end_date
     FROM daily_fee_payments
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND payment_date = $4::date
     ORDER BY id DESC
     LIMIT 1`,
    [tenantId, studentId, termId, date]
  );

  if (onDateRes.rows.length > 0) {
    const paymentType = String(onDateRes.rows[0].payment_type);
    const paidUntil = String(onDateRes.rows[0].coverage_end_date).slice(0, 10);
    if (paymentType === 'weekly' || paymentType === 'monthly' || paymentType === 'termly') {
      return { status: 'covered', paidUntil, paymentType };
    }
    return { status: 'paid', paidUntil, paymentType };
  }

  const coverRes = await run(
    `SELECT coverage_end_date::text AS coverage_end_date, payment_type
     FROM daily_fee_payments
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND coverage_start_date <= $4::date AND coverage_end_date >= $4::date
       AND payment_type IN ('weekly', 'monthly', 'termly')
     ORDER BY coverage_end_date DESC
     LIMIT 1`,
    [tenantId, studentId, termId, date]
  );

  if (coverRes.rows.length > 0) {
    return {
      status: 'covered',
      paidUntil: String(coverRes.rows[0].coverage_end_date).slice(0, 10),
      paymentType: coverRes.rows[0].payment_type,
    };
  }

  const lastRes = await run(
    `SELECT coverage_end_date::text AS coverage_end_date, next_due_date::text AS next_due_date, payment_type
     FROM daily_fee_payments
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND payment_type IN ('weekly', 'monthly', 'termly')
     ORDER BY coverage_end_date DESC
     LIMIT 1`,
    [tenantId, studentId, termId]
  );

  if (lastRes.rows.length > 0) {
    const lastEnd = String(lastRes.rows[0].coverage_end_date).slice(0, 10);
    if (parseDateOnly(lastEnd).getTime() < parseDateOnly(date).getTime()) {
      return {
        status: 'expired',
        lastPaidUntil: lastEnd,
        nextDueDate: lastRes.rows[0].next_due_date
          ? String(lastRes.rows[0].next_due_date).slice(0, 10)
          : null,
        paymentType: lastRes.rows[0].payment_type,
      };
    }
  }

  return { status: 'pending' };
}

export async function upsertCollectionRecordsForPayment(
  client: pg.PoolClient,
  tenantId: number,
  paymentId: number,
  studentId: number,
  classId: number,
  termId: number,
  coverageStart: string,
  coverageEnd: string
): Promise<void> {
  const schoolDays = await listSchoolDaysInRange(
    (text, params) => client.query(text, params),
    tenantId,
    termId,
    coverageStart,
    coverageEnd
  );

  for (const day of schoolDays) {
    await client.query(
      `INSERT INTO daily_fee_collection_records
         (tenant_id, student_id, class_id, term_id, collection_date, status, daily_fee_payment_id)
       VALUES ($1, $2, $3, $4, $5, 'paid', $6)
       ON CONFLICT (tenant_id, student_id, collection_date)
       DO UPDATE SET status = 'paid', daily_fee_payment_id = EXCLUDED.daily_fee_payment_id,
         class_id = EXCLUDED.class_id, term_id = EXCLUDED.term_id`,
      [tenantId, studentId, classId, termId, day, paymentId]
    );
  }
}

export async function recalculatePaymentsOnClosureChange(
  tenantId: number,
  termId: number,
  closureDate: string,
  action: 'add' | 'remove'
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const delta = action === 'add' ? 1 : -1;

    const affected = await client.query(
      `SELECT id, student_id, class_id, coverage_start_date::text AS coverage_start_date,
              coverage_end_date::text AS coverage_end_date, school_days_covered
       FROM daily_fee_payments
       WHERE tenant_id = $1 AND term_id = $2
         AND coverage_start_date <= $3::date AND coverage_end_date >= $3::date`,
      [tenantId, termId, closureDate]
    );

    for (const row of affected.rows) {
      const newSchoolDays = Math.max(1, Number(row.school_days_covered) + delta);
      const newEnd = await calculateCoverageEndDate(
        (text, params) => client.query(text, params),
        tenantId,
        termId,
        String(row.coverage_start_date).slice(0, 10),
        newSchoolDays
      );
      const newNextDue = await calculateNextDueDate(
        (text, params) => client.query(text, params),
        tenantId,
        termId,
        newEnd
      );

      await client.query(
        `UPDATE daily_fee_payments
         SET coverage_end_date = $1, school_days_covered = $2, next_due_date = $3
         WHERE id = $4 AND tenant_id = $5`,
        [newEnd, newSchoolDays, newNextDue, row.id, tenantId]
      );

      if (action === 'add') {
        await client.query(
          `INSERT INTO daily_fee_collection_records
             (tenant_id, student_id, class_id, term_id, collection_date, status, daily_fee_payment_id)
           VALUES ($1, $2, $3, $4, $5, 'school_closed', $6)
           ON CONFLICT (tenant_id, student_id, collection_date)
           DO UPDATE SET status = 'school_closed', daily_fee_payment_id = NULL`,
          [tenantId, row.student_id, row.class_id, termId, closureDate, row.id]
        );
        await upsertCollectionRecordsForPayment(
          client,
          tenantId,
          row.id,
          row.student_id,
          row.class_id,
          termId,
          newEnd,
          newEnd
        );
      } else {
        await client.query(
          `DELETE FROM daily_fee_collection_records
           WHERE tenant_id = $1 AND student_id = $2 AND collection_date = $3::date AND status = 'school_closed'`,
          [tenantId, row.student_id, closureDate]
        );
        await client.query(
          `DELETE FROM daily_fee_collection_records
           WHERE tenant_id = $1 AND student_id = $2 AND collection_date = $3::date AND daily_fee_payment_id = $4`,
          [tenantId, row.student_id, newEnd, row.id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDailyFeeStructure(
  run: QueryFn,
  tenantId: number,
  classId: number,
  termId: number
): Promise<DailyFeeStructure | null> {
  const exact = await run(
    `SELECT id, class_id, term_id, academic_year_id,
            daily_rate, weekly_rate, monthly_rate, termly_rate, school_days_count
     FROM daily_fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3`,
    [tenantId, classId, termId]
  );
  if (exact.rows.length > 0) {
    return mapStructureRow(exact.rows[0]);
  }

  const fallback = await run(
    `SELECT id, class_id, term_id, academic_year_id,
            daily_rate, weekly_rate, monthly_rate, termly_rate, school_days_count
     FROM daily_fee_structures
     WHERE tenant_id = $1 AND class_id = $2
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [tenantId, classId]
  );
  if (fallback.rows.length === 0) return null;
  return mapStructureRow(fallback.rows[0]);
}

export type ClassStudentRow = {
  id: number;
  first_name: string;
  last_name: string;
  student_id: string;
  admission_number: string | null;
  has_passport_photo: boolean;
};

/** Active students in a class — roster (class_assigned_id) plus any active enrollment row. */
export async function listStudentsInClass(
  run: QueryFn,
  tenantId: number,
  classId: number
): Promise<ClassStudentRow[]> {
  const res = await run(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
            (CASE WHEN s.passport_photo_url IS NOT NULL AND length(s.passport_photo_url) > 0
                  THEN true ELSE false END) AS has_passport_photo
     FROM students s
     WHERE s.tenant_id = $1
       AND COALESCE(s.enrollment_status, 'active') = 'active'
       AND (
         s.class_assigned_id = $2
         OR EXISTS (
           SELECT 1 FROM student_class_enrollments e
           WHERE e.student_id = s.id AND e.tenant_id = s.tenant_id
             AND e.class_id = $2
             AND e.status IN ('active', 'repeat')
         )
       )
     ORDER BY s.first_name, s.last_name`,
    [tenantId, classId]
  );
  return res.rows as ClassStudentRow[];
}
