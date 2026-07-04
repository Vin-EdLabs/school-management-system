import express from 'express';
import { TEACHER_VISIBLE_WHERE } from '../constants/staffQueries.js';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { isGraduatedEnrollment } from '../services/studentFeeBalanceService.js';
import { resolveSchoolDisplayName } from '../services/schoolBrandingService.js';
import {
  getReportCardArchiveById,
  getStudentAcademicTranscript,
  getStudentReportCardArchiveList,
} from '../services/reportCardArchiveService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

/** Profile lookup - Admin and Superadmin only. Search by Student ID, Teacher Staff ID, or Staff ID */
router.get('/profile-lookup', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
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
       WHERE t.tenant_id = $1 AND LOWER(t.staff_id) = LOWER($2) AND ${TEACHER_VISIBLE_WHERE}`,
      [tenantId, searchId]
    );
    if (teacherRes.rows.length > 0) {
      const profile = await buildTeacherProfile(tenantId, teacherRes.rows[0]);
      return res.json({ type: 'teacher', profile });
    }

    // Try Staff (other_staff staff_id)
    const staffRes = await query(
      `SELECT * FROM other_staff WHERE tenant_id = $1 AND LOWER(staff_id) = LOWER($2)`,
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

/** List all archived report cards for a student */
router.get(
  '/students/:studentId/report-card-archive',
  requireRole('super-admin', 'administrator', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      let tenantId = req.user!.tenantId;
      if (tenantId == null && req.user!.role === 'super-admin' && req.query.tenantId) {
        tenantId = parseInt(String(req.query.tenantId), 10);
      }
      if (tenantId == null) {
        return res.status(400).json({ error: 'School context required' });
      }
      const studentId = parseInt(String(req.params.studentId), 10);
      if (!Number.isFinite(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID' });
      }

      const studentCheck = await query(
        'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
        [studentId, tenantId]
      );
      if (!studentCheck.rows.length) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const archives = await getStudentReportCardArchiveList(tenantId, studentId);
      res.json({ archives });
    } catch (error) {
      console.error('Report card archive list error:', error);
      res.status(500).json({ error: 'Failed to fetch report card history' });
    }
  }
);

/** Get a single archived report card (full snapshot) */
router.get(
  '/report-card-archive/:archiveId',
  requireRole('super-admin', 'administrator', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      let tenantId = req.user!.tenantId;
      if (tenantId == null && req.user!.role === 'super-admin' && req.query.tenantId) {
        tenantId = parseInt(String(req.query.tenantId), 10);
      }
      if (tenantId == null) {
        return res.status(400).json({ error: 'School context required' });
      }
      const archiveId = parseInt(String(req.params.archiveId), 10);
      if (!Number.isFinite(archiveId)) {
        return res.status(400).json({ error: 'Invalid archive ID' });
      }

      const archive = await getReportCardArchiveById(tenantId, archiveId);
      if (!archive) {
        return res.status(404).json({ error: 'Archived report card not found' });
      }

      res.json({ archive });
    } catch (error) {
      console.error('Report card archive detail error:', error);
      res.status(500).json({ error: 'Failed to fetch archived report card' });
    }
  }
);

/** Academic transcript across all archived terms */
router.get(
  '/students/:studentId/academic-transcript',
  requireRole('super-admin', 'administrator', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      let tenantId = req.user!.tenantId;
      if (tenantId == null && req.user!.role === 'super-admin' && req.query.tenantId) {
        tenantId = parseInt(String(req.query.tenantId), 10);
      }
      if (tenantId == null) {
        return res.status(400).json({ error: 'School context required' });
      }
      const studentId = parseInt(String(req.params.studentId), 10);
      if (!Number.isFinite(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID' });
      }

      const studentCheck = await query(
        'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
        [studentId, tenantId]
      );
      if (!studentCheck.rows.length) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const transcript = await getStudentAcademicTranscript(tenantId, studentId);
      res.json(transcript);
    } catch (error) {
      console.error('Academic transcript error:', error);
      res.status(500).json({ error: 'Failed to fetch academic transcript' });
    }
  }
);

function buildStudentDetails(student: any) {
  return {
    gender: student.gender || '—',
    dateOfBirth: student.date_of_birth || '—',
    nationality: student.nationality || '—',
    homeAddress: student.home_address || '—',
    guardianName: student.guardian_name || '—',
    guardianContact: student.guardian_contact || '—',
    guardian2Name: student.guardian_2_name || '—',
    guardian2Contact: student.guardian_2_contact || '—',
    guardian2Relationship: student.guardian_2_relationship || '—',
    numberOfSiblings: Number(student.number_of_siblings) || 0,
    namesOfSiblings: student.names_of_siblings || '—',
    previousSchool: student.previous_school || '—',
    enrollmentStatus: student.enrollment_status || 'active',
    beneficiaryType: student.beneficiary_type || null,
    beneficiaryNotes: student.beneficiary_notes || '—',
    notes: student.notes || '—',
  };
}

async function buildStudentProfile(tenantId: number, student: any) {
  const studentId = student.id;

  const settingsRes = await query(
    `SELECT school_name, current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const schoolSettings = settingsRes.rows[0] || {};
  const schoolDisplayName = await resolveSchoolDisplayName(tenantId);
  const currentTerm = schoolSettings.current_term || null;
  const currentYear = schoolSettings.current_year || null;

  const studentDetails = buildStudentDetails(student);

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
    school: {
      name: schoolDisplayName,
      currentTerm,
      currentYear,
    },
    header: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      fullName: `${student.first_name} ${student.last_name}`,
      studentId: student.student_id,
      admissionNumber: student.admission_number,
      class: student.class_name || '—',
      level: student.level || '',
      stream: student.stream || '',
      status: student.notes?.toLowerCase().includes('suspended') ? 'Suspended' : isGraduatedEnrollment(student.enrollment_status) ? 'Alumni' : 'Active',
      guardianName: studentDetails.guardianName,
      guardianContact: studentDetails.guardianContact,
      gender: studentDetails.gender,
      dateOfBirth: studentDetails.dateOfBirth,
      nationality: studentDetails.nationality,
      homeAddress: studentDetails.homeAddress,
      admissionDate: student.date_of_admission || '—',
      passportPhotoUrl: student.passport_photo_url || null,
      hasPassportPhoto: !!(student.passport_photo_url && String(student.passport_photo_url).length > 0),
      isBeneficiary: !!student.is_beneficiary,
      discountType: student.discount_type || null,
      discountValue: student.discount_value != null ? Number(student.discount_value) : null,
    },
    details: studentDetails,
    overview: {
      isBeneficiary: !!student.is_beneficiary,
      currentTermAverage: Math.round(termAverage * 10) / 10,
      attendancePercentage: attPct,
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
  if (entityType === 'PAYMENT' && action === 'VOID') return 'Payment voided';
  if (entityType === 'PAYMENT' && action === 'UPDATE') return 'Payment corrected';
  if (entityType === 'STUDENT' && action === 'UPDATE') return 'Student info edited';
  if (entityType === 'STUDENT' && action === 'CREATE') return 'Student registered';
  if (entityType === 'STUDENT' && action === 'STUDENT_PENDING') return 'Saved as pending admission';
  if (entityType === 'STUDENT' && action === 'STUDENT_ENROLLED') return 'Pending student approved & enrolled';
  if (entityType === 'STUDENT' && action === 'STUDENT_REJECTED') return 'Pending admission rejected';
  return `${action} ${entityType}`;
}

