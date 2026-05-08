import webpush from 'web-push';
import { query } from '../db/connection.js';
import { sendFcmToParentAccount } from './fcmService.js';

export type PushPayload = {
  title: string;
  body: string;
  icon?: string | null;
  badge?: string | null;
  url?: string;
};

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@scholarnerve.com';

  if (!publicKey || !privateKey) {
    console.warn('[web-push] VAPID keys missing. Push notifications are disabled.');
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || '';
}

export async function sendPushToParentAccount(parentAccountId: number, payload: PushPayload) {
  ensureConfigured();
  const webPushEnabled = configured;

  const subs = await query(
    `SELECT endpoint, p256dh, auth
     FROM parent_push_subscriptions
     WHERE parent_account_id = $1`,
    [parentAccountId]
  );

  if (webPushEnabled && subs.rows.length > 0) {
    const unreadRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM parent_notifications
       WHERE parent_account_id = $1 AND is_read = false`,
      [parentAccountId]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
    const unreadCount = Number(unreadRes.rows[0]?.total || 0);

    const data = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || undefined,
      badge: payload.badge || payload.icon || undefined,
      url: payload.url || '/parent',
      unreadCount,
      at: Date.now(),
    });

    for (const sub of subs.rows) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription as any, data);
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await query(
            'DELETE FROM parent_push_subscriptions WHERE parent_account_id = $1 AND endpoint = $2',
            [parentAccountId, sub.endpoint]
          ).catch(() => {});
        } else {
          console.error('[web-push] send failed:', error?.message || error);
        }
      }
    }
  }

  await sendFcmToParentAccount(parentAccountId, payload).catch(() => {});
}

export async function sendPushToStudentParents(
  tenantId: number,
  studentId: number,
  payload: PushPayload
) {
  const parentRows = await query(
    `SELECT id
     FROM parent_portal_accounts
     WHERE tenant_id = $1 AND student_id = $2`,
    [tenantId, studentId]
  );
  for (const parent of parentRows.rows) {
    await query(
      `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url, icon)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, parent.id, payload.title, payload.body, payload.url || '/parent', payload.icon || null]
    ).catch(() => {});
    await sendPushToParentAccount(parent.id, payload);
  }
}

export async function sendPushToTenantParents(
  tenantId: number,
  payload: PushPayload
): Promise<{ parentAccounts: number; subscribedAccounts: number }> {
  const parentRows = await query(
    `SELECT id FROM parent_portal_accounts WHERE tenant_id = $1`,
    [tenantId]
  );

  const subscribed = await query(
    `SELECT COUNT(DISTINCT parent_account_id)::int AS total
     FROM parent_push_subscriptions
     WHERE tenant_id = $1`,
    [tenantId]
  ).catch(() => ({ rows: [{ total: 0 }] as any[] }));

  for (const parent of parentRows.rows) {
    await query(
      `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url, icon)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, parent.id, payload.title, payload.body, payload.url || '/parent', payload.icon || null]
    ).catch(() => {});
    await sendPushToParentAccount(parent.id, payload);
  }

  return {
    parentAccounts: parentRows.rows.length,
    subscribedAccounts: Number(subscribed.rows[0]?.total || 0),
  };
}
