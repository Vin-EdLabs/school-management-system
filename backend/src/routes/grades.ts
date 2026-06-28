import express from 'express';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';
import { resolveSchoolDisplayName } from '../services/schoolBrandingService.js';
import { archiveClassReportCardsOnRelease, archiveStudentReportCard, validateClassReportReadyForRelease, resolveArchiveSignatures } from '../services/reportCardArchiveService.js';
import { assertMainClassTeacher, isMainClassTeacher } from '../services/classTeacherAccess.js';
import { getSchoolActiveTermYear } from '../services/gradesTermContext.js';
import {
  getSchoolTermYear,
  loadClassTermRemarks,
  loadStudentTermRemarks,
  upsertTermReportRemark,
} from '../services/termReportRemarksService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

// ── Assignments ──────────────────────────────────────────────────────────────

// Get assignments for a class (optionally filtered by subject)
router.get('/assignments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, subject } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId required' });

    const { term, academicYear } = await getSchoolActiveTermYear(tenantId);
    if (!term || !academicYear) {
      return res.status(400).json({ error: 'No active academic term is set for this school' });
    }

    let sql = `SELECT id, class_id, subject, name, assignment_type, max_score, due_date, created_at, term, academic_year
               FROM grade_assignments
               WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND academic_year = $4`;
    const params: any[] = [tenantId, classId, term, academicYear];

    if (subject) {
      params.push(subject);
      sql += ` AND subject = $${params.length}`;
    }
    sql += ' ORDER BY subject, assignment_type, name';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get unique subjects for a class
