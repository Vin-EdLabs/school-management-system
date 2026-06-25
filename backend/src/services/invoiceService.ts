import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import {
  getStudentBalanceFromLedger,
  getArrearsBreakdownFromLedger,
  ledgerBalanceToApiShape,
} from './ledgerBalanceService.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { syncMissingLedgerTermFeesForActiveTerm } from './ledgerFinanceService.js';
import { resolveLedgerFeeStructureForStudent } from './effectiveStudentBalanceService.js';
import { listStudentCharges } from './studentChargesService.js';
import { loadActiveFeeStructureLinesByClassTerm, loadActiveFeeStructureLinesForStudent } from './feeStructureItemsService.js';
import {
  beneficiaryAdjustedFee,
  formatBeneficiaryDiscountLabel,
  type BeneficiaryStudentRow,
} from '../utils/beneficiaryFee.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type InvoiceLineItem = { description: string; amount: number };

export type InvoiceRecord = {
  id: number;
  tenantId: number;
  studentId: number;
  termId: number | null;
  academicYearId: number | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  termFee: number;
  individualCharges: number;
  arrears: number;
  creditApplied: number;
  totalDue: number;
  status: string;
  liveStatus: string;
  lineItems: InvoiceLineItem[];
  generatedByUserId: number | null;
  createdAt: string;
  studentName?: string;
  studentCode?: string;
  className?: string;
  termLabel?: string;
  generatedByName?: string;
  outstanding?: number;
  /** Gross term bill before payments (term + charges + arrears). */
  totalBilled?: number;
  /** Payments recorded this term on the ledger. */
  amountPaid?: number;
  /** Beneficiary / scholarship discount on term fees. */
  discountAmount?: number;
  discountLabel?: string | null;
};

