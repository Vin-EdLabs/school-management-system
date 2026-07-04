import { query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';
import { getActiveTeachersSalaryTotal } from './teacherStatusService.js';
import { TEACHER_COUNTABLE_WHERE_BARE } from '../constants/staffQueries.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';
import { getIO } from '../socket.js';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  OTHER_CATEGORY,
} from '../constants/financeCategories.js';

export const EXPECTED_FEE_INCOME = 'Expected Fee Income';
export const SALARIES_CATEGORY = 'Salaries';

const DISCOUNTED_TERM_FEE_SQL = `
  (
    CASE
      WHEN s.is_beneficiary = true AND LOWER(TRIM(COALESCE(s.discount_type::text, ''))) = 'percentage'
        THEN COALESCE(crf.raw_total, 0) - (COALESCE(crf.raw_total, 0) * COALESCE(s.discount_value, 0) / 100)
      WHEN s.is_beneficiary = true AND LOWER(TRIM(COALESCE(s.discount_type::text, ''))) = 'fixed'
        THEN GREATEST(0::numeric, COALESCE(crf.raw_total, 0) - COALESCE(s.discount_value, 0))
      ELSE COALESCE(crf.raw_total, 0)
    END
  )`;

const TERM_PRED_FS = `
  (
    TRIM(COALESCE(fs.term, '')) = ''
    OR fs.term = $2 OR fs.term = $4 OR fs.term LIKE $3
    OR $2 LIKE TRIM(fs.term) || '%' OR TRIM(fs.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(fs.term) || '%' OR TRIM(fs.term) LIKE $4 || '%'
  )`;

const TERM_PRED_PAY = `
  (
    TRIM(COALESCE(p.term, '')) = ''
    OR p.term = $2 OR p.term = $4 OR p.term LIKE $3
    OR $2 LIKE TRIM(p.term) || '%' OR TRIM(p.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(p.term) || '%' OR TRIM(p.term) LIKE $4 || '%'
  )`;

const INCOME_TERM_PRED = `
  (
    TRIM(COALESCE(i.term, '')) = ''
    OR i.term = $2 OR i.term = $4 OR i.term LIKE $3
    OR $2 LIKE TRIM(i.term) || '%' OR TRIM(i.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(i.term) || '%' OR TRIM(i.term) LIKE $4 || '%'
  )`;

const EXPENSE_TERM_PRED = `
  (
    TRIM(COALESCE(e.term, '')) = ''
    OR e.term = $2 OR e.term = $4 OR e.term LIKE $3
    OR $2 LIKE TRIM(e.term) || '%' OR TRIM(e.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(e.term) || '%' OR TRIM(e.term) LIKE $4 || '%'
  )`;

function resolveTermMatch(term: string, academicYear: string): string {
  const t = String(term || '').trim();
  const y = String(academicYear || '').trim();
  if (!y || t.endsWith(y)) return t;
  return `${t} ${y}`;
}

function termLike(termMatch: string): string {
  return `${termMatch}%`;
}

function termOnly(term: string): string {
  const m = String(term || '').trim().match(/^(Term\s*\d+)/i);
  return m ? m[1] : String(term || '').trim();
}

export type BudgetCategory = {
  id: number | null;
  name: string;
  type: 'income' | 'expense';
  isSystem: boolean;
  isCustom: boolean;
  hasTransactions: boolean;
};

export type BudgetLineInput = {
  categoryName: string;
  categoryType: 'income' | 'expense';
  budgetedAmount: number;
  alertThreshold?: number;
};

export type BudgetLineView = BudgetLineInput & {
  id: number;
  actualAmount: number;
  remaining: number;
  percentageUsed: number;
  variance: number;
  alertLevel: 'none' | 'warning' | 'critical' | 'exceeded';
  alerts: Array<{ id: number; alertLevel: string; isRead: boolean; message: string }>;
};

const emitBudgetChanged = (tenantId: number, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'term-budget',
      action,
      at: Date.now(),
    });
  } catch {
    /* optional */
  }
};

async function getActiveTermContext(tenantId: number): Promise<{
  academicYear: string;
  term: string;
  termMatch: string;
  termLike: string;
  termOnly: string;
}> {
  const settings = await query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [tenantId]
  );
  const term = String(settings.rows[0]?.current_term || 'Term 1').trim();
  const academicYear = String(settings.rows[0]?.current_year || new Date().getFullYear()).trim();
  const termMatch = resolveTermMatch(term, academicYear);
  return { academicYear, term, termMatch, termLike: termLike(termMatch), termOnly: termOnly(term) };
}

