import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import { type FeeBalanceResult } from './financeCalculationService.js';
import { resolvePaymentAccountForTransaction } from './paymentAccountService.js';
import { getStudentFeeBalance, buildReceiptSnapshot } from './studentFeeBalanceService.js';

const CORRECTION_WINDOW_DAYS = 7;

export type CorrectionInput = {
  amount: number;
  payment_date: string;
  payment_method?: string;
  payment_account_id?: number;
  student_id: number;
  reason: string;
  correction_type: 'debit' | 'credit';
  term?: string;
  notes?: string;
};

type PaymentRow = Record<string, unknown>;

function resolveTermForMatch(term: string | null): string | null {
  return term ? String(term).trim() : null;
}

async function resolvePaymentChain(
  client: pg.PoolClient | null,
  tenantId: number,
  paymentId: number
): Promise<{ root: PaymentRow; chain: PaymentRow[]; active: PaymentRow }> {
  const run = client ? client.query.bind(client) : query;
  let currentId = paymentId;
  const chain: PaymentRow[] = [];

  for (let depth = 0; depth < 25; depth++) {
    const res = await run(`SELECT p.* FROM payments p WHERE p.id = $1 AND p.tenant_id = $2`, [
      currentId,
      tenantId,
    ]);
    if (!res.rows.length) {
      throw new Error('Payment not found');
    }
    const row = res.rows[0];
    chain.unshift(row);
    if (!row.corrects_payment_id) break;
    currentId = row.corrects_payment_id;
  }

  const root = chain[0];
  const active = chain[chain.length - 1];
  return { root, chain, active };
}

