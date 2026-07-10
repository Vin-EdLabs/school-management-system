import { query } from '../db/connection.js';
import { formatPaymentAccountLabel, getAccountBalances, type PaymentAccountRow } from './paymentAccountService.js';

export type LegacyUnlinkedTotals = {
  paymentsIn: number;
  incomeIn: number;
  expensesOut: number;
  net: number;
};

export type CashPosition = {
  accountsTotal: number;
  legacyUnlinkedNet: number;
  totalCashPosition: number;
  accounts: Awaited<ReturnType<typeof getAccountBalances>>;
  legacy: LegacyUnlinkedTotals;
};

export type AccountCollectionRow = {
  accountId: number | null;
  accountLabel: string;
  openingBalance: number;
  openingBalanceAsOf?: string | null;
  feesCollected: number;
  otherIncome: number;
  expenses: number;
  currentBalance: number;
};

export type AccountSnapshot = {
  id: number;
  accountLabel: string;
  accountType: string;
  openingBalance: number;
  openingBalanceAsOf?: string | null;
  paymentsIn: number;
  incomeIn: number;
  expensesOut: number;
  transfersIn: number;
  transfersOut: number;
  currentBalance: number;
};

export type ActivityTotals = {
  feesCollectedTerm: number;
  feesCollectedPeriod: number;
  otherIncome: number;
  totalExpenses: number;
  totalIncome: number;
  periodActivityNet: number;
};

/** Match payment rows to a term label — never treat blank term as a match. */
const PAYMENT_TERM_LABEL_PRED = `
  (
    TRIM(COALESCE(p.term, '')) <> ''
    AND (
      p.term = $2 OR p.term = $4 OR p.term LIKE $3
      OR $2 LIKE TRIM(p.term) || '%' OR TRIM(p.term) LIKE $2 || '%'
      OR $4 LIKE TRIM(p.term) || '%' OR TRIM(p.term) LIKE $4 || '%'
    )
  )`;

export async function getLegacyUnlinkedTotals(tenantId: number): Promise<LegacyUnlinkedTotals> {
  const result = await query(
    `SELECT
       COALESCE((
         SELECT SUM(COALESCE(amount_paid, amount, 0))
         FROM payments
         WHERE tenant_id = $1 AND payment_account_id IS NULL AND COALESCE(is_voided, false) = false
       ), 0)::numeric AS payments_in,
       COALESCE((
         SELECT SUM(amount) FROM income
         WHERE tenant_id = $1 AND payment_account_id IS NULL
       ), 0)::numeric AS income_in,
       COALESCE((
         SELECT SUM(amount) FROM expenses
         WHERE tenant_id = $1 AND payment_account_id IS NULL
       ), 0)::numeric AS expenses_out`,
    [tenantId]
  );
  const row = result.rows[0] ?? {};
  const paymentsIn = parseFloat(String(row.payments_in ?? 0));
  const incomeIn = parseFloat(String(row.income_in ?? 0));
  const expensesOut = parseFloat(String(row.expenses_out ?? 0));
  return {
    paymentsIn,
    incomeIn,
    expensesOut,
    net: paymentsIn + incomeIn - expensesOut,
  };
}

export async function getCashPosition(tenantId: number): Promise<CashPosition> {
  const [accounts, legacy] = await Promise.all([
    getAccountBalances(tenantId),
    getLegacyUnlinkedTotals(tenantId),
  ]);
  const accountsTotal = accounts.reduce((sum, a) => sum + a.balance, 0);
  return {
    accountsTotal,
    legacyUnlinkedNet: legacy.net,
    totalCashPosition: accountsTotal + legacy.net,
    accounts,
    legacy,
  };
}

export async function getIncomeAndExpenseTotalsAll(tenantId: number): Promise<{
  otherIncome: number;
  totalExpenses: number;
}> {
  const result = await query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM income WHERE tenant_id = $1), 0)::numeric AS other_income,
       COALESCE((SELECT SUM(amount) FROM expenses WHERE tenant_id = $1), 0)::numeric AS total_expenses`,
    [tenantId]
  );
  const row = result.rows[0] ?? {};
  return {
    otherIncome: parseFloat(String(row.other_income ?? 0)),
    totalExpenses: parseFloat(String(row.total_expenses ?? 0)),
  };
}

/** All non-voided fee payments from the transactions table (carries across term switches). */
export async function getFeesCollectedAll(tenantId: number): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0)::numeric AS total
     FROM payments
     WHERE tenant_id = $1
       AND COALESCE(is_voided, false) = false
       AND COALESCE(payment_category, 'term_fee') = 'term_fee'`,
    [tenantId]
  );
  return parseFloat(String(result.rows[0]?.total ?? 0)) || 0;
}

