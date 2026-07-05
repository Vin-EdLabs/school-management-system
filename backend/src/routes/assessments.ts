import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  attachGradeAccessContext,
  assertTeacherOwnsAssessment,
  isAdminGradeRole,
  teacherCanAccessSubjectClass,
} from '../middleware/requireGradeAccess.js';
import { getSchoolActiveTermYear } from '../services/gradesTermContext.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

async function resolveTermContext(
  tenantId: number,
  termIdRaw?: unknown
): Promise<{ term: string; academicYear: string; academicTermId: number | null }> {
  if (termIdRaw != null && String(termIdRaw).trim() !== '') {
    const termId = parseInt(String(termIdRaw), 10);
    const res = await query(
      `SELECT id, term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2`,
      [termId, tenantId]
    );
    if (res.rows.length === 0) {
      throw Object.assign(new Error('Academic term not found'), { status: 404 });
    }
    return {
      term: String(res.rows[0].term_name),
      academicYear: String(res.rows[0].year),
      academicTermId: termId,
    };
  }
  const active = await getSchoolActiveTermYear(tenantId);
  if (!active.term || !active.academicYear) {
    throw Object.assign(new Error('No active academic term is set'), { status: 400 });
  }
  const at = await query(
    `SELECT id FROM academic_terms WHERE tenant_id = $1 AND term_name = $2 AND year = $3 LIMIT 1`,
    [tenantId, active.term, active.academicYear]
  );
  return {
    term: active.term,
    academicYear: active.academicYear,
    academicTermId: at.rows[0]?.id != null ? Number(at.rows[0].id) : null,
  };
}

async function resolveSubject(tenantId: number, subjectId: number): Promise<{ id: number; name: string }> {
  const res = await query(`SELECT id, name FROM subjects WHERE id = $1 AND tenant_id = $2`, [
    subjectId,
    tenantId,
  ]);
  if (res.rows.length === 0) {
    throw Object.assign(new Error('Subject not found'), { status: 404 });
  }
  return { id: Number(res.rows[0].id), name: String(res.rows[0].name) };
}

function mapAssessmentRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    subject: row.subject,
    name: row.name,
    componentId: row.component_id,
    componentName: row.component_name,
    isExam: row.is_exam,
    maxMarks: row.max_marks ?? row.max_score,
    assignmentType: row.assignment_type,
    termId: row.academic_term_id,
    term: row.term,
    academicYear: row.academic_year,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to assessments' });
    }

    const classId = parseInt(String(req.query.classId || ''), 10);
    const subjectId = req.query.subjectId ? parseInt(String(req.query.subjectId), 10) : null;
    if (Number.isNaN(classId)) {
      return res.status(400).json({ error: 'classId required' });
    }

    const termCtx = await resolveTermContext(tenantId, req.query.termId);

    let sql = `
      SELECT ga.*, gcc.name AS component_name
      FROM grade_assignments ga
      LEFT JOIN grade_config_components gcc ON gcc.id = ga.component_id
      WHERE ga.tenant_id = $1 AND ga.class_id = $2
        AND ga.term = $3 AND ga.academic_year = $4`;
    const params: unknown[] = [tenantId, classId, termCtx.term, termCtx.academicYear];

    if (subjectId != null && !Number.isNaN(subjectId)) {
      params.push(subjectId);
      sql += ` AND ga.subject_id = $${params.length}`;
    }

    if (req.gradeAccessRole === 'teacher') {
      const pairs = req.allowedSubjectClassPairs || [];
      const allowedSubjectIds = pairs.filter((p) => p.classId === classId).map((p) => p.subjectId);
      if (allowedSubjectIds.length === 0) {
        return res.json([]);
      }
      params.push(allowedSubjectIds);
      sql += ` AND ga.subject_id = ANY($${params.length})`;
      params.push(req.user!.id);
      sql += ` AND ga.created_by = $${params.length}`;
    }

    sql += ' ORDER BY ga.is_exam, gcc.display_order NULLS LAST, ga.subject, ga.name';

    const result = await query(sql, params);
    res.json(result.rows.map(mapAssessmentRow));
  } catch (error: any) {
    console.error('GET assessments error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to fetch assessments' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to assessments' });
    }

    const { name, subjectId, classId, termId, componentId, isExam, maxMarks } = req.body;
    if (!name || !subjectId || !classId) {
      return res.status(400).json({ error: 'name, subjectId, and classId required' });
    }

    const subject = await resolveSubject(tenantId, Number(subjectId));
    const termCtx = await resolveTermContext(tenantId, termId);
    const examFlag = !!isExam;
    const max = parseFloat(String(maxMarks)) || 100;

    if (!isAdminGradeRole(req)) {
      const pairs = req.allowedSubjectClassPairs || [];
      if (!teacherCanAccessSubjectClass(pairs, subject.id, Number(classId))) {
        return res.status(403).json({ error: 'You are not assigned to this subject and class' });
      }
    }

    if (examFlag) {
      const dup = await query(
        `SELECT id FROM grade_assignments
         WHERE tenant_id = $1 AND class_id = $2 AND subject = $3
           AND term = $4 AND academic_year = $5 AND is_exam = TRUE`,
        [tenantId, classId, subject.name, termCtx.term, termCtx.academicYear]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({
          error: 'An End of Term Exam already exists for this subject this term',
        });
      }
    } else {
      if (!componentId) {
        return res.status(400).json({ error: 'componentId required for class score assessments' });
      }
      const comp = await query(
        `SELECT id FROM grade_config_components WHERE id = $1 AND tenant_id = $2`,
        [componentId, tenantId]
      );
      if (comp.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid component for this tenant' });
      }
    }

    const compRow = !examFlag
      ? await query(`SELECT name FROM grade_config_components WHERE id = $1`, [componentId])
      : { rows: [{ name: 'Exam' }] };

    const result = await query(
      `INSERT INTO grade_assignments (
         tenant_id, class_id, subject, subject_id, name, assignment_type,
         max_score, max_marks, due_date, term, academic_year, academic_term_id,
         component_id, is_exam, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        tenantId,
        classId,
        subject.name,
        subject.id,
        String(name).trim(),
        examFlag ? 'Exam' : String(compRow.rows[0]?.name || 'Test'),
        max,
        null,
        termCtx.term,
        termCtx.academicYear,
        termCtx.academicTermId,
        examFlag ? null : componentId,
        examFlag,
        req.user!.id,
      ]
    );

    const row = result.rows[0];
    const withComp = await query(
      `SELECT ga.*, gcc.name AS component_name
       FROM grade_assignments ga
       LEFT JOIN grade_config_components gcc ON gcc.id = ga.component_id
       WHERE ga.id = $1`,
      [row.id]
    );
    res.status(201).json(mapAssessmentRow(withComp.rows[0]));
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'An End of Term Exam already exists for this subject this term' });
    }
    console.error('POST assessments error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to create assessment' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to assessments' });
    }

    const existing = await query(
      `SELECT * FROM grade_assignments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const row = existing.rows[0];

    if (req.gradeAccessRole === 'teacher') {
      if (Number(row.created_by) !== Number(req.user!.id)) {
        return res.status(403).json({ error: 'You can only edit assessments you created' });
      }
      const pairs = req.allowedSubjectClassPairs || [];
      if (
        row.subject_id &&
        !teacherCanAccessSubjectClass(pairs, Number(row.subject_id), Number(row.class_id))
      ) {
        return res.status(403).json({ error: 'You are not assigned to this subject and class' });
      }
    }

    if (req.body.isExam !== undefined && !!req.body.isExam !== !!row.is_exam) {
      return res.status(400).json({ error: 'Cannot change exam flag after creation' });
    }

    const { name, maxMarks, componentId } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let n = 1;

    if (name !== undefined) {
      updates.push(`name = $${n++}`);
      values.push(String(name).trim());
    }
    if (maxMarks !== undefined) {
      const max = parseFloat(String(maxMarks));
      updates.push(`max_score = $${n++}`, `max_marks = $${n++}`);
      values.push(max, max);
    }
    if (componentId !== undefined && !row.is_exam) {
      updates.push(`component_id = $${n++}`);
      values.push(componentId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id, tenantId);
    await query(
      `UPDATE grade_assignments SET ${updates.join(', ')} WHERE id = $${n++} AND tenant_id = $${n}`,
      values
    );

    const refreshed = await query(
      `SELECT ga.*, gcc.name AS component_name
       FROM grade_assignments ga
       LEFT JOIN grade_config_components gcc ON gcc.id = ga.component_id
       WHERE ga.id = $1`,
      [id]
    );
    res.json(mapAssessmentRow(refreshed.rows[0]));
  } catch (error: any) {
    console.error('PUT assessment error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to update assessment' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to assessments' });
    }

    const existing = await query(
      `SELECT * FROM grade_assignments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const row = existing.rows[0];

    if (req.gradeAccessRole === 'teacher') {
      if (Number(row.created_by) !== Number(req.user!.id)) {
        return res.status(403).json({ error: 'You can only delete assessments you created' });
      }
    }

    const scored = await query(
      `SELECT 1 FROM student_grades WHERE assignment_id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, tenantId]
    );
    if (scored.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete an assessment that already has scores entered' });
    }

    await query(`DELETE FROM grade_assignments WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('DELETE assessment error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to delete assessment' });
  }
});

router.get('/:assessmentId/scores', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const assessmentId = parseInt(req.params.assessmentId, 10);
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to scores' });
    }

    const aRes = await query(
      `SELECT * FROM grade_assignments WHERE id = $1 AND tenant_id = $2`,
      [assessmentId, tenantId]
    );
    if (aRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const assessment = aRes.rows[0];

    const accessError = assertTeacherOwnsAssessment(req, assessment);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    const scores = await query(
      `SELECT sg.student_id, sg.raw_score, sg.score, s.first_name, s.last_name, s.student_id AS admission_number
       FROM student_grades sg
       JOIN students s ON s.id = sg.student_id AND s.tenant_id = sg.tenant_id
       WHERE sg.tenant_id = $1 AND sg.assignment_id = $2
         AND COALESCE(s.enrollment_status, 'active') = 'active'`,
      [tenantId, assessmentId]
    );

    res.json({
      assessmentId,
      maxMarks: assessment.max_marks ?? assessment.max_score,
      scores: scores.rows.map((r) => ({
        studentId: r.student_id,
        studentName: `${r.first_name} ${r.last_name}`.trim(),
        admissionNumber: r.admission_number,
        rawScore: r.raw_score ?? r.score,
      })),
    });
  } catch (error: any) {
    console.error('GET scores error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to fetch scores' });
  }
});

router.put('/:assessmentId/scores', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const assessmentId = parseInt(req.params.assessmentId, 10);
    const { scores } = req.body as { scores: Array<{ studentId: number; rawScore: number }> };
    await attachGradeAccessContext(req);
    if (req.gradeAccessRole === 'denied') {
      return res.status(403).json({ error: 'You do not have access to scores' });
    }

    if (!Array.isArray(scores)) {
      return res.status(400).json({ error: 'scores array required' });
    }

    const aRes = await query(
      `SELECT * FROM grade_assignments WHERE id = $1 AND tenant_id = $2`,
      [assessmentId, tenantId]
    );
    if (aRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const assessment = aRes.rows[0];
    const maxMarks = Number(assessment.max_marks ?? assessment.max_score) || 100;

    const accessError = assertTeacherOwnsAssessment(req, assessment);
    if (accessError) {
      return res.status(403).json({ error: accessError });
    }

    for (const entry of scores) {
      const raw = Number(entry.rawScore);
      if (Number.isNaN(raw) || raw < 0) {
        return res.status(400).json({ error: `Invalid score for student ${entry.studentId}` });
      }
      if (raw > maxMarks) {
        return res.status(400).json({
          error: `Score ${raw} exceeds max marks ${maxMarks} for student ${entry.studentId}`,
        });
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const entry of scores) {
        await client.query(
          `INSERT INTO student_grades (tenant_id, student_id, assignment_id, score, raw_score, graded_by, updated_at)
           VALUES ($1, $2, $3, $4, $4, $5, NOW())
           ON CONFLICT (tenant_id, student_id, assignment_id)
           DO UPDATE SET score = EXCLUDED.score, raw_score = EXCLUDED.raw_score,
                         graded_by = EXCLUDED.graded_by, updated_at = NOW()`,
          [tenantId, entry.studentId, assessmentId, entry.rawScore, req.user!.id]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, count: scores.length });
  } catch (error: any) {
    console.error('PUT scores error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to save scores' });
  }
});

export default router;
