import { query } from '../db/connection.js';
import { sendPushToStaffUser } from './webPushService.js';

type PushPayload = { title: string; body: string; url?: string };

const SCHOOL_COMMS_ROLES = ['administrator', 'finance', 'headmaster', 'teacher', 'staff'] as const;

async function pushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToStaffUser(id, payload).catch(() => {})));
}

async function pushToSchoolRoles(tenantId: number, payload: PushPayload): Promise<void> {
  const users = await query(
    `SELECT id FROM users
     WHERE tenant_id = $1
       AND role = ANY($2::text[])
       AND is_active = true`,
    [tenantId, SCHOOL_COMMS_ROLES]
  );
  await pushToUsers((users.rows as { id: number }[]).map((r) => r.id), payload);
}

export async function notifySchoolStaffOfParentDesk(
  tenantId: number,
  payload: PushPayload
): Promise<void> {
  await pushToSchoolRoles(tenantId, payload);
}

export async function notifySchoolStaffOfSupportReply(
  tenantId: number,
  payload: PushPayload
): Promise<void> {
  await pushToSchoolRoles(tenantId, payload);
}

export async function notifySuperAdminsOfSupportMessage(payload: PushPayload): Promise<void> {
  const users = await query(
    `SELECT id FROM users WHERE role = 'super-admin' AND is_active = true`
  );
  await pushToUsers((users.rows as { id: number }[]).map((r) => r.id), payload);
}
