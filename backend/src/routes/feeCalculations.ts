import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getStudentLiveFeeBreakdown,
  resolveActiveLedgerTerm,
  liveBreakdownToSummary,
} from '../services/studentLiveFeeBreakdownService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/**
 * GET /fee-calculations/students/balances?classId=
 * Batch ledger balances for fee-tracked students (Student Balances tab).
 */
router.get('/students/balances', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;

    let studentsQuery = `
      SELECT s.id FROM students s
      WHERE s.tenant_id = $1
        AND COALESCE(s.enrollment_status, 'active') = 'active'
    `;
    const params: unknown[] = [tenantId];
    if (classId) {
      studentsQuery += ` AND s.class_assigned_id = $2`;
      params.push(classId);
    }
    studentsQuery += ` ORDER BY s.first_name, s.last_name`;

    const studentsRes = await query(studentsQuery, params);

    const balances: Record<string, Awaited<ReturnType<typeof getStudentLiveFeeBreakdown>>> = {};
    await Promise.all(
      studentsRes.rows.map(async (row: { id: number }) => {
        const b = await getStudentLiveFeeBreakdown(null, tenantId, row.id);
        if (b) balances[String(row.id)] = b;
      })
    );

    const { termLabel } = await resolveActiveLedgerTerm(query, tenantId);
    res.json({ activeTermLabel: termLabel, balances });
  } catch (error) {
    console.error('Batch student balances error:', error);
    res.status(500).json({ error: 'Failed to load student balances' });
  }
});

/**
 * GET /fee-calculations/students/:studentId/balance
 * Single student ledger balance — source of truth for records, balance card, and fee breakdown UI.
 */
router.get('/students/:studentId/balance', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const breakdown = await getStudentLiveFeeBreakdown(null, tenantId, studentId);
    if (!breakdown) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(breakdown);
  } catch (error) {
    console.error('Student balance error:', error);
    res.status(500).json({ error: 'Failed to load student balance' });
  }
});

// Calculate student fees - all dynamic, no stored balances
router.get('/student/:studentId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId } = req.params;
    const { term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Term and academic year are required' });
    }

    const studentResult = await query(
      `SELECT s.*, c.id as class_id, c.class_name, c.level, c.stream
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult.rows[0];
    const breakdown = await getStudentLiveFeeBreakdown(null, tenantId, parseInt(studentId, 10));
    const emptySummary = {
      termFee: 0,
      totalPaid: 0,
      outstanding: 0,
      arrears: 0,
      credit: 0,
      status: 'Cleared' as const,
    };
    const summary = breakdown ? liveBreakdownToSummary(breakdown) : emptySummary;

    const paymentHistoryResult = await query(
      `SELECT * FROM payments
       WHERE tenant_id = $1 AND student_id = $2 AND COALESCE(is_voided, false) = false
       ORDER BY payment_date DESC`,
      [tenantId, studentId]
    );

    res.json({
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        admissionNumber: student.admission_number,
        className: student.class_name,
        level: student.level,
      },
      feeCalculation: {
        totalFees: summary.termFee ?? 0,
        standardFees: summary.termFee ?? 0,
        discountAmount: 0,
        totalPaid: summary.totalPaid,
        outstanding: summary.outstanding,
        arrears: summary.arrears,
        credit: summary.credit,
        status: summary.status,
        isBeneficiary: student.is_beneficiary,
        beneficiaryType: student.beneficiary_type,
        term,
        academicYear,
      },
      balance: breakdown,
      paymentHistory: paymentHistoryResult.rows,
    });
  } catch (error) {
    console.error('Calculate student fees error:', error);
    res.status(500).json({ error: 'Failed to calculate student fees' });
  }
});

// Get all students with fee balances (dynamic)
router.get('/students/balances-by-term', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { term, academicYear, classId } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Term and academic year are required' });
    }

    let queryText = `
      SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
             c.id as class_id, c.class_name, c.level, c.stream
      FROM students s
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE s.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (classId) {
      queryText += ' AND s.class_assigned_id = $2';
      params.push(classId);
    }
    queryText += ' ORDER BY s.first_name, s.last_name';

    const result = await query(queryText, params);

    const studentsWithBalances = await Promise.all(
      result.rows.map(async (row: any) => {
        const breakdown = await getStudentLiveFeeBreakdown(null, tenantId, row.id);
        const summary = breakdown ? liveBreakdownToSummary(breakdown) : null;
        return {
          ...row,
          totalFees: summary?.termFee ?? 0,
          totalPaid: summary?.totalPaid ?? 0,
          outstanding: summary?.outstanding ?? 0,
          arrears: summary?.arrears ?? 0,
          credit: summary?.credit ?? 0,
          status: summary?.status ?? 'Cleared',
        };
      })
    );

    res.json(studentsWithBalances);
  } catch (error) {
    console.error('Get student balances error:', error);
    res.status(500).json({ error: 'Failed to get student balances' });
  }
});

/**
 * Class outstanding report - backend only.
 * Fetch students in class, calculate outstanding for each, show only outstanding > 0.
 */
router.get('/class-report', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Term and academic year are required' });
    }

    let queryText = `
      SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
             c.id as class_id, c.class_name
      FROM students s
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE s.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (classId) {
      queryText += ' AND s.class_assigned_id = $2';
      params.push(classId);
    }
    queryText += ' ORDER BY s.first_name, s.last_name';

    const result = await query(queryText, params);

    const rows: Array<{
      id: number;
      firstName: string;
      lastName: string;
      studentName: string;
      studentId: string;
      admissionNumber: string;
      className: string;
      totalFees: number;
      totalPaid: number;
      outstanding: number;
      outstandingBalance: number;
      status: string;
    }> = [];

    for (const row of result.rows) {
      const breakdown = await getStudentLiveFeeBreakdown(null, tenantId, row.id);
      const outstanding = breakdown?.outstanding ?? 0;

      if (outstanding > 0) {
        rows.push({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          studentName: `${row.first_name} ${row.last_name}`,
          studentId: row.student_id,
          admissionNumber: row.admission_number,
          className: row.class_name || '',
          totalFees: breakdown?.currentTermFee ?? 0,
          totalPaid: breakdown?.totalPaid ?? 0,
          outstanding,
          outstandingBalance: outstanding,
          status: (breakdown?.status ?? 'Owing').toLowerCase() as 'owing' | 'cleared' | 'credit',
        });
      }
    }

    res.json({
      term,
      academicYear,
      classId: classId || null,
      students: rows,
      totalOutstanding: rows.reduce((sum, s) => sum + s.outstanding, 0),
    });
  } catch (error) {
    console.error('Class report error:', error);
    res.status(500).json({ error: 'Failed to generate class report' });
  }
});

router.post('/refresh-arrears', requireRole('super-admin', 'administrator'), async (_req: AuthRequest, res) => {
  res.json({
    message: 'Arrears are computed from the student ledger in real time.',
    deprecated: true,
  });
});

router.post('/process-term-change', async (_req: AuthRequest, res) => {
  res.json({ message: 'Term change noted. Balances are computed from the ledger.', arrearsUpdated: 0, creditsUpdated: 0 });
});

router.post('/process-class-promotion', async (_req: AuthRequest, res) => {
  res.json({ message: 'Class promotion noted. Balances are computed from the ledger.', outstandingCarriedOver: 0 });
});

export default router;