async function ensureBudgetCategory(
  tenantId: number,
  name: string,
  catType: 'income' | 'expense',
  isSystem = true
): Promise<boolean> {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  const res = await query(
    `INSERT INTO budget_categories (tenant_id, name, type, is_system, is_active)
     SELECT $1, $2::varchar, $3::varchar, $4, true
     WHERE NOT EXISTS (
       SELECT 1 FROM budget_categories bc
       WHERE bc.tenant_id = $1
         AND bc.type = $3::varchar
         AND LOWER(TRIM(bc.name)) = LOWER(TRIM($2::text))
     )
     RETURNING id`,
    [tenantId, trimmed, catType, isSystem]
  );
  return res.rows.length > 0;
}

/** Friendly labels for budget dashboard and shared dropdowns. */
export function getCategoryDisplayName(name: string): string {
  const n = String(name || '').trim();
  if (n.toLowerCase() === EXPECTED_FEE_INCOME.toLowerCase()) return 'School Fees';
  return n;
}

/** Register a category from an income/expense transaction and sync active budget lines. */
export async function registerTransactionCategory(
  tenantId: number,
  name: string,
  catType: 'income' | 'expense',
  userId: number | null = null,
  userRole: string | null = null,
  ipAddress?: string | null
): Promise<void> {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;

  const created = await ensureBudgetCategory(tenantId, trimmed, catType, false);
  if (created) {
    await writeAuditLog({
      tenantId,
      userId,
      userRole,
      action: 'BUDGET_CATEGORY_ADDED',
      entityType: 'BUDGET_CATEGORY',
      module: 'finance',
      summary: `Category "${trimmed}" (${catType}) added from transaction`,
      afterValues: { name: trimmed, type: catType },
      ipAddress,
    });
  }

  await syncActiveBudgetLines(tenantId);
  emitBudgetChanged(tenantId, 'updated');
}

/** Ensure every known category has a line on the active term budget (budgeted 0 if new). */
export async function syncActiveBudgetLines(tenantId: number): Promise<void> {
  const ctx = await getActiveTermContext(tenantId);
  const budgetRes = await query(
    `SELECT id FROM term_budgets
     WHERE tenant_id = $1 AND academic_year = $2 AND term = $3 AND status = 'active'
     LIMIT 1`,
    [tenantId, ctx.academicYear, ctx.term]
  );
  if (budgetRes.rows.length === 0) return;

  const budgetId = Number(budgetRes.rows[0].id);
  const categories = await listBudgetCategories(tenantId);
  const existingRes = await query(
    `SELECT LOWER(TRIM(category_name)) AS name, category_type AS type
     FROM budget_lines WHERE budget_id = $1`,
    [budgetId]
  );
  const existing = new Set(
    existingRes.rows.map((r) => `${String(r.type)}:${String(r.name)}`)
  );

  for (const cat of categories) {
    const key = `${cat.type}:${cat.name.toLowerCase()}`;
    if (existing.has(key)) continue;
    await query(
      `INSERT INTO budget_lines (budget_id, tenant_id, category_name, category_type, budgeted_amount, alert_threshold)
       VALUES ($1, $2, $3::varchar, $4::varchar, 0, 90)`,
      [budgetId, tenantId, cat.name, cat.type]
    );
  }
}

async function seedDefaultCategories(tenantId: number, type: 'income' | 'expense'): Promise<void> {
  const list = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  for (const name of list) {
    if (name === OTHER_CATEGORY) continue;
    await ensureBudgetCategory(tenantId, name, type, true);
  }
}

async function syncSystemCategories(tenantId: number, type: 'income' | 'expense'): Promise<void> {
  await seedDefaultCategories(tenantId, type);

  if (type === 'income') {
    const distinct = await query(
      `SELECT DISTINCT TRIM(COALESCE(NULLIF(TRIM(category), ''), NULLIF(TRIM(source), ''))) AS name
       FROM income
       WHERE tenant_id = $1
         AND TRIM(COALESCE(NULLIF(TRIM(category), ''), NULLIF(TRIM(source), ''))) IS NOT NULL
         AND TRIM(COALESCE(NULLIF(TRIM(category), ''), NULLIF(TRIM(source), ''))) <> ''`,
      [tenantId]
    );
    for (const row of distinct.rows) {
      await ensureBudgetCategory(tenantId, String(row.name || ''), 'income', true);
    }
    await ensureBudgetCategory(tenantId, EXPECTED_FEE_INCOME, 'income', true);
  } else {
    const distinct = await query(
      `SELECT DISTINCT TRIM(category) AS name
       FROM expenses
       WHERE tenant_id = $1 AND TRIM(COALESCE(category, '')) <> ''`,
      [tenantId]
    );
    for (const row of distinct.rows) {
      await ensureBudgetCategory(tenantId, String(row.name || ''), 'expense', true);
    }
    await ensureBudgetCategory(tenantId, SALARIES_CATEGORY, 'expense', true);
  }
}

