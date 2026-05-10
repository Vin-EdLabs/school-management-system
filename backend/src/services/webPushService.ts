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

async function attachSchoolLogoToPayloadIfNeeded(tenantId: number, payload: PushPayload) {
  if (payload.icon) return;
  const settings = await query(
    `SELECT COALESCE(ss.logo_url, t.logo_url) as logo_url
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId]
  ).catch(() => ({ rows: [] as any[] }));
  const logo = settings.rows[0]?.logo_url;
  if (logo && !String(logo).startsWith('data:')) {
    payload.icon = logo;
  }
}

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

/** Parent portal accounts for one or more students (same tenant). Deduplicates one parent with multiple selected children. */
export async function sendPushToStudentsParents(
  tenantId: number,
  studentIds: number[],
  payload: PushPayload
): Promise<{ parentAccounts: number; subscribedAccounts: number }> {
  const uniq = [...new Set(studentIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (uniq.length === 0) {
    return { parentAccounts: 0, subscribedAccounts: 0 };
  }

  const stCheck = await query(
    `SELECT id FROM students WHERE tenant_id = $1 AND id = ANY($2::int[])`,
    [tenantId, uniq]
  );
  if (stCheck.rows.length !== uniq.length) {
    const err: Error & { statusCode?: number } = new Error('One or more students not found in this school');
    err.statusCode = 404;
    throw err;
  }

  await attachSchoolLogoToPayloadIfNeeded(tenantId, payload);

  const parentRows = await query(
    `SELECT DISTINCT ppa.id
     FROM parent_portal_accounts ppa
     WHERE ppa.tenant_id = $1 AND ppa.student_id = ANY($2::int[])`,
    [tenantId, uniq]
  );

  const ids = parentRows.rows.map((r: { id: number }) => r.id);
  let subscribedAccounts = 0;
  if (ids.length > 0) {
    const subRes = await query(
      `SELECT COUNT(DISTINCT parent_account_id)::int AS total
       FROM parent_push_subscriptions
       WHERE tenant_id = $1 AND parent_account_id = ANY($2::int[])`,
      [tenantId, ids]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
    subscribedAccounts = Number(subRes.rows[0]?.total || 0);
  }

  await Promise.all(
    parentRows.rows.map(async (parent: { id: number }) => {
      await query(
        `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url, icon)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, parent.id, payload.title, payload.body, payload.url || '/parent', payload.icon || null]
      ).catch(() => {});
      return sendPushToParentAccount(parent.id, payload).catch(() => {});
    })
  );

  return { parentAccounts: parentRows.rows.length, subscribedAccounts };
}

export async function sendPushToStudentParents(
  tenantId: number,
  studentId: number,
  payload: PushPayload
): Promise<{ parentAccounts: number; subscribedAccounts: number }> {
  return sendPushToStudentsParents(tenantId, [studentId], payload);
}

export async function sendPushToClassParents(
  tenantId: number,
  classId: number,
  payload: PushPayload
): Promise<{ parentAccounts: number; subscribedAccounts: number }> {
  const cls = await query('SELECT id FROM classes WHERE id = $1 AND tenant_id = $2', [classId, tenantId]);
  if (cls.rows.length === 0) {
    const err: Error & { statusCode?: number } = new Error('Class not found');
    err.statusCode = 404;
    throw err;
  }

  await attachSchoolLogoToPayloadIfNeeded(tenantId, payload);

  const parentRows = await query(
    `SELECT DISTINCT ppa.id
     FROM parent_portal_accounts ppa
     INNER JOIN students s ON s.id = ppa.student_id AND s.tenant_id = ppa.tenant_id
     WHERE ppa.tenant_id = $1 AND s.class_assigned_id = $2`,
    [tenantId, classId]
  );

  const ids = parentRows.rows.map((r: { id: number }) => r.id);
  let subscribedAccounts = 0;
  if (ids.length > 0) {
    const subRes = await query(
      `SELECT COUNT(DISTINCT parent_account_id)::int AS total
       FROM parent_push_subscriptions
       WHERE tenant_id = $1 AND parent_account_id = ANY($2::int[])`,
      [tenantId, ids]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
    subscribedAccounts = Number(subRes.rows[0]?.total || 0);
  }

  await Promise.all(
    parentRows.rows.map(async (parent: { id: number }) => {
      await query(
        `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url, icon)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, parent.id, payload.title, payload.body, payload.url || '/parent', payload.icon || null]
      ).catch(() => {});
      return sendPushToParentAccount(parent.id, payload).catch(() => {});
    })
  );

  return { parentAccounts: parentRows.rows.length, subscribedAccounts };
}

export async function sendPushToTenantParents(
  tenantId: number,
  payload: PushPayload
): Promise<{ parentAccounts: number; subscribedAccounts: number }> {
  await attachSchoolLogoToPayloadIfNeeded(tenantId, payload);

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

  await Promise.all(
    parentRows.rows.map(async (parent) => {
      await query(
        `INSERT INTO parent_notifications (tenant_id, parent_account_id, title, message, url, icon)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, parent.id, payload.title, payload.body, payload.url || '/parent', payload.icon || null]
      ).catch(() => {});
      return sendPushToParentAccount(parent.id, payload).catch(() => {});
    })
  );

  return {
    parentAccounts: parentRows.rows.length,
    subscribedAccounts: Number(subscribed.rows[0]?.total || 0),
  };
}
