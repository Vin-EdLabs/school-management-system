import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { calculateFeeBalance } from '../services/financeCalculationService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** Resolve term string for matching fee_structures and payments */
function resolveTermForMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (academicYear) {
    const y = String(academicYear).trim();
    return `${t} ${y}`;
  }
  return t;
}

/** Compute total fees and total paid for a student, return balance (all backend, dynamic) */
async function getStudentFeeBalance(
  client: any,
  tenantId: number,
  studentId: number,
  term: string | null,
  academicYear: string | null
) {
  const studentRes = await client.query(
    'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;
  const classId = studentRes.rows[0].class_assigned_id;
  if (!classId) return calculateFeeBalance(0, 0);

  const termMatch = resolveTermForMatch(term, academicYear) || term;
  if (!termMatch) return calculateFeeBalance(0, 0);

  const feeRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND (term = $3 OR term LIKE $4)`,
    [tenantId, classId, termMatch, `${termMatch}%`]
  );
  const totalFees = parseFloat(feeRes.rows[0]?.total || '0');

  const paidRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments
     WHERE tenant_id = $1 AND student_id = $2 AND (term = $3 OR term LIKE $4)`,
    [tenantId, studentId, termMatch, `${termMatch}%`]
  );
  const totalPaid = parseFloat(paidRes.rows[0]?.total || '0');

  // Fetch arrears from term_arrears
  const arrearsRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM term_arrears
     WHERE tenant_id = $1 AND student_id = $2 AND (current_term = $3 OR current_term = $4)`,
    [tenantId, studentId, termMatch, term]
  );
  const arrears = parseFloat(arrearsRes.rows[0]?.total || '0');

  return calculateFeeBalance(totalFees, totalPaid, arrears);
}

/** Generate receipt number: R + 8 digits (e.g. R00012345), unique per school */
async function generateReceiptNumber(tenantId: number, receiptPrefix?: string): Promise<string> {
  const client = await getClient();
  try {
    const prefix = receiptPrefix || 'R';
    const res = await client.query(
      `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id) DO UPDATE SET
         last_number = receipt_number_seq.last_number + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING last_number`,
      [tenantId]
    );
    const lastNum = res.rows.length > 0 ? parseInt(String(res.rows[0].last_number), 10) : 1;
    return `${prefix}${String(lastNum).padStart(8, '0')}`;
  } finally {
    client.release();
  }
}

// Get all payments
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId, term, startDate, endDate } = req.query;

    let queryText = `
      SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date, p.payment_method,
             p.term, p.notes, p.receipt_number, p.created_at, p.updated_at,
             s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (studentId) {
      queryText += ' AND p.student_id = $2';
      params.push(studentId);
      if (term) {
        queryText += ' AND (p.term = $3 OR p.term LIKE $4)';
        params.push(term, `${term}%`);
      }
    } else if (term) {
      queryText += ' AND (p.term = $2 OR p.term LIKE $3)';
      params.push(term, `${term}%`);
    }

    if (startDate && endDate) {
      const paramIndex = params.length + 1;
      queryText += ` AND p.payment_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
    }

    queryText += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get single payment
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      `SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date, p.payment_method,
              p.term, p.notes, p.receipt_number, p.created_at, p.updated_at,
              s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
       FROM payments p
       LEFT JOIN students s ON p.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Create payment - adds to payments table; totals are computed dynamically on next fetch
// Never overwrite or delete payments.
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, amount, payment_date, payment_method, term, notes, academic_year } = req.body;

    if (!student_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Student ID, amount, and payment date are required' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number' });
    }

    const studentRes = await query(
      'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const settingsRes = await query(
      'SELECT receipt_prefix FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const receiptPrefix = settingsRes.rows[0]?.receipt_prefix || 'R';

    const receiptNumber = await generateReceiptNumber(tenantId, receiptPrefix);

    const termToStore = academic_year ? `${term || ''} ${academic_year}`.trim() : (term || null);

    const insertResult = await query(
      `INSERT INTO payments (tenant_id, student_id, amount, payment_date, payment_method, term, notes, receipt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        tenantId,
        student_id,
        paymentAmount,
        payment_date,
        payment_method || null,
        termToStore || term || null,
        notes || null,
        receiptNumber,
      ]
    );
    const payment = insertResult.rows[0];

    const client = await getClient();
    let balance = null;
    try {
      balance = await getStudentFeeBalance(
        client,
        tenantId,
        parseInt(student_id, 10),
        term || null,
        academic_year || null
      );
    } finally {
      client.release();
    }

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'PAYMENT', payment.id]
    );

    res.status(201).json({
      payment,
      balance: balance || undefined,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

export default router;
