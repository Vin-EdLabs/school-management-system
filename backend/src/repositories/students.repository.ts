import { query } from "../config/db.js";

export async function createStudent(payload: any) {
  const res = await query(
    `INSERT INTO students (
      first_name, last_name, admission_no, class_id, status,
      gender, date_of_birth, nationality, date_of_admission,
      guardian_name, guardian_contact, home_address,
      previous_school, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      payload.first_name,
      payload.last_name,
      payload.admission_no ?? null,
      payload.class_id ?? null,
      payload.status ?? "active",
      payload.gender ?? null,
      payload.date_of_birth ?? null,
      payload.nationality ?? null,
      payload.date_of_admission ?? null,
      payload.guardian_name ?? null,
      payload.guardian_contact ?? null,
      payload.home_address ?? null,
      payload.previous_school ?? null,
      payload.notes ?? null,
    ],
  );
  return res.rows[0];
}

export async function findStudentById(id: number) {
  const res = await query("SELECT * FROM students WHERE id = $1 LIMIT 1", [id]);
  return res.rows[0];
}

export async function updateStudent(id: number, payload: any) {
  const fields = [
    "first_name",
    "last_name",
    "admission_no",
    "class_id",
    "status",
    "gender",
    "date_of_birth",
    "nationality",
    "date_of_admission",
    "guardian_name",
    "guardian_contact",
    "home_address",
    "previous_school",
    "notes"
  ];

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, f)) {
      updates.push(`${f} = $${idx++}`);
      values.push((payload as any)[f]);
    }
  }

  if (updates.length === 0) {
    return findStudentById(id);
  }

  values.push(id);
  const sql = `UPDATE students SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
  const res = await query(sql, values);
  return res.rows[0];
}

export async function searchStudents(q: string) {
  const res = await query(
    "SELECT * FROM students WHERE first_name ILIKE $1 OR last_name ILIKE $1 LIMIT 100",
    ["%" + q + "%"],
  );
  return res.rows;
}

export async function listStudents(limit = 1000) {
  const res = await query("SELECT * FROM students ORDER BY id DESC LIMIT $1", [
    limit,
  ]);
  return res.rows;
}

export async function getMaxAdmissionSequence(prefix: string) {
  // prefix should include the leading part, e.g. 'ADM2024'
  const res = await query(
    "SELECT MAX(CAST(SUBSTRING(admission_no FROM '\\d+$') AS INTEGER)) AS max_seq FROM students WHERE admission_no LIKE $1",
    [prefix + "%"],
  );
  return res.rows[0]?.max_seq ?? null;
}