/** Fee payments for one ledger term (by term_id on the payment transaction). */
export async function getFeesCollectedForTerm(
  tenantId: number,
  ledgerTermId: number
): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0)::numeric AS total
     FROM payments
     WHERE tenant_id = $1
       AND term_id = $2
       AND COALESCE(is_voided, false) = false
       AND COALESCE(payment_category, 'term_fee') = 'term_fee'`,
    [tenantId, ledgerTermId]
  );
  return parseFloat(String(result.rows[0]?.total ?? 0)) || 0;
}

/** Other income + expenses within an inclusive date range (term window). */
export async function getIncomeAndExpenseTotalsInRange(
  tenantId: number,
  fromDate: string,
  toDate: string
): Promise<{ otherIncome: number; totalExpenses: number }> {
  const result = await query(
    `SELECT
       COALESCE((
         SELECT SUM(amount) FROM income
         WHERE tenant_id = $1
           AND COALESCE(income_date::date, created_at::date) >= $2::date
           AND COALESCE(income_date::date, created_at::date) <= $3::date
       ), 0)::numeric AS other_income,
       COALESCE((
         SELECT SUM(amount) FROM expenses
         WHERE tenant_id = $1
           AND COALESCE(payment_date::date, created_at::date) >= $2::date
           AND COALESCE(payment_date::date, created_at::date) <= $3::date
       ), 0)::numeric AS total_expenses`,
    [tenantId, fromDate, toDate]
  );
  const row = result.rows[0] ?? {};
  return {
    otherIncome: parseFloat(String(row.other_income ?? 0)) || 0,
    totalExpenses: parseFloat(String(row.total_expenses ?? 0)) || 0,
  };
}

export async function getDirectActivityTotals(
  tenantId: number,
  opts: {
    financeFrom: string;
    financeTo: string;
    termMatch: string;
    termLike: string;
    termOnly: string;
    ledgerTermId?: number | null;
  }
): Promise<ActivityTotals> {
  const { financeFrom, financeTo, termMatch, termLike, termOnly, ledgerTermId } = opts;

  const feesTermSql =
    ledgerTermId != null
      ? `COALESCE((
           SELECT SUM(COALESCE(p.amount_paid, p.amount, 0))
           FROM payments p
           WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
             AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
             AND p.term_id = $7
         ), 0)::numeric`
      : `COALESCE((
           SELECT SUM(COALESCE(p.amount_paid, p.amount, 0))
           FROM payments p
           WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
             AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
             AND ${PAYMENT_TERM_LABEL_PRED}
         ), 0)::numeric`;

  const params: unknown[] =
    ledgerTermId != null
      ? [tenantId, termMatch, termLike, termOnly, financeFrom, financeTo, ledgerTermId]
      : [tenantId, termMatch, termLike, termOnly, financeFrom, financeTo];

  const result = await query(
    `SELECT
       ${feesTermSql} AS fees_collected_term,
       COALESCE((
         SELECT SUM(COALESCE(p.amount_paid, p.amount, 0))
         FROM payments p
         WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
           AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
           AND COALESCE(p.payment_date::date, p.created_at::date) >= $5::date
           AND COALESCE(p.payment_date::date, p.created_at::date) <= $6::date
       ), 0)::numeric AS fees_collected_period,
       COALESCE((
         SELECT SUM(i.amount) FROM income i
         WHERE i.tenant_id = $1
           AND COALESCE(i.income_date::date, i.created_at::date) >= $5::date
           AND COALESCE(i.income_date::date, i.created_at::date) <= $6::date
       ), 0)::numeric AS other_income,
       COALESCE((
         SELECT SUM(e.amount) FROM expenses e
         WHERE e.tenant_id = $1
           AND COALESCE(e.payment_date::date, e.created_at::date) >= $5::date
           AND COALESCE(e.payment_date::date, e.created_at::date) <= $6::date
       ), 0)::numeric AS total_expenses`,
    params
  );
  const row = result.rows[0] ?? {};
  const feesCollectedTerm = parseFloat(String(row.fees_collected_term ?? 0));
  const feesCollectedPeriod = parseFloat(String(row.fees_collected_period ?? 0));
  const otherIncome = parseFloat(String(row.other_income ?? 0));
  const totalExpenses = parseFloat(String(row.total_expenses ?? 0));
  const totalIncome = feesCollectedPeriod + otherIncome;
  return {
    feesCollectedTerm,
    feesCollectedPeriod,
    otherIncome,
    totalExpenses,
    totalIncome,
    periodActivityNet: totalIncome - totalExpenses,
  };
}

export function buildAccountSnapshots(
  accounts: Awaited<ReturnType<typeof getAccountBalances>>
): AccountSnapshot[] {
  return accounts.map((account) => ({
    id: account.id,
    accountLabel: formatPaymentAccountLabel(account as PaymentAccountRow),
    accountType: account.account_type,
    openingBalance: parseFloat(String(account.opening_balance ?? 0)),
    openingBalanceAsOf: account.opening_balance_as_of ?? null,
    paymentsIn: account.payments_in ?? 0,
    incomeIn: account.income_in ?? 0,
    expensesOut: account.expenses_out ?? 0,
    transfersIn: account.transfers_in ?? 0,
    transfersOut: account.transfers_out ?? 0,
    currentBalance: account.balance ?? 0,
  }));
}

export function getTotalOpeningBalance(accounts: Awaited<ReturnType<typeof getAccountBalances>>): number {
  return accounts.reduce((sum, a) => sum + parseFloat(String(a.opening_balance ?? 0)), 0);
}

export async function getCollectionsByAccount(
  tenantId: number,
  opts: {
    financeFrom: string;
    financeTo: string;
    termMatch: string;
    termLike: string;
    termOnly: string;
    /** 'all' = every fee payment (carries across terms); 'term' = selected term only */
    feesScope?: 'all' | 'term';
    ledgerTermId?: number | null;
  }
): Promise<AccountCollectionRow[]> {
  const {
    financeFrom,
    financeTo,
    termMatch,
    termLike,
    termOnly,
    feesScope = 'term',
    ledgerTermId,
  } = opts;
  const cashPosition = await getCashPosition(tenantId);

  let feesQuery: string;
  let feesParams: unknown[];
  if (feesScope === 'all') {
    feesQuery = `SELECT p.payment_account_id AS account_id,
              CASE WHEN p.payment_account_id IS NULL THEN 'Unlinked'
                   ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label,
              COALESCE(SUM(COALESCE(p.amount_paid, p.amount, 0)), 0)::numeric AS amount
       FROM payments p
       LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
       WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
       GROUP BY p.payment_account_id, account_label`;
    feesParams = [tenantId];
  } else if (ledgerTermId != null) {
    feesQuery = `SELECT p.payment_account_id AS account_id,
              CASE WHEN p.payment_account_id IS NULL THEN 'Unlinked'
                   ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label,
              COALESCE(SUM(COALESCE(p.amount_paid, p.amount, 0)), 0)::numeric AS amount
       FROM payments p
       LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
       WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
         AND p.term_id = $2
       GROUP BY p.payment_account_id, account_label`;
    feesParams = [tenantId, ledgerTermId];
  } else {
    feesQuery = `SELECT p.payment_account_id AS account_id,
              CASE WHEN p.payment_account_id IS NULL THEN 'Unlinked'
                   ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label,
              COALESCE(SUM(COALESCE(p.amount_paid, p.amount, 0)), 0)::numeric AS amount
       FROM payments p
       LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
       WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
         AND ${PAYMENT_TERM_LABEL_PRED}
       GROUP BY p.payment_account_id, account_label`;
    feesParams = [tenantId, termMatch, termLike, termOnly];
  }

  const [feesRes, incomeRes, expenseRes] = await Promise.all([
    query(feesQuery, feesParams),
    query(
      `SELECT i.payment_account_id AS account_id,
              CASE WHEN i.payment_account_id IS NULL THEN 'Unlinked'
                   ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label,
              COALESCE(SUM(i.amount), 0)::numeric AS amount
       FROM income i
       LEFT JOIN payment_accounts pa ON pa.id = i.payment_account_id
       WHERE i.tenant_id = $1
         AND COALESCE(i.income_date::date, i.created_at::date) >= $2::date
         AND COALESCE(i.income_date::date, i.created_at::date) <= $3::date
       GROUP BY i.payment_account_id, account_label`,
      [tenantId, financeFrom, financeTo]
    ),
    query(
      `SELECT e.payment_account_id AS account_id,
              CASE WHEN e.payment_account_id IS NULL THEN 'Unlinked'
                   ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label,
              COALESCE(SUM(e.amount), 0)::numeric AS amount
       FROM expenses e
       LEFT JOIN payment_accounts pa ON pa.id = e.payment_account_id
       WHERE e.tenant_id = $1
         AND COALESCE(e.payment_date::date, e.created_at::date) >= $2::date
         AND COALESCE(e.payment_date::date, e.created_at::date) <= $3::date
       GROUP BY e.payment_account_id, account_label`,
      [tenantId, financeFrom, financeTo]
    ),
  ]);

  const map = new Map<string, AccountCollectionRow>();

  const keyFor = (accountId: number | null, label: string) =>
    accountId != null ? `id:${accountId}` : `label:${label}`;

  const ensure = (accountId: number | null, accountLabel: string) => {
    const key = keyFor(accountId, accountLabel);
    if (!map.has(key)) {
      map.set(key, {
        accountId,
        accountLabel,
        openingBalance: 0,
        openingBalanceAsOf: null,
        feesCollected: 0,
        otherIncome: 0,
        expenses: 0,
        currentBalance: 0,
      });
    }
    return map.get(key)!;
  };

  for (const row of feesRes.rows) {
    const entry = ensure(row.account_id != null ? Number(row.account_id) : null, String(row.account_label));
    entry.feesCollected = parseFloat(String(row.amount ?? 0));
  }
  for (const row of incomeRes.rows) {
    const entry = ensure(row.account_id != null ? Number(row.account_id) : null, String(row.account_label));
    entry.otherIncome = parseFloat(String(row.amount ?? 0));
  }
  for (const row of expenseRes.rows) {
    const entry = ensure(row.account_id != null ? Number(row.account_id) : null, String(row.account_label));
    entry.expenses = parseFloat(String(row.amount ?? 0));
  }

  for (const account of cashPosition.accounts) {
    const label = formatPaymentAccountLabel(account as PaymentAccountRow);
    const entry = ensure(account.id, label);
    entry.openingBalance = parseFloat(String(account.opening_balance ?? 0));
    entry.openingBalanceAsOf = account.opening_balance_as_of ?? null;
    entry.currentBalance = account.balance;
    if (!entry.accountLabel) entry.accountLabel = label;
  }

  const legacy = cashPosition.legacy;
  if (legacy.paymentsIn > 0 || legacy.incomeIn > 0 || legacy.expensesOut > 0 || legacy.net !== 0) {
    const entry = ensure(null, 'Unlinked');
    entry.currentBalance = legacy.net;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.accountLabel === 'Unlinked') return 1;
    if (b.accountLabel === 'Unlinked') return -1;
    return a.accountLabel.localeCompare(b.accountLabel);
  });
}

export async function getFundTransfersReport(
  tenantId: number,
  opts?: { startDate?: string; endDate?: string; limit?: number }
) {
  const params: unknown[] = [tenantId];
  let where = 'ft.tenant_id = $1 AND COALESCE(ft.is_reversed, false) = false';

  if (opts?.startDate && opts?.endDate) {
    params.push(opts.startDate, opts.endDate);
    where += ` AND ft.transfer_date >= $${params.length - 1}::date AND ft.transfer_date <= $${params.length}::date`;
  }

  const limit = opts?.limit ?? 200;
  params.push(limit);

  const result = await query(
    `SELECT ft.id, ft.amount, ft.transfer_date, ft.note, ft.created_at,
            fa.id AS from_account_id,
            COALESCE(NULLIF(TRIM(fa.nickname), ''), fa.account_name) AS from_account_label,
            ta.id AS to_account_id,
            COALESCE(NULLIF(TRIM(ta.nickname), ''), ta.account_name) AS to_account_label,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS transferred_by_name
     FROM fund_transfers ft
     JOIN payment_accounts fa ON fa.id = ft.from_account_id
     JOIN payment_accounts ta ON ta.id = ft.to_account_id
     LEFT JOIN users u ON u.id = ft.transferred_by
     WHERE ${where}
     ORDER BY ft.transfer_date DESC, ft.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    amount: parseFloat(String(row.amount ?? 0)),
  }));
}

export const ACCOUNT_LABEL_SELECT = `
  CASE WHEN t.payment_account_id IS NULL THEN 'Unlinked'
       ELSE COALESCE(NULLIF(TRIM(pa.nickname), ''), pa.account_name) END AS account_label`;
