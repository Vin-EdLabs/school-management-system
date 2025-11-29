import { query } from '../config/db.js';

export async function createEvent(payload: any) {
  const res = await query(
    'INSERT INTO events (title, date, time, description, color, category, reminder, reminder_time, location, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [
      payload.title,
      payload.date ? new Date(payload.date) : new Date(),
      payload.time ?? null,
      payload.description ?? null,
      payload.color ?? null,
      payload.category ?? null,
      payload.reminder ?? false,
      payload.reminder_time ?? payload.reminderTime ?? null,
      payload.location ?? null,
      JSON.stringify(payload.meta ?? {}),
    ]
  );
  return res.rows[0];
}

export async function listEvents(limit = 1000) {
  const res = await query('SELECT * FROM events ORDER BY date ASC LIMIT $1', [limit]);
  return res.rows;
}

export async function getEventById(id: number) {
  const res = await query('SELECT * FROM events WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function updateEvent(id: number, payload: any) {
  await query(
    'UPDATE events SET title=$1, date=$2, time=$3, description=$4, color=$5, category=$6, reminder=$7, reminder_time=$8, location=$9, meta=$10 WHERE id=$11',
    [
      payload.title,
      payload.date ? new Date(payload.date) : null,
      payload.time ?? null,
      payload.description ?? null,
      payload.color ?? null,
      payload.category ?? null,
      payload.reminder ?? false,
      payload.reminder_time ?? payload.reminderTime ?? null,
      payload.location ?? null,
      JSON.stringify(payload.meta ?? {}),
      id,
    ]
  );
  return getEventById(id);
}

export async function deleteEvent(id: number) {
  await query('DELETE FROM events WHERE id = $1', [id]);
  return { deleted: true };
}
