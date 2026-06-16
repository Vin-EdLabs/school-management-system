import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';

export type TeacherUserRow = {
  id: number;
  staff_id: string;
  full_name: string;
  email?: string | null;
};

async function findUserByUsername(username: string): Promise<{ id: number; tenant_id: number; teacher_id: string | null } | null> {
  const res = await query(
    `SELECT id, tenant_id, teacher_id FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as { id: number; tenant_id: number; teacher_id: string | null };
}

/** Pick a login username — staff_id when free globally, else tenant-scoped. */
async function resolveTeacherUsername(tenantId: number, staffId: string): Promise<string> {
  const base = staffId.trim();
  const existing = await findUserByUsername(base);
  if (!existing || existing.tenant_id === tenantId) return base;
  const scoped = `t${tenantId}_${base}`;
  const scopedExisting = await findUserByUsername(scoped);
  if (!scopedExisting || scopedExisting.tenant_id === tenantId) return scoped;
  return `t${tenantId}_${base}_${Date.now().toString(36).slice(-4)}`;
}

/** Ensure a teachers row has a linked login in users. Default password = staff_id. */
export async function ensureTeacherUserAccount(
  tenantId: number,
  teacher: TeacherUserRow
): Promise<{ created: boolean; userId?: number }> {
  const teacherId = String(teacher.id);
  const staffId = String(teacher.staff_id || '').trim();
  if (!staffId) return { created: false };

  const existingByTeacher = await query(
    `SELECT id, username FROM users
     WHERE tenant_id = $1 AND teacher_id::text = $2`,
    [tenantId, teacherId]
  );
  if (existingByTeacher.rows.length > 0) {
    const userId = Number(existingByTeacher.rows[0].id);
    await query(
      `UPDATE users
       SET full_name = $1,
           email = COALESCE($2, email),
           role = 'teacher',
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [teacher.full_name, teacher.email || null, userId]
    );
    return { created: false, userId };
  }

  const username = await resolveTeacherUsername(tenantId, staffId);
  const existingByUsername = await findUserByUsername(username);
  if (existingByUsername && existingByUsername.tenant_id === tenantId) {
    const userId = existingByUsername.id;
    await query(
      `UPDATE users
       SET teacher_id = $1,
           full_name = $2,
           email = COALESCE($3, email),
           role = 'teacher',
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [teacherId, teacher.full_name, teacher.email || null, userId]
    );
    return { created: false, userId };
  }

  const passwordHash = await bcrypt.hash(staffId, 10);
  const inserted = await query(
    `INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id, is_active)
     VALUES ($1, $2, $3, $4, $5, 'teacher', $6, true)
     RETURNING id`,
    [tenantId, username, teacher.full_name, teacher.email || null, passwordHash, teacherId]
  );

  return { created: true, userId: Number(inserted.rows[0]?.id) };
}

/** Backfill user accounts for all teachers missing a linked login. */
export async function ensureAllTeacherUserAccounts(tenantId: number): Promise<number> {
  const teachers = await query(
    `SELECT t.id, t.staff_id, t.full_name, t.email
     FROM teachers t
     WHERE t.tenant_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM users u
         WHERE u.tenant_id = t.tenant_id AND u.teacher_id::text = t.id::text
       )
     ORDER BY t.id ASC`,
    [tenantId]
  );

  let created = 0;
  for (const row of teachers.rows as TeacherUserRow[]) {
    try {
      const result = await ensureTeacherUserAccount(tenantId, row);
      if (result.created) created++;
    } catch (err) {
      console.warn(`[ensureTeacherUserAccount] teacher ${row.id} (${row.staff_id}):`, (err as Error).message);
    }
  }
  return created;
}