export function resolveLiveInvoiceStatus(
  invoice: { due_date?: string | Date | null },
  outstanding: number,
  paymentsMade = 0
): string {
  const owing = roundMoney(Math.max(0, outstanding));
  if (owing <= 0) return 'paid';
  if (paymentsMade > 0.001) return 'partially_paid';
  if (invoice.due_date) {
    const due = invoice.due_date instanceof Date ? invoice.due_date : new Date(String(invoice.due_date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (due < today && owing > 0) return 'overdue';
  }
  return 'issued';
}

export async function generateInvoiceNumber(
  client: pg.PoolClient | null,
  tenantId: number,
  bump = 0
): Promise<string> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const year = new Date().getFullYear();
  const prefix = `INV${year}`;
  const res = await run(
    `SELECT COALESCE(MAX(CAST(RIGHT(invoice_number, 4) AS INTEGER)), 0) AS mx
     FROM invoices
     WHERE tenant_id = $1 AND invoice_number LIKE $2`,
    [tenantId, `${prefix}%`]
  );
  const seq = parseInt(String(res.rows[0]?.mx || '0'), 10) + 1 + bump;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function loadStudentBeneficiary(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number
): Promise<BeneficiaryStudentRow> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT is_beneficiary, discount_type, discount_value
     FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  return (res.rows[0] as BeneficiaryStudentRow) || {};
}

function resolveTermFeeDiscount(
  structureSubtotal: number,
  ledgerTermFee: number,
  student: BeneficiaryStudentRow
): { termFee: number; discountAmount: number; discountLabel: string | null } {
  if (structureSubtotal <= 0) {
    return { termFee: ledgerTermFee, discountAmount: 0, discountLabel: null };
  }

  const adjusted = beneficiaryAdjustedFee(structureSubtotal, student);
  let discountAmount = roundMoney(adjusted.discountAmount);
  let termFee = roundMoney(adjusted.totalFees);

  if (ledgerTermFee > 0) {
    termFee = ledgerTermFee;
    discountAmount = roundMoney(Math.max(0, structureSubtotal - ledgerTermFee));
  }

  const discountLabel =
    discountAmount > 0.001 ? formatBeneficiaryDiscountLabel(student) : null;
  return { termFee, discountAmount, discountLabel };
}

type BuiltInvoiceLines = {
  lineItems: InvoiceLineItem[];
  discountAmount: number;
  discountLabel: string | null;
  structureSubtotal: number;
  termFee: number;
};

async function buildLineItems(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number,
  termLabel: string,
  balance: Awaited<ReturnType<typeof getStudentBalanceFromLedger>>,
  classId?: number | null
): Promise<BuiltInvoiceLines> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const arrearsLines = await getArrearsBreakdownFromLedger(client, tenantId, studentId, termId);
  const chargeRows = await listStudentCharges(tenantId, studentId, termId);
  const student = await loadStudentBeneficiary(client, tenantId, studentId);
  const items: InvoiceLineItem[] = [];

  let classAssignedId = classId ?? null;
  if (classAssignedId == null) {
    const classRes = await run(
      `SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2`,
      [studentId, tenantId]
    );
    classAssignedId =
      classRes.rows[0]?.class_assigned_id != null ? Number(classRes.rows[0].class_assigned_id) : null;
  }

  const studentFeeBreakdown = await loadActiveFeeStructureLinesForStudent(
    client,
    tenantId,
    studentId,
    termId
  );
  const classFeeBreakdown =
    classAssignedId != null
      ? await loadActiveFeeStructureLinesByClassTerm(tenantId, classAssignedId, termId)
      : null;
  const effectiveBreakdown = studentFeeBreakdown ?? classFeeBreakdown;
  const structureSubtotal = effectiveBreakdown?.subtotal ?? 0;
  const { termFee, discountAmount, discountLabel } = resolveTermFeeDiscount(
    structureSubtotal,
    balance.termFee,
    student
  );

  if (effectiveBreakdown?.lines?.length) {
    for (const line of effectiveBreakdown.lines) {
      if (line.amount > 0) items.push({ description: line.label, amount: line.amount });
    }
    if (discountAmount > 0 && discountLabel) {
      items.push({ description: discountLabel, amount: -discountAmount });
    }
  } else if (balance.termFee > 0) {
    items.push({ description: `Tuition Fee — ${termLabel}`, amount: balance.termFee });
  } else if (termFee > 0) {
    items.push({ description: `Tuition Fee — ${termLabel}`, amount: termFee });
  }

  for (const c of chargeRows) {
    if (c.amount > 0) items.push({ description: c.description, amount: c.amount });
  }
  if (arrearsLines.length > 0) {
    for (const a of arrearsLines) {
      if (a.amount > 0) items.push({ description: a.description, amount: a.amount });
    }
  } else if (balance.arrears > 0) {
    items.push({ description: 'Arrears', amount: balance.arrears });
  }
  const creditApplied = roundMoney(balance.creditFromCarryForward);
  if (creditApplied > 0) {
    items.push({ description: 'Credit Applied', amount: -creditApplied });
  }
  if (balance.paymentsMade > 0) {
    items.push({ description: 'Payments Received', amount: -balance.paymentsMade });
  }

  return { lineItems: items, discountAmount, discountLabel, structureSubtotal, termFee };
}

export type ResolvedInvoiceAmounts = {
  lineItems: InvoiceLineItem[];
  termFee: number;
  individualCharges: number;
  arrears: number;
  creditApplied: number;
  amountPaid: number;
  discountAmount: number;
  discountLabel: string | null;
  totalBilled: number;
  outstanding: number;
};

function sumLineItems(lineItems: InvoiceLineItem[]): number {
  return roundMoney(lineItems.reduce((sum, line) => sum + line.amount, 0));
}

