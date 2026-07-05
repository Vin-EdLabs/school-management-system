import express from 'express';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';
import { resolveSchoolDisplayName } from '../services/schoolBrandingService.js';
import { archiveClassReportCardsOnRelease, archiveStudentReportCard, validateClassReportReadyForRelease, resolveArchiveSignatures, buildTermReportData } from '../services/reportCardArchiveService.js';
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

    let sql = `SELECT ga.id, ga.class_id, ga.subject, ga.subject_id, ga.name, ga.assignment_type,
                      ga.max_score, ga.max_marks, ga.is_exam, ga.component_id, ga.due_date,
                      ga.created_at, ga.term, ga.academic_year, gcc.name AS component_name
               FROM grade_assignments ga
               LEFT JOIN grade_config_components gcc ON gcc.id = ga.component_id
               WHERE ga.tenant_id = $1 AND ga.class_id = $2 AND ga.term = $3 AND ga.academic_year = $4`;
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

    const role = String(req.user!.role || '').toLowerCase();
    const isSchoolAdmin = role === 'administrator' || role === 'super-admin' || role === 'headmaster';
    const isMainTeacher = await isMainClassTeacher(
      tenantId,
      Number(classId),
      req.user!.teacherId != null ? Number(req.user!.teacherId) : null
    );

    let subjectIdFilter: Set<number> | undefined;
    if (!isSchoolAdmin && (role === 'teacher' || role === 'staff') && !isMainTeacher) {
      const { attachGradeAccessContext } = await import('../middleware/requireGradeAccess.js');
      await attachGradeAccessContext(req);
      if (req.gradeAccessRole === 'denied') {
        return res.status(403).json({ error: 'You do not have access to term reports' });
      }
      const allowed = (req.allowedSubjectClassPairs || [])
        .filter((p) => p.classId === Number(classId))
        .map((p) => p.subjectId);
      if (allowed.length === 0) {
        return res.json({
          students: [],
          subjects: [],
          assignments: [],
          assignmentsBySubject: {},
          className: '',
          classScoreWeight: 50,
          examWeight: 50,
        });
      }
      subjectIdFilter = new Set(allowed);
    } else if (role === 'finance') {
      return res.status(403).json({ error: 'You do not have access to term reports' });
    }

    const built = await buildTermReportData(
      tenantId,
      Number(classId),
      undefined,
      undefined,
      subjectIdFilter ? { subjectIdFilter } : undefined
    );

    if (!built) {
      return res.json({ students: [], subjects: [], assignments: [], className: '', assignmentsBySubject: {} });
    }

    const releaseRes = await query(
      `SELECT is_released, released_at, u.username AS released_by_name
       FROM term_report_releases r
       LEFT JOIN users u ON r.released_by = u.id
       WHERE r.tenant_id = $1 AND r.class_id = $2 AND r.term = $3`,
      [tenantId, classId, built.currentTerm]
    );
    const releaseInfo = releaseRes.rows[0] || null;

    const reportSignatures = await resolveArchiveSignatures(tenantId, Number(classId));

    return res.json({
      students: built.students,
      subjects: built.subjects,
      assignments: built.assignments,
      assignmentsBySubject: built.assignmentsBySubject,
      className: built.className,
      currentTerm: built.currentTerm,
      currentYear: built.currentYear,
      schoolName: built.schoolName,
      gradeScale: built.gradeScale,
      classScoreWeight: built.classScoreWeight,
      examWeight: built.examWeight,
      gradeBoundaries: built.gradeBoundaries,
      teacherRemarks: built.teacherRemarks,
      headmasterRemarks: built.headmasterRemarks,
      headmasterName: built.headmasterName,
      headmasterTitle: built.headmasterTitle,
      attendanceSummary: built.attendanceSummary,
      classAttendanceTotalDays: built.classAttendanceTotalDays,
      isReleased: releaseInfo?.is_released ?? false,
      releasedAt: releaseInfo?.released_at ?? built.releasedAt ?? null,
      releasedByName: releaseInfo?.released_by_name ?? null,
      isMainClassTeacherForUser: isMainTeacher,
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
