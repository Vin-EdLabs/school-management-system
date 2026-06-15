import type pg from 'pg';
import { query } from '../db/connection.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { getTermByTermLedgerSummary, type TermLedgerSummaryRow } from './ledgerBalanceService.js';

type QueryFn = typeof query;

export type LedgerStatementRow = {
  id: number;
  date: string;
  description: string;
  entryType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  receiptNumber: string | null;
  paymentMethod: string | null;
  paymentId: number | null;
};

export type LedgerTermOption = {
  termId: number;
  academicYearId: number;
  label: string;
};

export type LedgerStatementSummary = {
  totalCharged: number;
  totalPaid: number;
  outstanding: number;
};

export type StudentLedgerStatementHeader = {
  id: number;
  fullName: string;
  studentId: string;
  admissionNumber: string;
  className: string;
};

export type StudentLedgerStatementResponse = {
  student: StudentLedgerStatementHeader;
  termId: number | null;
  academicYearId: number | null;
  termLabel: string | null;
  availableTerms: LedgerTermOption[];
  entries: LedgerStatementRow[];
  summary: LedgerStatementSummary;
  termSummary: TermLedgerSummaryRow[];
};

/** @deprecated Use StudentLedgerStatementResponse */
export type StudentLedgerStatement = StudentLedgerStatementResponse & {
  studentId: number;
  totalCharged: number;
  totalPaid: number;
  balance: number;
  outstanding: number;
  credit: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const raw = String(value || '');
  return raw.split('T')[0] || raw;
}

async function fetchAvailableTerms(
  run: QueryFn,
  tenantId: number,
  studentId: number
): Promise<LedgerTermOption[]> {
  const res = await run(
    `SELECT DISTINCT sl.term_id, t.academic_year_id, t.name AS term_part, ay.name AS year_part
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1 AND sl.student_id = $2 AND sl.term_id IS NOT NULL
     ORDER BY ay.name ASC, t.name ASC`,
    [tenantId, studentId]
  );
  return res.rows.map((row) => ({
    termId: Number(row.term_id),
    academicYearId: Number(row.academic_year_id),
    label: `${row.term_part} ${row.year_part}`.trim(),
  }));
}

