import type pg from 'pg';
import { query } from '../db/connection.js';

export type PaymentAccountRow = {
  id: number;
  tenant_id: number;
  account_type: string;
  account_name: string;
  nickname?: string | null;
  account_number?: string | null;
  branch?: string | null;
  network?: string | null;
  phone_number?: string | null;
  opening_balance: string | number;
  opening_balance_as_of?: string | null;
  opening_balance_configured?: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export function paymentMethodFromAccountType(accountType: string): string {
  switch (accountType) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank Transfer';
    case 'momo':
      return 'Mobile Money';
    default:
      return 'Cash';
  }
}

export function legacyPaymentMethodCategory(method: string): 'cash' | 'bank' | 'momo' | 'other' {
  if (/mobile|momo/i.test(method)) return 'momo';
  if (/bank|cheque|transfer/i.test(method)) return 'bank';
  if (/cash/i.test(method)) return 'cash';
  return 'other';
}

export function formatPaymentAccountLabel(account: Pick<
  PaymentAccountRow,
  'account_type' | 'account_name' | 'nickname' | 'account_number' | 'network' | 'phone_number'
>): string {
  const displayName = account.nickname?.trim() || account.account_name;
  if (account.account_type === 'cash') {
    return displayName || 'Cash at Hand';
  }
  if (account.account_type === 'bank') {
    const acc = account.account_number ? ` - Acc: ${account.account_number}` : '';
    return `${displayName}${acc}`;
  }
  if (account.account_type === 'momo') {
    const label = account.network ? `${account.network} Momo` : displayName;
    const phone = account.phone_number ? ` - ${account.phone_number}` : '';
    return `${label}${phone}`;
  }
  return displayName;
}

export async function accountHasTransactions(tenantId: number, accountId: number): Promise<boolean> {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1 FROM payments WHERE tenant_id = $1 AND payment_account_id = $2 AND COALESCE(is_voided, false) = false
       UNION ALL
       SELECT 1 FROM income WHERE tenant_id = $1 AND payment_account_id = $2
       UNION ALL
       SELECT 1 FROM expenses WHERE tenant_id = $1 AND payment_account_id = $2
       UNION ALL
       SELECT 1 FROM fund_transfers WHERE tenant_id = $1 AND (from_account_id = $2 OR to_account_id = $2) AND COALESCE(is_reversed, false) = false
     ) AS has_tx`,
    [tenantId, accountId]
  );
  return !!result.rows[0]?.has_tx;
}

export async function getPaymentAccountById(
  tenantId: number,
  accountId: number
): Promise<PaymentAccountRow | null> {
  const result = await query(
    `SELECT * FROM payment_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [accountId, tenantId]
  );
  return result.rows[0] ?? null;
}

export async function resolvePaymentAccountForTransaction(
  tenantId: number,
  paymentAccountId?: number | null,
  paymentMethod?: string | null
): Promise<{ paymentAccountId: number | null; paymentMethod: string | null }> {
  if (paymentAccountId) {
    const account = await getPaymentAccountById(tenantId, paymentAccountId);
    if (!account) {
      throw new Error('Invalid payment account');
    }
    return {
      paymentAccountId: account.id,
      paymentMethod: paymentMethod || paymentMethodFromAccountType(account.account_type),
    };
  }

  if (paymentMethod) {
    const typeGuess = legacyPaymentMethodCategory(paymentMethod);
    if (typeGuess !== 'other') {
      const fallback = await query(
        `SELECT id FROM payment_accounts
         WHERE tenant_id = $1 AND is_active = true AND account_type = $2
         ORDER BY is_default DESC, id ASC LIMIT 1`,
        [tenantId, typeGuess === 'cash' ? 'cash' : typeGuess]
      );
      if (fallback.rows[0]) {
        return { paymentAccountId: fallback.rows[0].id, paymentMethod };
      }
    }
  }

  const defaultAccount = await query(
    `SELECT id FROM payment_accounts
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY is_default DESC, (account_type = 'cash') DESC, id ASC LIMIT 1`,
    [tenantId]
  );
  if (defaultAccount.rows[0]) {
    return {
      paymentAccountId: defaultAccount.rows[0].id,
      paymentMethod: paymentMethod || 'Cash',
    };
  }

  return { paymentAccountId: null, paymentMethod: paymentMethod || null };
}

export async function getAccountBalanceForId(tenantId: number, accountId: number): Promise<number | null> {
  const balances = await getAccountBalances(tenantId);
  const row = balances.find((b) => b.id === accountId);
  return row ? row.balance : null;
}

