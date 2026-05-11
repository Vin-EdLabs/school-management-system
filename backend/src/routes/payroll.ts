import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { sendPushToStaffUser } from '../services/webPushService.js';

function generatePin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
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

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Get current user's salary (teacher or staff) - for profile
router.get('/my-salary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (role === 'teacher' && teacherId) {
      const teacherRes = await query(
        'SELECT id, full_name, staff_id, monthly_salary FROM teachers WHERE id = $1 AND tenant_id = $2',
        [teacherId, tenantId]
      );
      if (teacherRes.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
      const t = teacherRes.rows[0];
      const paymentsRes = await query(
        `SELECT month, year, amount, paid_date, payment_method FROM salary_payments
         WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2 ORDER BY year DESC, month DESC`,
        [tenantId, teacherId]
      );
      const monthlySalary = parseFloat(t.monthly_salary || 0);
      const payments = paymentsRes.rows.map((p: any) => ({
        month: p.month,
        year: p.year,
        amount: parseFloat(p.amount),
        paidDate: p.paid_date,
        paymentMethod: p.payment_method,
        status: parseFloat(p.amount) >= monthlySalary ? 'Paid' : 'Partially Paid',
      }));
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const thisMonth = payments.find((p: any) => p.month === currentMonth && p.year === currentYear);
      return res.json({
        fullName: t.full_name,
        staffId: t.staff_id,
        monthlySalary,
        currentMonthStatus: thisMonth ? thisMonth.status : 'Unpaid',
        paymentHistory: payments,
      });
    }
    // Staff (other_staff_id) - would need to add to auth
    return res.status(403).json({ error: 'Only teachers can view salary here' });
  } catch (error) {
    console.error('Get my salary error:', error);
    res.status(500).json({ error: 'Failed to fetch salary' });
  }
});

// Get payroll overview for a month (teachers + other staff with paid/unpaid status)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const y = year ? parseInt(year as string) : new Date().getFullYear();

    // Teachers (from teachers table) - auto-included when added
    const teachersRes = await query(
      `SELECT t.id, t.full_name, t.staff_id, t.monthly_salary, t.employment_status, c.class_name
       FROM teachers t
       LEFT JOIN classes c ON t.class_assigned_id = c.id
       WHERE t.tenant_id = $1 AND (LOWER(COALESCE(t.employment_status, '')) = 'active' OR t.employment_status IS NULL OR t.employment_status = '')`,
      [tenantId]
    );

    // Other staff
    const otherStaffRes = await query(
      `SELECT id, full_name, role, monthly_salary, employment_status, staff_id
       FROM payroll_other_staff
       WHERE tenant_id = $1 AND (employment_status = 'active' OR employment_status IS NULL)`,
      [tenantId]
    );

    // Salary payments for this month
    const paymentsRes = await query(
      `SELECT payee_type, payee_id, amount, paid_date, payment_method
       FROM salary_payments
       WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      [tenantId, m, y]
    );

    const paymentMap: Record<string, { amount: number; paid_date: string; payment_method: string }> = {};
    paymentsRes.rows.forEach((p: any) => {
      paymentMap[`${p.payee_type}-${p.payee_id}`] = {
        amount: parseFloat(p.amount),
        paid_date: p.paid_date,
        payment_method: p.payment_method || '',
      };
    });

    const payroll = [
      ...teachersRes.rows.map((t: any) => {
        const key = `teacher-${t.id}`;
        const paid = paymentMap[key];
        return {
          id: t.id,
          payeeType: 'teacher',
          name: t.full_name,
          staffId: t.staff_id,
          role: t.class_name || 'Teacher',
          monthlySalary: parseFloat(t.monthly_salary || 0),
          amountPaid: paid ? paid.amount : 0,
          paidDate: paid?.paid_date,
          paymentMethod: paid?.payment_method,
          status: paid ? (paid.amount >= parseFloat(t.monthly_salary || 0) ? 'Paid' : 'Partially Paid') : 'Unpaid',
        };
      }),
      ...otherStaffRes.rows.map((s: any) => {
        const key = `staff-${s.id}`;
        const paid = paymentMap[key];
        return {
          id: s.id,
          payeeType: 'staff',
          name: s.full_name,
          staffId: s.staff_id || null,
          role: s.role || 'Staff',
          monthlySalary: parseFloat(s.monthly_salary || 0),
          amountPaid: paid ? paid.amount : 0,
          paidDate: paid?.paid_date,
          paymentMethod: paid?.payment_method,
          status: paid ? (paid.amount >= parseFloat(s.monthly_salary || 0) ? 'Paid' : 'Partially Paid') : 'Unpaid',
        };
      }),
    ];

    const totalSalary = payroll.reduce((sum, p) => sum + p.monthlySalary, 0);
    const totalPaid = payroll.reduce((sum, p) => sum + p.amountPaid, 0);
    const unpaidCount = payroll.filter(p => p.status === 'Unpaid').length;

    res.json({
      month: m,
      year: y,
      payroll,
      summary: { totalSalary, totalPaid, unpaidCount, paidCount: payroll.length - unpaidCount },
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ error: 'Failed to fetch payroll' });
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
    const { full_name, role, monthly_salary, employment_status, notes } = req.body;
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
      `INSERT INTO payroll_other_staff (tenant_id, full_name, role, monthly_salary, employment_status, notes, staff_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, full_name, role || null, parseFloat(monthly_salary), employment_status || 'active', notes || null, staffId]
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
    const { full_name, role, monthly_salary, employment_status, notes } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (full_name !== undefined) { updates.push(`full_name = $${p++}`); values.push(full_name); }
    if (role !== undefined) { updates.push(`role = $${p++}`); values.push(role); }
    if (monthly_salary !== undefined) { updates.push(`monthly_salary = $${p++}`); values.push(parseFloat(monthly_salary)); }
    if (employment_status !== undefined) { updates.push(`employment_status = $${p++}`); values.push(employment_status); }
    if (notes !== undefined) { updates.push(`notes = $${p++}`); values.push(notes); }
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

// Record salary payment
router.post('/pay', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { payee_type, payee_id, month, year, amount, paid_date, payment_method, notes } = req.body;
    if (!payee_type || !payee_id || !month || !year || !amount) {
      return res.status(400).json({ error: 'Payee type, payee ID, month, year, and amount are required' });
    }
    const result = await query(
      `INSERT INTO salary_payments (tenant_id, payee_type, payee_id, month, year, amount, paid_date, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id, payee_type, payee_id, month, year)
       DO UPDATE SET amount = $6, paid_date = $7, payment_method = $8, notes = $9
       RETURNING *`,
      [tenantId, payee_type, payee_id, parseInt(month), parseInt(year), parseFloat(amount), paid_date || null, payment_method || null, notes || null]
    );
    const parsedMonth = parseInt(month as string, 10);
    const parsedYear = parseInt(year as string, 10);
    const parsedAmount = parseFloat(amount as string);
    const period = new Date(parsedYear, parsedMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const amountLabel = Number.isFinite(parsedAmount)
      ? `GHS ${parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;
    const salaryTitle = 'Salary paid';
    const salaryBody = amountLabel
      ? `Your salary for ${period} has been recorded: ${amountLabel}.`
      : `Your salary for ${period} has been recorded.`;

    emitTenantDataChanged(tenantId, 'salary-payment', 'created', {
      payee_type: String(payee_type),
      payee_id: Number(payee_id),
      month: parsedMonth,
      year: parsedYear,
      amount: parsedAmount,
      title: salaryTitle,
      body: salaryBody,
    });

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
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Record salary payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
