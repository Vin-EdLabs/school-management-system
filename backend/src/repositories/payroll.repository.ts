import { query } from '../config/db.js';

export async function createPayrollRun(monthYear: string) {
  const sql = `
    INSERT INTO payroll_runs (month_year, status)
    VALUES ($1, 'draft')
    RETURNING id, month_year, status, total_amount, created_at
  `;
  try {
    const res = await query(sql, [monthYear]);
    return res.rows[0];
  } catch (err) {
    throw new Error('Failed to create payroll run');
  }
}

export async function getPayrollRun(id: number) {
  const sql = `
    SELECT id, month_year, status, total_amount, processed_date, created_at, updated_at
    FROM payroll_runs
    WHERE id = $1
  `;
  try {
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  } catch (err) {
    return null;
  }
}

export async function listPayrollRuns(limit = 100) {
  const sql = `
    SELECT id, month_year, status, total_amount, processed_date, created_at
    FROM payroll_runs
    ORDER BY month_year DESC
    LIMIT $1
  `;
  try {
    const res = await query(sql, [limit]);
    return res.rows;
  } catch (err) {
    return [];
  }
}

export async function createPayrollItem(payrollRunId: number, staffId: number, baseSalary: number, deductions: number = 0, bonuses: number = 0) {
  const netAmount = baseSalary - deductions + bonuses;
  const sql = `
    INSERT INTO payroll_items (payroll_run_id, staff_id, base_salary, deductions, bonuses, net_amount, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    RETURNING id, payroll_run_id, staff_id, base_salary, deductions, bonuses, net_amount, status
  `;
  try {
    const res = await query(sql, [payrollRunId, staffId, baseSalary, deductions, bonuses, netAmount]);
    return res.rows[0];
  } catch (err) {
    throw new Error('Failed to create payroll item');
  }
}

export async function getPayrollItemsForRun(payrollRunId: number) {
  const sql = `
    SELECT pi.id, pi.payroll_run_id, pi.staff_id, pi.base_salary, pi.deductions, pi.bonuses, pi.net_amount, pi.status, pi.notes,
           u.username, u.email
    FROM payroll_items pi
    JOIN users u ON pi.staff_id = u.id
    WHERE pi.payroll_run_id = $1
    ORDER BY u.username
  `;
  try {
    const res = await query(sql, [payrollRunId]);
    return res.rows;
  } catch (err) {
    return [];
  }
}

export async function recordPayrollPayment(payrollItemId: number, staffId: number, amount: number, paymentDate: string, paymentMethod: string = 'bank_transfer', referenceNumber?: string) {
  const sql = `
    INSERT INTO payroll_payments (payroll_item_id, staff_id, amount, payment_date, payment_method, reference_number)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, payroll_item_id, staff_id, amount, payment_date, payment_method, reference_number
  `;
  try {
    const res = await query(sql, [payrollItemId, staffId, amount, paymentDate, paymentMethod, referenceNumber || null]);
    
    // Update payroll item status to paid
    await query('UPDATE payroll_items SET status = $1 WHERE id = $2', ['paid', payrollItemId]);
    
    return res.rows[0];
  } catch (err) {
    throw new Error('Failed to record payroll payment');
  }
}

export async function getPaymentHistory(staffId: number, limit = 12) {
  const sql = `
    SELECT pp.id, pp.payroll_item_id, pp.amount, pp.payment_date, pp.payment_method, pp.reference_number,
           pr.month_year, pi.base_salary, pi.deductions, pi.bonuses
    FROM payroll_payments pp
    JOIN payroll_items pi ON pp.payroll_item_id = pi.id
    JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
    WHERE pp.staff_id = $1
    ORDER BY pp.payment_date DESC
    LIMIT $2
  `;
  try {
    const res = await query(sql, [staffId, limit]);
    return res.rows;
  } catch (err) {
    return [];
  }
}

export async function addPayrollDeduction(payrollItemId: number, deductionType: string, amount: number, description?: string) {
  const sql = `
    INSERT INTO payroll_deductions (payroll_item_id, deduction_type, amount, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id, payroll_item_id, deduction_type, amount, description
  `;
  try {
    const res = await query(sql, [payrollItemId, deductionType, amount, description || null]);
    return res.rows[0];
  } catch (err) {
    throw new Error('Failed to add payroll deduction');
  }
}

export async function getPayrollDeductions(payrollItemId: number) {
  const sql = `
    SELECT id, deduction_type, amount, description
    FROM payroll_deductions
    WHERE payroll_item_id = $1
  `;
  try {
    const res = await query(sql, [payrollItemId]);
    return res.rows;
  } catch (err) {
    return [];
  }
}

export async function generatePayrollReport(payrollRunId: number, userId: number) {
  const sql = `
    INSERT INTO payroll_reports (payroll_run_id, report_type, total_staff, total_paid, generated_by)
    SELECT $1, 'monthly', COUNT(DISTINCT staff_id), SUM(net_amount), $2
    FROM payroll_items
    WHERE payroll_run_id = $1
    RETURNING id, payroll_run_id, total_staff, total_paid, generated_at
  `;
  try {
    const res = await query(sql, [payrollRunId, userId]);
    return res.rows[0];
  } catch (err) {
    throw new Error('Failed to generate payroll report');
  }
}

export default {
  createPayrollRun,
  getPayrollRun,
  listPayrollRuns,
  createPayrollItem,
  getPayrollItemsForRun,
  recordPayrollPayment,
  getPaymentHistory,
  addPayrollDeduction,
  getPayrollDeductions,
  generatePayrollReport
};