export async function getAccountBalances(tenantId: number) {
  const result = await query(
    `SELECT
       pa.*,
       COALESCE(pa.opening_balance, 0)::numeric AS opening_balance,
       COALESCE(pay.in_total, 0)::numeric AS payments_in,
       COALESCE(inc.in_total, 0)::numeric AS income_in,
       COALESCE(exp.out_total, 0)::numeric AS expenses_out,
       COALESCE(tin.in_total, 0)::numeric AS transfers_in,
       COALESCE(tout.out_total, 0)::numeric AS transfers_out,
       (
         COALESCE(pa.opening_balance, 0)
         + COALESCE(pay.in_total, 0)
         + COALESCE(inc.in_total, 0)
         + COALESCE(tin.in_total, 0)
         - COALESCE(exp.out_total, 0)
         - COALESCE(tout.out_total, 0)
       )::numeric AS balance,
       EXISTS (
         SELECT 1 FROM payments p
         WHERE p.tenant_id = $1 AND p.payment_account_id = pa.id AND COALESCE(p.is_voided, false) = false
       ) OR EXISTS (
         SELECT 1 FROM income i WHERE i.tenant_id = $1 AND i.payment_account_id = pa.id
       ) OR EXISTS (
         SELECT 1 FROM expenses e WHERE e.tenant_id = $1 AND e.payment_account_id = pa.id
       ) OR EXISTS (
         SELECT 1 FROM fund_transfers ft
         WHERE ft.tenant_id = $1 AND (ft.from_account_id = pa.id OR ft.to_account_id = pa.id)
           AND COALESCE(ft.is_reversed, false) = false
       ) AS has_transactions
     FROM payment_accounts pa
     LEFT JOIN (
       SELECT payment_account_id, SUM(COALESCE(amount_paid, amount, 0)) AS in_total
       FROM payments WHERE tenant_id = $1 AND payment_account_id IS NOT NULL AND COALESCE(is_voided, false) = false
       GROUP BY payment_account_id
     ) pay ON pay.payment_account_id = pa.id
     LEFT JOIN (
       SELECT payment_account_id, SUM(amount) AS in_total
       FROM income WHERE tenant_id = $1 AND payment_account_id IS NOT NULL
       GROUP BY payment_account_id
     ) inc ON inc.payment_account_id = pa.id
     LEFT JOIN (
       SELECT payment_account_id, SUM(amount) AS out_total
       FROM expenses WHERE tenant_id = $1 AND payment_account_id IS NOT NULL
       GROUP BY payment_account_id
     ) exp ON exp.payment_account_id = pa.id
     LEFT JOIN (
       SELECT to_account_id AS payment_account_id, SUM(amount) AS in_total
       FROM fund_transfers WHERE tenant_id = $1 AND COALESCE(is_reversed, false) = false
       GROUP BY to_account_id
     ) tin ON tin.payment_account_id = pa.id
     LEFT JOIN (
       SELECT from_account_id AS payment_account_id, SUM(amount) AS out_total
       FROM fund_transfers WHERE tenant_id = $1 AND COALESCE(is_reversed, false) = false
       GROUP BY from_account_id
     ) tout ON tout.payment_account_id = pa.id
     WHERE pa.tenant_id = $1 AND pa.is_active = true
     ORDER BY pa.is_default DESC, pa.account_type, pa.account_name`,
    [tenantId]
  );

  return result.rows.map((row) => {
    const paymentsIn = parseFloat(String(row.payments_in ?? 0));
    const incomeIn = parseFloat(String(row.income_in ?? 0));
    const transfersIn = parseFloat(String(row.transfers_in ?? 0));
    const expensesOut = parseFloat(String(row.expenses_out ?? 0));
    const transfersOut = parseFloat(String(row.transfers_out ?? 0));
    return {
      ...row,
      opening_balance: parseFloat(String(row.opening_balance ?? 0)),
      opening_balance_configured: !!row.opening_balance_configured,
      has_transactions: !!row.has_transactions,
      opening_balance_locked: !!row.has_transactions,
      payments_in: paymentsIn,
      income_in: incomeIn,
      expenses_out: expensesOut,
      transfers_in: transfersIn,
      transfers_out: transfersOut,
      money_in: paymentsIn + incomeIn + transfersIn,
      money_out: expensesOut + transfersOut,
      balance: parseFloat(String(row.balance ?? 0)),
    };
  });
}

