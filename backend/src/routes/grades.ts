import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';

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

// ── Assignments ──────────────────────────────────────────────────────────────

// Get assignments for a class (optionally filtered by subject)
router.get('/assignments', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, subject } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId required' });

    let sql = `SELECT id, class_id, subject, name, assignment_type, max_score, due_date, created_at
               FROM grade_assignments
               WHERE tenant_id = $1 AND class_id = $2`;
    const params: any[] = [tenantId, classId];

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

    const result = await query(
      `SELECT DISTINCT subject FROM grade_assignments
       WHERE tenant_id = $1 AND class_id = $2
       ORDER BY subject`,
      [tenantId, classId]
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
    const result = await query(
      `INSERT INTO grade_assignments (tenant_id, class_id, subject, name, assignment_type, max_score, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, classId, subject.trim(), name.trim(), assignmentType || 'Test', parseFloat(maxScore) || 100, dueDate || null]
    );
    emitTenantDataChanged(tenantId, 'grade-assignment', 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Delete assignment
router.delete('/assignments/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await query(
      'DELETE FROM grade_assignments WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );
    emitTenantDataChanged(tenantId, 'grade-assignment', 'deleted');
    res.json({ message: 'Assignment deleted' });
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
      result = await query(
        `SELECT ${gradeSelect}
         FROM student_grades g
         JOIN students s ON g.student_id = s.id AND s.tenant_id = g.tenant_id
         JOIN grade_assignments a ON g.assignment_id = a.id
         LEFT JOIN users u ON g.graded_by = u.id
         WHERE g.tenant_id = $1 AND a.class_id = $2
         ORDER BY a.subject, a.name, s.first_name, s.last_name`,
        [tenantId, classId]
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

    // 1. All assignments for this class grouped by subject
    const assignmentsRes = await query(
      `SELECT id, subject, name, assignment_type, max_score
       FROM grade_assignments
       WHERE tenant_id = $1 AND class_id = $2
       ORDER BY subject, assignment_type, name`,
      [tenantId, classId]
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
      const subjectScores: Record<string, { score: number; maxScore: number }> = {};
      let grandTotal = 0;
      let grandMax = 0;

      for (const subj of subjectOrder) {
        const subjectAssignments = assignmentsBySubject[subj];
        let subjectScore = 0;
        let subjectMax = 0;
        for (const a of subjectAssignments) {
          const scored = gradeMap[s.id]?.[a.id] ?? 0;
          subjectScore += scored;
          subjectMax += parseFloat(a.max_score);
        }
        subjectScores[subj] = { score: subjectScore, maxScore: subjectMax };
        grandTotal += subjectScore;
        grandMax += subjectMax;
      }

      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        admissionNumber: s.admission_number,
        passportPhotoUrl: s.passport_photo_url || null,
        hasMoved: s.hasMoved,
        subjectScores,
        grandTotal: Math.round(grandTotal * 100) / 100,
        grandMax: Math.round(grandMax * 100) / 100,
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
      'SELECT current_term, current_year, school_name FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term || '';
    const currentYear = settingsRes.rows[0]?.current_year || '';
    const schoolName = settingsRes.rows[0]?.school_name || '';

    // 11. Check release status
    const releaseRes = await query(
      `SELECT is_released, released_at, u.username AS released_by_name
       FROM term_report_releases r
       LEFT JOIN users u ON r.released_by = u.id
       WHERE r.tenant_id = $1 AND r.class_id = $2 AND r.term = $3`,
      [tenantId, classId, currentTerm]
    );
    const releaseInfo = releaseRes.rows[0] || null;

    return res.json({
      students: reportRows,
      subjects: subjectOrder,
      assignments,
      assignmentsBySubject,
      className,
      currentTerm,
      currentYear,
      schoolName,
      isReleased: releaseInfo?.is_released ?? false,
      releasedAt: releaseInfo?.released_at ?? null,
      releasedByName: releaseInfo?.released_by_name ?? null,
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
    const { classId, release } = req.body; // release: boolean
    if (!classId) return res.status(400).json({ error: 'classId required' });

    const settingsRes = await query(
      'SELECT current_term FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term;
    if (!currentTerm) return res.status(400).json({ error: 'No active term set' });

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
    res.json({ message: release !== false ? 'Report released to parents' : 'Report hidden from parents' });
  } catch (error) {
    console.error('Release report error:', error);
    res.status(500).json({ error: 'Failed to update report release status' });
  }
});

export default router;
