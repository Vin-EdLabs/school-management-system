import express from 'express';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { sendPushToStaffUser } from '../services/webPushService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';

function generatePin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function computePayrollLine(
  gross: number,
  ssnitEnabled: boolean,
  ssnitPercent: number,
  otherDeductions: number,
  allowances: number
) {
  const g = roundMoney(gross);
  const ssnitAmount = ssnitEnabled ? roundMoney(g * (ssnitPercent / 100)) : 0;
  const net = roundMoney(g - ssnitAmount - roundMoney(otherDeductions) + roundMoney(allowances));
  return { gross: g, ssnitAmount, net, ssnitPercent: roundMoney(ssnitPercent) };
}

const router = express.Router();

const emitTenantDataChanged = (
  tenantId: number,
  entity: string,
  action: 'created' | 'updated' | 'deleted',
  extra?: Record<string, unknown>
) => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity,
      action,
      at: Date.now(),
      ...(extra || {}),
    });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

async function ensurePayrollSettings(tenantId: number) {
  await query(
    `INSERT INTO payroll_settings (tenant_id) VALUES ($1)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
}

async function getPayrollSettingsRow(tenantId: number) {
  await ensurePayrollSettings(tenantId);
  const r = await query('SELECT * FROM payroll_settings WHERE tenant_id = $1', [tenantId]);
  return r.rows[0] as Record<string, unknown>;
}

async function refreshOpenPayrollRowsForSsnitFlag(
  tenantId: number,
  payeeType: 'teacher' | 'staff',
  payeeId: number,
  monthlySalary: number,
  ssnitEnabled: boolean
) {
  const settings = await getPayrollSettingsRow(tenantId);
  const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
  const rows = await query(
    `SELECT id, amount, gross_salary, other_deductions, allowances, net_salary
     FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = $2 AND payee_id = $3`,
    [tenantId, payeeType, payeeId]
  );

  for (const row of rows.rows as Record<string, unknown>[]) {
    const amountPaid = parseFloat(String(row.amount ?? 0));
    const currentNet = parseFloat(String(row.net_salary ?? 0));
    if (amountPaid >= currentNet - 0.01 && currentNet > 0) continue;

    const gross = row.gross_salary != null ? parseFloat(String(row.gross_salary)) : monthlySalary;
    const otherD = parseFloat(String(row.other_deductions ?? 0));
    const allow = parseFloat(String(row.allowances ?? 0));
    const calc = computePayrollLine(gross || monthlySalary, ssnitEnabled, ssnitPct, otherD, allow);
    await query(
      `UPDATE salary_payments
       SET ssnit_percent = $1, ssnit_amount = $2, net_salary = $3, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $4 AND id = $5`,
      [ssnitPct, calc.ssnitAmount, calc.net, tenantId, row.id]
    );
  }
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/settings', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const row = await getPayrollSettingsRow(tenantId);
    res.json({
      defaultSsnitPercent: parseFloat(String(row.default_ssnit_percent ?? 5.5)),
      currency: String(row.currency || 'GHS'),
      payrollGenerationDay: parseInt(String(row.payroll_generation_day ?? 1), 10),
      autoGeneratePayroll: Boolean(row.auto_generate_payroll),
      payslipFooterText: row.payslip_footer_text || '',
      payslipSignatureText: row.payslip_signature_text || '',
    });
  } catch (error) {
    console.error('Get payroll settings error:', error);
    res.status(500).json({ error: 'Failed to load payroll settings' });
  }
});

router.put('/settings', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await ensurePayrollSettings(tenantId);
    const {
      defaultSsnitPercent,
      currency,
      payrollGenerationDay,
      autoGeneratePayroll,
      payslipFooterText,
      payslipSignatureText,
    } = req.body;

    const updates: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (defaultSsnitPercent !== undefined) {
      const v = parseFloat(String(defaultSsnitPercent));
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        return res.status(400).json({ error: 'SSNIT percent must be between 0 and 100' });
      }
      updates.push(`default_ssnit_percent = $${p++}`);
      vals.push(v);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${p++}`);
      vals.push(String(currency).slice(0, 10));
    }
    if (payrollGenerationDay !== undefined) {
      const d = parseInt(String(payrollGenerationDay), 10);
      if (!Number.isFinite(d) || d < 1 || d > 28) {
        return res.status(400).json({ error: 'Payroll generation day must be 1–28' });
      }
      updates.push(`payroll_generation_day = $${p++}`);
      vals.push(d);
    }
    if (autoGeneratePayroll !== undefined) {
      updates.push(`auto_generate_payroll = $${p++}`);
      vals.push(Boolean(autoGeneratePayroll));
    }
    if (payslipFooterText !== undefined) {
      updates.push(`payslip_footer_text = $${p++}`);
      vals.push(payslipFooterText == null ? null : String(payslipFooterText));
    }
    if (payslipSignatureText !== undefined) {
      updates.push(`payslip_signature_text = $${p++}`);
      vals.push(payslipSignatureText == null ? null : String(payslipSignatureText));
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const prevRes = await query('SELECT * FROM payroll_settings WHERE tenant_id = $1', [tenantId]);
    const previous = prevRes.rows[0] || null;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(tenantId);
    const result = await query(
      `UPDATE payroll_settings SET ${updates.join(', ')} WHERE tenant_id = $${p} RETURNING *`,
      vals
    );
    const next = result.rows[0] || null;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'PAYROLL_SETTINGS_UPDATE',
      entityType: 'PAYROLL_SETTINGS',
      entityId: tenantId,
      module: 'finance',
      status: 'success',
      summary: 'Payroll / finance settings updated',
      details: { previous, new: next, submitted: req.body },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'payroll-settings', 'updated');
    const row = result.rows[0];
    res.json({
      defaultSsnitPercent: parseFloat(String(row.default_ssnit_percent ?? 5.5)),
      currency: String(row.currency || 'GHS'),
      payrollGenerationDay: parseInt(String(row.payroll_generation_day ?? 1), 10),
      autoGeneratePayroll: Boolean(row.auto_generate_payroll),
      payslipFooterText: row.payslip_footer_text || '',
      payslipSignatureText: row.payslip_signature_text || '',
    });
  } catch (error) {
    console.error('Put payroll settings error:', error);
    res.status(500).json({ error: 'Failed to save payroll settings' });
  }
});