router.get('/subjects', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId required' });

    const { term, academicYear } = await getSchoolActiveTermYear(tenantId);
    if (!term || !academicYear) {
      return res.json([]);
    }

    const result = await query(
      `SELECT DISTINCT subject FROM grade_assignments
       WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND academic_year = $4
       ORDER BY subject`,
      [tenantId, classId, term, academicYear]
    );
    res.json(result.rows.map((r: any) => r.subject));
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create assignment
router.post('/assignments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, subject, name, assignmentType, maxScore, dueDate } = req.body;
    if (!classId || !name || !subject) {
      return res.status(400).json({ error: 'classId, subject, and name required' });
    }

    const { term, academicYear } = await getSchoolActiveTermYear(tenantId);
    if (!term || !academicYear) {
      return res.status(400).json({ error: 'No active academic term is set. Activate a term before adding assessments.' });
    }

    const result = await query(
      `INSERT INTO grade_assignments (tenant_id, class_id, subject, name, assignment_type, max_score, due_date, term, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tenantId, classId, subject.trim(), name.trim(), assignmentType || 'Test', parseFloat(maxScore) || 100, dueDate || null, term, academicYear]
    );
    emitTenantDataChanged(tenantId, 'grade-assignment', 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Delete assignment — ungraded: teachers/admins; graded: administrators only with password
router.delete('/assignments/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const role = req.user!.role;
    const assignmentId = req.params.id;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const graded = await query(
      `SELECT COUNT(*)::int AS count
       FROM student_grades sg
       JOIN grade_assignments ga ON ga.id = sg.assignment_id
       WHERE sg.assignment_id = $1 AND ga.tenant_id = $2`,
      [assignmentId, tenantId]
    );
    const gradedCount = graded.rows[0]?.count ?? 0;
    const hasGrades = gradedCount > 0;

    if (hasGrades) {
      if (role !== 'administrator' && role !== 'super-admin') {
        return res.status(403).json({
          error: 'Only school administrators can delete assessments that already have grades recorded.',
        });
      }
      if (!password.trim()) {
        return res.status(400).json({
          error: 'Password required to delete a graded assessment.',
        });
      }
      const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      if (hasGrades) {
        await client.query(
          'DELETE FROM student_grades WHERE assignment_id = $1 AND tenant_id = $2',
          [assignmentId, tenantId]
        );
      }
      const result = await client.query(
        'DELETE FROM grade_assignments WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [assignmentId, tenantId]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Assessment not found' });
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    emitTenantDataChanged(tenantId, 'grade-assignment', 'deleted');
    res.json({ message: 'Assignment deleted', gradesRemoved: hasGrades ? gradedCount : 0 });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// ── Grades ───────────────────────────────────────────────────────────────────

// Get grades — by assignmentId or classId, includes grader name + timestamps for audit log
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, assignmentId, studentId } = req.query;

    const gradeSelect = `
      g.id, g.student_id, g.assignment_id, g.score,
      g.created_at, g.updated_at,
      s.first_name, s.last_name, s.student_id AS admission_number,
      a.name AS assignment_name, a.max_score, a.subject, a.assignment_type,
      u.username AS graded_by_name
    `;

    let result;
    if (assignmentId) {
      result = await query(
        `SELECT ${gradeSelect}
         FROM student_grades g
         JOIN students s ON g.student_id = s.id AND s.tenant_id = g.tenant_id
         JOIN grade_assignments a ON g.assignment_id = a.id
         LEFT JOIN users u ON g.graded_by = u.id
         WHERE g.tenant_id = $1 AND g.assignment_id = $2
         ORDER BY s.first_name, s.last_name`,
        [tenantId, assignmentId]
      );
    } else if (classId) {
      const { term, academicYear } = await getSchoolActiveTermYear(tenantId);
      if (!term || !academicYear) {
        return res.json([]);
      }
      result = await query(
        `SELECT ${gradeSelect}
         FROM student_grades g
         JOIN students s ON g.student_id = s.id AND s.tenant_id = g.tenant_id
         JOIN grade_assignments a ON g.assignment_id = a.id
         LEFT JOIN users u ON g.graded_by = u.id
         WHERE g.tenant_id = $1 AND a.class_id = $2 AND a.term = $3 AND a.academic_year = $4
         ORDER BY a.subject, a.name, s.first_name, s.last_name`,
        [tenantId, classId, term, academicYear]
      );
    } else if (studentId) {
      result = await query(
        `SELECT ${gradeSelect}
         FROM student_grades g
         JOIN students s ON g.student_id = s.id AND s.tenant_id = g.tenant_id
         JOIN grade_assignments a ON g.assignment_id = a.id
         LEFT JOIN users u ON g.graded_by = u.id
         WHERE g.tenant_id = $1 AND g.student_id = $2
         ORDER BY a.subject, a.name`,
        [tenantId, studentId]
      );
    } else {
      return res.status(400).json({ error: 'classId, studentId, or assignmentId required' });
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// Get full grade change history for a specific student + assignment
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId, assignmentId } = req.query;
    if (!studentId || !assignmentId) {
      return res.status(400).json({ error: 'studentId and assignmentId required' });
    }
    const result = await query(
      `SELECT
         l.id,
         l.old_score,
         l.new_score,
         l.changed_at,
         u.username AS changed_by_name
       FROM grade_audit_log l
       LEFT JOIN users u ON l.changed_by = u.id
       WHERE l.tenant_id = $1 AND l.student_id = $2 AND l.assignment_id = $3
       ORDER BY l.changed_at DESC`,
      [tenantId, studentId, assignmentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get grade history error:', error);
    res.status(500).json({ error: 'Failed to fetch grade history' });
  }
});

// Save single grade (upsert) — logs every change to grade_audit_log
router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const { studentId, assignmentId, score } = req.body;
    if (!studentId || !assignmentId || score == null) {
      return res.status(400).json({ error: 'studentId, assignmentId, and score required' });
    }
    const newScore = parseFloat(score);

    // Capture existing score for the audit log
    const existing = await query(
      'SELECT score FROM student_grades WHERE tenant_id = $1 AND student_id = $2 AND assignment_id = $3',
      [tenantId, studentId, assignmentId]
    );
    const oldScore = existing.rows[0]?.score ?? null;

    const result = await query(
      `INSERT INTO student_grades (tenant_id, student_id, assignment_id, score, graded_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, student_id, assignment_id)
       DO UPDATE SET score = EXCLUDED.score, graded_by = EXCLUDED.graded_by, updated_at = NOW()
       RETURNING *`,
      [tenantId, studentId, assignmentId, newScore, userId]
    );

    // Append to audit log
    await query(
      `INSERT INTO grade_audit_log (tenant_id, student_id, assignment_id, old_score, new_score, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, studentId, assignmentId, oldScore, newScore, userId]
    );

    emitTenantDataChanged(tenantId, 'grade', 'updated');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Save grade error:', error);
    res.status(500).json({ error: 'Failed to save grade' });
  }
});

