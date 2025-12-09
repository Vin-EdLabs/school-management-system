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

async function detectUserNameSelect() {
  // prefer display_name, then full_name, then username, then first_name+last_name
  const res = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('display_name','full_name','username','first_name','last_name')`
  );
  const cols = (res.rows || []).map((r: any) => r.column_name);
  if (cols.includes('display_name')) return `u.display_name as teacher_name`;
  if (cols.includes('full_name')) return `u.full_name as teacher_name`;
  if (cols.includes('username')) return `u.username as teacher_name`;
  if (cols.includes('first_name') && cols.includes('last_name')) return `(u.first_name || ' ' || u.last_name) as teacher_name`;
  // fallback: username alias (may be null if missing)
  return `u.username as teacher_name`;
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
  // build a robust class_name that falls back to level+stream or 'Class {id}' when a title column is absent
  let classSelect: string;
  if (titleCol) {
    classSelect = `COALESCE(c."${titleCol}", (CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END)) as class_name, c.level, c.stream`;
  } else {
    classSelect = `(CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END) as class_name, c.level, c.stream`;
  }
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
  const classSelect = titleCol
    ? `COALESCE(c."${titleCol}", (CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END)) as class_name`
    : `(CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END) as class_name`;
  const sql = `SELECT s.*, ${classSelect}, u.username as teacher_username FROM schedules s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.teacher_id ORDER BY s.day_of_week, s.start_time`;
  const res = await query(sql);
  return res.rows;
}

export async function findConflicts({ class_id, teacher_id, room, day_of_week, start_time, end_time, subject, excludeId }: any) {
  const conflicts: any[] = [];
  // normalize
  const dow = typeof day_of_week !== 'undefined' ? day_of_week : 0;

  // Helper: overlapping when NOT (existing.end_time <= new.start_time OR existing.start_time >= new.end_time)
  const overlapClause = `NOT (end_time <= $3 OR start_time >= $4)`;

  // detect class title column and user name select for nicer messages
  const titleCol = await detectClassTitleColumn();
  const classSelect = titleCol
    ? `COALESCE(c."${titleCol}", (CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END)) as class_name, c.level, c.stream`
    : `(CASE WHEN c.level IS NOT NULL THEN c.level || COALESCE(' ' || c.stream, '') ELSE 'Class ' || c.id::text END) as class_name, c.level, c.stream`;
  const teacherSelect = await detectUserNameSelect();

  // build a proposed object (labels for the incoming schedule) so the API can report both sides
  const proposed: any = { class_id: class_id ?? null, teacher_id: teacher_id ?? null, room: room ?? null, day_of_week: dow, start_time, end_time, subject: subject ?? null };
  if (class_id != null) {
    try {
      const clsRes = await query(`SELECT ${titleCol ? `COALESCE(${titleCol ? `"${titleCol}"` : "'',"} , (CASE WHEN level IS NOT NULL THEN level || COALESCE(' ' || stream, '') ELSE 'Class ' || id::text END)) as class_name, level, stream` : `(CASE WHEN level IS NOT NULL THEN level || COALESCE(' ' || stream, '') ELSE 'Class ' || id::text END) as class_name, level, stream`} FROM classes WHERE id = $1 LIMIT 1`, [class_id]);
      if (clsRes.rows && clsRes.rows[0]) {
        proposed.class_name = clsRes.rows[0].class_name;
        proposed.level = clsRes.rows[0].level;
        proposed.stream = clsRes.rows[0].stream;
      }
    } catch (e) {
      // ignore label enrichment errors
    }
  }
  if (teacher_id != null) {
    try {
      const thSel = teacherSelect.replace('u.', 'u.');
      const tSql = `SELECT ${thSel}, u.username as teacher_username FROM users u WHERE u.id = $1 LIMIT 1`;
      const tRes = await query(tSql, [teacher_id]);
      if (tRes.rows && tRes.rows[0]) {
        proposed.teacher_name = tRes.rows[0].teacher_name;
        proposed.teacher_username = tRes.rows[0].teacher_username;
      }
    } catch (e) {
      // ignore
    }
  }

  if (class_id != null) {
    const params: any[] = [dow, class_id, start_time, end_time];
    let sql = `SELECT s.*, ${classSelect}, ${teacherSelect}, u.username as teacher_username FROM schedules s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.teacher_id WHERE s.day_of_week = $1 AND s.class_id = $2 AND ${overlapClause}`;
    if (excludeId) { sql += ' AND s.id <> $5'; params.push(excludeId); }
    const res = await query(sql, params);
    res.rows.forEach((r: any) => conflicts.push({ type: 'class', existing: r, proposed }));
  }

  if (teacher_id != null) {
    const params: any[] = [dow, teacher_id, start_time, end_time];
    let sql = `SELECT s.*, ${classSelect}, ${teacherSelect}, u.username as teacher_username FROM schedules s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.teacher_id WHERE s.day_of_week = $1 AND s.teacher_id = $2 AND ${overlapClause}`;
    if (excludeId) { sql += ' AND s.id <> $5'; params.push(excludeId); }
    const res = await query(sql, params);
    res.rows.forEach((r: any) => conflicts.push({ type: 'teacher', existing: r, proposed }));
  }

  if (room != null) {
    const params: any[] = [dow, room, start_time, end_time];
    // room is text; compare on room
    let sql = `SELECT s.*, ${classSelect}, ${teacherSelect}, u.username as teacher_username FROM schedules s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.teacher_id WHERE s.day_of_week = $1 AND s.room = $2 AND ${overlapClause}`;
    if (excludeId) { sql += ' AND s.id <> $5'; params.push(excludeId); }
    const res = await query(sql, params);
    res.rows.forEach((r: any) => conflicts.push({ type: 'room', existing: r, proposed }));
  }

  return conflicts;
}

export default { createSchedule, updateSchedule, deleteSchedule, listSchedulesByTeacher, listSchedulesByClass, listAllSchedules };
