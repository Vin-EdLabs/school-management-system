import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { calculateFeeBalance } from '../services/financeCalculationService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** Profile lookup - Admin and Superadmin only. Search by Student ID, Teacher Staff ID, or Staff ID */
router.get('/profile-lookup', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    let tenantId = req.user!.tenantId;
    if (tenantId == null && req.user!.role === 'super-admin' && req.query.tenantId) {
      tenantId = parseInt(String(req.query.tenantId), 10);
    }
    if (tenantId == null) {
      return res.status(400).json({ error: 'School context required. Select a school first.' });
    }
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Search ID is required' });
    }
    const searchId = String(id).trim();
    if (!searchId) return res.status(400).json({ error: 'Search ID is required' });

    // Try Student (student_id or admission_number)
    const studentRes = await query(
      `SELECT s.*, c.class_name, c.level, c.stream
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.tenant_id = $1 AND (s.student_id = $2 OR s.admission_number ILIKE $2)`,
      [tenantId, searchId]
    );
    if (studentRes.rows.length > 0) {
      const student = studentRes.rows[0];
      const profile = await buildStudentProfile(tenantId, student);
      return res.json({ type: 'student', profile });
    }

    // Try Teacher (staff_id)
    const teacherRes = await query(
      `SELECT t.*, c.class_name
       FROM teachers t
       LEFT JOIN classes c ON t.class_assigned_id = c.id
       WHERE t.tenant_id = $1 AND LOWER(t.staff_id) = LOWER($2)`,
      [tenantId, searchId]
    );
    if (teacherRes.rows.length > 0) {
      const profile = await buildTeacherProfile(tenantId, teacherRes.rows[0]);
      return res.json({ type: 'teacher', profile });
    }

    // Try Staff (payroll_other_staff staff_id)
    const staffRes = await query(
      `SELECT * FROM payroll_other_staff WHERE tenant_id = $1 AND LOWER(staff_id) = LOWER($2)`,
      [tenantId, searchId]
    );
    if (staffRes.rows.length > 0) {
      const profile = await buildStaffProfile(tenantId, staffRes.rows[0]);
      return res.json({ type: 'staff', profile });
    }

    return res.status(404).json({ error: 'No record found with this ID' });
  } catch (error) {
    console.error('Profile lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup profile' });
  }
});

