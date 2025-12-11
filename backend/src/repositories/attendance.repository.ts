import { query } from '../config/db.js';

interface AttendancePayload {
  class_id: number;
  student_id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_by: number;
  notes?: string;
}

export async function markAttendance(payload: AttendancePayload) {
  const { class_id, student_id, attendance_date, status, marked_by, notes } = payload;
  
  const res = await query(
    `INSERT INTO attendance (class_id, student_id, attendance_date, status, marked_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (student_id, attendance_date)
     DO UPDATE SET
       class_id = EXCLUDED.class_id,
       status = EXCLUDED.status,
       marked_by = EXCLUDED.marked_by,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    [class_id, student_id, attendance_date, status, marked_by, notes || null]
  );
  
  return res.rows[0];
}

export async function bulkMarkAttendance(records: AttendancePayload[]) {
  if (records.length === 0) return [];

  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  records.forEach((record) => {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
    );
    values.push(
      record.class_id,
      record.student_id,
      record.attendance_date,
      record.status,
      record.marked_by,
      record.notes || null
    );
    paramIndex += 6;
  });

  const res = await query(
    `INSERT INTO attendance (class_id, student_id, attendance_date, status, marked_by, notes)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (student_id, attendance_date)
     DO UPDATE SET
       class_id = EXCLUDED.class_id,
       status = EXCLUDED.status,
       marked_by = EXCLUDED.marked_by,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    values
  );

  return res.rows;
}

export async function getAttendanceByClass(classId: number, date: string) {
  const res = await query(
    `SELECT a.*, s.first_name, s.last_name, s.admission_no
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.class_id = $1 AND a.attendance_date = $2
     ORDER BY s.last_name, s.first_name`,
    [classId, date]
  );
  return res.rows;
}

export async function getAttendanceByStudent(studentId: number, startDate?: string, endDate?: string) {
  let sql = `SELECT * FROM attendance WHERE student_id = $1`;
  const params: any[] = [studentId];

  if (startDate) {
    params.push(startDate);
    sql += ` AND attendance_date >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    sql += ` AND attendance_date <= $${params.length}`;
  }

  sql += ` ORDER BY attendance_date DESC`;

  const res = await query(sql, params);
  return res.rows;
}

export async function getAttendanceByDateRange(classId: number, startDate: string, endDate: string) {
  const res = await query(
    `SELECT a.*, s.first_name, s.last_name, s.admission_no
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.class_id = $1 
       AND a.attendance_date >= $2 
       AND a.attendance_date <= $3
     ORDER BY a.attendance_date DESC, s.last_name, s.first_name`,
    [classId, startDate, endDate]
  );
  return res.rows;
}

export async function deleteAttendance(id: number) {
  await query('DELETE FROM attendance WHERE id = $1', [id]);
  return { deleted: true };
}

export default {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceByClass,
  getAttendanceByStudent,
  getAttendanceByDateRange,
  deleteAttendance
};
