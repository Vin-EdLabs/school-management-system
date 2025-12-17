import { query } from '../config/db.js';

export async function createExamType(payload: { name: string; weight?: number; created_by?: number }) {
  const res = await query(
    `INSERT INTO exam_types (name, weight, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [payload.name, payload.weight || 0, payload.created_by || null]
  );
  return res.rows[0];
}

export async function listExamTypes() {
  const res = await query(`SELECT * FROM exam_types ORDER BY id`);
  return res.rows;
}

export async function createExam(payload: any) {
  const { exam_type_id, class_id, subject_id, term, exam_date, created_by } = payload;
  const res = await query(
    `INSERT INTO exams (exam_type_id, class_id, subject_id, term, exam_date, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [exam_type_id || null, class_id || null, subject_id || null, term || null, exam_date || null, created_by || null]
  );
  return res.rows[0];
}

export async function getExamById(id: number) {
  const res = await query(`SELECT * FROM exams WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0];
}

export async function listExams(filter: { classId?: number; subjectId?: number; term?: string } = {}) {
  let sql = `SELECT e.*, et.name as exam_type_name, s.name as subject_name, u.id as subject_teacher_id, u.username as subject_teacher_username
             FROM exams e
             LEFT JOIN exam_types et ON e.exam_type_id = et.id
             LEFT JOIN subjects s ON e.subject_id = s.id
             LEFT JOIN users u ON s.teacher_id = u.id`;
  const params: any[] = [];
  const where: string[] = [];
  if (filter.classId) { params.push(filter.classId); where.push(`e.class_id = $${params.length}`); }
  if (filter.subjectId) { params.push(filter.subjectId); where.push(`e.subject_id = $${params.length}`); }
  if (filter.term) { params.push(filter.term); where.push(`e.term = $${params.length}`); }
  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY e.exam_date DESC`;
  const res = await query(sql, params);
  return res.rows;
}

export async function lockExam(id: number, locked: boolean) {
  const res = await query(`UPDATE exams SET is_locked = $1 WHERE id = $2 RETURNING *`, [locked, id]);
  return res.rows[0];
}

export async function getGradesByExam(examId: number) {
  const res = await query(`
    SELECT g.*, s.first_name, s.last_name, s.admission_no,
           (s.first_name || ' ' || s.last_name) as student_name,
           e.max_score,
           gb.grade as grade
    FROM grades g
    JOIN students s ON g.student_id = s.id
    LEFT JOIN exams e ON g.exam_id = e.id
    LEFT JOIN grade_boundaries gb ON g.score IS NOT NULL
      AND g.score >= gb.min AND g.score <= gb.max
      AND gb.class_id IS NULL -- use global/school-wide boundaries by default
    WHERE g.exam_id = $1
    ORDER BY s.last_name, s.first_name
  `, [examId]);
  return res.rows;
}

export async function upsertGrades(examId: number, records: Array<any>, userId?: number) {
  if (!records || records.length === 0) return [];
  // Build bulk upsert
  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;
  for (const r of records) {
    // Accept both snake_case (`student_id`) and camelCase (`studentId`) from client payloads
    const studentId = (r.student_id ?? r.studentId) ?? null;
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(examId, studentId, r.score ?? null, r.status ?? 'OK', r.remarks ?? null);
  }
  const sql = `INSERT INTO grades (exam_id, student_id, score, status, remarks) VALUES ${placeholders.join(', ')}
    ON CONFLICT (exam_id, student_id) DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_at = NOW()
    RETURNING *`;
  const res = await query(sql, values);
  // Optionally insert audit rows could be added here
  return res.rows;
}

export async function updateGrade(gradeId: number, patch: any, userId?: number) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const key of ['score', 'status', 'remarks']) {
    if (patch[key] !== undefined) { fields.push(`${key} = $${idx++}`); params.push(patch[key]); }
  }
  if (fields.length === 0) return null;
  params.push(gradeId);
  const sql = `UPDATE grades SET ${fields.join(', ')}, updated_at = NOW(), updated_by = $${idx} WHERE id = $${idx+1} RETURNING *`;
  const res = await query(sql, params.concat([userId || null, gradeId]));
  return res.rows[0];
}

export async function deleteGrade(gradeId: number) {
  await query(`DELETE FROM grades WHERE id = $1`, [gradeId]);
  return { deleted: true };
}

export async function examAnalytics(examId: number) {
  const res = await query(`
    SELECT COUNT(*) as total,
           AVG(score)::numeric(10,2) as average,
           MAX(score) as highest,
           MIN(score) as lowest,
           SUM(CASE WHEN score >= 0 AND score IS NOT NULL THEN 1 ELSE 0 END) FILTER (WHERE score >= 50) as passed
    FROM grades WHERE exam_id = $1
  `, [examId]);
  return res.rows[0];
}

export default {
  createExamType,
  listExamTypes,
  createExam,
  getExamById,
  listExams,
  lockExam,
  getGradesByExam,
  upsertGrades,
  updateGrade,
  deleteGrade,
  examAnalytics
};
