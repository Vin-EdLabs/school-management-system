import { query } from '../db/connection.js';
import { sendPushToStaffUser, type PushPayload } from './webPushService.js';

export type StaffNotificationKind =
  | 'admin'
  | 'salary'
  | 'complaint'
  | 'chat'
  | 'general'
  | 'birthday'
  | 'attendance';

export async function insertStaffNotification(input: {
  tenantId: number;
  userId: number;
  kind: StaffNotificationKind;
  title: string;
  message: string;
  url?: string | null;
  referenceKey?: string | null;
}): Promise<number | null> {
  const title = String(input.title || 'Notification').slice(0, 255);
  const message = String(input.message || '').trim().slice(0, 4000);
  if (!message) return null;

  try {
    const result = await query(
      `INSERT INTO staff_user_notifications
         (tenant_id, user_id, kind, title, message, url, reference_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, reference_key) WHERE reference_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        input.tenantId,
        input.userId,
        input.kind,
        title,
        message,
        input.url || null,
        input.referenceKey || null,
      ]
    );
    return result.rows[0]?.id != null ? Number(result.rows[0].id) : null;
  } catch {
    return null;
  }
}

export async function notifyStaffUser(
  userId: number,
  tenantId: number,
  input: {
    kind: StaffNotificationKind;
    title: string;
    message: string;
    url?: string | null;
    referenceKey?: string | null;
    push?: PushPayload;
  }
): Promise<void> {
  await insertStaffNotification({
    tenantId,
    userId,
    kind: input.kind,
    title: input.title,
    message: input.message,
    url: input.url,
    referenceKey: input.referenceKey,
  });

  const pushBody = input.push?.body ?? input.message;
  await sendPushToStaffUser(userId, {
    title: input.push?.title ?? input.title,
    body: pushBody,
    url: input.push?.url ?? input.url ?? '/',
    icon: input.push?.icon,
    badge: input.push?.badge,
  }).catch(() => undefined);
}

export async function notifyTenantStaffByRoles(
  tenantId: number,
  roles: string[],
  input: {
    kind: StaffNotificationKind;
    title: string;
    message: string;
    url?: string | null;
    referenceKeyPrefix?: string | null;
    push?: PushPayload;
  }
): Promise<{ userCount: number }> {
  const usersRes = await query(
    `SELECT id FROM users
     WHERE tenant_id = $1 AND role = ANY($2::text[]) AND is_active = true`,
    [tenantId, roles]
  );

  await Promise.all(
    usersRes.rows.map(async (row: { id: number }) => {
      const userId = Number(row.id);
      const referenceKey = input.referenceKeyPrefix ? `${input.referenceKeyPrefix}:${userId}` : null;
      await notifyStaffUser(userId, tenantId, {
        kind: input.kind,
        title: input.title,
        message: input.message,
        url: input.url,
        referenceKey,
        push: input.push,
      });
    })
  );

  return { userCount: usersRes.rows.length };
}

export async function listStaffNotifications(userId: number, limit = 100) {
  const result = await query(
    `SELECT id, kind, title, message, url, is_read, created_at
     FROM staff_user_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 100)]
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    kind: String(row.kind),
    title: row.title as string,
    message: row.message as string,
    url: row.url as string | null,
    is_read: !!row.is_read,
    created_at: row.created_at as string,
  }));
}

export async function markStaffNotificationRead(notificationId: number, userId: number): Promise<void> {
  await query(
    `UPDATE staff_user_notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllStaffNotificationsRead(userId: number): Promise<void> {
  await query(
    `UPDATE staff_user_notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
}

export async function countUnreadStaffNotifications(userId: number): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS c FROM staff_user_notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return Number(result.rows[0]?.c || 0);
}