// Batch save grades — saves multiple scores, logs every change
router.post('/batch', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array required' });
    }

    // Pre-fetch all existing scores for this assignment in one query
    const validRecords = records.filter(r => {
      if (r.score === '' || r.score === null || r.score === undefined) return false;
      const n = parseFloat(r.score);
      return !isNaN(n);
    });

    if (validRecords.length === 0) {
      return res.json({ message: '0 grade(s) saved', saved: 0, skipped: records.length });
    }

    const assignmentId = validRecords[0].assignmentId;
    const studentIds = validRecords.map((r: any) => r.studentId);

    const existingRes = await query(
      `SELECT student_id, score FROM student_grades
       WHERE tenant_id = $1 AND assignment_id = $2 AND student_id = ANY($3)`,
      [tenantId, assignmentId, studentIds]
    );
    const existingMap: Record<number, number | null> = {};
    for (const row of existingRes.rows) existingMap[row.student_id] = parseFloat(row.score);

    let saved = 0;
    const skipped = records.length - validRecords.length;

    for (const r of validRecords) {
      const newScore = parseFloat(r.score);
      const oldScore = existingMap[r.studentId] ?? null;

      await query(
        `INSERT INTO student_grades (tenant_id, student_id, assignment_id, score, graded_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (tenant_id, student_id, assignment_id)
         DO UPDATE SET score = EXCLUDED.score, graded_by = EXCLUDED.graded_by, updated_at = NOW()`,
        [tenantId, r.studentId, r.assignmentId, newScore, userId]
      );

      await query(
        `INSERT INTO grade_audit_log (tenant_id, student_id, assignment_id, old_score, new_score, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, r.studentId, r.assignmentId, oldScore, newScore, userId]
      );
      saved++;
    }

    emitTenantDataChanged(tenantId, 'grade', 'updated');
    res.json({ message: `${saved} grade(s) saved`, saved, skipped });
  } catch (error) {
    console.error('Batch save grades error:', error);
    res.status(500).json({ error: 'Failed to save grades' });
  }
});

// ── Term Report ──────────────────────────────────────────────────────────────

/**
 * GET /grades/term-report?classId=X
 * Returns all students ranked by grand total across all subjects.
 * Students who have moved from the class are included if they have grades.
 */
router.get('/term-report', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId required' });

    const { term: activeTerm, academicYear: activeYear } = await getSchoolActiveTermYear(tenantId);

    // 1. All assignments for this class grouped by subject (current term only)
    const assignmentsRes = await query(
      `SELECT id, subject, name, assignment_type, max_score
       FROM grade_assignments
       WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND academic_year = $4
       ORDER BY subject, assignment_type, name`,
      [tenantId, classId, activeTerm, activeYear]
    );
    const assignments: any[] = assignmentsRes.rows;

    if (assignments.length === 0) {
      return res.json({ students: [], subjects: [], assignments: [], className: '' });
    }

    // 2. Class name
    const classRes = await query(
      'SELECT class_name FROM classes WHERE id = $1 AND tenant_id = $2',
      [classId, tenantId]
    );
    const className = classRes.rows[0]?.class_name || '';

    // 3. All students currently in the class (include passport photo)
    const studentsRes = await query(
      `SELECT id, first_name, last_name, student_id AS admission_number, passport_photo_url
       FROM students
       WHERE tenant_id = $1 AND class_assigned_id = $2
       ORDER BY first_name, last_name`,
      [tenantId, classId]
    );

    // 4. Also include students who have grades but may have moved
    const assignmentIds = assignments.map((a: any) => a.id);
    const gradedStudentsRes = await query(
      `SELECT DISTINCT s.id, s.first_name, s.last_name, s.student_id AS admission_number,
              s.passport_photo_url
       FROM student_grades sg
       JOIN students s ON sg.student_id = s.id AND s.tenant_id = sg.tenant_id
       WHERE sg.tenant_id = $1 AND sg.assignment_id = ANY($2)`,
      [tenantId, assignmentIds]
    );

    // Merge: union of current class students + any graded students (dedup by id)
    const studentMap = new Map<number, any>();
    for (const s of studentsRes.rows) studentMap.set(s.id, { ...s, hasMoved: false });
    for (const s of gradedStudentsRes.rows) {
      if (!studentMap.has(s.id)) studentMap.set(s.id, { ...s, hasMoved: true });
    }
    const allStudents = Array.from(studentMap.values());

    // 5. All grades for these assignments
    const gradesRes = await query(
      `SELECT student_id, assignment_id, score::float AS score
       FROM student_grades
       WHERE tenant_id = $1 AND assignment_id = ANY($2)`,
      [tenantId, assignmentIds]
    );

    // Grade lookup: student_id → assignment_id → score
    const gradeMap: Record<number, Record<number, number>> = {};
    for (const g of gradesRes.rows) {
      if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
      gradeMap[g.student_id][g.assignment_id] = g.score;
    }

    // 6. Unique ordered subjects
    const subjectOrder: string[] = [];
    for (const a of assignments) {
      if (!subjectOrder.includes(a.subject)) subjectOrder.push(a.subject);
    }

    // 7. Group assignments by subject
    const assignmentsBySubject: Record<string, any[]> = {};
    for (const subj of subjectOrder) {
      assignmentsBySubject[subj] = assignments.filter((a: any) => a.subject === subj);
    }

    // 8. Build per-student report rows
    const reportRows = allStudents.map((s: any) => {
      const subjectScores: Record<string, { score: number; maxScore: number; classScore: number; examScore: number }> = {};
      let grandTotal = 0;
      let grandMax = 0;

      for (const subj of subjectOrder) {
        const subjectAssignments = assignmentsBySubject[subj];
        let classScoreSum = 0;
        let classMaxSum = 0;
        let examScoreSum = 0;
        let examMaxSum = 0;

        for (const a of subjectAssignments) {
          const scored = gradeMap[s.id]?.[a.id] ?? 0;
          const typeLabel = String(a.assignment_type || a.name || '').toLowerCase();
          const isExam = typeLabel === 'exam' || typeLabel.includes('exam');
          if (isExam) {
            examScoreSum += scored;
            examMaxSum += parseFloat(a.max_score);
          } else {
            classScoreSum += scored;
            classMaxSum += parseFloat(a.max_score);
          }
        }

        let classScoreVal = 0;
        let examScoreVal = 0;

        if (classMaxSum > 0 && examMaxSum > 0) {
          classScoreVal = (classScoreSum / classMaxSum) * 40;
          examScoreVal = (examScoreSum / examMaxSum) * 60;
        } else if (classMaxSum > 0) {
          const pct = classScoreSum / classMaxSum;
          classScoreVal = pct * 40;
          examScoreVal = pct * 60;
        } else if (examMaxSum > 0) {
          const pct = examScoreSum / examMaxSum;
          classScoreVal = pct * 40;
          examScoreVal = pct * 60;
        }

        const totalScore = classScoreVal + examScoreVal;

        subjectScores[subj] = {
          score: Math.round(totalScore * 10) / 10,
          maxScore: 100,
          classScore: Math.round(classScoreVal * 10) / 10,
          examScore: Math.round(examScoreVal * 10) / 10,
        };
        grandTotal += totalScore;
        grandMax += 100;
      }

      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        admissionNumber: s.admission_number,
        passportPhotoUrl: s.passport_photo_url || null,
        hasMoved: s.hasMoved,
        subjectScores,
        grandTotal: Math.round(grandTotal * 10) / 10,
        grandMax: Math.round(grandMax * 10) / 10,
        percentage: grandMax > 0 ? Math.round((grandTotal / grandMax) * 100) : 0,
        position: 0,
      };
    });

    // 9. Sort by grand total desc, assign position (ties share a rank)
    reportRows.sort((a, b) => b.grandTotal - a.grandTotal);
    let pos = 1;
    for (let i = 0; i < reportRows.length; i++) {
      if (i > 0 && reportRows[i].grandTotal < reportRows[i - 1].grandTotal) pos = i + 1;
      reportRows[i].position = pos;
    }

    // 10. Get school settings for term info
    const settingsRes = await query(
      'SELECT current_term, current_year, grade_scale FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term || '';
    const currentYear = settingsRes.rows[0]?.current_year || '';
    const schoolName = await resolveSchoolDisplayName(tenantId);
    const gradeScale = settingsRes.rows[0]?.grade_scale || [
      { letter: 'A', minPct: 80, maxPct: 100, description: 'Excellent' },
      { letter: 'B', minPct: 70, maxPct: 79, description: 'Good' },
      { letter: 'C', minPct: 60, maxPct: 69, description: 'Fair' },
      { letter: 'D', minPct: 50, maxPct: 59, description: 'Pass' },
      { letter: 'F', minPct: 0, maxPct: 49, description: 'Fail' },
    ];

    // 11. Load saved remarks for this class/term (latest row per student)
    const { teacherRemarks, headmasterRemarks } = await loadClassTermRemarks(
      tenantId,
      Number(classId),
      currentTerm,
      currentYear
    );

    // 12. Check release status
    const releaseRes = await query(
      `SELECT is_released, released_at, u.username AS released_by_name
       FROM term_report_releases r
       LEFT JOIN users u ON r.released_by = u.id
       WHERE r.tenant_id = $1 AND r.class_id = $2 AND r.term = $3`,
      [tenantId, classId, currentTerm]
    );
    const releaseInfo = releaseRes.rows[0] || null;

    const headmasterRes = await query(
      `SELECT COALESCE(t.full_name, u.full_name) AS full_name,
              COALESCE(NULLIF(TRIM(t.headmaster_title), ''), 'Headmaster') AS headmaster_title
       FROM users u
       LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1 AND u.role = 'headmaster' AND u.is_active = true
       ORDER BY u.id ASC
       LIMIT 1`,
      [tenantId]
    ).catch(async () => {
      return query(
        `SELECT COALESCE(t.full_name, u.full_name) AS full_name
         FROM users u
         LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
         WHERE u.tenant_id = $1 AND u.role = 'headmaster' AND u.is_active = true
         ORDER BY u.id ASC
         LIMIT 1`,
        [tenantId]
      );
    });
    const headmasterName = headmasterRes.rows[0]?.full_name || null;
    const headmasterTitle = headmasterRes.rows[0]?.headmaster_title || 'Headmaster';

    // 13. Attendance summary for this class (from attendance module)
    const classDaysRes = await query(
      `SELECT COUNT(DISTINCT attendance_date)::int AS total_days
       FROM attendance
       WHERE tenant_id = $1 AND class_id = $2`,
      [tenantId, classId]
    );
    const classAttendanceTotalDays = classDaysRes.rows[0]?.total_days ?? 0;

    const attendanceRes = await query(
      `SELECT
         student_id,
         COUNT(*)::int AS total_days,
         SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_count
       FROM attendance
       WHERE tenant_id = $1 AND class_id = $2
       GROUP BY student_id`,
      [tenantId, classId]
    );
    const attendanceSummary: Record<number, { present: number; totalDays: number }> = {};
    for (const row of attendanceRes.rows) {
      attendanceSummary[row.student_id] = {
        present: row.present_count ?? 0,
        totalDays: row.total_days ?? classAttendanceTotalDays,
      };
    }

    const isMainClassTeacherForUser = await isMainClassTeacher(
      tenantId,
      Number(classId),
      req.user!.teacherId != null ? Number(req.user!.teacherId) : null
    );
    const reportSignatures = await resolveArchiveSignatures(tenantId, Number(classId));

    return res.json({
      students: reportRows,
      subjects: subjectOrder,
      assignments,
      assignmentsBySubject,
      className,
      currentTerm,
      currentYear,
      schoolName,
      gradeScale,
      teacherRemarks,
      headmasterRemarks,
      headmasterName,
      headmasterTitle,
      attendanceSummary,
      classAttendanceTotalDays,
      isReleased: releaseInfo?.is_released ?? false,
      releasedAt: releaseInfo?.released_at ?? null,
      releasedByName: releaseInfo?.released_by_name ?? null,
      isMainClassTeacherForUser,
      reportSignatures,
    });
  } catch (error) {
    console.error('Term report error:', error);
    res.status(500).json({ error: 'Failed to generate term report' });
  }
});

// ── POST /grades/release-report ───────────────────────────────────────────────
// Toggle the released state of the term report for a class.

router.post('/release-report', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const role = String(req.user!.role || '').toLowerCase();
    const { classId, release, signatures } = req.body; // release: boolean
    if (!classId) return res.status(400).json({ error: 'classId required' });

    const settingsRes = await query(
      'SELECT current_term FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term;
    if (!currentTerm) return res.status(400).json({ error: 'No active term set' });

    const releasing = release !== false;
    const isSchoolAdmin = role === 'administrator' || role === 'super-admin';

    if (releasing) {
      if (role === 'teacher' || role === 'staff') {
        try {
          await assertMainClassTeacher(tenantId, Number(classId), req.user!.teacherId != null ? Number(req.user!.teacherId) : null);
        } catch (e: unknown) {
          const err = e as { status?: number; message?: string };
          return res.status(err.status || 403).json({ error: err.message || 'Forbidden' });
        }
      } else if (role !== 'headmaster' && !isSchoolAdmin) {
        return res.status(403).json({ error: 'You cannot release report cards for this class' });
      }

      if (!isSchoolAdmin) {
        const validation = await validateClassReportReadyForRelease(
          tenantId,
          Number(classId),
          signatures || undefined
        );
        if (!validation.ok) {
          return res.status(400).json({
            error: validation.errors[0] || 'Report card is not complete',
            validation,
          });
        }
      }
    } else if (!isSchoolAdmin && role !== 'headmaster') {
      if (role === 'teacher' || role === 'staff') {
        try {
          await assertMainClassTeacher(tenantId, Number(classId), req.user!.teacherId != null ? Number(req.user!.teacherId) : null);
        } catch (e: unknown) {
          const err = e as { status?: number; message?: string };
          return res.status(err.status || 403).json({ error: err.message || 'Forbidden' });
        }
      } else {
        return res.status(403).json({ error: 'You cannot hide report cards for this class' });
      }
    }

    await query(
      `INSERT INTO term_report_releases (tenant_id, class_id, term, released_by, is_released, released_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, class_id, term)
       DO UPDATE SET is_released = EXCLUDED.is_released,
                     released_by = EXCLUDED.released_by,
                     released_at = NOW()`,
      [tenantId, classId, currentTerm, userId, release !== false]
    );

    emitTenantDataChanged(tenantId, 'term-report-release', 'updated');

    // Always snapshot to permanent records (release or hide). First snapshot is immutable.
    const archiveResult = await archiveClassReportCardsOnRelease(
      tenantId,
      Number(classId),
      userId,
      signatures || undefined
    ).catch((err) => {
      console.error('Report card archive error:', err);
      return { archived: 0, updated: 0 };
    });

    if (release !== false) {
      const studentsRes = await query(
        `SELECT id FROM students WHERE tenant_id = $1 AND class_assigned_id = $2`,
        [tenantId, classId]
      ).catch(() => ({ rows: [] as any[] }));
      for (const row of studentsRes.rows) {
        await sendPushToStudentParents(tenantId, row.id, {
          title: 'Results Released',
          body: `Your ward's ${currentTerm} results are now available.`,
          url: `/parent/${tenantId}`,
        }).catch(() => {});
      }
    }
    res.json({
      message: release !== false ? 'Report released to parents' : 'Report hidden from parents',
      archive: archiveResult,
    });
  } catch (error) {
    console.error('Release report error:', error);
    res.status(500).json({ error: 'Failed to update report release status' });
  }
});