/** Build line items and derive totals — fees + arrears + charges, minus discount, credit and payments. */
export async function resolveInvoiceAmounts(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number,
  termLabel: string,
  classId?: number | null
): Promise<ResolvedInvoiceAmounts> {
  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, termId);
  const feeResolved =
    balance.termFee <= 0
      ? await resolveLedgerFeeStructureForStudent(client, tenantId, studentId, termId)
      : null;
  const balanceForLines =
    feeResolved && balance.termFee <= 0
      ? {
          ...balance,
          termFee: feeResolved.netTotal,
          totalDue: roundMoney(
            feeResolved.netTotal + balance.individualCharges + balance.arrears
          ),
          outstanding: roundMoney(
            Math.max(
              0,
              feeResolved.netTotal +
                balance.individualCharges +
                balance.arrears -
                balance.paymentsMade -
                balance.creditFromCarryForward
            )
          ),
        }
      : balance;

  const built = await buildLineItems(
    client,
    tenantId,
    studentId,
    termId,
    termLabel,
    balanceForLines,
    classId
  );

  const creditApplied = roundMoney(balance.creditFromCarryForward);
  const amountPaid = balance.paymentsMade;
  const termFeesBeforeDiscount =
    built.structureSubtotal > 0
      ? built.structureSubtotal
      : built.termFee > 0
        ? built.termFee
        : feeResolved
          ? feeResolved.netTotal
          : balance.termFee;
  const totalBilled = roundMoney(
    termFeesBeforeDiscount + balance.individualCharges + balance.arrears
  );
  const outstanding = roundMoney(Math.max(0, sumLineItems(built.lineItems)));

  return {
    lineItems: built.lineItems,
    termFee: built.termFee,
    individualCharges: balance.individualCharges,
    arrears: balance.arrears,
    creditApplied,
    amountPaid,
    discountAmount: built.discountAmount,
    discountLabel: built.discountLabel,
    totalBilled,
    outstanding: outstanding > 0 ? outstanding : roundMoney(Math.max(0, totalBilled - amountPaid - creditApplied)),
  };
}

/** Recompute invoice amounts from the live student ledger and persist + return. */
export async function syncInvoiceFromLedger(
  tenantId: number,
  invoiceId: number
): Promise<InvoiceRecord | null> {
  const res = await query(
    `SELECT i.*,
            s.first_name, s.last_name, s.student_id AS student_code, s.class_assigned_id,
            c.class_name,
            t.name AS term_name,
            u.full_name AS generated_by_name
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     LEFT JOIN terms t ON t.id = i.term_id
     LEFT JOIN users u ON u.id = i.generated_by_user_id
     WHERE i.tenant_id = $1 AND i.id = $2`,
    [tenantId, invoiceId]
  );
  if (!res.rows.length) return null;

  const row = res.rows[0];
  const studentId = Number(row.student_id);
  const termId = row.term_id != null ? Number(row.term_id) : null;
  if (!termId) {
    return mapInvoiceRow(row, {
      studentName: `${row.first_name} ${row.last_name}`.trim(),
      studentCode: String(row.student_code || ''),
      className: String(row.class_name || ''),
      termLabel: String(row.term_name || ''),
      generatedByName: row.generated_by_name ? String(row.generated_by_name) : undefined,
    });
  }

  const termLabel = String(row.term_name || 'Current term').trim();
  const classId = row.class_assigned_id != null ? Number(row.class_assigned_id) : null;
  const amounts = await resolveInvoiceAmounts(null, tenantId, studentId, termId, termLabel, classId);

  const liveStatus = resolveLiveInvoiceStatus(
    { due_date: row.due_date as Date | string | null },
    amounts.outstanding,
    amounts.amountPaid
  );

  await query(
    `UPDATE invoices
     SET term_fee = $1,
         individual_charges = $2,
         arrears = $3,
         credit_applied = $4,
         total_due = $5,
         line_items = $6::jsonb,
         status = $7
     WHERE id = $8 AND tenant_id = $9`,
    [
      amounts.termFee,
      amounts.individualCharges,
      amounts.arrears,
      amounts.creditApplied,
      amounts.outstanding,
      JSON.stringify(amounts.lineItems),
      liveStatus,
      invoiceId,
      tenantId,
    ]
  );

  return mapInvoiceRow(
    {
      ...row,
      term_fee: amounts.termFee,
      individual_charges: amounts.individualCharges,
      arrears: amounts.arrears,
      credit_applied: amounts.creditApplied,
      total_due: amounts.outstanding,
      line_items: amounts.lineItems,
      status: liveStatus,
    },
    {
      studentName: `${row.first_name} ${row.last_name}`.trim(),
      studentCode: String(row.student_code || ''),
      className: String(row.class_name || ''),
      termLabel,
      generatedByName: row.generated_by_name ? String(row.generated_by_name) : undefined,
      outstanding: amounts.outstanding,
      totalBilled: amounts.totalBilled,
      amountPaid: amounts.amountPaid,
      discountAmount: amounts.discountAmount,
      discountLabel: amounts.discountLabel,
    }
  );
}