async function buildStudentProfile(tenantId: number, student: any) {
  const classId = student.class_assigned_id;
  const studentId = student.id;

  // Fee summary per term (all terms from fee_structures + payments)
  const feeStructRes = await query(
    `SELECT fs.term, fs.class_id, COALESCE(SUM(fs.amount), 0) as total_fees
     FROM fee_structures fs
     WHERE fs.tenant_id = $1 AND fs.class_id = $2
     GROUP BY fs.term, fs.class_id`,
    [tenantId, classId]
  );

  const paymentsRes = await query(
    `SELECT p.*,
       (SELECT u.username FROM audit_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = 'PAYMENT' AND al.entity_id = p.id AND al.action = 'CREATE'
        AND al.tenant_id = p.tenant_id
        ORDER BY al.created_at DESC LIMIT 1) as recorded_by
     FROM payments p
     WHERE p.tenant_id = $1 AND p.student_id = $2
     ORDER BY p.payment_date DESC`,
    [tenantId, studentId]
  );

  const paymentMap: Record<string, { total: number; records: any[] }> = {};
  paymentsRes.rows.forEach((p: any) => {
    const term = (p.term || 'Unknown').trim();
    if (!paymentMap[term]) paymentMap[term] = { total: 0, records: [] };
    paymentMap[term].total += parseFloat(p.amount || 0);
    paymentMap[term].records.push({
      date: p.payment_date,
      amount: parseFloat(p.amount),
      receiptNumber: p.receipt_number,
      recordedBy: p.recorded_by || '—',
    });
  });

  function getPaidForTerm(feeTerm: string): number {
    let total = 0;
    for (const [payTerm, data] of Object.entries(paymentMap)) {
      if (feeTerm === payTerm || payTerm.startsWith(feeTerm) || feeTerm.startsWith(payTerm)) {
        total += data.total;
      }
    }
    return total;
  }

  const feeSummaryByTerm: any[] = [];
  const termsSeen = new Set<string>();
  feeStructRes.rows.forEach((row: any) => {
    const term = (row.term || '').trim();
    if (!term || termsSeen.has(term)) return;
    termsSeen.add(term);
    const totalFees = parseFloat(row.total_fees || 0);
    const totalPaid = getPaidForTerm(term);
      const balance = calculateFeeBalance(totalFees, totalPaid);
    feeSummaryByTerm.push({
      academicYear: term.split(' ').pop() || '',
      term: term,
      totalFees,
      totalPaid,
      outstanding: balance.outstanding,
      status: balance.status,
    });
  });

  const allPayments = paymentsRes.rows.map((p: any) => ({
    date: p.payment_date,
    amount: parseFloat(p.amount),
    receiptNumber: p.receipt_number,
    recordedBy: p.recorded_by || '—',
  }));

  const totalFeesAll = feeStructRes.rows.reduce((s: number, r: any) => s + parseFloat(r.total_fees || 0), 0);
  const totalPaidAll = paymentsRes.rows.reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0);
  const overviewBalance = calculateFeeBalance(totalFeesAll, totalPaidAll);

  const attendanceRes = await query(
    `SELECT attendance_date, present FROM attendance WHERE tenant_id = $1 AND student_id = $2 ORDER BY attendance_date DESC LIMIT 200`,
    [tenantId, studentId]
  );
  const attRows = attendanceRes.rows;
  const totalPresent = attRows.filter((a: any) => a.present).length;
  const totalAbsent = attRows.filter((a: any) => !a.present).length;
  const attPct = attRows.length > 0 ? Math.round((totalPresent / attRows.length) * 100) : 0;

  const gradesRes = await query(
    `SELECT g.*, a.name as assignment_name, a.max_score, a.assignment_type
     FROM student_grades g
     JOIN grade_assignments a ON g.assignment_id = a.id
     WHERE g.tenant_id = $1 AND g.student_id = $2`,
    [tenantId, studentId]
  );
  const grades = gradesRes.rows.map((g: any) => ({
    assignmentName: g.assignment_name,
    score: parseFloat(g.score),
    maxScore: parseFloat(g.max_score || 100),
    assignmentType: g.assignment_type,
  }));
  const termAverage = grades.length > 0
    ? grades.reduce((s: number, g: any) => s + (g.score / g.maxScore) * 100, 0) / grades.length
    : 0;

  const activityRes = await query(
    `SELECT al.action, al.entity_type, al.entity_id, al.created_at, u.username
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.tenant_id = $1
       AND (
         (al.entity_type = 'STUDENT' AND al.entity_id = $2)
         OR (al.entity_type = 'PAYMENT' AND al.entity_id IN (SELECT id FROM payments WHERE student_id = $2))
       )
     ORDER BY al.created_at DESC LIMIT 100`,
    [tenantId, studentId]
  );

  const activityLog = activityRes.rows.map((a: any) => ({
    date: a.created_at,
    action: formatAction(a.action, a.entity_type),
    performedBy: a.username || '—',
  }));

  return {
    header: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      fullName: `${student.first_name} ${student.last_name}`,
      studentId: student.student_id,
      admissionNumber: student.admission_number,
      class: student.class_name || '—',
      status: student.notes?.toLowerCase().includes('suspended') ? 'Suspended' : 'Active',
      guardianName: student.guardian_name || '—',
      guardianContact: student.guardian_contact || '—',
      admissionDate: student.date_of_admission || '—',
      passportPhotoUrl: student.passport_photo_url,
    },
    overview: {
      totalFeesAssigned: totalFeesAll,
      totalPaid: totalPaidAll,
      totalOutstanding: overviewBalance.outstanding,
      currentTermAverage: Math.round(termAverage * 10) / 10,
      attendancePercentage: attPct,
    },
    fees: {
      summaryByTerm: feeSummaryByTerm,
      paymentHistory: allPayments,
    },
    academicPerformance: {
      grades,
      termAverage: Math.round(termAverage * 10) / 10,
      overallAverage: Math.round(termAverage * 10) / 10,
    },
    attendance: {
      totalPresent,
      totalAbsent,
      attendancePercentage: attPct,
      dailyRecords: attRows.map((a: any) => ({
        date: a.attendance_date,
        status: a.present ? 'Present' : 'Absent',
      })),
    },
    activityLog,
  };
}