async function getAccountLabel(
  client: pg.PoolClient | null,
  tenantId: number,
  accountId: number | null | undefined,
  fallbackMethod?: string | null
): Promise<string> {
  if (accountId == null) return fallbackMethod || 'Unlinked';
  const run = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT COALESCE(NULLIF(TRIM(nickname), ''), account_name) AS label
     FROM payment_accounts WHERE id = $1 AND tenant_id = $2`,
    [accountId, tenantId]
  );
  return res.rows[0]?.label || fallbackMethod || 'Unlinked';
}

/** Format a payment/receipt date as DD/MM/YYYY for audit storage. */
export function formatCorrectionAuditDate(value: unknown): string {
  if (value == null || value === '') return '—';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = value;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
  }
  return raw;
}

function buildMethodChangeLabel(beforeLabel: string, afterLabel: string) {
  const b = (beforeLabel || '—').trim();
  const a = (afterLabel || '—').trim();
  if (b.toLowerCase() === a.toLowerCase()) return 'No change';
  return `${b} → ${a}`;
}

function buildDateChangeLabel(beforeDate: unknown, afterDate: unknown) {
  const b = formatCorrectionAuditDate(beforeDate);
  const a = formatCorrectionAuditDate(afterDate);
  if (b === a) return 'No change';
  return `${b} → ${a}`;
}

export function extractBalanceSnapshot(balance: FeeBalanceResult) {
  const totalFees = Number(balance.totalFees) || 0;
  const totalPaid = Number(balance.totalPaid) || 0;
  const arrears = Number(balance.arrears) || 0;
  const totalDue = totalFees + arrears;
  const rawOutstanding = Number(balance.outstanding);
  const owing = rawOutstanding > 0.0001 ? rawOutstanding : 0;
  const credit =
    Number(balance.credit) > 0.0001
      ? Number(balance.credit)
      : rawOutstanding < -0.0001
        ? Math.abs(rawOutstanding)
        : 0;

  return {
    balance_before: Math.round(owing * 100) / 100,
    balance_after: Math.round(owing * 100) / 100,
    balance_outstanding: Math.round(owing * 100) / 100,
    balance_credit: Math.round(credit * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    total_due: Math.round(totalDue * 100) / 100,
    has_fees_assigned: totalDue > 0.0001,
    has_payments_recorded: totalPaid > 0.0001,
  };
}

export function projectBalanceAfterCorrection(
  balanceBefore: FeeBalanceResult,
  originalAmount: number,
  newAmount: number,
  correctionType: 'debit' | 'credit'
) {
  validateCorrectionTypeAmount(correctionType, originalAmount, newAmount);

  const signedBefore = signedNetFromBalance(balanceBefore);
  const { balanceChange, newSignedBalance, signedAfter } = computeCorrectionBalanceAfter(
    signedBefore,
    originalAmount,
    newAmount,
    correctionType
  );

  const oweLess = correctionType === 'credit' ? Math.max(0, balanceChange) : 0;
  const oweMore = correctionType === 'debit' ? Math.max(0, balanceChange) : 0;
  const { outstanding, credit } = signedToOwingAndCredit(signedAfter);
  const totalDue = Number(balanceBefore.totalFees) + Number(balanceBefore.arrears);
  const projectedPaid = Number(balanceBefore.totalPaid) - originalAmount + newAmount;

  return {
    outstanding,
    credit,
    oweLess,
    oweMore,
    signedBefore,
    signedAfter,
    balanceChange,
    totalDue,
    projectedPaid,
  };
}

export function validateCorrectionTypeAmount(
  correctionType: 'debit' | 'credit',
  originalAmount: number,
  newAmount: number
) {
  if (correctionType === 'debit' && newAmount >= originalAmount - 0.0001) {
    throw new Error('Debit correction requires a lower amount than the original');
  }
  if (correctionType === 'credit' && newAmount <= originalAmount + 0.0001) {
    throw new Error('Credit correction requires a higher amount than the original');
  }
}

/** Signed net: positive = student owes, negative = student has credit/overpayment. */
export function signedNetFromBalance(balance: FeeBalanceResult): number {
  const outstanding = Number(balance.outstanding);
  const credit = Number(balance.credit) || 0;
  if (outstanding > 0.0001) return outstanding;
  if (outstanding < -0.0001) return outstanding;
  if (credit > 0.0001) return -credit;
  return 0;
}

/**
 * Apply correction to the student's outstanding balance.
 * Credit: student paid more than recorded → balance decreases.
 * Debit: payment was overstated → balance increases.
 */
export function computeCorrectionBalanceAfter(
  currentSignedBalance: number,
  originalAmount: number,
  newAmount: number,
  correctionType: 'debit' | 'credit'
) {
  validateCorrectionTypeAmount(correctionType, originalAmount, newAmount);

  if (correctionType === 'credit') {
    const balanceChange = newAmount - originalAmount;
    const newSignedBalance = currentSignedBalance - balanceChange;
    return { balanceChange, newSignedBalance, signedBefore: currentSignedBalance, signedAfter: newSignedBalance };
  }

  const balanceChange = originalAmount - newAmount;
  const newSignedBalance = currentSignedBalance + balanceChange;
  return { balanceChange, newSignedBalance, signedBefore: currentSignedBalance, signedAfter: newSignedBalance };
}

export function signedToOwingAndCredit(signed: number) {
  if (signed > 0.0001) {
    return { outstanding: signed, credit: 0 };
  }
  if (signed < -0.0001) {
    return { outstanding: 0, credit: Math.abs(signed) };
  }
  return { outstanding: 0, credit: 0 };
}

export function getCorrectionEligibility(
  payment: {
    is_voided?: boolean;
    corrected_by_payment_id?: number | null;
  },
  rootCreatedAt: string
) {
  if (payment.is_voided) {
    return { canCorrect: false, reason: 'This receipt has been voided' };
  }
  if (payment.corrected_by_payment_id) {
    return { canCorrect: false, reason: 'This receipt was superseded by a newer correction' };
  }
  const anchor = new Date(rootCreatedAt);
  if (Number.isNaN(anchor.getTime())) {
    return { canCorrect: false, reason: 'Original receipt creation date is unavailable' };
  }
  const ageMs = Date.now() - anchor.getTime();
  const windowMs = CORRECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > windowMs) {
    return {
      canCorrect: false,
      reason: 'This receipt is locked and cannot be corrected after 7 days',
    };
  }
  const daysLeft = Math.ceil((windowMs - ageMs) / (24 * 60 * 60 * 1000));
  return { canCorrect: true, daysLeft };
}

function formatAmountDifference(originalAmount: number, newAmount: number, correctionType: string) {
  const diff = Math.abs(newAmount - originalAmount);
  const direction = newAmount >= originalAmount ? 'added' : 'removed';
  return {
    original_amount: originalAmount,
    new_amount: newAmount,
    difference: diff,
    difference_direction: direction,
    amount_change_label: `GHS ${originalAmount.toFixed(2)} → GHS ${newAmount.toFixed(2)} (GHS ${diff.toFixed(2)} ${direction})`,
    correction_type: correctionType,
  };
}

export async function getCorrectionHistory(tenantId: number, paymentId: number) {
  const { root, chain } = await resolvePaymentChain(null, tenantId, paymentId);
  const base = root.base_receipt_number || root.receipt_number;
  const historyRes = await query(
    `SELECT id, receipt_number, amount, receipt_version, is_voided, created_at, corrects_payment_id, corrected_by_payment_id
     FROM payments
     WHERE tenant_id = $1 AND base_receipt_number = $2
     ORDER BY receipt_version ASC NULLS FIRST, created_at ASC`,
    [tenantId, base]
  );
  return {
    rootReceiptNumber: root.receipt_number,
    rootCreatedAt: root.created_at,
    correctionCount: Math.max(0, chain.length - 1),
    chain: historyRes.rows.map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      amount: parseFloat(String(row.amount ?? 0)),
      version: row.receipt_version ?? 0,
      isVoided: !!row.is_voided,
      createdAt: row.created_at,
      correctsPaymentId: row.corrects_payment_id,
    })),
  };
}

export async function getCorrectionContext(tenantId: number, paymentId: number) {
  const { root, chain, active } = await resolvePaymentChain(null, tenantId, paymentId);
  const row = active;

  const res = await query(
    `SELECT p.*,
            s.first_name,
            s.last_name,
            s.student_id AS school_student_code,
            s.admission_number,
            (CASE WHEN s.passport_photo_url IS NOT NULL AND length(s.passport_photo_url) > 0 THEN true ELSE false END) AS has_passport_photo,
            c.class_name,
            CASE
              WHEN p.payment_account_id IS NULL THEN 'Unlinked'
              ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name)
            END AS account_label
     FROM payments p
     JOIN students s ON s.id = p.student_id AND s.tenant_id = p.tenant_id
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = p.tenant_id
     LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [row.id, tenantId]
  );
  if (!res.rows.length) {
    throw new Error('Payment not found');
  }
  const paymentRow = res.rows[0];
  const rootCreatedAt = String(root.created_at);
  const eligibility = getCorrectionEligibility(paymentRow, rootCreatedAt);
  const balance = await getStudentFeeBalance(null, tenantId, paymentRow.student_id, paymentRow.term ?? null);
  const totalDue = balance ? Number(balance.totalFees) + Number(balance.arrears) : 0;
  const history = await getCorrectionHistory(tenantId, paymentId);

  return {
    eligibility,
    rootCreatedAt,
    correctionHistory: history,
    student: {
      id: paymentRow.student_id,
      firstName: paymentRow.first_name,
      lastName: paymentRow.last_name,
      studentId: paymentRow.school_student_code,
      admissionNumber: paymentRow.admission_number,
      className: paymentRow.class_name || '—',
      hasPassportPhoto: !!paymentRow.has_passport_photo,
    },
    original: {
      paymentId: paymentRow.id,
      receiptNumber: paymentRow.receipt_number,
      rootReceiptNumber: root.receipt_number,
      amount: parseFloat(String(paymentRow.amount ?? 0)),
      paymentDate: paymentRow.payment_date,
      paymentMethod: paymentRow.payment_method,
      paymentAccountId: paymentRow.payment_account_id,
      accountLabel: paymentRow.account_label || paymentRow.payment_method || '—',
      term: paymentRow.term,
      createdAt: paymentRow.created_at,
    },
    balance: balance
      ? {
          totalFees: Number(balance.totalFees),
          totalPaid: Number(balance.totalPaid),
          totalDue,
          outstanding: Math.max(0, Number(balance.outstanding)),
          credit: Number(balance.credit),
          status: balance.status,
          maxPaymentAmount: totalDue,
        }
      : {
          totalFees: 0,
          totalPaid: 0,
          totalDue: 0,
          outstanding: 0,
          credit: 0,
          status: 'Cleared' as const,
          maxPaymentAmount: 0,
        },
  };
}

