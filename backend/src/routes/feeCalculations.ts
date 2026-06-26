import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';
import { syncMissingLedgerTermFeesForActiveTerm } from '../services/ledgerFinanceService.js';
import {
  getBatchStudentBalancesFromLedger,
  ledgerBalanceToApiShape,
  getStudentBalanceFromLedger,
  getArrearsBreakdownFromLedger,
} from '../services/ledgerBalanceService.js';
import { enrichBalanceShapeWithExpectedFees, assertStudentInTenant, resolveLedgerFeeStructureForStudent } from '../services/effectiveStudentBalanceService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /fee-calculations/students/balances?classId=
 * Batch ledger balances — single SQL query, student_ledger only.
 */
router.get('/students/balances', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;

    // Auto-bill students added outside the app (direct DB) before reading balances.
    try {
      await syncMissingLedgerTermFeesForActiveTerm(tenantId);
    } catch (syncErr) {
      console.error('[students/balances] Ledger fee sync failed (continuing):', syncErr);
    }

    const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(query, tenantId);
    if (!ledgerTermId) {
      return res.json({ activeTermLabel: termLabel, balances: {}, summary: {} });
    }

    const classIdNum =
      classId != null && String(classId).trim() !== '' ? parseInt(String(classId), 10) : null;

    const rows = await getBatchStudentBalancesFromLedger(
      null,
      tenantId,
      ledgerTermId,
      classIdNum != null && !Number.isNaN(classIdNum) ? classIdNum : null
    );

    const balances: Record<string, Awaited<ReturnType<typeof ledgerBalanceToApiShape>>> = {};

    for (const row of rows) {
      const rawShape = {
        currentTermFee: row.termFee,
        currentTermName: termLabel,
        activeTermId: ledgerTermId,
        arrearLines: row.arrears > 0 ? [{ termName: 'Arrears', amount: row.arrears }] : [],
        totalArrears: row.arrears,
        creditBroughtForward: row.creditBroughtForward,
        totalDue: row.totalDue,
        paidLines:
          row.amountPaidThisTerm > 0
            ? [{ termName: `${termLabel || 'Current term'} (this term)`, amount: row.amountPaidThisTerm }]
            : [],
        totalPaid: row.amountPaidThisTerm,
        outstanding: row.outstanding,
        credit: row.creditBalance,
        netBalance: row.netBalance,
        status:
          row.termFee <= 0 &&
          (row.individualCharges ?? 0) <= 0 &&
          row.amountPaidThisTerm <= 0 &&
          row.arrears <= 0 &&
          row.creditBroughtForward <= 0
            ? ('NotSet' as const)
            : row.netBalance < -0.001
              ? ('Credit' as const)
              : row.netBalance > 0.001
                ? ('Owing' as const)
                : ('Cleared' as const),
        paymentsMade: row.amountPaidThisTerm,
        totalCharged: row.totalDue,
        individualCharges: row.individualCharges ?? 0,
        individualChargeLines: [],
        termRows: [
          {
            termId: ledgerTermId,
            termName: termLabel || 'Current term',
            termFee: row.termFee,
            amountPaid: row.amountPaidThisTerm,
            outstanding: row.outstanding,
            displayOutstanding: row.outstanding,
            isActiveTerm: true,
          },
        ],
      };

      balances[String(row.id)] = await enrichBalanceShapeWithExpectedFees(
        null,
        tenantId,
        row.id,
        ledgerTermId,
        rawShape
      );
    }

    let studentsOwing = 0;
    let studentsCredit = 0;
    let studentsWithArrears = 0;
    let totalOutstanding = 0;
    let totalCredit = 0;
    let totalArrearsAmount = 0;

    for (const shape of Object.values(balances)) {
      if (!shape) continue;
      const outstanding = roundMoney(shape.outstanding ?? 0);
      const credit = roundMoney(shape.credit ?? 0);
      const arrears = roundMoney(shape.totalArrears ?? 0);
      const netBalance = shape.netBalance ?? 0;

      if (outstanding > 0) {
        studentsOwing++;
        totalOutstanding += outstanding;
      }
      if (netBalance < -0.001) {
        studentsCredit++;
        totalCredit += credit > 0 ? credit : roundMoney(Math.abs(netBalance));
      } else if (credit > 0) {
        studentsCredit++;
        totalCredit += credit;
      }
      if (arrears > 0) {
        studentsWithArrears++;
        totalArrearsAmount += arrears;
      }
    }

    res.json({
      activeTermLabel: termLabel,
      balances,
      summary: {
        studentsOwing,
        studentsCredit,
        studentsWithArrears,
        totalOutstanding: roundMoney(totalOutstanding),
        totalCredit: roundMoney(totalCredit),
        totalArrears: roundMoney(totalArrearsAmount),
        totalStudents: rows.length,
      },
    });
  } catch (error) {
    console.error('Batch student balances error:', error);
    res.status(500).json({ error: 'Failed to load student balances' });
  }
});