export async function listBudgetCategories(tenantId: number, type?: 'income' | 'expense'): Promise<BudgetCategory[]> {
  await syncSystemCategories(tenantId, 'income');
  await syncSystemCategories(tenantId, 'expense');

  const params: unknown[] = [tenantId];
  let filter = '';
  if (type) {
    filter = ' AND bc.type = $2';
    params.push(type);
  }

  const res = await query(
    `SELECT bc.id, bc.name, bc.type, bc.is_system,
       EXISTS (
         SELECT 1 FROM income i
         WHERE i.tenant_id = bc.tenant_id
           AND bc.type = 'income'
           AND LOWER(TRIM(COALESCE(NULLIF(TRIM(i.category), ''), NULLIF(TRIM(i.source), '')))) = LOWER(TRIM(bc.name))
       ) OR EXISTS (
         SELECT 1 FROM expenses e
         WHERE e.tenant_id = bc.tenant_id
           AND bc.type = 'expense'
           AND LOWER(TRIM(COALESCE(e.category, ''))) = LOWER(TRIM(bc.name))
       ) AS has_transactions
     FROM budget_categories bc
     WHERE bc.tenant_id = $1 AND bc.is_active = true ${filter}
     ORDER BY bc.type ASC, bc.name ASC`,
    params
  );

  return res.rows.map((r) => ({
    id: r.id != null ? Number(r.id) : null,
    name: String(r.name),
    type: r.type as 'income' | 'expense',
    isSystem: !!r.is_system,
    isCustom: !r.is_system,
    hasTransactions: !!r.has_transactions,
  }));
}

export async function addBudgetCategory(
  tenantId: number,
  userId: number | null,
  userRole: string | null,
  name: string,
  type: 'income' | 'expense',
  ipAddress?: string | null
): Promise<BudgetCategory> {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Category name is required');
  if (type !== 'income' && type !== 'expense') throw new Error('Type must be income or expense');

  const dup = await query(
    `SELECT id FROM budget_categories
     WHERE tenant_id = $1 AND type = $2::varchar AND LOWER(TRIM(name)) = LOWER(TRIM($3::text)) AND is_active = true`,
    [tenantId, type, trimmed]
  );
  if (dup.rows.length > 0) {
    throw new Error('Category already exists');
  }

  const res = await query(
    `INSERT INTO budget_categories (tenant_id, name, type, is_system, is_active)
     VALUES ($1, $2, $3, false, true) RETURNING *`,
    [tenantId, trimmed, type]
  );
  const row = res.rows[0];
  await writeAuditLog({
    tenantId,
    userId,
    userRole,
    action: 'BUDGET_CATEGORY_ADDED',
    entityType: 'BUDGET_CATEGORY',
    entityId: row.id,
    module: 'finance',
    summary: `Budget category "${trimmed}" (${type}) added`,
    afterValues: { name: trimmed, type },
    ipAddress,
  });
  emitBudgetChanged(tenantId, 'created');
  await syncActiveBudgetLines(tenantId);
  return {
    id: Number(row.id),
    name: trimmed,
    type,
    isSystem: false,
    isCustom: true,
    hasTransactions: false,
  };
}

export async function renameBudgetCategory(
  tenantId: number,
  categoryId: number,
  newName: string
): Promise<void> {
  const trimmed = String(newName || '').trim();
  if (!trimmed) throw new Error('Category name is required');

  const cat = await query(
    'SELECT * FROM budget_categories WHERE id = $1 AND tenant_id = $2',
    [categoryId, tenantId]
  );
  if (cat.rows.length === 0) throw new Error('Category not found');
  const oldName = String(cat.rows[0].name);
  const type = String(cat.rows[0].type);

  await query(
    'UPDATE budget_categories SET name = $1 WHERE id = $2 AND tenant_id = $3',
    [trimmed, categoryId, tenantId]
  );

  await query(
    `UPDATE budget_lines SET category_name = $1, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2 AND LOWER(TRIM(category_name)) = LOWER(TRIM($3)) AND category_type = $4`,
    [trimmed, tenantId, oldName, type]
  );

  if (type === 'income') {
    await query(
      `UPDATE income SET category = $1
       WHERE tenant_id = $2 AND LOWER(TRIM(COALESCE(category, source, ''))) = LOWER(TRIM($3))`,
      [trimmed, tenantId, oldName]
    );
  } else {
    await query(
      `UPDATE expenses SET category = $1
       WHERE tenant_id = $2 AND LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM($3))`,
      [trimmed, tenantId, oldName]
    );
  }
}

