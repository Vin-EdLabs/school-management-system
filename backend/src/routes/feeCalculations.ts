import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { calculateFeeBalance } from '../services/financeCalculationService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/**
 * GET /fee-calculations/arrears-balances
 * Returns { studentId: arrearsAmount } for the current active term.
 * Reads from the simple term_arrears table, matched by current_term string from school_settings.
 */
router.get('/arrears-balances', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    const settingsResult = await query(
      'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    if (
      settingsResult.rows.length === 0 ||
      !settingsResult.rows[0].current_term
    ) {
      return res.json({});
    }

    const { current_term, current_year } = settingsResult.rows[0];
    // Build both possible strings: "Term 2 2027" and "Term 2"
    const fullTerm = current_year
      ? `${current_term} ${current_year}`.trim()
      : current_term;

    const arrearsResult = await query(
      `SELECT student_id, COALESCE(SUM(amount), 0)::numeric AS arrears
       FROM term_arrears
       WHERE tenant_id = $1
         AND (current_term = $2 OR current_term = $3)
       GROUP BY student_id`,
      [tenantId, fullTerm, current_term]
    );

    const arrearsBalances: Record<string, number> = {};
    for (const row of arrearsResult.rows) {
      arrearsBalances[String(row.student_id)] = parseFloat(row.arrears) || 0;
    }
    return res.json(arrearsBalances);
  } catch (e) {
    console.error('arrears-balances error:', e);
    return res.json({});
  }
});

/** Resolve term string for matching fee_structures and payments */
function resolveTermForMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (academicYear) {
    const y = String(academicYear).trim();
    // Only append if the term string doesn't already contain the year
    if (!t.includes(y)) {
      return `${t} ${y}`;
    }
  }
  return t;
}

/**
 * Calculate student fee balance from DB (dynamic, never stored).
 * total_fees = SUM(fee_structures.amount) for class + term + academic_year
 * total_paid = SUM(payments.amount) for student + term
 * outstanding = total_fees - total_paid
 */
