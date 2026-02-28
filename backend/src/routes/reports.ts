import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { resolveLedgerTermFromSettings } from '../services/ledgerFinanceService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/**
 * Resolve term string for matching fee_structures and payments.
 * fee_structures.term and payments.term may be "Term 1" or "Term 1 2024".
 * Avoid double-appending year if term already ends with it.
 */
function resolveTermMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (!academicYear) return t;
  const y = String(academicYear).trim();
  if (!y || t.endsWith(y)) return t;
  return `${t} ${y}`;
}

/**
 * GET /api/reports/fee-status
 * Fee Status / Class Report: all students in a class for an academic period.
 * Prefers ledger (student_ledger) when current term resolves to a ledger term; otherwise uses fee_structures/payments.
 *
 * Query params:
 *   classId (required) - class id
 *   academicPeriodId - optional; if not provided, current period from school_settings is used
 *   term - optional; used with academicYear when academicPeriodId not used
 *   academicYear - optional
 *   status - 'all' | 'owing' | 'paid' (default: all)
 *
 * Response: { academicPeriod, class: { id, name }, students: [...], summary: { totalExpected, totalPaid, totalBalance } }
 */
router.get('/fee-status', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, academicPeriodId, term: queryTerm, academicYear: queryYear, status = 'all' } = req.query;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    let term: string;
    let academicYear: string;

    if (academicPeriodId) {
      const periodResult = await query(
        'SELECT term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2',
        [academicPeriodId, tenantId]
      );
      if (periodResult.rows.length === 0) {
        return res.status(404).json({ error: 'Academic period not found' });
      }
      term = periodResult.rows[0].term_name;
      academicYear = periodResult.rows[0].year;
    } else {
      const settingsResult = await query(
        'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      if (settingsResult.rows.length === 0) {
        return res.status(400).json({ error: 'School settings not found. Set current term and year.' });
      }
      term = (queryTerm as string) || settingsResult.rows[0].current_term || '';
      academicYear = (queryYear as string) || settingsResult.rows[0].current_year || '';
    }

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Academic period could not be resolved. Set current term and year in settings.' });
    }

    const ledgerTerm = await resolveLedgerTermFromSettings(tenantId, academicYear, term);
    if (ledgerTerm) {
      const ledgerReport = await query(
        `WITH per_student_this_term AS (
          SELECT student_id,
            COALESCE(SUM(CASE WHEN entry_type = 'term_fee' THEN debit ELSE 0 END), 0)::numeric AS term_fee,
            COALESCE(SUM(CASE WHEN entry_type = 'arrears' THEN debit ELSE 0 END), 0)::numeric AS arrears
          FROM student_ledger WHERE tenant_id = $1 AND term_id = $2 GROUP BY student_id
        ),
        per_student_cumulative AS (
          SELECT student_id,
            COALESCE(SUM(credit), 0)::numeric AS total_paid,
            (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))::numeric AS balance
          FROM student_ledger WHERE tenant_id = $1 GROUP BY student_id
        ),
        students_in_class AS (
          SELECT s.id, s.student_id AS "studentNumber", s.first_name, s.last_name, c.id AS "classId", c.class_name
          FROM students s
          LEFT JOIN classes c ON s.class_assigned_id = c.id
          WHERE s.tenant_id = $1 AND s.class_assigned_id = $3
        )
        SELECT
          sc.id AS "studentId",
          sc."studentNumber",
          sc.first_name AS "firstName",
          sc.last_name AS "lastName",
          sc."classId",
          sc.class_name AS "className",
          COALESCE(pst.term_fee, 0)::numeric AS "termFee",
          COALESCE(pst.arrears, 0)::numeric AS "arrears",
          (COALESCE(pst.term_fee, 0) + COALESCE(pst.arrears, 0))::numeric AS "totalFeeExpected",
          COALESCE(psc.total_paid, 0)::numeric AS "totalPaid",
          COALESCE(psc.balance, 0)::numeric AS "balance"
        FROM students_in_class sc
        LEFT JOIN per_student_this_term pst ON pst.student_id = sc.id
        LEFT JOIN per_student_cumulative psc ON psc.student_id = sc.id
        ORDER BY sc.first_name, sc.last_name`,
        [tenantId, ledgerTerm.termId, classId]
      );
      let rows = ledgerReport.rows;
      const statusFilter = (status as string).toLowerCase();
      if (statusFilter === 'owing') rows = rows.filter((r: any) => Number(r.balance) > 0);
      else if (statusFilter === 'paid') rows = rows.filter((r: any) => Number(r.balance) <= 0);

      const students = rows.map((r: any) => ({
        studentId: r.studentId,
        studentNumber: r.studentNumber,
        studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        className: r.className || '',
        termFee: parseFloat(r.termFee) || 0,
        arrears: parseFloat(r.arrears) || 0,
        totalFeeExpected: parseFloat(r.totalFeeExpected) || 0,
        totalPaid: parseFloat(r.totalPaid) || 0,
        balance: parseFloat(r.balance) || 0,
        status: Number(r.balance) > 0 ? 'owing' : Number(r.balance) < 0 ? 'credit' : 'paid',
      }));

      const totalExpected = students.reduce((sum: number, s: any) => sum + s.totalFeeExpected, 0);
      const totalPaid = students.reduce((sum: number, s: any) => sum + s.totalPaid, 0);
      const totalBalance = students.reduce((sum: number, s: any) => sum + s.balance, 0);
      const totalArrears = students.reduce((sum: number, s: any) => sum + s.arrears, 0);

      const classResult = await query(
        'SELECT id, class_name FROM classes WHERE id = $1 AND tenant_id = $2',
        [classId, tenantId]
      );
      const classRow = classResult.rows[0];

      return res.json({
        academicPeriod: { term, academicYear, label: `${term} ${academicYear}`.trim() },
        class: { id: parseInt(String(classId), 10), name: classRow?.class_name || '' },
        students,
        summary: { totalExpected, totalPaid, totalBalance, totalArrears, count: students.length },
      });
    }

    const termMatch = resolveTermMatch(term, academicYear);
    const termLike = `${termMatch}%`;
    const termStr = String(term).trim();
    const termOnly = termStr.replace(/\s+\d{4}$/, '').trim() || termStr;

    const reportQuery = `
      WITH class_fee AS (
        SELECT COALESCE(SUM(amount), 0)::numeric AS total_fee
        FROM fee_structures
        WHERE tenant_id = $1 AND class_id = $2
          AND (term = $3 OR term LIKE $4 OR term = $5)
      ),
      student_totals AS (
        SELECT
          p.student_id,
          COALESCE(SUM(p.amount), 0)::numeric AS total_paid
        FROM payments p
        WHERE p.tenant_id = $1 AND (p.term = $3 OR p.term LIKE $4 OR p.term = $5)
        GROUP BY p.student_id
      )
      SELECT
        s.id AS "studentId",
        s.student_id AS "studentNumber",
        s.first_name AS "firstName",
        s.last_name AS "lastName",
        c.id AS "classId",
        c.class_name AS "className",
        (SELECT total_fee FROM class_fee)::numeric AS "totalFeeExpected",
        COALESCE(st.total_paid, 0)::numeric AS "totalPaid",
        ((SELECT total_fee FROM class_fee) - COALESCE(st.total_paid, 0))::numeric AS "balance"
      FROM students s
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      LEFT JOIN student_totals st ON s.id = st.student_id
      WHERE s.tenant_id = $1 AND s.class_assigned_id = $2
      ORDER BY s.first_name, s.last_name
    `;

    const result = await query(reportQuery, [tenantId, classId, termMatch, termLike, termOnly]);
    let rows = result.rows;

    // Optional status filter (server-side)
    const statusFilter = (status as string).toLowerCase();
    if (statusFilter === 'owing') {
      rows = rows.filter((r: any) => Number(r.balance) > 0);
    } else if (statusFilter === 'paid') {
      rows = rows.filter((r: any) => Number(r.balance) <= 0);
    }

    const students = rows.map((r: any) => ({
      studentId: r.studentId,
      studentNumber: r.studentNumber,
      studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      className: r.className || '',
      totalFeeExpected: parseFloat(r.totalFeeExpected) || 0,
      totalPaid: parseFloat(r.totalPaid) || 0,
      balance: parseFloat(r.balance) || 0,
      status: Number(r.balance) > 0 ? 'owing' : Number(r.balance) < 0 ? 'credit' : 'paid',
    }));

    const totalExpected = students.reduce((sum: number, s: any) => sum + s.totalFeeExpected, 0);
    const totalPaid = students.reduce((sum: number, s: any) => sum + s.totalPaid, 0);
    const totalBalance = students.reduce((sum: number, s: any) => sum + s.balance, 0);

    const classResult = await query(
      'SELECT id, class_name FROM classes WHERE id = $1 AND tenant_id = $2',
      [classId, tenantId]
    );
    const classRow = classResult.rows[0];

    res.json({
      academicPeriod: {
        term,
        academicYear,
        label: `${term} ${academicYear}`.trim(),
      },
      class: {
        id: parseInt(String(classId), 10),
        name: classRow?.class_name || '',
      },
      students,
      summary: {
        totalExpected,
        totalPaid,
        totalBalance,
        count: students.length,
      },
    });
  } catch (error) {
    console.error('Fee status report error:', error);
    res.status(500).json({ error: 'Failed to generate fee status report' });
  }
});

export default router;