export async function deleteBudgetCategory(tenantId: number, categoryId: number): Promise<void> {
  const cat = await query(
    'SELECT * FROM budget_categories WHERE id = $1 AND tenant_id = $2',
    [categoryId, tenantId]
  );
  if (cat.rows.length === 0) throw new Error('Category not found');
  if (cat.rows[0].is_system) throw new Error('System categories cannot be deleted');

  const name = String(cat.rows[0].name);
  const type = String(cat.rows[0].type);

  const txCheck =
    type === 'income'
      ? await query(
          `SELECT 1 FROM income i
           WHERE i.tenant_id = $1
             AND LOWER(TRIM(COALESCE(NULLIF(TRIM(i.category), ''), NULLIF(TRIM(i.source), '')))) = LOWER(TRIM($2))
           LIMIT 1`,
          [tenantId, name]
        )
      : await query(
          `SELECT 1 FROM expenses e
           WHERE e.tenant_id = $1 AND LOWER(TRIM(COALESCE(e.category, ''))) = LOWER(TRIM($2))
           LIMIT 1`,
          [tenantId, name]
        );

  if (txCheck.rows.length > 0) {
    throw new Error('Cannot delete category with linked transactions');
  }

  await query('UPDATE budget_categories SET is_active = false WHERE id = $1 AND tenant_id = $2', [
    categoryId,
    tenantId,
  ]);
}

export async function getTermMonths(tenantId: number, academicYear: string, term: string): Promise<number> {
  const res = await query(
    `SELECT start_date, end_date FROM academic_terms
     WHERE tenant_id = $1 AND year = $2
       AND (term_name = $3 OR term_name LIKE $3 || '%' OR $3 LIKE term_name || '%')
     ORDER BY is_active DESC, start_date DESC NULLS LAST
     LIMIT 1`,
    [tenantId, academicYear, termOnly(term)]
  );
  const start = res.rows[0]?.start_date ? new Date(res.rows[0].start_date) : null;
  const end = res.rows[0]?.end_date ? new Date(res.rows[0].end_date) : null;
  if (start && end && end >= start) {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Math.max(1, months);
  }
  return 3;
}

export async function getExpectedFeeIncome(tenantId: number, term: string, academicYear: string): Promise<number> {
  const termMatch = resolveTermMatch(term, academicYear);
  const res = await query(
    `WITH class_raw_fee AS (
      SELECT c.id AS class_id, COALESCE(SUM(fs.amount), 0)::numeric AS raw_total
      FROM classes c
      LEFT JOIN fee_structures fs ON fs.class_id = c.id
        AND (fs.tenant_id = $1 OR fs.tenant_id IS NULL)
        AND (${TERM_PRED_FS})
      WHERE c.tenant_id = $1
      GROUP BY c.id
    )
    SELECT COALESCE(SUM((${DISCOUNTED_TERM_FEE_SQL})), 0)::numeric AS total
    FROM students s
    INNER JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
    LEFT JOIN class_raw_fee crf ON crf.class_id = s.class_assigned_id
    WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}`,
    [tenantId, termMatch, termLike(termMatch), termOnly(term)]
  );
  return parseFloat(res.rows[0]?.total || '0') || 0;
}

export async function getSalaryAutoFill(tenantId: number, term: string, academicYear: string) {
  const monthlyTotal = await getActiveTeachersSalaryTotal(tenantId);
  const teacherCount = await query(
    `SELECT COUNT(*)::int AS cnt FROM teachers
     WHERE tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE_BARE}`,
    [tenantId]
  );
  const activeTeachers = Number(teacherCount.rows[0]?.cnt || 0);
  const months = await getTermMonths(tenantId, academicYear, term);
  return {
    monthlyTotal,
    activeTeachers,
    months,
    suggestedAmount: monthlyTotal * months,
    note: `Auto-calculated from ${activeTeachers} active teachers (GHS ${monthlyTotal.toLocaleString()}/month × ${months} months)`,
  };
}