// Get current user's salary (teacher) - for profile
router.get('/my-salary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (role === 'teacher' && teacherId) {
      const teacherRes = await query(
        'SELECT id, full_name, staff_id, monthly_salary, ssnit_enabled FROM teachers WHERE id = $1 AND tenant_id = $2',
        [teacherId, tenantId]
      );
      if (teacherRes.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
      const t = teacherRes.rows[0] as any;
      const settings = await getPayrollSettingsRow(tenantId);
      const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
      const ssnitEnabled = t.ssnit_enabled !== false;
      const monthlySalary = parseFloat(t.monthly_salary || 0);
      const { ssnitAmount, net } = computePayrollLine(monthlySalary, ssnitEnabled, ssnitPct, 0, 0);
      const currency = String(settings.currency || 'GHS');

      // One row per calendar month (latest id wins if duplicates ever existed)
      const paymentsRes = await query(
        `SELECT DISTINCT ON (sp.year, sp.month)
           sp.month, sp.year, sp.amount, sp.paid_date, sp.payment_method,
           sp.net_salary, sp.gross_salary, sp.ssnit_amount, sp.other_deductions, sp.allowances
         FROM salary_payments sp
         WHERE sp.tenant_id = $1 AND sp.payee_type = 'teacher' AND sp.payee_id = $2
         ORDER BY sp.year DESC, sp.month DESC, sp.id DESC`,
        [tenantId, teacherId]
      );

      const mapPaymentRow = (p: any) => {
        const grossForRow = p.gross_salary != null ? parseFloat(p.gross_salary) : monthlySalary;
        const otherD = parseFloat(p.other_deductions || 0);
        const allow = parseFloat(p.allowances || 0);
        const lineCalc = computePayrollLine(grossForRow, ssnitEnabled, ssnitPct, otherD, allow);
        const netExpected = ssnitEnabled && p.net_salary != null ? parseFloat(p.net_salary) : lineCalc.net;
        const paid = parseFloat(p.amount || 0);
        const ssnitForRow = ssnitEnabled && p.ssnit_amount != null ? parseFloat(p.ssnit_amount) : lineCalc.ssnitAmount;
        const balance = Math.max(0, roundMoney(netExpected - paid));
        return {
          month: p.month,
          year: p.year,
          amountPaid: paid,
          grossSalary: grossForRow,
          netSalary: netExpected,
          ssnitAmount: ssnitForRow,
          otherDeductions: otherD,
          allowances: allow,
          balanceOwing: balance,
          paidDate: p.paid_date,
          paymentMethod: p.payment_method || null,
          status: paid >= netExpected - 0.01 && netExpected > 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
        };
      };

      const payments = paymentsRes.rows.map(mapPaymentRow);

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const thisMonth = payments.find((p: any) => p.month === currentMonth && p.year === currentYear);

      let currentMonthSnapshot: {
        grossSalary: number;
        ssnitAmount: number;
        netSalary: number;
        amountPaid: number;
        status: string;
        paymentMethod: string | null;
        paidDate: string | null;
      };

      if (thisMonth) {
        currentMonthSnapshot = {
          grossSalary: thisMonth.grossSalary,
          ssnitAmount: thisMonth.ssnitAmount,
          netSalary: thisMonth.netSalary,
          amountPaid: thisMonth.amountPaid,
          status: thisMonth.status,
          paymentMethod: thisMonth.paymentMethod,
          paidDate: thisMonth.paidDate,
        };
      } else {
        currentMonthSnapshot = {
          grossSalary: monthlySalary,
          ssnitAmount,
          netSalary: net,
          amountPaid: 0,
          status: 'Unpaid',
          paymentMethod: null,
          paidDate: null,
        };
      }

      return res.json({
        fullName: t.full_name,
        staffId: t.staff_id,
        monthlySalary,
        grossSalary: monthlySalary,
        currency,
        ssnitEnabled,
        defaultSsnitPercent: ssnitPct,
        ssnitDeduction: ssnitAmount,
        netSalary: net,
        currentMonthStatus: currentMonthSnapshot.status,
        currentMonthSnapshot,
        paymentHistory: payments,
      });
    }
    return res.status(403).json({ error: 'Only teachers can view salary here' });
  } catch (error) {
    console.error('Get my salary error:', error);
    res.status(500).json({ error: 'Failed to fetch salary' });
  }
});