/**
 * GET /fee-calculations/students/:studentId/balance
 * Single student balance from student_ledger only.
 */
router.get('/students/:studentId/balance', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(query, tenantId);

    const exists = await assertStudentInTenant(null, tenantId, studentId);
    if (!exists) {
      return res.status(404).json({ error: 'Student not found' });
    }

    let shape = await ledgerBalanceToApiShape(null, tenantId, studentId, ledgerTermId);
    if (!shape) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (ledgerTermId) {
      shape = await enrichBalanceShapeWithExpectedFees(null, tenantId, studentId, ledgerTermId, shape);
    }

    const arrearsBreakdown = ledgerTermId
      ? await getArrearsBreakdownFromLedger(null, tenantId, studentId, ledgerTermId)
      : [];

    res.json({
      ...shape,
      arrearsBreakdown: arrearsBreakdown.map((line) => ({
        description: line.description,
        amount: line.amount,
        entryType: line.entryType,
        date: line.date,
      })),
      totalCharged: shape.totalCharged,
      paymentsMade: shape.paymentsMade,
    });
  } catch (error) {
    console.error('Student balance error:', error);
    res.status(500).json({ error: 'Failed to load student balance' });
  }
});

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
    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
    const shape = await ledgerBalanceToApiShape(null, tenantId, parseInt(studentId, 10), ledgerTermId);

    res.json({
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        admissionNumber: student.admission_number,
        className: student.class_name,
        level: student.level,
      },
      feeCalculation: shape
        ? {
            totalFees: shape.currentTermFee,
            standardFees: shape.currentTermFee,
            discountAmount: 0,
            totalPaid: shape.totalPaid,
            outstanding: shape.outstanding,
            arrears: shape.totalArrears,
            credit: shape.credit,
            status: shape.status,
            isBeneficiary: student.is_beneficiary,
            beneficiaryType: student.beneficiary_type,
            term,
            academicYear,
          }
        : null,
      balance: shape,
      paymentHistory: [],
    });
  } catch (error) {
    console.error('Calculate student fees error:', error);
    res.status(500).json({ error: 'Failed to calculate student fees' });
  }
});

router.get('/students/balances-by-term', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;

    try {
      await syncMissingLedgerTermFeesForActiveTerm(tenantId);
    } catch (syncErr) {
      console.error('[students/balances-by-term] Ledger fee sync failed (continuing):', syncErr);
    }

    const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(query, tenantId);
    if (!ledgerTermId) {
      return res.json([]);
    }

    const classIdNum =
      classId != null && String(classId).trim() !== '' ? parseInt(String(classId), 10) : null;

    const rows = await getBatchStudentBalancesFromLedger(
      null,
      tenantId,
      ledgerTermId,
      classIdNum != null && !Number.isNaN(classIdNum) ? classIdNum : null
    );

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const rawShape = {
          currentTermFee: row.termFee,
          currentTermName: termLabel,
          activeTermId: ledgerTermId,
          arrearLines: row.arrears > 0 ? [{ termName: 'Arrears', amount: row.arrears }] : [],
          totalArrears: row.arrears,
          creditBroughtForward: row.creditBroughtForward,
          totalDue: row.totalDue,
          paidLines:
            row.amountPaidThisTerm > 0
              ? [{ termName: `${termLabel || 'Current term'} (this term)`, amount: row.amountPaidThisTerm }]
              : [],
          totalPaid: row.amountPaidThisTerm,
          outstanding: row.outstanding,
          credit: row.creditBalance,
          netBalance: row.netBalance,
          status:
            row.termFee <= 0 &&
            (row.individualCharges ?? 0) <= 0 &&
            row.amountPaidThisTerm <= 0 &&
            row.arrears <= 0 &&
            row.creditBroughtForward <= 0
              ? ('NotSet' as const)
              : row.netBalance < -0.001
                ? ('Credit' as const)
                : row.netBalance > 0.001
                  ? ('Owing' as const)
                  : ('Cleared' as const),
          paymentsMade: row.amountPaidThisTerm,
          totalCharged: row.totalDue,
          individualCharges: row.individualCharges ?? 0,
          individualChargeLines: [],
          termRows: [],
        };
        return enrichBalanceShapeWithExpectedFees(null, tenantId, row.id, ledgerTermId, rawShape);
      })
    );

    res.json(
      enriched.map((shape, i) => {
        const row = rows[i];
        return {
          id: row.id,
          first_name: row.firstName,
          last_name: row.lastName,
          student_id: row.studentId,
          admission_number: row.admissionNumber,
          class_name: row.className,
          totalFees: shape.currentTermFee ?? row.termFee,
          totalPaid: shape.totalPaid ?? row.amountPaidThisTerm,
          outstanding: shape.outstanding ?? row.outstanding,
          arrears: shape.totalArrears ?? row.arrears,
          credit: shape.credit ?? row.creditBalance,
          status:
            (shape.credit ?? 0) > 0 ? 'Credit' : (shape.outstanding ?? 0) > 0 ? 'Owing' : 'Cleared',
        };
      })
    );
  } catch (error) {
    console.error('Get student balances error:', error);
    res.status(500).json({ error: 'Failed to get student balances' });
  }
});