async function getActualForCategory(
  tenantId: number,
  categoryName: string,
  categoryType: 'income' | 'expense',
  termMatch: string,
  termLikeStr: string,
  termOnlyStr: string,
  academicYear: string
): Promise<number> {
  const catLower = categoryName.trim().toLowerCase();

  if (categoryType === 'income' && catLower === EXPECTED_FEE_INCOME.toLowerCase()) {
    const res = await query(
      `SELECT COALESCE(SUM(COALESCE(p.amount_paid, p.amount, 0)), 0)::numeric AS total
       FROM payments p
       WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false AND (${TERM_PRED_PAY})`,
      [tenantId, termMatch, termLikeStr, termOnlyStr]
    );
    return parseFloat(res.rows[0]?.total || '0') || 0;
  }

  if (categoryType === 'income') {
    const res = await query(
      `SELECT COALESCE(SUM(i.amount), 0)::numeric AS total
       FROM income i
       WHERE i.tenant_id = $1
         AND (${INCOME_TERM_PRED})
         AND (i.academic_year = $5 OR i.academic_year IS NULL OR TRIM(COALESCE(i.academic_year, '')) = '')
         AND LOWER(TRIM(COALESCE(NULLIF(TRIM(i.category), ''), NULLIF(TRIM(i.source), '')))) = LOWER(TRIM($6))`,
      [tenantId, termMatch, termLikeStr, termOnlyStr, academicYear, categoryName]
    );
    return parseFloat(res.rows[0]?.total || '0') || 0;
  }

  const res = await query(
    `SELECT COALESCE(SUM(e.amount), 0)::numeric AS total
     FROM expenses e
     WHERE e.tenant_id = $1
       AND (${EXPENSE_TERM_PRED})
       AND (e.academic_year = $5 OR e.academic_year IS NULL OR TRIM(COALESCE(e.academic_year, '')) = '')
       AND LOWER(TRIM(COALESCE(e.category, ''))) = LOWER(TRIM($6))`,
    [tenantId, termMatch, termLikeStr, termOnlyStr, academicYear, categoryName]
  );
  return parseFloat(res.rows[0]?.total || '0') || 0;
}

function resolveAlertLevel(pct: number): 'none' | 'warning' | 'critical' | 'exceeded' {
  if (pct >= 100) return 'exceeded';
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'warning';
  return 'none';
}

function alertMessage(level: string, categoryName: string, actual: number, budgeted: number): string {
  const fmt = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (level === 'warning') {
    return `You have used 75% of your ${categoryName} budget (${fmt(actual)} of ${fmt(budgeted)})`;
  }
  if (level === 'critical') {
    const remaining = Math.max(0, budgeted - actual);
    return `You are approaching your ${categoryName} budget limit (${fmt(actual)} of ${fmt(budgeted)} — ${fmt(remaining)} remaining)`;
  }
  if (level === 'exceeded') {
    const over = Math.max(0, actual - budgeted);
    return `Your ${categoryName} budget has been exceeded by ${fmt(over)}`;
  }
  return '';
}

export async function getLastTermBudget(tenantId: number, academicYear: string, term: string) {
  const res = await query(
    `SELECT * FROM term_budgets
     WHERE tenant_id = $1 AND status IN ('active', 'closed')
       AND (academic_year < $2 OR (academic_year = $2 AND term < $3))
     ORDER BY academic_year DESC, term DESC, created_at DESC
     LIMIT 1`,
    [tenantId, academicYear, term]
  );
  if (res.rows.length === 0) return null;
  const budget = res.rows[0];
  const lines = await query(
    'SELECT * FROM budget_lines WHERE budget_id = $1 ORDER BY category_type, category_name',
    [budget.id]
  );
  return { budget, lines: lines.rows };
}

export async function getSetupPrefill(tenantId: number, copyFromLast: boolean) {
  const ctx = await getActiveTermContext(tenantId);
  const categories = await listBudgetCategories(tenantId);
  const salary = await getSalaryAutoFill(tenantId, ctx.term, ctx.academicYear);
  const expectedFee = await getExpectedFeeIncome(tenantId, ctx.term, ctx.academicYear);

  const incomeCats = categories.filter((c) => c.type === 'income');
  const expenseCats = categories.filter((c) => c.type === 'expense');

  const lastBudget = copyFromLast ? await getLastTermBudget(tenantId, ctx.academicYear, ctx.term) : null;
  const lastMap = new Map<string, number>();
  if (lastBudget) {
    for (const line of lastBudget.lines) {
      lastMap.set(`${line.category_type}:${String(line.category_name).toLowerCase()}`, parseFloat(line.budgeted_amount));
    }
  }

  const buildLine = (name: string, type: 'income' | 'expense', defaultAmount: number) => {
    const key = `${type}:${name.toLowerCase()}`;
    const amount = lastMap.has(key) ? lastMap.get(key)! : defaultAmount;
    return { categoryName: name, categoryType: type, budgetedAmount: amount, alertThreshold: 90 };
  };

  const incomeLines = incomeCats.map((c) =>
    buildLine(
      c.name,
      'income',
      c.name.toLowerCase() === EXPECTED_FEE_INCOME.toLowerCase() ? expectedFee : 0
    )
  );
  const expenseLines = expenseCats.map((c) =>
    buildLine(
      c.name,
      'expense',
      c.name.toLowerCase() === SALARIES_CATEGORY.toLowerCase() ? salary.suggestedAmount : 0
    )
  );

  return {
    academicYear: ctx.academicYear,
    term: ctx.term,
    salaryAutoFill: salary,
    expectedFeeIncome: expectedFee,
    incomeLines,
    expenseLines,
    copyFromLast: !!lastBudget,
  };
}