function buildAfterBalanceSnap(
  balanceBefore: FeeBalanceResult,
  projected: ReturnType<typeof projectBalanceAfterCorrection>
) {
  const totalFees = Number(balanceBefore.totalFees) || 0;
  const totalPaid = Number(projected.projectedPaid) || 0;
  const arrears = Number(balanceBefore.arrears) || 0;
  const totalDue = totalFees + arrears;

  return {
    balance_after: Math.round(projected.outstanding * 100) / 100,
    balance_outstanding: Math.round(projected.outstanding * 100) / 100,
    balance_credit: Math.round(projected.credit * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    total_due: Math.round(totalDue * 100) / 100,
    has_fees_assigned: totalDue > 0.0001,
    has_payments_recorded: totalPaid > 0.0001,
  };
}

async function resolveTermIdForLedger(
  client: pg.PoolClient,
  tenantId: number,
  termStr: string
): Promise<{ termId: number; academicYearId: number } | null> {
  if (!termStr?.trim()) return null;
  const termToStore = termStr.trim();
  const termOnly = termToStore.replace(/\s+\d{4}$/, '').trim() || termToStore;

  const termLookup = await client.query(
    `SELECT t.id, t.academic_year_id
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1 AND (
       t.name = $2 OR t.name = $3 OR (t.name || ' ' || ay.name) = $2
     )
     LIMIT 1`,
    [tenantId, termToStore, termOnly]
  );
  if (termLookup.rows.length > 0) {
    return {
      termId: Number(termLookup.rows[0].id),
      academicYearId: Number(termLookup.rows[0].academic_year_id),
    };
  }

  const activeTermLookup = await client.query(
    `SELECT t.id, t.academic_year_id
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     JOIN school_settings s ON (s.current_term = t.name OR s.current_term = (t.name || ' ' || ay.name))
     WHERE t.tenant_id = $1 AND s.tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );
  if (activeTermLookup.rows.length > 0) {
    return {
      termId: Number(activeTermLookup.rows[0].id),
      academicYearId: Number(activeTermLookup.rows[0].academic_year_id),
    };
  }

  return null;
}

async function postCorrectionLedgerEntry(
  client: pg.PoolClient,
  tenantId: number,
  studentId: number,
  termStr: string,
  correctionType: 'debit' | 'credit',
  originalAmount: number,
  newAmount: number,
  receiptNumber: string,
  reason: string
) {
  const termInfo = await resolveTermIdForLedger(client, tenantId, termStr);
  if (!termInfo) return;

  const balanceChange =
    correctionType === 'credit' ? newAmount - originalAmount : originalAmount - newAmount;
  if (balanceChange <= 0.0001) return;

  const description = `Receipt correction ${receiptNumber} (${correctionType}): ${reason}`.slice(0, 500);

  await client.query(
    `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, receipt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'payment_correction', $8)`,
    [
      tenantId,
      studentId,
      termInfo.academicYearId,
      termInfo.termId,
      description,
      correctionType === 'credit' ? 0 : balanceChange,
      correctionType === 'credit' ? balanceChange : 0,
      receiptNumber,
    ]
  );
}

async function insertCorrectedPayment(
  client: pg.PoolClient,
  params: {
    tenantId: number;
    studentId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    paymentAccountId: number | null;
    term: string | null;
    notes: string | null;
    receiptNumber: string;
    baseReceiptNumber: string;
    version: number;
    originalPaymentId: number;
  }
) {
  const values = [
    params.tenantId,
    params.studentId,
    params.amount,
    params.paymentDate,
    params.paymentMethod,
    params.paymentAccountId,
    params.term,
    params.notes,
    params.receiptNumber,
    params.baseReceiptNumber,
    params.version,
    params.originalPaymentId,
  ];

  try {
    return await client.query(
      `INSERT INTO payments (
         tenant_id, student_id, amount, amount_paid, payment_date, payment_method, payment_account_id,
         term, notes, receipt_number, base_receipt_number, receipt_version,
         corrects_payment_id, is_voided, is_locked
       ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, false)
       RETURNING *`,
      values
    );
  } catch {
    return await client.query(
      `INSERT INTO payments (
         tenant_id, student_id, amount, payment_date, payment_method, payment_account_id,
         term, notes, receipt_number, base_receipt_number, receipt_version,
         corrects_payment_id, is_voided, is_locked
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, false)
       RETURNING *`,
      values
    );
  }
}

function nextReceiptVersionSuffix(baseReceiptNumber: string, tenantId: number, client: pg.PoolClient) {
  return client
    .query(
      `SELECT COALESCE(MAX(receipt_version), 0) AS max_version
     FROM payments
     WHERE tenant_id = $1 AND base_receipt_number = $2`,
      [tenantId, baseReceiptNumber]
    )
    .then((res) => {
      const next = parseInt(String(res.rows[0]?.max_version ?? 0), 10) + 1;
      return { version: next, receiptNumber: `${baseReceiptNumber}-R${next}` };
    });
}

export async function correctReceipt(
  tenantId: number,
  paymentId: number,
  userId: number,
  input: CorrectionInput
) {
  if (!input.reason?.trim()) {
    throw new Error('Reason for correction is mandatory');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (!input.payment_date) {
    throw new Error('Payment date is required');
  }
  if (!input.student_id) {
    throw new Error('Student is required');
  }
  if (!input.correction_type || !['debit', 'credit'].includes(input.correction_type)) {
    throw new Error('Correction type (debit or credit) is required');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { root, chain } = await resolvePaymentChain(client, tenantId, paymentId);
    const original = chain[chain.length - 1];

    if (original.id !== paymentId) {
      throw new Error('Payment mismatch while resolving correction chain');
    }

    const eligibility = getCorrectionEligibility(original, String(root.created_at));
    if (!eligibility.canCorrect) {
      throw new Error(eligibility.reason || 'This receipt cannot be corrected');
    }

    const originalAmount = parseFloat(String(original.amount ?? 0));
    validateCorrectionTypeAmount(input.correction_type, originalAmount, input.amount);

    const termToStore = String(input.term ?? original.term ?? '').trim();
    const balanceBeforeRaw = await getStudentFeeBalance(
      client,
      tenantId,
      input.student_id,
      termToStore || null
    );
    if (!balanceBeforeRaw) {
      throw new Error('Could not calculate student fee balance');
    }
    const balanceBeforeSnap = extractBalanceSnapshot(balanceBeforeRaw);

    const maxTermFee = Number(balanceBeforeRaw.totalFees) + Number(balanceBeforeRaw.arrears);
    if (maxTermFee > 0 && input.amount > maxTermFee + 0.0001) {
      throw new Error(
        `New amount cannot exceed the total fee assigned for this term (GHS ${maxTermFee.toFixed(2)})`
      );
    }

    if (
      balanceBeforeSnap.balance_before === 0 &&
      balanceBeforeSnap.balance_credit === 0 &&
      !balanceBeforeSnap.has_fees_assigned &&
      !balanceBeforeSnap.has_payments_recorded
    ) {
      console.warn(
        `[receiptCorrection] Student ${input.student_id} balance before correction is zero — no fees or payments found for term "${termToStore}"`
      );
    }

    const studentCheck = await client.query(
      'SELECT id, first_name, last_name, student_id AS school_student_code, admission_number FROM students WHERE id = $1 AND tenant_id = $2',
      [input.student_id, tenantId]
    );
    if (studentCheck.rows.length === 0) {
      throw new Error('Student not found');
    }
    const studentRow = studentCheck.rows[0];
    const studentDisplay = `${studentRow.first_name} ${studentRow.last_name}`.trim();
    const studentLabel = studentRow.admission_number
      ? `${studentDisplay} (${studentRow.admission_number})`
      : `${studentDisplay} (${studentRow.school_student_code || input.student_id})`;

    const originalAccountId =
      original.payment_account_id != null ? Number(original.payment_account_id) : null;

    const resolved = await resolvePaymentAccountForTransaction(
      tenantId,
      input.payment_account_id ?? originalAccountId ?? undefined,
      String(input.payment_method ?? original.payment_method ?? '')
    );

    const accountLabelBefore = await getAccountLabel(
      client,
      tenantId,
      originalAccountId,
      String(original.payment_method ?? '')
    );
    const accountLabelAfter = await getAccountLabel(
      client,
      tenantId,
      resolved.paymentAccountId,
      resolved.paymentMethod
    );

    const baseReceiptNumber = (original.base_receipt_number || root.receipt_number) as string;
    const { version, receiptNumber } = await nextReceiptVersionSuffix(baseReceiptNumber, tenantId, client);

    const diffMeta = formatAmountDifference(originalAmount, input.amount, input.correction_type);

    const beforeValues = {
      payment_id: original.id,
      receipt_number: original.receipt_number,
      root_receipt_number: root.receipt_number,
      student_id: original.student_id,
      student_name: studentDisplay,
      student_label: studentLabel,
      amount: originalAmount,
      payment_method: original.payment_method,
      payment_account_id: original.payment_account_id,
      payment_account_label: accountLabelBefore,
      payment_date: formatCorrectionAuditDate(original.payment_date),
      payment_date_raw: original.payment_date,
      term: original.term,
      notes: original.notes,
      balance_before: balanceBeforeSnap.balance_before,
      balance_outstanding_before: balanceBeforeSnap.balance_before,
      balance_credit_before: balanceBeforeSnap.balance_credit,
      total_fees_before: balanceBeforeSnap.total_fees,
      total_paid_before: balanceBeforeSnap.total_paid,
      total_due_before: balanceBeforeSnap.total_due,
      has_fees_assigned: balanceBeforeSnap.has_fees_assigned,
      has_payments_recorded: balanceBeforeSnap.has_payments_recorded,
      ...diffMeta,
    };

    const projectedAfter = projectBalanceAfterCorrection(
      balanceBeforeRaw,
      originalAmount,
      input.amount,
      input.correction_type
    );

    await client.query(
      `UPDATE payments SET
         is_voided = true,
         correction_reason = $1,
         corrected_at = CURRENT_TIMESTAMP,
         corrected_by_user_id = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4`,
      [input.reason.trim(), userId, original.id, tenantId]
    );

    const correctedInsert = await insertCorrectedPayment(client, {
      tenantId,
      studentId: input.student_id,
      amount: input.amount,
      paymentDate: input.payment_date,
      paymentMethod: resolved.paymentMethod || String(original.payment_method ?? 'Cash'),
      paymentAccountId: resolved.paymentAccountId,
      term: termToStore || null,
      notes: input.notes ?? (original.notes as string | null) ?? null,
      receiptNumber,
      baseReceiptNumber,
      version,
      originalPaymentId: Number(original.id),
    });
    const corrected = correctedInsert.rows[0];

    await postCorrectionLedgerEntry(
      client,
      tenantId,
      input.student_id,
      termToStore,
      input.correction_type,
      originalAmount,
      input.amount,
      receiptNumber,
      input.reason.trim()
    );

    const balanceAfterSnap = buildAfterBalanceSnap(balanceBeforeRaw, projectedAfter);

    const balanceAfterRaw = await getStudentFeeBalance(
      client,
      tenantId,
      input.student_id,
      termToStore || null
    );

    if (balanceAfterRaw) {
      const dbSnap = extractBalanceSnapshot(balanceAfterRaw);
      const projectedOwing = balanceAfterSnap.balance_after;
      const dbOwing = dbSnap.balance_before;
      if (Math.abs(projectedOwing - dbOwing) > 0.05) {
        console.warn(
          `[receiptCorrection] Balance mismatch after ${input.correction_type} correction for student ${input.student_id}: projected=${projectedOwing}, db=${dbOwing}`
        );
      }
    }

    if (
      balanceAfterSnap.balance_after === 0 &&
      balanceAfterSnap.balance_credit === 0 &&
      !balanceAfterSnap.has_fees_assigned &&
      !balanceAfterSnap.has_payments_recorded
    ) {
      console.warn(
        `[receiptCorrection] Student ${input.student_id} balance after correction is zero — no fees or payments found for term "${termToStore}"`
      );
    }

    let receiptSnapshot: Record<string, number> | null = null;
    if (balanceAfterRaw) {
      receiptSnapshot = buildReceiptSnapshot(balanceAfterRaw);
    } else {
      const syntheticBalance: FeeBalanceResult = {
        totalFees: Number(balanceBeforeRaw.totalFees) || 0,
        totalPaid: projectedAfter.projectedPaid,
        arrears: Number(balanceBeforeRaw.arrears) || 0,
        outstanding: projectedAfter.signedAfter,
        credit: projectedAfter.credit,
        status:
          projectedAfter.credit > 0
            ? 'Credit'
            : projectedAfter.outstanding > 0
              ? 'Owing'
              : 'Cleared',
      };
      receiptSnapshot = buildReceiptSnapshot(syntheticBalance);
    }
    if (receiptSnapshot) {
      await client.query(
        `UPDATE payments SET receipt_snapshot = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(receiptSnapshot), corrected.id]
      );
    }

    await client.query(
      `UPDATE payments SET corrected_by_payment_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [corrected.id, original.id, tenantId]
    );

    const afterValues = {
      payment_id: corrected.id,
      receipt_number: corrected.receipt_number,
      root_receipt_number: root.receipt_number,
      student_id: corrected.student_id,
      student_name: studentDisplay,
      student_label: studentLabel,
      amount: parseFloat(String(corrected.amount)),
      payment_method: corrected.payment_method,
      payment_account_id: corrected.payment_account_id,
      payment_account_label: accountLabelAfter,
      payment_date: formatCorrectionAuditDate(corrected.payment_date),
      payment_date_raw: corrected.payment_date,
      term: corrected.term,
      notes: corrected.notes,
      balance_before: balanceBeforeSnap.balance_before,
      balance_after: balanceAfterSnap.balance_after,
      balance_outstanding_before: balanceBeforeSnap.balance_before,
      balance_outstanding_after: balanceAfterSnap.balance_after,
      balance_credit_before: balanceBeforeSnap.balance_credit,
      balance_credit_after: balanceAfterSnap.balance_credit,
      balance_change: projectedAfter.balanceChange,
      total_fees_after: balanceAfterSnap.total_fees,
      total_paid_after: balanceAfterSnap.total_paid,
      total_due_after: balanceAfterSnap.total_due,
      account_balance_change:
        input.correction_type === 'credit'
          ? input.amount - originalAmount
          : -(originalAmount - input.amount),
      has_fees_assigned: balanceAfterSnap.has_fees_assigned,
      has_payments_recorded: balanceAfterSnap.has_payments_recorded,
      method_change_label: buildMethodChangeLabel(accountLabelBefore, accountLabelAfter),
      date_change_label: buildDateChangeLabel(original.payment_date, corrected.payment_date),
      ...diffMeta,
    };

    const correctionLog = await client.query(
      `INSERT INTO receipt_corrections (
         tenant_id, original_payment_id, corrected_payment_id,
         corrected_by_user_id, correction_reason, before_values, after_values
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       RETURNING *`,
      [
        tenantId,
        root.id,
        corrected.id,
        userId,
        input.reason.trim(),
        JSON.stringify(beforeValues),
        JSON.stringify(afterValues),
      ]
    );

    await client.query('COMMIT');

    return {
      original: { ...original, is_voided: true, corrected_by_payment_id: corrected.id },
      corrected,
      correction: correctionLog.rows[0],
      beforeValues,
      afterValues,
      receiptSnapshot,
      correctionHistory: chain.map((p) => p.receipt_number),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listReceiptCorrections(
  tenantId: number,
  filters: {
    startDate?: string;
    endDate?: string;
    userId?: number;
    studentId?: number;
    limit?: number;
    offset?: number;
  }
) {
  const params: unknown[] = [tenantId];
  let where = 'WHERE rc.tenant_id = $1';

  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where += ` AND rc.created_at >= $${params.length - 1}::timestamptz AND rc.created_at < ($${params.length}::date + interval '1 day')`;
  }
  if (filters.userId) {
    params.push(filters.userId);
    where += ` AND rc.corrected_by_user_id = $${params.length}`;
  }
  if (filters.studentId) {
    params.push(filters.studentId);
    where += ` AND (rc.before_values->>'student_id')::int = $${params.length}`;
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const countRes = await query(
    `SELECT COUNT(*) AS total FROM receipt_corrections rc ${where}`,
    params.slice(0, params.length - 2)
  );

  const rows = await query(
    `SELECT rc.*,
            u.username AS corrected_by_username,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS corrected_by_name
     FROM receipt_corrections rc
     LEFT JOIN users u ON u.id = rc.corrected_by_user_id
     ${where}
     ORDER BY rc.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: rows.rows,
    total: parseInt(String(countRes.rows[0]?.total ?? 0), 10),
    limit,
    offset,
  };
}
