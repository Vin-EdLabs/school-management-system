import { query } from '../config/db.js';

async function detectClassTitleColumn() {
  // Check which column exists on the classes table and return a safe column name
  const res = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'classes' AND column_name IN ('name','class_name','title')`
  );
  if (!res.rows || res.rows.length === 0) return null;
  // prefer 'name' then 'class_name' then 'title' if multiple present
  const cols = res.rows.map((r: any) => r.column_name);
  if (cols.includes('name')) return 'name';
  if (cols.includes('class_name')) return 'class_name';
  if (cols.includes('title')) return 'title';
  return cols[0] || null;
}

export async function createSchedule(payload: any) {
  const res = await query(
    `INSERT INTO schedules (class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now()) RETURNING *`,
    [payload.class_id ?? null, payload.teacher_id ?? null, payload.day_of_week ?? 0, payload.start_time ?? null, payload.end_time ?? null, payload.room ?? null, payload.subject ?? null]
  );
  return res.rows[0];
}

export async function updateSchedule(id: number, payload: any) {
  await query(
    `UPDATE schedules SET class_id=$1, teacher_id=$2, day_of_week=$3, start_time=$4, end_time=$5, room=$6, subject=$7, updated_at=now() WHERE id=$8`,
    [payload.class_id ?? null, payload.teacher_id ?? null, payload.day_of_week ?? 0, payload.start_time ?? null, payload.end_time ?? null, payload.room ?? null, payload.subject ?? null, id]
  );
  const res = await query('SELECT * FROM schedules WHERE id=$1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function deleteSchedule(id: number) {
  await query('DELETE FROM schedules WHERE id=$1', [id]);
  return { deleted: true };
}

export async function listSchedulesByTeacher(teacherId: number) {
  const titleCol = await detectClassTitleColumn();
  const classSelect = titleCol ? `c."${titleCol}" as class_name, c.level, c.stream` : `c.level, c.stream`;
  const sql = `SELECT s.*, ${classSelect} FROM schedules s LEFT JOIN classes c ON c.id = s.class_id WHERE s.teacher_id = $1 ORDER BY s.day_of_week, s.start_time`;
  const res = await query(sql, [teacherId]);
  return res.rows;
}

export async function listSchedulesByClass(classId: number) {
  const res = await query('SELECT s.*, u.username as teacher_username FROM schedules s LEFT JOIN users u ON u.id = s.teacher_id WHERE s.class_id = $1 ORDER BY s.day_of_week, s.start_time', [classId]);
  return res.rows;
}

export async function listAllSchedules() {
  const titleCol = await detectClassTitleColumn();
  const classSelect = titleCol ? `c."${titleCol}" as class_name` : 'NULL as class_name';
  const sql = `SELECT s.*, ${classSelect}, u.username as teacher_username FROM schedules s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.teacher_id ORDER BY s.day_of_week, s.start_time`;
  const res = await query(sql);
  return res.rows;
}

export default { createSchedule, updateSchedule, deleteSchedule, listSchedulesByTeacher, listSchedulesByClass, listAllSchedules };
