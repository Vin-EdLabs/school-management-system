import { query } from '../db/connection.js';
import { sendPushToPartner, type PushPayload } from './webPushService.js';

/** Insert in-app notification and send web push to partner devices. */
export async function notifyPartner(
  partnerDbId: number,
  title: string,
  body: string,
  url = '/'
): Promise<void> {
  await query(
    `INSERT INTO partner_notifications (partner_id, title, body) VALUES ($1, $2, $3)`,
    [partnerDbId, title, body]
  );

  const payload: PushPayload = { title, body, url };
  await sendPushToPartner(partnerDbId, payload).catch(() => undefined);
}