router.get('/history', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const payeeType = req.query.payee_type ? String(req.query.payee_type) : undefined;
    const payeeId = req.query.payee_id ? parseInt(String(req.query.payee_id), 10) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    let sql = `
      SELECT sp.*,
        CASE WHEN sp.payee_type = 'teacher' THEN t.full_name ELSE s.full_name END AS display_name,
        CASE WHEN sp.payee_type = 'teacher' THEN t.staff_id ELSE s.staff_id END AS display_staff_id,
        CASE WHEN sp.payee_type = 'teacher' THEN COALESCE(c.class_name, 'Teacher') ELSE COALESCE(s.role, 'Staff') END AS display_role
      FROM salary_payments sp
      LEFT JOIN teachers t ON sp.payee_type = 'teacher' AND sp.payee_id = t.id AND t.tenant_id = sp.tenant_id
      LEFT JOIN classes c ON t.class_assigned_id = c.id
      LEFT JOIN payroll_other_staff s ON sp.payee_type = 'staff' AND sp.payee_id = s.id AND s.tenant_id = sp.tenant_id
      WHERE sp.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (month != null && !Number.isNaN(month)) {
      sql += ` AND sp.month = $${idx++}`;
      params.push(month);
    }
    if (year != null && !Number.isNaN(year)) {
      sql += ` AND sp.year = $${idx++}`;
      params.push(year);
    }
    if (payeeType && (payeeType === 'teacher' || payeeType === 'staff')) {
      sql += ` AND sp.payee_type = $${idx++}`;
      params.push(payeeType);
    }
    if (payeeId != null && !Number.isNaN(payeeId)) {
      sql += ` AND sp.payee_id = $${idx++}`;
      params.push(payeeId);
    }
    sql += ` ORDER BY sp.year DESC, sp.month DESC, display_name ASC`;
    const result = await query(sql, params);
    const rows = result.rows.map((r: any) => {
      const gross = r.gross_salary != null ? parseFloat(r.gross_salary) : 0;
      const net = r.net_salary != null ? parseFloat(r.net_salary) : gross;
      const paid = parseFloat(r.amount || 0);
      let st = 'Unpaid';
      if (paid >= net - 0.01 && net > 0) st = 'Paid';
      else if (paid > 0) st = 'Partially Paid';
      return {
        id: r.id,
        payeeType: r.payee_type,
        payeeId: r.payee_id,
        name: r.display_name,
        staffId: r.display_staff_id,
        role: r.display_role,
        month: r.month,
        year: r.year,
        grossSalary: gross,
        ssnitPercent: r.ssnit_percent != null ? parseFloat(r.ssnit_percent) : null,
        ssnitAmount: r.ssnit_amount != null ? parseFloat(r.ssnit_amount) : null,
        otherDeductions: parseFloat(r.other_deductions || 0),
        allowances: parseFloat(r.allowances || 0),
        netSalary: net,
        amountPaid: paid,
        paidDate: r.paid_date,
        paymentMethod: r.payment_method,
        status: st,
        expenseId: r.expense_id,
      };
    });
    const filtered = status ? rows.filter((r) => r.status === status) : rows;
    res.json(filtered);
  } catch (error) {
    console.error('Payroll history error:', error);
    res.status(500).json({ error: 'Failed to load payroll history' });
  }
});

router.get('/detail', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const month = parseInt(String(req.query.month), 10);
    const year = parseInt(String(req.query.year), 10);
    const payeeType = String(req.query.payee_type || '');
    const payeeId = parseInt(String(req.query.payee_id), 10);
    if (!month || !year || !payeeId || (payeeType !== 'teacher' && payeeType !== 'staff')) {
      return res.status(400).json({ error: 'month, year, payee_type, payee_id are required' });
    }
    const settings = await getPayrollSettingsRow(tenantId);
    const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
    const currency = String(settings.currency || 'GHS');

    let staff: any = null;
    if (payeeType === 'teacher') {
      const tr = await query(
        `SELECT t.*, c.class_name FROM teachers t
         LEFT JOIN classes c ON t.class_assigned_id = c.id
         WHERE t.tenant_id = $1 AND t.id = $2`,
        [tenantId, payeeId]
      );
      if (tr.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
      const t = tr.rows[0];
      staff = {
        payeeType: 'teacher',
        id: t.id,
        name: t.full_name,
        staffId: t.staff_id,
        position: t.class_name || 'Teacher',
        monthlySalary: parseFloat(t.monthly_salary || 0),
        ssnitEnabled: t.ssnit_enabled !== false,
        employmentStatus: t.employment_status,
      };
    } else {
      const sr = await query(
        'SELECT * FROM payroll_other_staff WHERE tenant_id = $1 AND id = $2',
        [tenantId, payeeId]
      );
      if (sr.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
      const s = sr.rows[0];
      staff = {
        payeeType: 'staff',
        id: s.id,
        name: s.full_name,
        staffId: s.staff_id,
        position: s.role || 'Staff',
        monthlySalary: parseFloat(s.monthly_salary || 0),
        ssnitEnabled: s.ssnit_enabled !== false,
        employmentStatus: s.employment_status,
      };
    }

    const pr = await query(
      `SELECT * FROM salary_payments WHERE tenant_id = $1 AND payee_type = $2 AND payee_id = $3 AND month = $4 AND year = $5`,
      [tenantId, payeeType, payeeId, month, year]
    );
    const grossBase = staff.monthlySalary;
    const otherD = pr.rows[0] ? parseFloat(pr.rows[0].other_deductions || 0) : 0;
    const allow = pr.rows[0] ? parseFloat(pr.rows[0].allowances || 0) : 0;
    const lineGross = pr.rows[0]?.gross_salary != null ? parseFloat(pr.rows[0].gross_salary) : grossBase;
    const effGross = lineGross || grossBase;
    const calc = computePayrollLine(effGross, staff.ssnitEnabled, ssnitPct, otherD, allow);

    const hist = await query(
      `SELECT month, year, amount, paid_date, payment_method, gross_salary, net_salary, ssnit_amount, notes, expense_id
       FROM salary_payments WHERE tenant_id = $1 AND payee_type = $2 AND payee_id = $3
       ORDER BY year DESC, month DESC LIMIT 36`,
      [tenantId, payeeType, payeeId]
    );

    const row = pr.rows[0];
    res.json({
      settings: { defaultSsnitPercent: ssnitPct, currency, payslipFooterText: settings.payslip_footer_text || '', payslipSignatureText: settings.payslip_signature_text || '' },
      staff,
      month,
      year,
      line: {
        grossSalary: effGross,
        ssnitPercent: ssnitPct,
        ssnitAmount: calc.ssnitAmount,
        otherDeductions: otherD,
        allowances: allow,
        netSalary: calc.net,
        payrollNotes: row?.payroll_notes || '',
        paymentNotes: row?.notes || '',
        amountPaid: row ? parseFloat(row.amount || 0) : 0,
        paidDate: row?.paid_date || null,
        paymentMethod: row?.payment_method || null,
        expenseId: row?.expense_id || null,
        stored: !!row,
      },
      paymentHistory: hist.rows.map((h: any) => ({
        month: h.month,
        year: h.year,
        amountPaid: parseFloat(h.amount || 0),
        grossSalary: h.gross_salary != null ? parseFloat(h.gross_salary) : null,
        netSalary: h.net_salary != null ? parseFloat(h.net_salary) : null,
        ssnitAmount: h.ssnit_amount != null ? parseFloat(h.ssnit_amount) : null,
        paidDate: h.paid_date,
        paymentMethod: h.payment_method,
        notes: h.notes,
        expenseId: h.expense_id,
      })),
    });
  } catch (error) {
    console.error('Payroll detail error:', error);
    res.status(500).json({ error: 'Failed to load payroll detail' });
  }
});

// Get payroll overview for a month (teachers + other staff with paid/unpaid status)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    const settings = await getPayrollSettingsRow(tenantId);
    const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
    const currency = String(settings.currency || 'GHS');

    const teachersRes = await query(
      `SELECT t.id, t.full_name, t.staff_id, t.monthly_salary, t.employment_status, t.ssnit_enabled, c.class_name
       FROM teachers t
       LEFT JOIN classes c ON t.class_assigned_id = c.id
       WHERE t.tenant_id = $1 AND (LOWER(COALESCE(t.employment_status, '')) = 'active' OR t.employment_status IS NULL OR t.employment_status = '')`,
      [tenantId]
    );

    const otherStaffRes = await query(
      `SELECT id, full_name, role, monthly_salary, employment_status, staff_id, ssnit_enabled
       FROM payroll_other_staff
       WHERE tenant_id = $1 AND (employment_status = 'active' OR employment_status IS NULL)`,
      [tenantId]
    );

    const paymentsRes = await query(
      `SELECT payee_type, payee_id, amount, paid_date, payment_method, notes,
              gross_salary, ssnit_percent, ssnit_amount, other_deductions, allowances, net_salary, payroll_notes, expense_id
       FROM salary_payments
       WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      [tenantId, m, y]
    );

    const paymentMap: Record<string, any> = {};
    paymentsRes.rows.forEach((p: any) => {
      paymentMap[`${p.payee_type}-${p.payee_id}`] = p;
    });

    const buildRow = (base: {
      id: number;
      payeeType: string;
      name: string;
      staffId: string | null;
      role: string;
      monthlySalary: number;
      ssnitEnabled: boolean;
    }) => {
      const key = `${base.payeeType}-${base.id}`;
      const paidRow = paymentMap[key];
      const gross = paidRow?.gross_salary != null ? parseFloat(paidRow.gross_salary) : base.monthlySalary;
      const otherD = paidRow ? parseFloat(paidRow.other_deductions || 0) : 0;
      const allow = paidRow ? parseFloat(paidRow.allowances || 0) : 0;
      const pct = paidRow?.ssnit_percent != null ? parseFloat(paidRow.ssnit_percent) : ssnitPct;
      const calc = computePayrollLine(gross, base.ssnitEnabled, pct, otherD, allow);
      const ssnitAmount = base.ssnitEnabled && paidRow?.ssnit_amount != null ? parseFloat(paidRow.ssnit_amount) : calc.ssnitAmount;
      const net = base.ssnitEnabled && paidRow?.net_salary != null ? parseFloat(paidRow.net_salary) : calc.net;
      const amountPaid = paidRow ? parseFloat(paidRow.amount || 0) : 0;
      let status = 'Unpaid';
      if (amountPaid >= net - 0.01 && net > 0) status = 'Paid';
      else if (amountPaid > 0) status = 'Partially Paid';
      return {
        id: base.id,
        payeeType: base.payeeType,
        name: base.name,
        staffId: base.staffId,
        role: base.role,
        monthlySalary: base.monthlySalary,
        ssnitEnabled: base.ssnitEnabled,
        grossSalary: gross,
        ssnitPercent: pct,
        ssnitAmount,
        otherDeductions: otherD,
        allowances: allow,
        netSalary: net,
        amountPaid,
        paidDate: paidRow?.paid_date,
        paymentMethod: paidRow?.payment_method,
        payrollNotes: paidRow?.payroll_notes || '',
        paymentNotes: paidRow?.notes || '',
        expenseId: paidRow?.expense_id || null,
        status,
      };
    };

    const payroll = [
      ...teachersRes.rows.map((t: any) =>
        buildRow({
          id: t.id,
          payeeType: 'teacher',
          name: t.full_name,
          staffId: t.staff_id,
          role: t.class_name || 'Teacher',
          monthlySalary: parseFloat(t.monthly_salary || 0),
          ssnitEnabled: t.ssnit_enabled !== false,
        })
      ),
      ...otherStaffRes.rows.map((s: any) =>
        buildRow({
          id: s.id,
          payeeType: 'staff',
          name: s.full_name,
          staffId: s.staff_id || null,
          role: s.role || 'Staff',
          monthlySalary: parseFloat(s.monthly_salary || 0),
          ssnitEnabled: s.ssnit_enabled !== false,
        })
      ),
    ];

    const totalGross = roundMoney(payroll.reduce((sum, p) => sum + p.grossSalary, 0));
    const totalSsnit = roundMoney(payroll.reduce((sum, p) => sum + p.ssnitAmount, 0));
    const totalNetScheduled = roundMoney(payroll.reduce((sum, p) => sum + p.netSalary, 0));
    const paidRows = payroll.filter((p) => p.status === 'Paid');
    const partialRows = payroll.filter((p) => p.status === 'Partially Paid');
    const totalNetPaid = roundMoney(
      paidRows.reduce((s, p) => s + p.netSalary, 0) + partialRows.reduce((s, p) => s + p.amountPaid, 0)
    );
    const unpaidCount = payroll.filter((p) => p.status === 'Unpaid').length;
    const paidCount = payroll.filter((p) => p.status === 'Paid').length;

    res.json({
      month: m,
      year: y,
      currency,
      settings: {
        defaultSsnitPercent: ssnitPct,
        autoGeneratePayroll: Boolean(settings.auto_generate_payroll),
        payrollGenerationDay: parseInt(String(settings.payroll_generation_day ?? 1), 10),
      },
      payroll,
      summary: {
        totalStaff: payroll.length,
        totalGross,
        totalSsnit,
        totalNetScheduled,
        totalNetPaid,
        paidCount,
        unpaidCount,
        partialCount: payroll.filter((p) => p.status === 'Partially Paid').length,
      },
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

router.patch('/staff/:payeeType/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { payeeType, id } = req.params;
    const pid = parseInt(id, 10);
    const { ssnit_enabled } = req.body;
    if (!Number.isFinite(pid)) return res.status(400).json({ error: 'Invalid id' });
    if (payeeType === 'teacher') {
      if (ssnit_enabled === undefined) return res.status(400).json({ error: 'ssnit_enabled required' });
      const result = await query(
        `UPDATE teachers SET ssnit_enabled = $1, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $2 AND id = $3 RETURNING id, full_name, staff_id, monthly_salary, ssnit_enabled`,
        [Boolean(ssnit_enabled), tenantId, pid]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
      await refreshOpenPayrollRowsForSsnitFlag(
        tenantId,
        'teacher',
        pid,
        parseFloat(String(result.rows[0].monthly_salary || 0)),
        Boolean(ssnit_enabled)
      );
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'PAYROLL_STAFF_SSNIT_UPDATE',
        entityType: 'TEACHER',
        entityId: pid,
        module: 'finance',
        status: 'success',
        summary: `SSNIT flag updated for teacher ${result.rows[0].full_name}`,
        details: { payeeType: 'teacher', payee_id: pid, ssnit_enabled: Boolean(ssnit_enabled) },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') ?? null,
      });
      emitTenantDataChanged(tenantId, 'teacher', 'updated');
      return res.json(result.rows[0]);
    }
    if (payeeType === 'staff') {
      if (ssnit_enabled === undefined) return res.status(400).json({ error: 'ssnit_enabled required' });
      const result = await query(
        `UPDATE payroll_other_staff SET ssnit_enabled = $1, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $2 AND id = $3 RETURNING *`,
        [Boolean(ssnit_enabled), tenantId, pid]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
      const st = result.rows[0] as Record<string, unknown>;
      await refreshOpenPayrollRowsForSsnitFlag(
        tenantId,
        'staff',
        pid,
        parseFloat(String(st.monthly_salary || 0)),
        Boolean(ssnit_enabled)
      );
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'PAYROLL_STAFF_SSNIT_UPDATE',
        entityType: 'PAYROLL_OTHER_STAFF',
        entityId: pid,
        module: 'finance',
        status: 'success',
        summary: `SSNIT flag updated for staff ${String(st.full_name ?? pid)}`,
        details: { payeeType: 'staff', payee_id: pid, ssnit_enabled: Boolean(ssnit_enabled) },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') ?? null,
      });
      emitTenantDataChanged(tenantId, 'payroll-staff', 'updated');
      return res.json(result.rows[0]);
    }
    return res.status(400).json({ error: 'payeeType must be teacher or staff' });
  } catch (error) {
    console.error('Patch payroll staff error:', error);
    res.status(500).json({ error: 'Failed to update staff SSNIT flag' });
  }
});