function formatAction(action: string, entityType: string): string {
  if (entityType === 'PAYMENT' && action === 'CREATE') return 'Payment recorded';
  if (entityType === 'STUDENT' && action === 'UPDATE') return 'Student info edited';
  if (entityType === 'STUDENT' && action === 'CREATE') return 'Student registered';
  return `${action} ${entityType}`;
}

async function buildTeacherProfile(tenantId: number, teacher: any) {
  const salaryPaymentsRes = await query(
    `SELECT month, year, amount, paid_date, payment_method
     FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2
     ORDER BY year DESC, month DESC`,
    [tenantId, teacher.id]
  );

  const monthlySalary = parseFloat(teacher.monthly_salary || 0);
  const salaryPayments = salaryPaymentsRes.rows.map((p: any) => ({
    month: p.month,
    year: p.year,
    salaryAmount: monthlySalary,
    paidAmount: parseFloat(p.amount),
    balance: Math.max(0, monthlySalary - parseFloat(p.amount)),
    paymentDate: p.paid_date,
    status: parseFloat(p.amount) >= monthlySalary ? 'Paid' : 'Partially Paid',
  }));

  const classTeachersRes = await query(
    `SELECT c.class_name, ct.is_main FROM class_teachers ct
     JOIN classes c ON ct.class_id = c.id
     WHERE ct.tenant_id = $1 AND ct.teacher_id = $2`,
    [tenantId, teacher.id]
  );

  const activityRes = await query(
    `SELECT al.action, al.entity_type, al.created_at, u.username
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.tenant_id = $1 AND al.entity_type = 'TEACHER' AND al.entity_id = $2
     ORDER BY al.created_at DESC LIMIT 50`,
    [tenantId, teacher.id]
  );

  return {
    header: {
      id: teacher.id,
      fullName: teacher.full_name,
      staffId: teacher.staff_id,
      role: 'Teacher',
      department: teacher.subjects_taught?.join(', ') || '—',
      employmentDate: teacher.employment_date || '—',
      salary: monthlySalary,
      employmentStatus: teacher.employment_status || 'Active',
    },
    overview: {
      classesAssigned: classTeachersRes.rows.map((r: any) => r.class_name),
      totalSalaryPayments: salaryPaymentsRes.rows.length,
    },
    salaryPayments,
    classesAssigned: classTeachersRes.rows,
    activityLog: activityRes.rows.map((a: any) => ({
      date: a.created_at,
      action: `${a.action} ${a.entity_type}`,
      performedBy: a.username || '—',
    })),
  };
}

async function buildStaffProfile(tenantId: number, staff: any) {
  const salaryPaymentsRes = await query(
    `SELECT month, year, amount, paid_date, payment_method
     FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = 'staff' AND payee_id = $2
     ORDER BY year DESC, month DESC`,
    [tenantId, staff.id]
  );

  const monthlySalary = parseFloat(staff.monthly_salary || 0);
  const salaryPayments = salaryPaymentsRes.rows.map((p: any) => ({
    month: p.month,
    year: p.year,
    salaryAmount: monthlySalary,
    paidAmount: parseFloat(p.amount),
    balance: Math.max(0, monthlySalary - parseFloat(p.amount)),
    paymentDate: p.paid_date,
    status: parseFloat(p.amount) >= monthlySalary ? 'Paid' : 'Partially Paid',
  }));

  return {
    header: {
      id: staff.id,
      fullName: staff.full_name,
      staffId: staff.staff_id,
      role: staff.role || 'Staff',
      department: staff.role || '—',
      employmentDate: '—',
      salary: monthlySalary,
      employmentStatus: staff.employment_status || 'Active',
    },
    overview: { totalSalaryPayments: salaryPaymentsRes.rows.length },
    salaryPayments,
    classesAssigned: [],
    activityLog: [],
  };
}

export default router;