async function computeStudentBalance(
  tenantId: number,
  studentId: number,
  classId: number | null,
  term: string | null,
  academicYear: string | null
) {
  const termMatch = resolveTermForMatch(term, academicYear) || term;
  if (!termMatch || !classId) {
    return calculateFeeBalance(0, 0);
  }

  const feeRes = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND (term = $3 OR term LIKE $4)`,
    [tenantId, classId, termMatch, `${termMatch}%`]
  );
  const totalFees = parseFloat(feeRes.rows[0]?.total || '0');

  const paidRes = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payments
     WHERE tenant_id = $1 AND student_id = $2 AND (term = $3 OR term LIKE $4)`,
    [tenantId, studentId, termMatch, `${termMatch}%`]
  );
  const totalPaid = parseFloat(paidRes.rows[0]?.total || '0');

  // Fetch arrears from term_arrears (previously calculated by switchTerm service)
  const arrearsRes = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM term_arrears
     WHERE tenant_id = $1 AND student_id = $2 AND (current_term = $3 OR current_term = $4)`,
    [tenantId, studentId, termMatch, term]
  );
  const arrears = parseFloat(arrearsRes.rows[0]?.total || '0');

  return calculateFeeBalance(totalFees, totalPaid, arrears);
}

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
    const balance = await computeStudentBalance(
      tenantId,
      parseInt(studentId, 10),
      student.class_id,
      String(term),
      String(academicYear)
    );

    const paymentHistoryResult = await query(
      `SELECT * FROM payments
       WHERE tenant_id = $1 AND student_id = $2 AND (term = $3 OR term LIKE $4)
       ORDER BY payment_date DESC`,
      [tenantId, studentId, resolveTermForMatch(String(term), String(academicYear)) || term, `${term}%`]
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
        totalFees: balance.totalFees,
        totalPaid: balance.totalPaid,
        outstanding: balance.outstanding,
        arrears: balance.arrears,
        credit: balance.credit,
        status: balance.status,
        term,
        academicYear,
      },
      paymentHistory: paymentHistoryResult.rows,
    });
  } catch (error) {
    console.error('Calculate student fees error:', error);
    res.status(500).json({ error: 'Failed to calculate student fees' });
  }
});

// Get all students with fee balances (dynamic)
router.get('/students/balances', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { term, academicYear, classId } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Term and academic year are required' });
    }

    const termMatch = resolveTermForMatch(String(term), String(academicYear)) || term;

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
        const balance = await computeStudentBalance(
          tenantId,
          row.id,
          row.class_id,
          String(term),
          String(academicYear)
        );
        return {
          ...row,
          totalFees: balance.totalFees,
          totalPaid: balance.totalPaid,
          outstanding: balance.outstanding,
          arrears: balance.arrears,
          credit: balance.credit,
          status: balance.status,
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
 * Include: Student Name, Total Fees, Total Paid, Outstanding, Status
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
      const balance = await computeStudentBalance(
        tenantId,
        row.id,
        row.class_id,
        String(term),
        String(academicYear)
      );

      if (balance.outstanding > 0) {
        rows.push({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          studentName: `${row.first_name} ${row.last_name}`,
          studentId: row.student_id,
          admissionNumber: row.admission_number,
          className: row.class_name || '',
          totalFees: balance.totalFees,
          totalPaid: balance.totalPaid,
          outstanding: balance.outstanding,
          outstandingBalance: balance.outstanding,
          status: balance.status.toLowerCase() as 'owing' | 'cleared' | 'credit',
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

// Refresh arrears for all students based on global running balance
router.post('/refresh-arrears', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    // 1. Get current active term from settings
    const settingsResult = await query(
      'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].current_term) {
      return res.status(400).json({ error: 'Active term not set' });
    }
    const { current_term, current_year } = settingsResult.rows[0];
    const currentYearNum = parseInt(current_year, 10);
    const currentTermNum = parseInt(current_term.match(/Term\s*(\d)/i)?.[1] || '1', 10);

    // Standardize current term strings for exclusion
    const termOnly = current_term.replace(/\s+\d{4}$/, '').trim();
    const fullTerm = (current_year && !current_term.includes(current_year))
      ? `${current_term} ${current_year}`.trim()
      : current_term;

    // 2. Fetch all students to process
    const studentsRes = await query(
      `SELECT id FROM students WHERE tenant_id = $1`,
      [tenantId]
    );

    let updatedCount = 0;
    for (const studentRow of studentsRes.rows) {
      const studentId = studentRow.id;

      // A. Calculate Legacy Arrears (from fee_structures and payments)
      // Filter out current term (and variants) and any future terms.
      const legacyResult = await query(
        `SELECT term, COALESCE(amount, 0) as amount, 'fee' as type 
         FROM fee_structures fs
         JOIN students s ON s.id = $1
         WHERE fs.tenant_id = $2 AND fs.class_id = s.class_assigned_id
           AND fs.term NOT IN ($3, $4, $5)
         UNION ALL
         SELECT term, -COALESCE(amount, 0) as amount, 'payment' as type 
         FROM payments
         WHERE tenant_id = $2 AND student_id = $1
           AND term NOT IN ($3, $4, $5)`,
        [studentId, tenantId, fullTerm, current_term, termOnly]
      );

      let legacyArrears = 0;
      for (const row of legacyResult.rows) {
        const termStr = row.term || '';
        const match = termStr.match(/\b(20\d{2})\b/);
        const year = match ? parseInt(match[1], 10) : currentYearNum;
        const rowTermNum = parseInt(termStr.match(/Term\s*(\d)/i)?.[1] || '0', 10);

        // Include only if Year is older, OR if same year but Term Number is older
        if (year < currentYearNum || (year === currentYearNum && rowTermNum < currentTermNum)) {
          legacyArrears += parseFloat(row.amount);
        }
      }

      // B. Calculate Ledger Arrears (if any)
      // Exclude the current term by name and then filter by hierarchy (past terms only)
      const ledgerArrearsRes = await query(
        `SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))::numeric AS balance
         FROM student_ledger sl
         JOIN terms t ON sl.term_id = t.id
         JOIN academic_years ay ON t.academic_year_id = ay.id
         WHERE sl.tenant_id = $1 AND sl.student_id = $2
           AND t.id NOT IN (
             SELECT id FROM terms WHERE tenant_id = $1 AND (name = $3 OR name = $4 OR name = $5)
           )
           AND (
             CAST(ay.name AS INTEGER) < $6
             OR (CAST(ay.name AS INTEGER) = $6 AND (
                -- Compare term name numerically if possible
                CAST(substring(t.name from 'Term\s*(\d)') AS INTEGER) < $7
             ))
           )`,
        [tenantId, studentId, fullTerm, current_term, termOnly, currentYearNum, currentTermNum]
      );
      const ledgerArrears = parseFloat(ledgerArrearsRes.rows[0].balance) || 0;

      const totalArrears = legacyArrears + ledgerArrears;

      // Only insert if there's actual debt (or credit) to track
      if (totalArrears !== 0) {
        await query(
          `INSERT INTO term_arrears (tenant_id, student_id, current_term, amount)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, student_id, current_term) 
           DO UPDATE SET amount = EXCLUDED.amount`,
          [tenantId, studentId, fullTerm, totalArrears]
        );
        updatedCount++;
      } else {
        // If arrears is 0, make sure we don't have a stale record
        await query(
          `DELETE FROM term_arrears 
           WHERE tenant_id = $1 AND student_id = $2 AND current_term = $3`,
          [tenantId, studentId, fullTerm]
        );
      }
    }
    res.json({ message: 'Arrears refreshed successfully', studentsUpdated: updatedCount });
  } catch (error) {
    console.error('Refresh arrears error:', error);
    res.status(500).json({ error: 'Failed to refresh arrears' });
  }
});

// No-op: balances are computed dynamically; no stored arrears/credits to carry over.
router.post('/process-term-change', async (req: AuthRequest, res) => {
  res.json({ message: 'Term change noted. Balances are computed dynamically.', arrearsUpdated: 0, creditsUpdated: 0 });
});

// No-op: balances are computed dynamically per term/class; no carryover needed.
router.post('/process-class-promotion', async (req: AuthRequest, res) => {
  res.json({ message: 'Class promotion noted. Balances are computed dynamically per term.', outstandingCarriedOver: 0 });
});

export default router;