export async function getActiveBudget(tenantId: number, academicYear?: string, term?: string) {
  const ctx = await getActiveTermContext(tenantId);
  const ay = academicYear || ctx.academicYear;
  const t = term || ctx.term;

  const budgetRes = await query(
    `SELECT * FROM term_budgets WHERE tenant_id = $1 AND academic_year = $2 AND term = $3`,
    [tenantId, ay, t]
  );
  if (budgetRes.rows.length === 0) return null;

  await syncActiveBudgetLines(tenantId);

  const budget = budgetRes.rows[0];
  const linesRes = await query(
    'SELECT * FROM budget_lines WHERE budget_id = $1 ORDER BY category_type ASC, category_name ASC',
    [budget.id]
  );

  const termMatch = resolveTermMatch(t, ay);
  const termLikeStr = termLike(termMatch);
  const termOnlyStr = termOnly(t);

  const alertsRes = await query(
    `SELECT * FROM budget_alerts WHERE budget_id = $1 ORDER BY created_at DESC`,
    [budget.id]
  );
  const alertsByLine = new Map<number, typeof alertsRes.rows>();
  for (const a of alertsRes.rows) {
    const lid = Number(a.budget_line_id);
    if (!alertsByLine.has(lid)) alertsByLine.set(lid, []);
    alertsByLine.get(lid)!.push(a);
  }

  const lines: BudgetLineView[] = [];
  let totalBudgetedIncome = 0;
  let totalActualIncome = 0;
  let totalBudgetedExpense = 0;
  let totalActualExpense = 0;

  for (const line of linesRes.rows) {
    const budgeted = parseFloat(line.budgeted_amount) || 0;
    const actual = await getActualForCategory(
      tenantId,
      line.category_name,
      line.category_type,
      termMatch,
      termLikeStr,
      termOnlyStr,
      ay
    );
    const remaining = budgeted - actual;
    const pct = budgeted > 0 ? (actual / budgeted) * 100 : actual > 0 ? 100 : 0;
    const alertLevel = resolveAlertLevel(pct);
    const lineAlerts = (alertsByLine.get(Number(line.id)) || []).map((a) => ({
      id: Number(a.id),
      alertLevel: String(a.alert_level),
      isRead: !!a.is_read,
      message: String(a.message || ''),
    }));

    if (line.category_type === 'income') {
      totalBudgetedIncome += budgeted;
      totalActualIncome += actual;
    } else {
      totalBudgetedExpense += budgeted;
      totalActualExpense += actual;
    }

    lines.push({
      id: Number(line.id),
      categoryName: String(line.category_name),
      categoryType: line.category_type,
      budgetedAmount: budgeted,
      alertThreshold: Number(line.alert_threshold) || 90,
      actualAmount: actual,
      remaining,
      percentageUsed: pct,
      variance: remaining,
      alertLevel,
      alerts: lineAlerts,
    });
  }

  return {
    budget: {
      id: Number(budget.id),
      academicYear: String(budget.academic_year),
      term: String(budget.term),
      status: String(budget.status),
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
    },
    summary: {
      totalBudgetedIncome,
      totalActualIncome,
      incomeVariance: totalBudgetedIncome - totalActualIncome,
      totalBudgetedExpense,
      totalActualExpense,
      expenseVariance: totalBudgetedExpense - totalActualExpense,
      netBudgetPosition: totalBudgetedIncome - totalBudgetedExpense,
      netActualPosition: totalActualIncome - totalActualExpense,
      netVariance: totalBudgetedIncome - totalBudgetedExpense - (totalActualIncome - totalActualExpense),
    },
    lines,
  };
}