router.get('/term-report-remarks', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, studentId } = req.query;
    if (!classId || !studentId) return res.status(400).json({ error: 'classId and studentId required' });

    const { term, academicYear } = await getSchoolTermYear(tenantId);
    const result = await loadStudentTermRemarks(
      tenantId,
      Number(classId),
      Number(studentId),
      term,
      academicYear
    );
    res.json(result);
  } catch (error) {
    console.error('Fetch term report remarks error:', error);
    res.status(500).json({ error: 'Failed to fetch term report remarks' });
  }
});

router.post('/term-report-remarks', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const role = String(req.user!.role || '').toLowerCase();
    const { classId, studentId, teacherRemark, headmasterRemark, signatures } = req.body;
    if (!classId || !studentId) return res.status(400).json({ error: 'classId and studentId required' });

    const { term, academicYear } = await getSchoolTermYear(tenantId);
    if (!term || !academicYear) {
      return res.status(400).json({ error: 'No active academic term is set for this school' });
    }

    const saved = { teacherRemark: '', headmasterRemark: '' };

    if (role === 'headmaster') {
      if (teacherRemark != null) {
        const value = String(teacherRemark);
        await upsertTermReportRemark(
          tenantId, Number(classId), Number(studentId), term, academicYear, 'teacher', value, userId
        );
        saved.teacherRemark = value;
      }
      if (headmasterRemark != null) {
        const value = String(headmasterRemark);
        await upsertTermReportRemark(
          tenantId, Number(classId), Number(studentId), term, academicYear, 'headmaster', value, userId
        );
        saved.headmasterRemark = value;
      }
    } else {
      if (teacherRemark != null) {
        try {
          await assertMainClassTeacher(tenantId, Number(classId), req.user!.teacherId != null ? Number(req.user!.teacherId) : null);
        } catch (e: unknown) {
          const err = e as { status?: number; message?: string };
          return res.status(err.status || 403).json({
            error: err.message || 'Only the main class teacher can save class teacher remarks',
          });
        }
        const value = String(teacherRemark);
        await upsertTermReportRemark(
          tenantId, Number(classId), Number(studentId), term, academicYear, 'teacher', value, userId
        );
        saved.teacherRemark = value;
      }
      // Headmaster remarks are only written by the headmaster role.
    }

    emitTenantDataChanged(tenantId, 'term-report-remark', 'updated');

    await archiveStudentReportCard(
      tenantId,
      Number(classId),
      Number(studentId),
      userId,
      signatures || undefined
    ).catch((err) => {
      console.error('Report card archive on save error:', err);
    });

    res.json({ message: 'Term report remarks saved', ...saved });
  } catch (error) {
    console.error('Save term report remarks error:', error);
    res.status(500).json({ error: 'Failed to save term report remarks' });
  }
});

router.post('/sync-report-signatures', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const role = String(req.user!.role || '').toLowerCase();
    const { classId, signatures } = req.body;
    if (!classId) return res.status(400).json({ error: 'classId required' });

    if (signatures?.classTeacherSig && (role === 'teacher' || role === 'staff')) {
      try {
        await assertMainClassTeacher(tenantId, Number(classId), req.user!.teacherId != null ? Number(req.user!.teacherId) : null);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        return res.status(err.status || 403).json({ error: err.message || 'Forbidden' });
      }
    }

    const result = await archiveClassReportCardsOnRelease(
      tenantId,
      Number(classId),
      userId,
      signatures || undefined
    );
    res.json({ message: 'Report card signatures synced to records', ...result });
  } catch (error) {
    console.error('Sync report signatures error:', error);
    res.status(500).json({ error: 'Failed to sync report card signatures' });
  }
});

export default router;