router.get('/class-report', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, term, academicYear } = req.query;

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Term and academic year are required' });
    }

    try {
      await syncMissingLedgerTermFeesForActiveTerm(tenantId);
    } catch (syncErr) {
      console.error('[class-report] Ledger fee sync failed (continuing):', syncErr);
    }

    const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(query, tenantId);
    if (!ledgerTermId) {
      return res.json({ term, academicYear, classId: classId || null, students: [], totalOutstanding: 0 });
    }

    const classIdNum =
      classId != null && String(classId).trim() !== '' ? parseInt(String(classId), 10) : null;

    const rows = await getBatchStudentBalancesFromLedger(
      null,
      tenantId,
      ledgerTermId,
      classIdNum != null && !Number.isNaN(classIdNum) ? classIdNum : null
    );

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const rawShape = {
          currentTermFee: row.termFee,
          currentTermName: termLabel,
          activeTermId: ledgerTermId,
          arrearLines: row.arrears > 0 ? [{ termName: 'Arrears', amount: row.arrears }] : [],
          totalArrears: row.arrears,
          creditBroughtForward: row.creditBroughtForward,
          totalDue: row.totalDue,
          paidLines:
            row.amountPaidThisTerm > 0
              ? [{ termName: `${termLabel || 'Current term'} (this term)`, amount: row.amountPaidThisTerm }]
              : [],
          totalPaid: row.amountPaidThisTerm,
          outstanding: row.outstanding,
          credit: row.creditBalance,
          netBalance: row.netBalance,
          status:
            row.termFee <= 0 &&
            (row.individualCharges ?? 0) <= 0 &&
            row.amountPaidThisTerm <= 0 &&
            row.arrears <= 0 &&
            row.creditBroughtForward <= 0
              ? ('NotSet' as const)
              : row.netBalance < -0.001
                ? ('Credit' as const)
                : row.netBalance > 0.001
                  ? ('Owing' as const)
                  : ('Cleared' as const),
          paymentsMade: row.amountPaidThisTerm,
          totalCharged: row.totalDue,
          individualCharges: row.individualCharges ?? 0,
          individualChargeLines: [],
          termRows: [],
        };
        return enrichBalanceShapeWithExpectedFees(null, tenantId, row.id, ledgerTermId, rawShape);
      })
    );

    const owing = enriched
      .map((shape, i) => ({ shape, row: rows[i] }))
      .filter(({ shape }) => (shape.outstanding ?? 0) > 0);

    res.json({
      term,
      academicYear,
      classId: classId || null,
      students: owing.map(({ shape, row }) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        studentName: `${row.firstName} ${row.lastName}`,
        studentId: row.studentId,
        admissionNumber: row.admissionNumber,
        className: row.className,
        totalFees: shape.currentTermFee ?? row.termFee,
        totalPaid: shape.totalPaid ?? row.amountPaidThisTerm,
        outstanding: shape.outstanding ?? row.outstanding,
        outstandingBalance: shape.outstanding ?? row.outstanding,
        status: 'owing' as const,
      })),
      totalOutstanding: owing.reduce((s, { shape }) => s + (shape.outstanding ?? 0), 0),
    });
  } catch (error) {
    console.error('Class report error:', error);
    res.status(500).json({ error: 'Failed to generate class report' });
  }
});

router.post('/refresh-arrears', requireRole('super-admin', 'administrator', 'finance'), async (_req: AuthRequest, res) => {
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