export async function createTermBudget(
  tenantId: number,
  userId: number | null,
  userRole: string | null,
  lines: BudgetLineInput[],
  ipAddress?: string | null
) {
  const ctx = await getActiveTermContext(tenantId);

  const existing = await query(
    `SELECT id, status FROM term_budgets WHERE tenant_id = $1 AND academic_year = $2 AND term = $3`,
    [tenantId, ctx.academicYear, ctx.term]
  );
  if (existing.rows.length > 0 && existing.rows[0].status === 'active') {
    throw new Error('An active budget already exists for this term');
  }
  if (existing.rows.length > 0 && existing.rows[0].status === 'closed') {
    throw new Error('This term budget is closed. Start a new term to create a new budget.');
  }

  const budgetRes = await query(
    `INSERT INTO term_budgets (tenant_id, academic_year, term, status, created_by)
     VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
    [tenantId, ctx.academicYear, ctx.term, userId]
  );
  const budget = budgetRes.rows[0];

  for (const line of lines) {
    await query(
      `INSERT INTO budget_lines (budget_id, tenant_id, category_name, category_type, budgeted_amount, alert_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        budget.id,
        tenantId,
        line.categoryName,
        line.categoryType,
        line.budgetedAmount,
        line.alertThreshold ?? 90,
      ]
    );
  }

  await writeAuditLog({
    tenantId,
    userId,
    userRole,
    action: 'BUDGET_CREATED',
    entityType: 'TERM_BUDGET',
    entityId: budget.id,
    module: 'finance',
    summary: `Term budget created for ${ctx.term} ${ctx.academicYear}`,
    afterValues: { academicYear: ctx.academicYear, term: ctx.term, lineCount: lines.length },
    ipAddress,
  });

  emitBudgetChanged(tenantId, 'created');
  await evaluateBudgetAlerts(tenantId);
  return getActiveBudget(tenantId, ctx.academicYear, ctx.term);
}

