import { query } from '../db/connection.js';
import {
  formatDateOnly,
  getClosureDates,
  getDailyFeeStructure,
  getStudentStatusForDate,
  isSchoolDay,
  listSchoolDaysInRange,
  listStudentsInClass,
  type DailyPaymentType,
} from './dailyFeeService.js';

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

function isoDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const TYPE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  termly: 'Termly',
};

function typeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return TYPE_LABELS[String(type).toLowerCase()] || String(type);
}

async function resolveTermMeta(tenantId: number, termId: number) {
  const res = await query(
    `SELECT t.id, t.name AS term_name, ay.name AS year_name,
            ay.start_date::text AS year_start, ay.end_date::text AS year_end
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1 AND t.id = $2`,
    [tenantId, termId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    label: `${String(row.term_name || '').trim()} ${String(row.year_name || '').trim()}`.trim(),
    yearStart: isoDate(row.year_start),
    yearEnd: isoDate(row.year_end),
  };
}

async function resolveTermDateRange(
  tenantId: number,
  termId: number,
  yearStart: string | null,
  yearEnd: string | null,
  schoolDaysCount: number
): Promise<{ start: string; end: string }> {
  const boundsRes = await query(
    `SELECT MIN(payment_date)::text AS min_date, MAX(coverage_end_date)::text AS max_date
     FROM daily_fee_payments
     WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, termId]
  );
  const payMin = isoDate(boundsRes.rows[0]?.min_date);
  const payMax = isoDate(boundsRes.rows[0]?.max_date);
  const today = formatDateOnly(new Date());

  let start = yearStart || payMin || today;
  let end = yearEnd || payMax || today;

  if (payMin && parseDateOnly(payMin).getTime() < parseDateOnly(start).getTime()) {
    start = payMin;
  }
  if (payMax && parseDateOnly(payMax).getTime() > parseDateOnly(end).getTime()) {
    end = payMax;
  }

  if (schoolDaysCount > 0) {
    const schoolDays = await listSchoolDaysInRange(query, tenantId, termId, start, end);
    if (schoolDays.length >= schoolDaysCount) {
      end = schoolDays[Math.min(schoolDaysCount - 1, schoolDays.length - 1)];
    } else if (schoolDays.length > 0) {
      end = schoolDays[schoolDays.length - 1];
    }
  }

  if (parseDateOnly(end).getTime() < parseDateOnly(start).getTime()) {
    end = start;
  }

  return { start, end };
}

type CoverageStatus = 'covered' | 'expired' | 'never_paid';

function mapCoverageStatus(status: string, hasPayments: boolean): CoverageStatus {
  if (!hasPayments) return 'never_paid';
  if (status === 'expired') return 'expired';
  if (status === 'covered' || status === 'paid') return 'covered';
  return 'never_paid';
}

export async function getClassOverviewReport(
  tenantId: number,
  classId: number,
  termId: number
) {
  const classRes = await query(
    `SELECT id, class_name FROM classes WHERE tenant_id = $1 AND id = $2`,
    [tenantId, classId]
  );
  if (classRes.rows.length === 0) {
    throw new Error('Class not found');
  }

  const termMeta = await resolveTermMeta(tenantId, termId);
  if (!termMeta) throw new Error('Term not found');

  const structure = await getDailyFeeStructure(query, tenantId, classId, termId);
  const students = await listStudentsInClass(query, tenantId, classId);
  const today = formatDateOnly(new Date());

  const paymentsRes = await query(
    `SELECT dfp.id, dfp.student_id, dfp.payment_date::text AS payment_date,
            dfp.payment_type, dfp.amount_paid::numeric AS amount_paid,
            s.first_name, s.last_name
     FROM daily_fee_payments dfp
     JOIN students s ON s.id = dfp.student_id AND s.tenant_id = dfp.tenant_id
     WHERE dfp.tenant_id = $1 AND dfp.class_id = $2 AND dfp.term_id = $3
     ORDER BY dfp.payment_date ASC, dfp.id ASC`,
    [tenantId, classId, termId]
  );

  const payments = paymentsRes.rows;
  const totalCollected = roundMoney(payments.reduce((s, p) => s + num(p.amount_paid), 0));
  const paymentCount = payments.length;
  const payingStudentIds = new Set(payments.map((p) => Number(p.student_id)));

  const typeCounts: Record<string, number> = {};
  for (const p of payments) {
    const t = String(p.payment_type || 'daily').toLowerCase();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  let mostCommonType = 'daily';
  let mostCommonCount = 0;
  for (const [t, c] of Object.entries(typeCounts)) {
    if (c > mostCommonCount) {
      mostCommonType = t;
      mostCommonCount = c;
    }
  }

  const lastPayment = payments.length
    ? payments[payments.length - 1]
    : null;

  const dailyMap = new Map<
    string,
    { total: number; studentIds: Set<number>; byType: Record<string, number> }
  >();

  for (const p of payments) {
    const date = isoDate(p.payment_date)!;
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        total: 0,
        studentIds: new Set(),
        byType: { daily: 0, weekly: 0, monthly: 0, termly: 0 },
      });
    }
    const bucket = dailyMap.get(date)!;
    const amount = num(p.amount_paid);
    const pType = String(p.payment_type || 'daily').toLowerCase() as DailyPaymentType;
    bucket.total = roundMoney(bucket.total + amount);
    bucket.studentIds.add(Number(p.student_id));
    if (pType in bucket.byType) bucket.byType[pType] = roundMoney(bucket.byType[pType] + amount);
  }

  const dailyCollections = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      total: v.total,
      studentCount: v.studentIds.size,
      byType: v.byType,
    }));

  const breakdownMap = new Map<string, { count: number; amount: number }>();
  for (const p of payments) {
    const t = String(p.payment_type || 'daily').toLowerCase();
    const cur = breakdownMap.get(t) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount = roundMoney(cur.amount + num(p.amount_paid));
    breakdownMap.set(t, cur);
  }

  const paymentTypeBreakdown = ['daily', 'weekly', 'monthly', 'termly']
    .filter((t) => breakdownMap.has(t))
    .map((t) => ({
      type: t,
      label: typeLabel(t),
      count: breakdownMap.get(t)!.count,
      amount: breakdownMap.get(t)!.amount,
    }));

  const studentStats = new Map<
    number,
    { totalPaid: number; paymentCount: number; lastPaymentDate: string | null; types: Record<string, number> }
  >();

  for (const p of payments) {
    const sid = Number(p.student_id);
    if (!studentStats.has(sid)) {
      studentStats.set(sid, { totalPaid: 0, paymentCount: 0, lastPaymentDate: null, types: {} });
    }
    const st = studentStats.get(sid)!;
    st.totalPaid = roundMoney(st.totalPaid + num(p.amount_paid));
    st.paymentCount += 1;
    const pd = isoDate(p.payment_date);
    if (pd && (!st.lastPaymentDate || pd > st.lastPaymentDate)) st.lastPaymentDate = pd;
    const pt = String(p.payment_type || 'daily').toLowerCase();
    st.types[pt] = (st.types[pt] || 0) + 1;
  }

  const studentRows = await Promise.all(
    students.map(async (s) => {
      const stats = studentStats.get(s.id);
      const hasPayments = Boolean(stats);
      const status = await getStudentStatusForDate(query, tenantId, s.id, termId, today);
      let mostUsed: string | null = null;
      let maxT = 0;
      if (stats) {
        for (const [t, c] of Object.entries(stats.types)) {
          if (c > maxT) {
            maxT = c;
            mostUsed = t;
          }
        }
      }
      return {
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        studentCode: String(s.student_id || ''),
        admissionNumber: s.admission_number ? String(s.admission_number) : null,
        totalPaid: stats?.totalPaid ?? 0,
        paymentCount: stats?.paymentCount ?? 0,
        lastPaymentDate: stats?.lastPaymentDate ?? null,
        coverageStatus: mapCoverageStatus(status.status, hasPayments),
        mostUsedType: mostUsed,
        mostUsedTypeLabel: mostUsed ? typeLabel(mostUsed) : null,
      };
    })
  );

  return {
    class: { id: classId, name: String(classRes.rows[0].class_name) },
    term: termMeta,
    structure: structure
      ? {
          dailyRate: structure.dailyRate,
          weeklyRate: structure.weeklyRate,
          monthlyRate: structure.monthlyRate,
          termlyRate: structure.termlyRate,
          schoolDaysCount: structure.schoolDaysCount,
        }
      : null,
    summary: {
      totalCollected,
      paymentCount,
      studentsPaying: payingStudentIds.size,
      totalStudents: students.length,
      mostCommonPaymentType: {
        type: mostCommonType,
        label: typeLabel(mostCommonType),
        count: mostCommonCount,
      },
      lastCollection: lastPayment
        ? {
            date: isoDate(lastPayment.payment_date)!,
            studentName: `${lastPayment.first_name} ${lastPayment.last_name}`.trim(),
          }
        : null,
    },
    dailyCollections,
    paymentTypeBreakdown,
    students: studentRows,
  };
}

export async function getStudentReport(tenantId: number, studentId: number, termId: number) {
  const studentRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
            s.passport_photo_url, s.class_assigned_id, c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1 AND s.id = $2`,
    [tenantId, studentId]
  );
  if (studentRes.rows.length === 0) throw new Error('Student not found');
  const srow = studentRes.rows[0];
  const classId = Number(srow.class_assigned_id) || null;

  const termMeta = await resolveTermMeta(tenantId, termId);
  if (!termMeta) throw new Error('Term not found');

  const structure =
    classId != null ? await getDailyFeeStructure(query, tenantId, classId, termId) : null;

  const paymentsRes = await query(
    `SELECT id, payment_date::text AS payment_date, payment_type,
            amount_paid::numeric AS amount_paid,
            coverage_start_date::text AS coverage_start_date,
            coverage_end_date::text AS coverage_end_date,
            next_due_date::text AS next_due_date,
            school_days_covered, payment_method, receipt_number
     FROM daily_fee_payments
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
     ORDER BY payment_date ASC, id ASC`,
    [tenantId, studentId, termId]
  );

  const payments = paymentsRes.rows.map((p) => ({
    id: Number(p.id),
    date: isoDate(p.payment_date)!,
    type: String(p.payment_type || 'daily').toLowerCase(),
    typeLabel: typeLabel(String(p.payment_type)),
    amount: num(p.amount_paid),
    coversFrom: isoDate(p.coverage_start_date)!,
    coversTo: isoDate(p.coverage_end_date)!,
    schoolDays: Number(p.school_days_covered) || 0,
    method: String(p.payment_method || '—'),
    receiptNumber: p.receipt_number ? String(p.receipt_number) : null,
    nextDueDate: isoDate(p.next_due_date),
  }));

  const totalPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
  const paymentCount = payments.length;
  const daysCovered = payments.reduce((sum, p) => sum + p.schoolDays, 0);
  const averagePayment = paymentCount > 0 ? roundMoney(totalPaid / paymentCount) : 0;

  const today = formatDateOnly(new Date());
  const status = await getStudentStatusForDate(query, tenantId, studentId, termId, today);

  let nextDueDate: string | null = null;
  if (status.nextDueDate) nextDueDate = status.nextDueDate;
  else if (payments.length > 0) {
    const last = payments[payments.length - 1];
    nextDueDate = last.nextDueDate;
  }

  let currentStatus = 'Not started';
  let statusDetail = '';
  if (status.status === 'covered' || status.status === 'paid') {
    currentStatus = 'Covered';
    statusDetail = status.paidUntil ? `Covered until ${status.paidUntil}` : 'Up to date';
  } else if (status.status === 'expired') {
    currentStatus = 'Expired';
    statusDetail = status.lastPaidUntil ? `Expired since ${status.lastPaidUntil}` : 'Coverage expired';
  } else if (paymentCount > 0) {
    currentStatus = 'Partial';
    statusDetail = 'Payments recorded';
  }

  let cumulative = 0;
  const paymentTimeline = payments.map((p) => {
    cumulative = roundMoney(cumulative + p.amount);
    return {
      date: p.date,
      amount: p.amount,
      cumulative,
      paymentType: p.type,
      paymentTypeLabel: p.typeLabel,
      coverageStart: p.coversFrom,
      coverageEnd: p.coversTo,
    };
  });

  const closureDates = await getClosureDates(query, tenantId, termId);
  const closureDays = [...closureDates].sort();
  const schoolDaysCount = structure?.schoolDaysCount ?? 0;
  const { start, end } = await resolveTermDateRange(
    tenantId,
    termId,
    termMeta.yearStart,
    termMeta.yearEnd,
    schoolDaysCount
  );

  const paidDatesRes = await query(
    `SELECT collection_date::text AS collection_date, status
     FROM daily_fee_collection_records
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
    [tenantId, studentId, termId]
  );
  const paidDates = new Set(
    paidDatesRes.rows.filter((r) => r.status === 'paid').map((r) => isoDate(r.collection_date)!)
  );

  const termSchoolDays = await listSchoolDaysInRange(query, tenantId, termId, start, end);
  const limitedSchoolDays =
    schoolDaysCount > 0 ? termSchoolDays.slice(0, schoolDaysCount) : termSchoolDays;

  const coverageCalendar = limitedSchoolDays.map((date) => {
    if (!isSchoolDay(date, closureDates)) {
      return { date, status: 'closed' as const };
    }
    if (parseDateOnly(date).getTime() > parseDateOnly(today).getTime()) {
      return { date, status: 'future' as const };
    }
    if (paidDates.has(date)) {
      return { date, status: 'paid' as const };
    }
    return { date, status: 'unpaid' as const };
  });

  const daysCoveredCount = coverageCalendar.filter((d) => d.status === 'paid').length;
  const daysNotCovered = Math.max(0, limitedSchoolDays.length - daysCoveredCount);

  let coverageStatusLabel = 'Not started';
  if (status.status === 'covered' || status.status === 'paid') {
    coverageStatusLabel = status.paidUntil ? `Covered until ${status.paidUntil}` : 'Up to date';
  } else if (status.status === 'expired') {
    coverageStatusLabel = 'Expired';
  } else if (paymentCount > 0) {
    coverageStatusLabel = 'Partial coverage';
  }

  return {
    student: {
      id: Number(srow.id),
      fullName: `${srow.first_name} ${srow.last_name}`.trim(),
      studentId: String(srow.student_id || ''),
      admissionNumber: srow.admission_number ? String(srow.admission_number) : null,
      className: String(srow.class_name || '—'),
      classId,
      photoUrl: srow.passport_photo_url ? String(srow.passport_photo_url) : null,
      hasPhoto: Boolean(srow.passport_photo_url),
    },
    term: termMeta,
    structure: structure
      ? {
          dailyRate: structure.dailyRate,
          weeklyRate: structure.weeklyRate,
          monthlyRate: structure.monthlyRate,
          termlyRate: structure.termlyRate,
          schoolDaysCount: structure.schoolDaysCount,
        }
      : null,
    summary: {
      totalPaid,
      paymentCount,
      daysCovered: daysCoveredCount,
      averagePayment,
      nextDueDate,
      currentStatus,
      statusDetail,
    },
    paymentTimeline,
    coverageCalendar,
    closureDays,
    payments,
    accountSummary: {
      termLabel: termMeta.label,
      totalSchoolDays: limitedSchoolDays.length,
      daysCovered: daysCoveredCount,
      daysNotCovered,
      totalAmountPaid: totalPaid,
      rates: {
        daily: structure?.dailyRate ?? 0,
        weekly: structure?.weeklyRate ?? 0,
        monthly: structure?.monthlyRate ?? 0,
        termly: structure?.termlyRate ?? 0,
      },
      coverageStatusLabel,
    },
  };
}
