import { query } from '../db/connection.js';
import { emitGlobalAnnouncementLiveEvent } from '../services/globalAnnouncementService.js';

/** Notify schools when scheduled announcements go live (within the last 2 minutes). */
export async function checkScheduledAnnouncements(): Promise<number> {
  try {
    const res = await query(
      `SELECT id, created_at, target, target_tenant_ids, is_active, scheduled_at, expires_at
       FROM global_announcements
       WHERE is_active = true
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= CURRENT_TIMESTAMP
         AND scheduled_at > CURRENT_TIMESTAMP - INTERVAL '2 minutes'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`
    );

    for (const row of res.rows) {
      await emitGlobalAnnouncementLiveEvent(row);
    }
    return res.rows.length;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Scheduled announcement job warning:', message);
    return 0;
  }
}

export function startScheduledAnnouncementJob(): void {
  void checkScheduledAnnouncements();
  setInterval(() => {
    void checkScheduledAnnouncements();
  }, 30 * 1000);
}