export async function updateTermBudgetLines(
  tenantId: number,
  userId: number | null,
  userRole: string | null,
  budgetId: number,
  lines: Array<{ id: number; budgetedAmount: number; alertThreshold?: number }>,
  ipAddress?: string | null
) {
  const budget = await query('SELECT * FROM term_budgets WHERE id = $1 AND tenant_id = $2', [budgetId, tenantId]);
  if (budget.rows.length === 0) throw new Error('Budget not found');
  if (budget.rows[0].status === 'closed') throw new Error('Cannot edit a closed budget');

  const termMatch = resolveTermMatch(String(budget.rows[0].term), String(budget.rows[0].academic_year));
  const termLikeStr = termLike(termMatch);
  const termOnlyStr = termOnly(String(budget.rows[0].term));

  for (const upd of lines) {
    const lineRes = await query(
      'SELECT * FROM budget_lines WHERE id = $1 AND budget_id = $2 AND tenant_id = $3',
      [upd.id, budgetId, tenantId]
    );
    if (lineRes.rows.length === 0) continue;
    const line = lineRes.rows[0];
    const oldAmount = parseFloat(line.budgeted_amount) || 0;
    const newAmount = Number(upd.budgetedAmount) || 0;

    const actual = await getActualForCategory(
      tenantId,
      line.category_name,
      line.category_type,
      termMatch,
      termLikeStr,
      termOnlyStr,
      String(budget.rows[0].academic_year)
    );

    if (line.category_type === 'expense' && newAmount < actual) {
      throw new Error(
        `Cannot reduce "${line.category_name}" below actual spent (${actual.toFixed(2)})`
      );
    }

    await query(
      `UPDATE budget_lines SET budgeted_amount = $1, alert_threshold = COALESCE($2, alert_threshold), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newAmount, upd.alertThreshold ?? null, upd.id]
    );

    if (oldAmount !== newAmount) {
      await writeAuditLog({
        tenantId,
        userId,
        userRole,
        action: 'BUDGET_UPDATED',
        entityType: 'BUDGET_LINE',
        entityId: upd.id,
        module: 'finance',
        summary: `Budget line "${line.category_name}" updated`,
        beforeValues: { budgetedAmount: oldAmount },
        afterValues: { budgetedAmount: newAmount },
        ipAddress,
      });
    }
  }

  await query('UPDATE term_budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [budgetId]);
  emitBudgetChanged(tenantId, 'updated');
  await evaluateBudgetAlerts(tenantId);
  return getActiveBudget(tenantId, String(budget.rows[0].academic_year), String(budget.rows[0].term));
}

export async function closeTermBudget(
  tenantId: number,
  userId: number | null,
  userRole: string | null,
  budgetId: number,
  ipAddress?: string | null
) {
  const budget = await query('SELECT * FROM term_budgets WHERE id = $1 AND tenant_id = $2', [budgetId, tenantId]);
  if (budget.rows.length === 0) throw new Error('Budget not found');
  if (budget.rows[0].status === 'closed') throw new Error('Budget is already closed');

  await query(
    `UPDATE term_budgets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [budgetId]
  );

  await query(
    `UPDATE budget_alerts SET is_read = true
     WHERE budget_id = $1 AND alert_level = 'exceeded'`,
    [budgetId]
  );

  await writeAuditLog({
    tenantId,
    userId,
    userRole,
    action: 'BUDGET_CLOSED',
    entityType: 'TERM_BUDGET',
    entityId: budgetId,
    module: 'finance',
    summary: `Term budget closed for ${budget.rows[0].term} ${budget.rows[0].academic_year}`,
    ipAddress,
  });

  emitBudgetChanged(tenantId, 'updated');
  return getActiveBudget(tenantId, String(budget.rows[0].academic_year), String(budget.rows[0].term));
}

export async function listBudgetHistory(tenantId: number) {
  const res = await query(
    `SELECT tb.*,
       (SELECT COUNT(*)::int FROM budget_lines bl WHERE bl.budget_id = tb.id) AS line_count,
       (SELECT COALESCE(SUM(bl.budgeted_amount), 0) FROM budget_lines bl WHERE bl.budget_id = tb.id AND bl.category_type = 'income') AS total_income,
       (SELECT COALESCE(SUM(bl.budgeted_amount), 0) FROM budget_lines bl WHERE bl.budget_id = tb.id AND bl.category_type = 'expense') AS total_expense
     FROM term_budgets tb
     WHERE tb.tenant_id = $1
     ORDER BY tb.academic_year DESC, tb.term DESC, tb.created_at DESC`,
    [tenantId]
  );
  return res.rows;
}

export async function evaluateBudgetAlerts(tenantId: number): Promise<void> {
  const data = await getActiveBudget(tenantId);
  if (!data || data.budget.status !== 'active') return;

  for (const line of data.lines) {
    if (line.budgetedAmount <= 0) continue;

    const levels: Array<'warning' | 'critical' | 'exceeded'> = [];
    if (line.percentageUsed >= 100) levels.push('exceeded');
    else if (line.percentageUsed >= 90) levels.push('critical');
    else if (line.percentageUsed >= 75) levels.push('warning');

    for (const level of levels) {
      const message = alertMessage(level, line.categoryName, line.actualAmount, line.budgetedAmount);
      const insert = await query(
        `INSERT INTO budget_alerts (tenant_id, budget_id, budget_line_id, alert_level, percentage_used, message, is_read)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (budget_line_id, alert_level) DO NOTHING
         RETURNING id`,
        [tenantId, data.budget.id, line.id, level, line.percentageUsed, message]
      );

      if (insert.rows.length > 0) {
        await writeAuditLog({
          tenantId,
          userId: null,
          userRole: null,
          action: 'BUDGET_ALERT_TRIGGERED',
          entityType: 'BUDGET_ALERT',
          entityId: insert.rows[0].id,
          module: 'finance',
          summary: message,
          details: {
            category: line.categoryName,
            percentage: line.percentageUsed,
            alertLevel: level,
          },
        });
        emitBudgetChanged(tenantId, 'updated');
      }
    }
  }
}

export async function getUnreadBudgetAlerts(tenantId: number) {
  const res = await query(
    `SELECT ba.*, bl.category_name, bl.category_type, tb.term, tb.academic_year, tb.status AS budget_status
     FROM budget_alerts ba
     JOIN budget_lines bl ON bl.id = ba.budget_line_id
     JOIN term_budgets tb ON tb.id = ba.budget_id
     WHERE ba.tenant_id = $1 AND ba.is_read = false AND tb.status = 'active'
     ORDER BY ba.created_at DESC
     LIMIT 50`,
    [tenantId]
  );
  return res.rows;
}

export async function markBudgetAlertRead(tenantId: number, alertId: number): Promise<void> {
  const alert = await query(
    `SELECT ba.*, bl.category_name, bl.budgeted_amount, tb.status AS budget_status
     FROM budget_alerts ba
     JOIN budget_lines bl ON bl.id = ba.budget_line_id
     JOIN term_budgets tb ON tb.id = ba.budget_id
     WHERE ba.id = $1 AND ba.tenant_id = $2`,
    [alertId, tenantId]
  );
  if (alert.rows.length === 0) throw new Error('Alert not found');

  const row = alert.rows[0];
  if (row.alert_level === 'exceeded' && row.budget_status === 'active') {
    const data = await getActiveBudget(tenantId);
    const line = data?.lines.find((l) => l.id === Number(row.budget_line_id));
    if (line && line.percentageUsed >= 100) {
      throw new Error('Exceeded alerts cannot be dismissed until the budget is increased or the term is closed');
    }
  }

  await query('UPDATE budget_alerts SET is_read = true WHERE id = $1 AND tenant_id = $2', [alertId, tenantId]);
  emitBudgetChanged(tenantId, 'updated');
}

export async function markAllBudgetAlertsRead(tenantId: number): Promise<void> {
  const unread = await getUnreadBudgetAlerts(tenantId);
  for (const a of unread) {
    if (a.alert_level === 'exceeded') continue;
    await query('UPDATE budget_alerts SET is_read = true WHERE id = $1', [a.id]);
  }
  emitBudgetChanged(tenantId, 'updated');
}
