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

async function getUnreadCount(parentAccountId: number): Promise<number> {
  const unreadRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM parent_notifications
     WHERE parent_account_id = $1 AND is_read = false`,
    [parentAccountId]
  ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
  return Number(unreadRes.rows[0]?.total || 0);
}

export async function sendFcmToParentAccount(parentAccountId: number, payload: FcmPayload) {
  if (!initializeFirebase()) return;

  const tokensRes = await query(
    `SELECT token
     FROM parent_fcm_tokens
     WHERE parent_account_id = $1`,
    [parentAccountId]
  ).catch(() => ({ rows: [] as any[] }));
  const tokens: string[] = tokensRes.rows.map((r: any) => String(r.token || '')).filter(Boolean);
  if (!tokens.length) return;

  const unreadCount = await getUnreadCount(parentAccountId);
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      url: payload.url || '/parent',
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
        data: { url: payload.url || '/parent' },
      },
      fcmOptions: {
        link: payload.url || '/parent',
      },
    },
  });

  for (let i = 0; i < response.responses.length; i++) {
    const entry = response.responses[i];
    if (!entry.success) {
      const code = (entry.error as any)?.code || '';
      const token = tokens[i];
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        await query(
          `DELETE FROM parent_fcm_tokens
           WHERE parent_account_id = $1 AND token = $2`,
          [parentAccountId, token]
        ).catch(() => {});
      }
    }
  }
}