router.patch('/line', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { payee_type, payee_id, month, year, other_deductions, allowances, payroll_notes, gross_salary } = req.body;
    if (!payee_type || !payee_id || !month || !year) {
      return res.status(400).json({ error: 'payee_type, payee_id, month, year are required' });
    }
    const pt = String(payee_type);
    const pid = parseInt(String(payee_id), 10);
    const m = parseInt(String(month), 10);
    const y = parseInt(String(year), 10);
    if (pt !== 'teacher' && pt !== 'staff') return res.status(400).json({ error: 'Invalid payee_type' });

    const existing = await query(
      `SELECT * FROM salary_payments WHERE tenant_id = $1 AND payee_type = $2 AND payee_id = $3 AND month = $4 AND year = $5`,
      [tenantId, pt, pid, m, y]
    );
    if (existing.rows[0]?.paid_date) {
      const net = parseFloat(existing.rows[0].net_salary || 0);
      const paid = parseFloat(existing.rows[0].amount || 0);
      if (paid >= net - 0.01 && net > 0) {
        return res.status(409).json({ error: 'Cannot edit a fully paid payroll line. Contact administrator if a correction is needed.' });
      }
    }

    let grossBase = 0;
    let ssnitEnabled = true;
    if (pt === 'teacher') {
      const tr = await query('SELECT monthly_salary, ssnit_enabled FROM teachers WHERE tenant_id = $1 AND id = $2', [tenantId, pid]);
      if (tr.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
      grossBase = parseFloat(tr.rows[0].monthly_salary || 0);
      ssnitEnabled = tr.rows[0].ssnit_enabled !== false;
    } else {
      const sr = await query('SELECT monthly_salary, ssnit_enabled FROM payroll_other_staff WHERE tenant_id = $1 AND id = $2', [tenantId, pid]);
      if (sr.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
      grossBase = parseFloat(sr.rows[0].monthly_salary || 0);
      ssnitEnabled = sr.rows[0].ssnit_enabled !== false;
    }

    const settings = await getPayrollSettingsRow(tenantId);
    const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
    const otherD = other_deductions !== undefined ? roundMoney(parseFloat(String(other_deductions)) || 0) : parseFloat(existing.rows[0]?.other_deductions || 0);
    const allow = allowances !== undefined ? roundMoney(parseFloat(String(allowances)) || 0) : parseFloat(existing.rows[0]?.allowances || 0);
    if (otherD < 0 || allow < 0) return res.status(400).json({ error: 'Deductions and allowances must be zero or positive' });
    const storedGross = existing.rows[0]?.gross_salary != null ? parseFloat(existing.rows[0].gross_salary) : grossBase;
    let effGross = storedGross || grossBase;
    if (gross_salary !== undefined && gross_salary !== null && gross_salary !== '') {
      const g = roundMoney(parseFloat(String(gross_salary)));
      if (!Number.isFinite(g) || g < 0) {
        return res.status(400).json({ error: 'Gross salary must be a non-negative number' });
      }
      if (g > 1_000_000_000) {
        return res.status(400).json({ error: 'Gross salary is unreasonably large' });
      }
      effGross = g;
    }
    const calc = computePayrollLine(effGross, ssnitEnabled, ssnitPct, otherD, allow);
    const notesVal = payroll_notes !== undefined ? (payroll_notes == null ? null : String(payroll_notes)) : existing.rows[0]?.payroll_notes ?? null;

    const amt = existing.rows[0] ? parseFloat(existing.rows[0].amount || 0) : 0;
    const pd = existing.rows[0]?.paid_date || null;
    const pm = existing.rows[0]?.payment_method || null;
    const nts = existing.rows[0]?.notes || null;

    const updLine = await query(
      `UPDATE salary_payments SET
        other_deductions = $1,
        allowances = $2,
        payroll_notes = $3,
        gross_salary = $4,
        ssnit_percent = $5,
        ssnit_amount = $6,
        net_salary = $7,
        gross_manual = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT sp.id FROM salary_payments sp
        WHERE sp.tenant_id = $8 AND sp.payee_type = $9 AND sp.payee_id = $10 AND sp.month = $11 AND sp.year = $12
        ORDER BY sp.id DESC
        LIMIT 1
      )
      RETURNING *`,
      [otherD, allow, notesVal, effGross, ssnitPct, calc.ssnitAmount, calc.net, tenantId, pt, pid, m, y]
    );

    const result =
      updLine.rowCount && updLine.rowCount > 0
        ? updLine
        : await query(
            `INSERT INTO salary_payments (
              tenant_id, payee_type, payee_id, month, year, amount, paid_date, payment_method, notes,
              gross_salary, ssnit_percent, ssnit_amount, other_deductions, allowances, net_salary, payroll_notes, gross_manual, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,CURRENT_TIMESTAMP)
            RETURNING *`,
            [tenantId, pt, pid, m, y, amt, pd, pm, nts, effGross, ssnitPct, calc.ssnitAmount, otherD, allow, calc.net, notesVal]
          );

    const prevLine = existing.rows[0] ? (existing.rows[0] as Record<string, unknown>) : null;
    const newLine = result.rows[0] as Record<string, unknown>;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: prevLine ? 'PAYROLL_LINE_UPDATE' : 'PAYROLL_LINE_CREATE',
      entityType: 'SALARY_PAYMENT',
      entityId: Number(newLine.id),
      module: 'finance',
      status: 'success',
      summary: `Payroll line ${prevLine ? 'updated' : 'created'} — ${pt} #${pid} (${m}/${y})`,
      details: {
        salary_payment_id: newLine.id,
        payee_type: pt,
        payee_id: pid,
        month: m,
        year: y,
        previous: prevLine,
        new: newLine,
        amount_affected: newLine.net_salary,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'salary-payment', 'updated', { month: m, year: y });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Patch payroll line error:', error);
    res.status(500).json({ error: 'Failed to save payroll line' });
  }
});