async function resolveFilterTermId(
  run: QueryFn,
  tenantId: number,
  opts: { termId?: number | null; academicYearId?: number | null }
): Promise<{ termId: number | null; academicYearId: number | null; termLabel: string | null }> {
  const hasTermId = opts.termId != null && !Number.isNaN(Number(opts.termId));
  const hasYearId = opts.academicYearId != null && !Number.isNaN(Number(opts.academicYearId));

  if (hasTermId) {
    const res = await run(
      `SELECT t.id, t.academic_year_id, t.name AS term_part, ay.name AS year_part
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [opts.termId, tenantId]
    );
    if (res.rows.length === 0) return { termId: null, academicYearId: null, termLabel: null };
    const row = res.rows[0];
    return {
      termId: Number(row.id),
      academicYearId: Number(row.academic_year_id),
      termLabel: `${row.term_part} ${row.year_part}`.trim(),
    };
  }

  if (hasYearId) {
    const res = await run(
      `SELECT t.id, t.academic_year_id, t.name AS term_part, ay.name AS year_part
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1 AND t.academic_year_id = $2 AND t.is_current = true
       LIMIT 1`,
      [tenantId, opts.academicYearId]
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        termId: Number(row.id),
        academicYearId: Number(row.academic_year_id),
        termLabel: `${row.term_part} ${row.year_part}`.trim(),
      };
    }
  }

  const active = await resolveActiveLedgerTerm(run, tenantId);
  return {
    termId: active.ledgerTermId,
    academicYearId: active.academicYearId,
    termLabel: active.termLabel,
  };
}

/** Outstanding balance from student_ledger for one term (debit − credit). */
export async function getLedgerOutstandingBalance(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<number> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS outstanding
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2 AND term_id = $3`,
    [studentId, tenantId, termId]
  );
  return roundMoney(parseFloat(res.rows[0]?.outstanding || '0') || 0);
}

/**
 * Full ledger statement — single source of truth for student financial records.
 * Running balance via SQL window function.
 */
export async function getStudentLedgerStatement(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  opts: {
    termId?: number | null;
    academicYearId?: number | null;
    allTerms?: boolean;
    currentTermOnly?: boolean;
  } = {}
): Promise<StudentLedgerStatementResponse | null> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const studentRes = await run(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number, c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;

  const student = studentRes.rows[0];
  const availableTerms = await fetchAvailableTerms(run, tenantId, studentId);

  const explicitTermFilter =
    (opts.termId != null && !Number.isNaN(Number(opts.termId))) ||
    (opts.academicYearId != null && !Number.isNaN(Number(opts.academicYearId))) ||
    opts.currentTermOnly === true;
  const showAllTerms = opts.allTerms === true || !explicitTermFilter;

  let filterTermId: number | null = null;
  let termLabel: string | null = 'All terms';
  let academicYearId: number | null = null;

  if (!showAllTerms) {
    const termFilter = await resolveFilterTermId(run, tenantId, opts);
    filterTermId = termFilter.termId;
    termLabel = termFilter.termLabel;
    academicYearId = termFilter.academicYearId;
  }

  const entriesRes = await run(
    `SELECT
       id,
       created_at,
       description,
       entry_type,
       debit,
       credit,
       receipt_number,
       payment_method,
       payment_id,
       SUM(debit - credit) OVER (
         ORDER BY created_at ASC, id ASC
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_balance
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2
       AND ($3::int IS NULL OR term_id = $3)
     ORDER BY created_at ASC, id ASC`,
    [studentId, tenantId, filterTermId]
  );

  const entries: LedgerStatementRow[] = entriesRes.rows.map((row) => ({
    id: Number(row.id),
    date: formatDate(row.created_at),
    description: String(row.description || ''),
    entryType: String(row.entry_type || ''),
    debit: roundMoney(parseFloat(row.debit) || 0),
    credit: roundMoney(parseFloat(row.credit) || 0),
    runningBalance: roundMoney(parseFloat(row.running_balance) || 0),
    receiptNumber: row.receipt_number ? String(row.receipt_number) : null,
    paymentMethod: row.payment_method ? String(row.payment_method) : null,
    paymentId: row.payment_id != null ? Number(row.payment_id) : null,
  }));

  const summaryRes = await run(
    `SELECT
       COALESCE(SUM(debit), 0) AS total_charged,
       COALESCE(SUM(credit), 0) AS total_paid,
       COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS outstanding
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2
       AND ($3::int IS NULL OR term_id = $3)`,
    [studentId, tenantId, filterTermId]
  );

  const summaryRow = summaryRes.rows[0] || {};
  const summary: LedgerStatementSummary = {
    totalCharged: roundMoney(parseFloat(summaryRow.total_charged) || 0),
    totalPaid: roundMoney(parseFloat(summaryRow.total_paid) || 0),
    outstanding: roundMoney(parseFloat(summaryRow.outstanding) || 0),
  };

  const termSummary = await getTermByTermLedgerSummary(client, tenantId, studentId);

  return {
    student: {
      id: Number(student.id),
      fullName: `${student.first_name} ${student.last_name}`.trim(),
      studentId: String(student.student_id || ''),
      admissionNumber: String(student.admission_number || ''),
      className: String(student.class_name || '—'),
    },
    termId: filterTermId,
    academicYearId,
    termLabel,
    availableTerms,
    entries,
    summary,
    termSummary,
  };
}

/** Backward-compatible alias */
export async function buildStudentLedgerStatement(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  opts: { termId?: number | null; academicYearId?: number | null } = {}
): Promise<StudentLedgerStatement | null> {
  const res = await getStudentLedgerStatement(client, tenantId, studentId, opts);
  if (!res) return null;
  const balance = res.summary.outstanding;
  return {
    ...res,
    studentId,
    totalCharged: res.summary.totalCharged,
    totalPaid: res.summary.totalPaid,
    balance,
    outstanding: roundMoney(Math.max(0, balance)),
    credit: roundMoney(Math.max(0, -balance)),
  };
}
