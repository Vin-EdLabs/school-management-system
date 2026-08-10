import { query } from '../db/connection.js';

export type DormLayoutBed = {
  id: number;
  bed_number: string;
  is_occupied: boolean;
  student: {
    id: number;
    first_name: string;
    last_name: string;
    class_name: string | null;
    passport_photo_url: string | null;
    outstanding: number;
    on_exeat: boolean;
    in_sick_bay: boolean;
  } | null;
};

export type DormLayoutRoom = {
  id: number;
  room_name: string;
  beds: DormLayoutBed[];
};

export type DormLayoutSection = {
  dorm_id: number;
  dorm_name: string;
  gender: string;
  rooms: DormLayoutRoom[];
};

/** Fast dorm layout — batched queries, no per-bed ledger calls. */
export async function buildDormLayout(tenantId: number, termId: number | null): Promise<{
  boys: DormLayoutSection[];
  girls: DormLayoutSection[];
}> {
  const bedsRes = await query(
    `SELECT bb.id, bb.bed_number, bb.is_occupied,
       br.id AS room_id, br.room_name,
       bd.id AS dorm_id, bd.name AS dorm_name, bd.gender,
       s.id AS student_id, s.first_name, s.last_name, s.passport_photo_url,
       c.class_name
     FROM boarding_beds bb
     JOIN boarding_rooms br ON bb.room_id = br.id
     JOIN boarding_dorms bd ON br.dorm_id = bd.id
     LEFT JOIN boarding_enrollments be ON be.bed_id = bb.id
       AND be.tenant_id = $1 AND be.status = 'boarder'
       AND ($2::int IS NULL OR be.term_id = $2)
     LEFT JOIN students s ON be.student_id = s.id
     LEFT JOIN classes c ON s.class_assigned_id = c.id
     WHERE bd.tenant_id = $1
     ORDER BY bd.gender, bd.name, br.room_name, bb.bed_number`,
    [tenantId, termId]
  );

  const studentIds = [
    ...new Set(
      bedsRes.rows
        .filter((r) => r.student_id)
        .map((r) => Number(r.student_id))
    ),
  ];

  const exeatSet = new Set<number>();
  const sickSet = new Set<number>();

  if (studentIds.length > 0) {
    const [exeatRes, sickRes] = await Promise.all([
      query(
        `SELECT DISTINCT student_id FROM boarding_exeats
         WHERE tenant_id = $1 AND student_id = ANY($2::int[])
           AND status IN ('approved', 'signed_out', 'overdue')
           AND departure_date <= CURRENT_DATE
           AND COALESCE(actual_return_date, return_date) >= CURRENT_DATE`,
        [tenantId, studentIds]
      ),
      query(
        `SELECT DISTINCT student_id FROM boarding_sick_bay
         WHERE tenant_id = $1 AND student_id = ANY($2::int[]) AND status = 'resting'`,
        [tenantId, studentIds]
      ),
    ]);
    for (const row of exeatRes.rows) exeatSet.add(Number(row.student_id));
    for (const row of sickRes.rows) sickSet.add(Number(row.student_id));
  }

  const dormMap = new Map<number, DormLayoutSection>();
  const roomMap = new Map<string, DormLayoutRoom>();

  for (const row of bedsRes.rows) {
    const dormId = Number(row.dorm_id);
    if (!dormMap.has(dormId)) {
      dormMap.set(dormId, {
        dorm_id: dormId,
        dorm_name: row.dorm_name,
        gender: row.gender,
        rooms: [],
      });
    }

    const roomKey = `${dormId}:${row.room_id}`;
    if (!roomMap.has(roomKey)) {
      const room: DormLayoutRoom = {
        id: Number(row.room_id),
        room_name: row.room_name,
        beds: [],
      };
      roomMap.set(roomKey, room);
      dormMap.get(dormId)!.rooms.push(room);
    }

    let student: DormLayoutBed['student'] = null;
    if (row.is_occupied && row.student_id) {
      const sid = Number(row.student_id);
      student = {
        id: sid,
        first_name: row.first_name,
        last_name: row.last_name,
        class_name: row.class_name,
        passport_photo_url: row.passport_photo_url,
        outstanding: 0,
        on_exeat: exeatSet.has(sid),
        in_sick_bay: sickSet.has(sid),
      };
    }

    roomMap.get(roomKey)!.beds.push({
      id: Number(row.id),
      bed_number: row.bed_number,
      is_occupied: Boolean(row.is_occupied),
      student,
    });
  }

  const boys: DormLayoutSection[] = [];
  const girls: DormLayoutSection[] = [];
  for (const section of dormMap.values()) {
    if (section.gender === 'girls') girls.push(section);
    else boys.push(section);
  }

  return { boys, girls };
}