export async function getLegacyMigrationStatus(tenantId: number) {
  const settings = await query(
    `SELECT COALESCE(legacy_payment_migration_completed, false) AS completed
     FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const completed = !!settings.rows[0]?.completed;

  const [payments, income, expenses] = await Promise.all([
    query(
      `SELECT COALESCE(payment_method, 'Unknown') AS payment_method, COUNT(*)::int AS count
       FROM payments WHERE tenant_id = $1 AND payment_account_id IS NULL AND COALESCE(is_voided, false) = false
       GROUP BY payment_method`,
      [tenantId]
    ),
    query(
      `SELECT COALESCE(payment_method, 'Unknown') AS payment_method, COUNT(*)::int AS count
       FROM income WHERE tenant_id = $1 AND payment_account_id IS NULL
       GROUP BY payment_method`,
      [tenantId]
    ),
    query(
      `SELECT COALESCE(payment_method, 'Unknown') AS payment_method, COUNT(*)::int AS count
       FROM expenses WHERE tenant_id = $1 AND payment_account_id IS NULL
       GROUP BY payment_method`,
      [tenantId]
    ),
  ]);

  const groups: Record<'cash' | 'bank' | 'momo', number> = { cash: 0, bank: 0, momo: 0 };
  for (const rows of [payments.rows, income.rows, expenses.rows]) {
    for (const row of rows) {
      const cat = legacyPaymentMethodCategory(String(row.payment_method));
      if (cat === 'cash' || cat === 'bank' || cat === 'momo') {
        groups[cat] += parseInt(String(row.count ?? 0), 10);
      }
    }
  }

  const totalUnlinked = groups.cash + groups.bank + groups.momo;
  return {
    completed,
    showBanner: !completed && totalUnlinked > 0,
    groups,
    totalUnlinked,
  };
}

export async function migrateLegacyTransactions(
  tenantId: number,
  mappings: { cash?: number; bank?: number; momo?: number }
) {
  const status = await getLegacyMigrationStatus(tenantId);
  if (status.completed) {
    throw new Error('Legacy migration has already been completed');
  }

  const updates: { table: string; category: 'cash' | 'bank' | 'momo'; accountId: number; count: number }[] = [];

  for (const category of ['cash', 'bank', 'momo'] as const) {
    const accountId = mappings[category];
    if (!accountId || status.groups[category] === 0) continue;

    const account = await getPaymentAccountById(tenantId, accountId);
    if (!account) throw new Error(`Invalid account for ${category}`);
    if (account.account_type !== category) {
      throw new Error(`Selected account must be a ${category} account`);
    }

    const methodPatterns =
      category === 'cash' ? ['%cash%']
      : category === 'bank' ? ['%bank%', '%transfer%', '%cheque%']
      : ['%mobile%', '%momo%'];

    for (const table of ['payments', 'income', 'expenses'] as const) {
      const voidFilter = table === 'payments' ? ' AND COALESCE(is_voided, false) = false' : '';
      const patternClause = methodPatterns.map((_, i) => `payment_method ILIKE $${i + 3}`).join(' OR ');
      const res = await query(
        `UPDATE ${table} SET payment_account_id = $1
         WHERE tenant_id = $2 AND payment_account_id IS NULL${voidFilter}
           AND (${patternClause})
         RETURNING id`,
        [accountId, tenantId, ...methodPatterns]
      );
      if (res.rowCount) {
        updates.push({ table, category, accountId, count: res.rowCount ?? res.rows.length });
      }
    }
  }

  await query(
    `UPDATE school_settings SET legacy_payment_migration_completed = true WHERE tenant_id = $1`,
    [tenantId]
  );

  return { updates, totalMapped: updates.reduce((s, u) => s + u.count, 0) };
}

export async function getAccountTransactions(
  tenantId: number,
  opts: { accountId?: number; startDate?: string; endDate?: string; limit?: number }
) {
  const limit = opts.limit ?? 10;
  const params: unknown[] = [tenantId];
  const filters: string[] = [];

  if (opts.accountId) {
    params.push(opts.accountId);
    filters.push(`payment_account_id = $${params.length}`);
  }

  if (opts.startDate && opts.endDate) {
    params.push(opts.startDate, opts.endDate);
    filters.push(`tx_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  params.push(limit);

  const result = await query(
    `SELECT * FROM (
       SELECT 'payment' AS type, id, amount, payment_date AS tx_date, payment_method,
              payment_account_id, notes AS description,
              CONCAT('Fee payment #', COALESCE(receipt_number, id::text)) AS label,
              NULL::int AS from_account_id, NULL::int AS to_account_id
       FROM payments WHERE tenant_id = $1 AND COALESCE(is_voided, false) = false
       UNION ALL
       SELECT 'income' AS type, id, amount, income_date AS tx_date, payment_method,
              payment_account_id, COALESCE(notes, source) AS description, source AS label,
              NULL::int, NULL::int
       FROM income WHERE tenant_id = $1
       UNION ALL
       SELECT 'expense' AS type, id, amount, payment_date AS tx_date, payment_method,
              payment_account_id, COALESCE(notes, purpose) AS description, title AS label,
              NULL::int, NULL::int
       FROM expenses WHERE tenant_id = $1
       UNION ALL
       SELECT 'transfer_out' AS type, id, amount, transfer_date AS tx_date, 'Transfer' AS payment_method,
              from_account_id AS payment_account_id, note AS description,
              CONCAT('Transfer to ', (SELECT account_name FROM payment_accounts WHERE id = to_account_id)) AS label,
              from_account_id, to_account_id
       FROM fund_transfers WHERE tenant_id = $1 AND COALESCE(is_reversed, false) = false
       UNION ALL
       SELECT 'transfer_in' AS type, id, amount, transfer_date AS tx_date, 'Transfer' AS payment_method,
              to_account_id AS payment_account_id, note AS description,
              CONCAT('Transfer from ', (SELECT account_name FROM payment_accounts WHERE id = from_account_id)) AS label,
              from_account_id, to_account_id
       FROM fund_transfers WHERE tenant_id = $1 AND COALESCE(is_reversed, false) = false
     ) t
     ${whereClause}
     ORDER BY tx_date DESC, id DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}