async function buildTeacherProfile(tenantId: number, teacher: any) {
  const salaryPaymentsRes = await query(
    `SELECT month, year, amount, paid_date, payment_method, net_salary
     FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2
     ORDER BY year DESC, month DESC`,
    [tenantId, teacher.id]
  );

  const monthlySalary = parseFloat(teacher.monthly_salary || 0);
  const salaryPayments = salaryPaymentsRes.rows.map((p: any) => {
    const netExpected =
      p.net_salary != null ? parseFloat(p.net_salary) : monthlySalary;
    const paid = parseFloat(p.amount);
    return {
      month: p.month,
      year: p.year,
      salaryAmount: monthlySalary,
      paidAmount: paid,
      balance: Math.max(0, netExpected - paid),
      paymentDate: p.paid_date,
      status: paid >= netExpected - 0.01 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    };
  });

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
      passportPhotoUrl: teacher.passport_photo_url || null,
      hasPassportPhoto: !!(teacher.passport_photo_url && String(teacher.passport_photo_url).length > 0),
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
    `SELECT month, year, amount, paid_date, payment_method, net_salary
     FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = 'staff' AND payee_id = $2
     ORDER BY year DESC, month DESC`,
    [tenantId, staff.id]
  );

  const monthlySalary = parseFloat(staff.monthly_salary || 0);
  const salaryPayments = salaryPaymentsRes.rows.map((p: any) => {
    const netExpected =
      p.net_salary != null ? parseFloat(p.net_salary) : monthlySalary;
    const paid = parseFloat(p.amount);
    return {
      month: p.month,
      year: p.year,
      salaryAmount: monthlySalary,
      paidAmount: paid,
      balance: Math.max(0, netExpected - paid),
      paymentDate: p.paid_date,
      status: paid >= netExpected - 0.01 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    };
  });

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