function mapInvoiceRow(row: Record<string, unknown>, extras?: Partial<InvoiceRecord>): InvoiceRecord {
  const lineItems = (() => {
    if (Array.isArray(row.line_items)) return row.line_items as InvoiceLineItem[];
    if (typeof row.line_items === 'string') {
      try {
        const parsed = JSON.parse(row.line_items) as unknown;
        return Array.isArray(parsed) ? (parsed as InvoiceLineItem[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  const issueDate =
    row.issue_date instanceof Date
      ? row.issue_date.toISOString().split('T')[0]
      : String(row.issue_date || '').split('T')[0];
  const dueDate =
    row.due_date == null
      ? null
      : row.due_date instanceof Date
        ? row.due_date.toISOString().split('T')[0]
        : String(row.due_date).split('T')[0];

  const outstanding = extras?.outstanding ?? roundMoney(parseFloat(String(row.total_due)) || 0);
  const paymentsMade = extras?.amountPaid ?? 0;
  const liveStatus = resolveLiveInvoiceStatus(
    { due_date: row.due_date as Date | string | null },
    outstanding,
    paymentsMade
  );

  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    studentId: Number(row.student_id),
    termId: row.term_id != null ? Number(row.term_id) : null,
    academicYearId: row.academic_year_id != null ? Number(row.academic_year_id) : null,
    invoiceNumber: String(row.invoice_number),
    issueDate,
    dueDate,
    termFee: roundMoney(parseFloat(String(row.term_fee)) || 0),
    individualCharges: roundMoney(parseFloat(String(row.individual_charges)) || 0),
    arrears: roundMoney(parseFloat(String(row.arrears)) || 0),
    creditApplied: roundMoney(parseFloat(String(row.credit_applied)) || 0),
    totalDue: roundMoney(parseFloat(String(row.total_due)) || 0),
    status: String(row.status || 'issued'),
    liveStatus,
    lineItems,
    generatedByUserId: row.generated_by_user_id != null ? Number(row.generated_by_user_id) : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
    studentName: extras?.studentName,
    studentCode: extras?.studentCode,
    className: extras?.className,
    termLabel: extras?.termLabel,
    generatedByName: extras?.generatedByName,
    outstanding,
    totalBilled:
      extras?.totalBilled ??
      roundMoney(
        (parseFloat(String(row.term_fee)) || 0) +
          (parseFloat(String(row.individual_charges)) || 0) +
          (parseFloat(String(row.arrears)) || 0)
      ),
    amountPaid: extras?.amountPaid,
    discountAmount: extras?.discountAmount,
    discountLabel: extras?.discountLabel ?? null,
  };
}

export async function studentHasInvoiceForTerm(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<boolean> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT 1 FROM invoices WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 LIMIT 1`,
    [tenantId, studentId, termId]
  );
  return res.rows.length > 0;
}

export type GenerateInvoiceResult =
  | { ok: true; invoice: InvoiceRecord; refreshed?: boolean }
  | { ok: false; reason: 'duplicate' | 'zero_balance' | 'not_found' | 'no_term' };

export async function generateSingleInvoice(
  tenantId: number,
  studentId: number,
  options: {
    termId?: number | null;
    dueDate?: string | null;
    generatedByUserId?: number | null;
  } = {}
): Promise<GenerateInvoiceResult> {
  try {
    await syncMissingLedgerTermFeesForActiveTerm(tenantId);
  } catch (syncErr) {
    console.error('[generateSingleInvoice] Ledger fee sync failed (continuing):', syncErr);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const run = client.query.bind(client);
    const { ledgerTermId, academicYearId, termLabel } = await resolveActiveLedgerTerm(
      run,
      tenantId,
      options.termId ?? undefined
    );
    if (!ledgerTermId || !academicYearId) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'no_term' };
    }

    const studentRes = await run(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.class_assigned_id, c.class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_assigned_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );
    if (studentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }

    if (await studentHasInvoiceForTerm(client, tenantId, studentId, ledgerTermId)) {
      await client.query('ROLLBACK');
      const existingRes = await query(
        `SELECT id FROM invoices WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 ORDER BY id DESC LIMIT 1`,
        [tenantId, studentId, ledgerTermId]
      );
      const existingId = existingRes.rows[0]?.id != null ? Number(existingRes.rows[0].id) : null;
      if (existingId) {
        const refreshed = await syncInvoiceFromLedger(tenantId, existingId);
        if (refreshed) return { ok: true, invoice: refreshed, refreshed: true };
      }
      return { ok: false, reason: 'duplicate' };
    }

    const classAssignedId =
      studentRes.rows[0].class_assigned_id != null
        ? Number(studentRes.rows[0].class_assigned_id)
        : null;

    const amounts = await resolveInvoiceAmounts(
      client,
      tenantId,
      studentId,
      ledgerTermId,
      termLabel || 'Current term',
      classAssignedId
    );

    if (amounts.outstanding <= 0.001 && amounts.totalBilled <= 0.001) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'zero_balance' };
    }

    const issueDate = new Date().toISOString().split('T')[0];
    let invoiceNumber = '';
    let inserted: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      invoiceNumber = await generateInvoiceNumber(client, tenantId, attempt);
      try {
        const ins = await run(
          `INSERT INTO invoices (
            tenant_id, student_id, term_id, academic_year_id, invoice_number,
            issue_date, due_date, term_fee, individual_charges, arrears,
            credit_applied, total_due, status, line_items, generated_by_user_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'issued',$13::jsonb,$14)
          RETURNING *`,
          [
            tenantId,
            studentId,
            ledgerTermId,
            academicYearId,
            invoiceNumber,
            issueDate,
            options.dueDate || null,
            amounts.termFee,
            amounts.individualCharges,
            amounts.arrears,
            amounts.creditApplied,
            amounts.outstanding,
            JSON.stringify(amounts.lineItems),
            options.generatedByUserId ?? null,
          ]
        );
        inserted = ins.rows[0];
        break;
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code !== '23505' || attempt === 2) throw e;
      }
    }

    if (!inserted) {
      await client.query('ROLLBACK');
      throw new Error('Failed to create invoice');
    }

    await client.query('COMMIT');

    const student = studentRes.rows[0];
    const invoice = mapInvoiceRow(inserted, {
      studentName: `${student.first_name} ${student.last_name}`.trim(),
      studentCode: String(student.student_id || ''),
      className: String(student.class_name || ''),
      termLabel: termLabel || undefined,
      outstanding: amounts.outstanding,
      totalBilled: amounts.totalBilled,
      amountPaid: amounts.amountPaid,
      discountAmount: amounts.discountAmount,
      discountLabel: amounts.discountLabel,
    });

    return { ok: true, invoice };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type BulkInvoiceSummary = {
  generated: number;
  skipped: number;
  totalInvoicedAmount: number;
  invoices: InvoiceRecord[];
  existingInvoices: InvoiceRecord[];
  skippedStudents: Array<{ studentId: number; studentName: string; reason: string }>;
};

export async function generateBulkInvoices(
  tenantId: number,
  options: {
    termId?: number | null;
    classId?: number | null;
    dueDate?: string | null;
    generatedByUserId?: number | null;
  } = {}
): Promise<BulkInvoiceSummary> {
  try {
    await syncMissingLedgerTermFeesForActiveTerm(tenantId);
  } catch (syncErr) {
    console.error('[generateBulkInvoices] Ledger fee sync failed (continuing):', syncErr);
  }

  const run: QueryFn = query;
  const { ledgerTermId } = await resolveActiveLedgerTerm(run, tenantId, options.termId ?? undefined);
  if (!ledgerTermId) {
    return {
      generated: 0,
      skipped: 0,
      totalInvoicedAmount: 0,
      invoices: [],
      existingInvoices: [],
      skippedStudents: [],
    };
  }

  const params: unknown[] = [tenantId];
  let classFilter = '';
  if (options.classId != null && !Number.isNaN(Number(options.classId))) {
    classFilter = ' AND s.class_assigned_id = $2';
    params.push(options.classId);
  }

  const studentsRes = await run(
    `SELECT s.id, s.first_name, s.last_name
     FROM students s
     WHERE s.tenant_id = $1
       AND COALESCE(s.enrollment_status, 'active') = 'active'
       ${classFilter}
     ORDER BY s.last_name, s.first_name`,
    params
  );

  const invoices: InvoiceRecord[] = [];
  const existingInvoices: InvoiceRecord[] = [];
  const skippedStudents: BulkInvoiceSummary['skippedStudents'] = [];
  let totalInvoicedAmount = 0;

  for (const row of studentsRes.rows) {
    const studentId = Number(row.id);
    const studentName = `${row.first_name} ${row.last_name}`.trim();
    const result = await generateSingleInvoice(tenantId, studentId, {
      termId: ledgerTermId,
      dueDate: options.dueDate,
      generatedByUserId: options.generatedByUserId,
    });

    if (result.ok) {
      if (result.refreshed) {
        existingInvoices.push(result.invoice);
      } else {
        invoices.push(result.invoice);
        totalInvoicedAmount = roundMoney(totalInvoicedAmount + result.invoice.totalDue);
      }
    } else {
      const reasonMap: Record<string, string> = {
        duplicate: 'Already invoiced for this term',
        zero_balance: 'Zero balance — nothing to invoice',
        not_found: 'Student not found',
        no_term: 'No active term',
      };
      if (result.reason === 'duplicate') {
        const existing = await fetchInvoiceForStudentTerm(tenantId, studentId, ledgerTermId);
        if (existing) existingInvoices.push(existing);
      }
      skippedStudents.push({
        studentId,
        studentName,
        reason: reasonMap[result.reason] || result.reason,
      });
    }
  }

  return {
    generated: invoices.length,
    skipped: skippedStudents.length,
    totalInvoicedAmount,
    invoices,
    existingInvoices,
    skippedStudents,
  };
}

export async function getInvoiceOutstanding(
  tenantId: number,
  studentId: number,
  termId: number | null
): Promise<number> {
  if (!termId) return 0;
  const balance = await getStudentBalanceFromLedger(null, tenantId, studentId, termId);
  return balance.outstanding;
}

async function fetchInvoiceForStudentTerm(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<InvoiceRecord | null> {
  const res = await query(
    `SELECT id FROM invoices
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [tenantId, studentId, termId]
  );
  if (!res.rows.length) return null;
  return syncInvoiceFromLedger(tenantId, Number(res.rows[0].id));
}

export async function listInvoices(
  tenantId: number,
  filters: {
    termId?: number | null;
    classId?: number | null;
    status?: string | null;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: InvoiceRecord[]; total: number }> {
  const conditions = ['i.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (filters.termId != null) {
    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId, filters.termId);
    if (ledgerTermId != null) {
      conditions.push(`i.term_id = $${idx++}`);
      params.push(ledgerTermId);
    }
  }
  if (filters.classId != null) {
    conditions.push(`s.class_assigned_id = $${idx++}`);
    params.push(filters.classId);
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     WHERE ${where}`,
    params
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const listRes = await query(
    `SELECT i.*,
            s.first_name, s.last_name, s.student_id AS student_code, c.class_name,
            t.name AS term_name,
            u.full_name AS generated_by_name
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     LEFT JOIN terms t ON t.id = i.term_id
     LEFT JOIN users u ON u.id = i.generated_by_user_id
     WHERE ${where}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const items: InvoiceRecord[] = [];
  for (const row of listRes.rows) {
    const synced = await syncInvoiceFromLedger(tenantId, Number(row.id));
    if (!synced) continue;
    if (filters.status && filters.status !== 'all' && synced.liveStatus !== filters.status) continue;
    items.push(synced);
  }

  return { items, total: filters.status && filters.status !== 'all' ? items.length : total };
}

export async function getInvoiceById(
  tenantId: number,
  invoiceId: number
): Promise<InvoiceRecord | null> {
  return syncInvoiceFromLedger(tenantId, invoiceId);
}

export async function getInvoicePdfPayload(tenantId: number, invoiceId: number) {
  const invoice = await getInvoiceById(tenantId, invoiceId);
  if (!invoice) return null;

  const settingsRes = await query(
    `SELECT school_name, address, contact, email, receipt_footer, bank_details, postal_address
     FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const tenantRes = await query(
    `SELECT name, logo_url, primary_color FROM tenants WHERE id = $1`,
    [tenantId]
  );
  const accountsRes = await query(
    `SELECT account_name, account_type, account_number, branch, network, phone_number, is_active
     FROM payment_accounts
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY is_default DESC, account_name`,
    [tenantId]
  );

  const settings = settingsRes.rows[0] || {};
  const tenant = tenantRes.rows[0] || {};

  return {
    invoice,
    school: {
      name: String(settings.school_name || tenant.name || 'School'),
      address: String(settings.address || settings.postal_address || settings.physical_address || ''),
      contact: String(settings.contact || settings.contact_phone || settings.phone_number || ''),
      email: String(settings.email || ''),
      footer: String(settings.receipt_footer || ''),
      bankDetails: String(settings.bank_details || ''),
      logoUrl: tenant.logo_url ? String(tenant.logo_url) : null,
      primaryColor: tenant.primary_color ? String(tenant.primary_color) : '#1a3a6b',
    },
    paymentAccounts: accountsRes.rows.map((a) => ({
      name: String(a.account_name || ''),
      type: String(a.account_type || ''),
      accountNumber: a.account_number ? String(a.account_number) : null,
      bankName:
        a.account_type === 'bank' && a.branch
          ? String(a.branch)
          : a.network
            ? String(a.network)
            : null,
      momoNumber: a.phone_number ? String(a.phone_number) : null,
    })),
  };
}

/** Sync all invoices from live ledger (for background job). */
export async function syncInvoiceStatuses(tenantId?: number): Promise<number> {
  const params: unknown[] = [];
  let tenantFilter = '';
  if (tenantId != null) {
    tenantFilter = 'WHERE tenant_id = $1';
    params.push(tenantId);
  }

  const res = await query(`SELECT id, tenant_id, status FROM invoices ${tenantFilter}`, params);

  let updated = 0;
  for (const row of res.rows) {
    const before = String(row.status || '');
    const synced = await syncInvoiceFromLedger(Number(row.tenant_id), Number(row.id));
    if (synced && synced.status !== before) updated++;
  }
  return updated;
}

export { ledgerBalanceToApiShape };
