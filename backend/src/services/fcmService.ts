import admin from 'firebase-admin';
import { query } from '../db/connection.js';

type FcmPayload = {
  title: string;
  body: string;
  icon?: string | null;
  badge?: string | null;
  url?: string;
};

let initialized = false;

function initializeFirebase() {
  if (initialized) return true;
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';
  if (!projectId || !clientEmail || !privateKeyRaw) return false;

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    initialized = true;
    return true;
  } catch (error) {
    console.error('[fcm] initialization failed:', error);
    return false;
  }
}

export function isFcmConfigured() {
  return initializeFirebase();
}

async function getParentUnreadCount(parentAccountId: number): Promise<number> {
  const unreadRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM parent_notifications
     WHERE parent_account_id = $1 AND is_read = false`,
    [parentAccountId]
  ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
  return Number(unreadRes.rows[0]?.total || 0);
}

async function getPartnerUnreadCount(partnerDbId: number): Promise<number> {
  const unreadRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM partner_notifications
     WHERE partner_id = $1 AND read_at IS NULL`,
    [partnerDbId]
  ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
  return Number(unreadRes.rows[0]?.total || 0);
}

async function sendFcmMulticast(
  tokens: string[],
  payload: FcmPayload,
  unreadCount: number,
  defaultUrl: string,
  onInvalidToken: (token: string) => Promise<void>,
) {
  if (!initializeFirebase() || tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      url: payload.url || defaultUrl,
      unreadCount: String(unreadCount),
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '',
      badge: payload.badge || payload.icon || '',
      at: String(Date.now()),
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || undefined,
        badge: payload.badge || payload.icon || undefined,
        data: { url: payload.url || defaultUrl },
      },
      fcmOptions: {
        link: payload.url || defaultUrl,
      },
    },
  });

  for (let i = 0; i < response.responses.length; i++) {
    const entry = response.responses[i];
    if (!entry.success) {
      const code = (entry.error as any)?.code || '';
      const token = tokens[i];
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        await onInvalidToken(token).catch(() => undefined);
      }
    }
  }
}

export async function sendFcmToParentAccount(parentAccountId: number, payload: FcmPayload) {
  const tokensRes = await query(
    `SELECT token
     FROM parent_fcm_tokens
     WHERE parent_account_id = $1`,
    [parentAccountId]
  ).catch(() => ({ rows: [] as any[] }));
  const tokens: string[] = tokensRes.rows.map((r: any) => String(r.token || '')).filter(Boolean);
  if (!tokens.length) return;

  const unreadCount = await getParentUnreadCount(parentAccountId);
  await sendFcmMulticast(
    tokens,
    payload,
    unreadCount,
    '/parent',
    async (token) => {
      await query(
        `DELETE FROM parent_fcm_tokens
         WHERE parent_account_id = $1 AND token = $2`,
        [parentAccountId, token]
      );
    },
  );
}

export async function sendFcmToPartner(partnerDbId: number, payload: FcmPayload) {
  const tokensRes = await query(
    `SELECT token
     FROM partner_fcm_tokens
     WHERE partner_id = $1`,
    [partnerDbId]
  ).catch(() => ({ rows: [] as any[] }));
  const tokens: string[] = tokensRes.rows.map((r: any) => String(r.token || '')).filter(Boolean);
  if (!tokens.length) return;

  const unreadCount = await getPartnerUnreadCount(partnerDbId);
  await sendFcmMulticast(
    tokens,
    payload,
    unreadCount,
    '/',
    async (token) => {
      await query(
        `DELETE FROM partner_fcm_tokens
         WHERE partner_id = $1 AND token = $2`,
        [partnerDbId, token]
      );
    },
  );
}