router.post('/prepare-month', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const m = parseInt(String(req.body.month), 10);
    const y = parseInt(String(req.body.year), 10);
    if (!m || !y) return res.status(400).json({ error: 'month and year required' });
    const settings = await getPayrollSettingsRow(tenantId);
    const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));

    const teachersRes = await query(
      `SELECT id, monthly_salary, ssnit_enabled FROM teachers t
       WHERE t.tenant_id = $1 AND (LOWER(COALESCE(t.employment_status, '')) = 'active' OR t.employment_status IS NULL OR t.employment_status = '')`,
      [tenantId]
    );
    const staffRes = await query(
      `SELECT id, monthly_salary, ssnit_enabled FROM payroll_other_staff
       WHERE tenant_id = $1 AND (employment_status = 'active' OR employment_status IS NULL)`,
      [tenantId]
    );

    let count = 0;
    for (const t of teachersRes.rows as any[]) {
      const gross = parseFloat(t.monthly_salary || 0);
      const se = t.ssnit_enabled !== false;
      const { ssnitAmount, net } = computePayrollLine(gross, se, ssnitPct, 0, 0);
      const ex = await query(
        `SELECT paid_date, amount, net_salary FROM salary_payments WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2 AND month = $3 AND year = $4`,
        [tenantId, t.id, m, y]
      );
      if (ex.rows[0]?.paid_date) {
        const netv = parseFloat(ex.rows[0].net_salary || net);
        const paid = parseFloat(ex.rows[0].amount || 0);
        if (paid >= netv - 0.01 && netv > 0) continue;
      }
      await query(
        `INSERT INTO salary_payments (
          tenant_id, payee_type, payee_id, month, year, amount, gross_salary, ssnit_percent, ssnit_amount, other_deductions, allowances, net_salary, updated_at
        ) VALUES ($1,'teacher',$2,$3,$4, COALESCE((SELECT amount FROM salary_payments WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2 AND month = $3 AND year = $4), 0),
          $5, $6, $7, 0, 0, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, payee_type, payee_id, month, year)
        DO UPDATE SET
          gross_salary = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.gross_salary WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.gross_salary ELSE salary_payments.gross_salary END,
          ssnit_percent = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.ssnit_percent WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.ssnit_percent ELSE salary_payments.ssnit_percent END,
          ssnit_amount = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.ssnit_amount WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.ssnit_amount ELSE salary_payments.ssnit_amount END,
          net_salary = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.net_salary WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.net_salary ELSE salary_payments.net_salary END,
          updated_at = CURRENT_TIMESTAMP`,
        [tenantId, t.id, m, y, gross, ssnitPct, ssnitAmount, net]
      );
      count++;
    }
    for (const s of staffRes.rows as any[]) {
      const gross = parseFloat(s.monthly_salary || 0);
      const se = s.ssnit_enabled !== false;
      const { ssnitAmount, net } = computePayrollLine(gross, se, ssnitPct, 0, 0);
      const ex = await query(
        `SELECT paid_date, amount, net_salary FROM salary_payments WHERE tenant_id = $1 AND payee_type = 'staff' AND payee_id = $2 AND month = $3 AND year = $4`,
        [tenantId, s.id, m, y]
      );
      if (ex.rows[0]?.paid_date) {
        const netv = parseFloat(ex.rows[0].net_salary || net);
        const paid = parseFloat(ex.rows[0].amount || 0);
        if (paid >= netv - 0.01 && netv > 0) continue;
      }
      await query(
        `INSERT INTO salary_payments (
          tenant_id, payee_type, payee_id, month, year, amount, gross_salary, ssnit_percent, ssnit_amount, other_deductions, allowances, net_salary, updated_at
        ) VALUES ($1,'staff',$2,$3,$4, COALESCE((SELECT amount FROM salary_payments WHERE tenant_id = $1 AND payee_type = 'staff' AND payee_id = $2 AND month = $3 AND year = $4), 0),
          $5, $6, $7, 0, 0, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, payee_type, payee_id, month, year)
        DO UPDATE SET
          gross_salary = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.gross_salary WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.gross_salary ELSE salary_payments.gross_salary END,
          ssnit_percent = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.ssnit_percent WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.ssnit_percent ELSE salary_payments.ssnit_percent END,
          ssnit_amount = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.ssnit_amount WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.ssnit_amount ELSE salary_payments.ssnit_amount END,
          net_salary = CASE WHEN COALESCE(salary_payments.gross_manual, false) THEN salary_payments.net_salary WHEN salary_payments.paid_date IS NULL OR salary_payments.amount < COALESCE(salary_payments.net_salary,0) - 0.01 THEN EXCLUDED.net_salary ELSE salary_payments.net_salary END,
          updated_at = CURRENT_TIMESTAMP`,
        [tenantId, s.id, m, y, gross, ssnitPct, ssnitAmount, net]
      );
      count++;
    }

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'PAYROLL_PREPARE_MONTH',
      entityType: 'PAYROLL_RUN',
      entityId: null,
      module: 'finance',
      status: 'success',
      summary: `Payroll prepared for ${m}/${y} (${count} staff rows touched)`,
      details: { month: m, year: y, rowsTouched: count },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'salary-payment', 'updated', { month: m, year: y });
    res.json({ ok: true, month: m, year: y, rowsTouched: count });
  } catch (error) {
    console.error('Prepare month error:', error);
    res.status(500).json({ error: 'Failed to prepare payroll month' });
  }
});

