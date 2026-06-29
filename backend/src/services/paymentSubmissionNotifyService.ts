import { query } from '../db/connection.js';
import { sendPushToStaffUser, sendPushToParentAccount } from './webPushService.js';

type PushPayload = { title: string; body: string; url?: string };

export async function notifyFinanceStaffOfPaymentSubmission(
  tenantId: number,
  payload: PushPayload
): Promise<void> {
  const users = await query(
    `SELECT id FROM users
     WHERE tenant_id = $1
       AND role IN ('finance', 'administrator', 'super-admin')
       AND is_active = true`,
    [tenantId]
  );
  await Promise.all(
    (users.rows as { id: number }[]).map((row) =>
      sendPushToStaffUser(row.id, payload).catch(() => {})
    )
  );
}

export async function notifyParentOfSubmissionReview(
  parentAccountId: number,
  payload: PushPayload
): Promise<void> {
  await sendPushToParentAccount(parentAccountId, payload).catch(() => {});
}