// Get other staff list
router.get('/other-staff', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      'SELECT * FROM payroll_other_staff WHERE tenant_id = $1 ORDER BY full_name',
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get other staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Add other staff (generates staff_id + 5-digit PIN, creates login user)
router.post('/other-staff', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { full_name, role, monthly_salary, employment_status, notes, ssnit_enabled } = req.body;
    if (!full_name || monthly_salary == null) {
      return res.status(400).json({ error: 'Full name and monthly salary are required' });
    }
    const existing = await query('SELECT staff_id FROM payroll_other_staff WHERE tenant_id = $1 AND staff_id LIKE $2', [tenantId, 'STAFF%']);
    let staffId = 'STAFF001';
    if (existing.rows.length > 0) {
      const maxId = Math.max(...existing.rows.map((r: any) => parseInt(String(r.staff_id).replace('STAFF', '')) || 0));
      staffId = `STAFF${(maxId + 1).toString().padStart(3, '0')}`;
    }
    const result = await query(
      `INSERT INTO payroll_other_staff (tenant_id, full_name, role, monthly_salary, employment_status, notes, staff_id, ssnit_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        tenantId,
        full_name,
        role || null,
        parseFloat(monthly_salary),
        employment_status || 'active',
        notes || null,
        staffId,
        ssnit_enabled === false ? false : true,
      ]
    );
    const staffRow = result.rows[0];
    const loginPin = generatePin();
    const passwordHash = await bcrypt.hash(loginPin, 10);
    await query(
      `INSERT INTO users (tenant_id, username, password_hash, role, other_staff_id) VALUES ($1, $2, $3, 'staff', $4)`,
      [tenantId, staffId, passwordHash, staffRow.id]
    );
    res.status(201).json({
      ...staffRow,
      loginStaffId: staffId,
      loginPin,
      loginMessage: `Staff can login with Staff ID: ${staffId} and PIN: ${loginPin}`,
    });
    emitTenantDataChanged(tenantId, 'payroll-staff', 'created');
  } catch (error) {
    console.error('Add other staff error:', error);
    res.status(500).json({ error: 'Failed to add staff' });
  }
});

// Update other staff
router.put('/other-staff/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { full_name, role, monthly_salary, employment_status, notes, ssnit_enabled } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (full_name !== undefined) {
      updates.push(`full_name = $${p++}`);
      values.push(full_name);
    }
    if (role !== undefined) {
      updates.push(`role = $${p++}`);
      values.push(role);
    }
    if (monthly_salary !== undefined) {
      updates.push(`monthly_salary = $${p++}`);
      values.push(parseFloat(monthly_salary));
    }
    if (employment_status !== undefined) {
      updates.push(`employment_status = $${p++}`);
      values.push(employment_status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${p++}`);
      values.push(notes);
    }
    if (ssnit_enabled !== undefined) {
      updates.push(`ssnit_enabled = $${p++}`);
      values.push(Boolean(ssnit_enabled));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    const result = await query(
      `UPDATE payroll_other_staff SET ${updates.join(', ')} WHERE tenant_id = $${p} AND id = $${p + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    emitTenantDataChanged(tenantId, 'payroll-staff', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update other staff error:', error);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

// Record salary payment (creates expense, links expense_id, prevents duplicate full pay)
router.post('/pay', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  const client = await getClient();
  const tenantId = req.user!.tenantId!;
  try {
    const { payee_type, payee_id, month, year, paid_date, payment_method, notes, amount: amountOverride } = req.body;
    if (!payee_type || !payee_id || !month || !year) {
      return res.status(400).json({ error: 'Payee type, payee ID, month, and year are required' });
    }
    const pt = String(payee_type);
    const pid = parseInt(String(payee_id), 10);
    const m = parseInt(String(month), 10);
    const y = parseInt(String(year), 10);
    if (pt !== 'teacher' && pt !== 'staff') {
      return res.status(400).json({ error: 'Invalid payee type' });
    }

    await ensurePayrollSettings(tenantId);
    const settingsRes = await client.query('SELECT * FROM payroll_settings WHERE tenant_id = $1', [tenantId]);
    const settings = settingsRes.rows[0] || {};
    const ssnitPct = parseFloat(String(settings.default_ssnit_percent ?? 5.5));
    const currency = String(settings.currency || 'GHS');

    let payeeName = '';
    let staffRef: string | null = null;
    let grossBase = 0;
    let ssnitEnabled = true;
    if (pt === 'teacher') {
      const tr = await client.query(
        `SELECT full_name, monthly_salary, ssnit_enabled, staff_id FROM teachers WHERE tenant_id = $1 AND id = $2`,
        [tenantId, pid]
      );
      if (tr.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      payeeName = tr.rows[0].full_name;
      staffRef = tr.rows[0].staff_id != null ? String(tr.rows[0].staff_id) : null;
      grossBase = parseFloat(tr.rows[0].monthly_salary || 0);
      ssnitEnabled = tr.rows[0].ssnit_enabled !== false;
    } else {
      const sr = await client.query(
        `SELECT full_name, monthly_salary, ssnit_enabled, staff_id FROM payroll_other_staff WHERE tenant_id = $1 AND id = $2`,
        [tenantId, pid]
      );
      if (sr.rows.length === 0) {
        return res.status(404).json({ error: 'Staff not found' });
      }
      payeeName = sr.rows[0].full_name;
      staffRef = sr.rows[0].staff_id != null ? String(sr.rows[0].staff_id) : null;
      grossBase = parseFloat(sr.rows[0].monthly_salary || 0);
      ssnitEnabled = sr.rows[0].ssnit_enabled !== false;
    }

    const lineRes = await client.query(
      `SELECT * FROM salary_payments WHERE tenant_id = $1 AND payee_type = $2 AND payee_id = $3 AND month = $4 AND year = $5`,
      [tenantId, pt, pid, m, y]
    );
    const lineRow = lineRes.rows[0];
    const otherD = lineRow ? parseFloat(lineRow.other_deductions || 0) : 0;
    const allow = lineRow ? parseFloat(lineRow.allowances || 0) : 0;
    const gross = lineRow?.gross_salary != null ? parseFloat(lineRow.gross_salary) : grossBase;
    const effGross = gross || grossBase;
    const pct = lineRow?.ssnit_percent != null ? parseFloat(lineRow.ssnit_percent) : ssnitPct;
    const calc = computePayrollLine(effGross, ssnitEnabled, pct, otherD, allow);
    const netPay = calc.net;

    const prevPaid = lineRow ? parseFloat(lineRow.amount || 0) : 0;
    if (lineRow?.paid_date && prevPaid >= netPay - 0.01 && netPay > 0) {
      return res.status(409).json({ error: 'Salary already recorded as fully paid for this month.' });
    }

    let payAmount = netPay;
    if (amountOverride != null && amountOverride !== '') {
      payAmount = roundMoney(parseFloat(String(amountOverride)));
      if (!Number.isFinite(payAmount) || payAmount <= 0) {
        return res.status(400).json({ error: 'Invalid payment amount' });
      }
      if (payAmount > netPay + 0.01) {
        return res.status(400).json({ error: `Amount cannot exceed net salary (${currency} ${netPay})` });
      }
    }

    if (prevPaid + payAmount > netPay + 0.01) {
      return res.status(400).json({ error: 'Total payments would exceed net salary for this month.' });
    }

    const period = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const expenseTitle = `Salary — ${payeeName} — ${period}`;
    const payDate = paid_date || new Date().toISOString().slice(0, 10);

    await client.query('BEGIN');

    const expenseIns = await client.query(
      `INSERT INTO expenses (tenant_id, title, category, amount, payee_name, payment_date, payment_method, purpose, notes, description, vendor, term, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        tenantId,
        expenseTitle,
        'Payroll',
        payAmount,
        payeeName,
        payDate,
        payment_method || null,
        'Staff salary payment',
        notes ? `${notes} | salary_payment:${pt}:${pid}:${m}:${y}` : `salary_payment:${pt}:${pid}:${m}:${y}`,
        `Net salary for ${period} (${currency})`,
        null,
        null,
        null,
      ]
    );
    const expenseId = expenseIns.rows[0].id;

    // UPDATE-first avoids relying on a unique index for ON CONFLICT (index creation can fail if duplicates existed).
    const upd = await client.query(
      `UPDATE salary_payments SET
        amount = salary_payments.amount + $1,
        paid_date = $2,
        payment_method = $3,
        notes = COALESCE($4, salary_payments.notes),
        gross_salary = $5,
        ssnit_percent = $6,
        ssnit_amount = $7,
        other_deductions = $8,
        allowances = $9,
        net_salary = $10,
        expense_id = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT sp.id FROM salary_payments sp
        WHERE sp.tenant_id = $12 AND sp.payee_type = $13 AND sp.payee_id = $14 AND sp.month = $15 AND sp.year = $16
        ORDER BY sp.id DESC
        LIMIT 1
      )
      RETURNING *`,
      [
        payAmount,
        payDate,
        payment_method || null,
        notes || null,
        effGross,
        pct,
        calc.ssnitAmount,
        otherD,
        allow,
        netPay,
        expenseId,
        tenantId,
        pt,
        pid,
        m,
        y,
      ]
    );
    const payRes =
      upd.rowCount && upd.rowCount > 0
        ? upd
        : await client.query(
            `INSERT INTO salary_payments (
              tenant_id, payee_type, payee_id, month, year, amount, paid_date, payment_method, notes,
              gross_salary, ssnit_percent, ssnit_amount, other_deductions, allowances, net_salary, expense_id, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP)
            RETURNING *`,
            [
              tenantId,
              pt,
              pid,
              m,
              y,
              payAmount,
              payDate,
              payment_method || null,
              notes || null,
              effGross,
              pct,
              calc.ssnitAmount,
              otherD,
              allow,
              netPay,
              expenseId,
            ]
          );

    await client.query('COMMIT');

    const payRow = payRes.rows[0];
    const staffSummary = staffRef || payeeName;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'SALARY_PAYMENT',
      entityType: 'SALARY_PAYMENT',
      entityId: payRow.id,
      module: 'finance',
      status: 'success',
      summary: `${currency} ${payAmount} salary paid to ${staffSummary}`,
      details: {
        transaction_id: payRow.id,
        expense_id: expenseId,
        payee_type: pt,
        payee_id: pid,
        payee_name: payeeName,
        staff_reference: staffRef,
        month: m,
        year: y,
        amount_paid: payAmount,
        previous_paid_total: prevPaid,
        new_paid_total: roundMoney(prevPaid + payAmount),
        net_salary: netPay,
        gross_salary: effGross,
        payment_method: payment_method || null,
        paid_date: payDate,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    const parsedAmount = payAmount;
    const amountLabel = Number.isFinite(parsedAmount)
      ? `${currency} ${parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;
    const salaryTitle = 'Salary paid';
    const salaryBody = amountLabel
      ? `Your salary for ${period} has been recorded: ${amountLabel}.`
      : `Your salary for ${period} has been recorded.`;

    try {
      emitTenantDataChanged(tenantId, 'salary-payment', 'created', {
        payee_type: String(payee_type),
        payee_id: Number(payee_id),
        month: m,
        year: y,
        amount: parsedAmount,
        title: salaryTitle,
        body: salaryBody,
      });
      emitTenantDataChanged(tenantId, 'expense', 'created');

      const normalizedPayeeType = String(payee_type);
      const normalizedPayeeId = Number(payee_id);
      if (Number.isFinite(normalizedPayeeId)) {
        const userRes = await query(
          normalizedPayeeType === 'teacher'
            ? `SELECT id FROM users
               WHERE tenant_id = $1 AND role = 'teacher' AND teacher_id = $2 AND is_active = true
               ORDER BY id ASC LIMIT 1`
            : `SELECT id FROM users
               WHERE tenant_id = $1 AND role = 'staff' AND other_staff_id = $2 AND is_active = true
               ORDER BY id ASC LIMIT 1`,
          [tenantId, normalizedPayeeId]
        ).catch(() => ({ rows: [] as any[] }));
        const targetUserId = Number(userRes.rows[0]?.id);
        if (Number.isFinite(targetUserId)) {
          await sendPushToStaffUser(targetUserId, {
            title: salaryTitle,
            body: salaryBody,
            url: `/school/${tenantId}`,
          }).catch(() => {});
        }
      }
    } catch (postErr) {
      console.error('Post-commit payroll notify error:', postErr);
    }

    res.status(201).json(payRes.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Record salary payment error:', error?.message || error, error?.code, error?.detail);
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Duplicate or conflicting salary record' });
    }
    const hint =
      typeof error?.message === 'string' && error.message.includes('unique or exclusion constraint')
        ? 'Database is missing the payroll period index; restart the API after migrations, or contact support.'
        : undefined;
    res.status(500).json({
      error: 'Failed to record payment',
      ...(hint ? { hint } : {}),
      ...(process.env.NODE_ENV !== 'production' && error?.message ? { detail: String(error.message) } : {}),
    });
  } finally {
    client.release();
  }
});

export default router;
