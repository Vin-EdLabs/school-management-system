import { query } from '../db/connection.js';
import { notifyOverdueExeatWhatsApp } from '../services/boardingWhatsAppService.js';

/** Mark overdue exeats and log notification dedup rows (WhatsApp hooks can read these). */
export async function processOverdueExeats(): Promise<number> {
  try {
    const overdue = await query(
      `SELECT e.id, e.tenant_id, e.student_id, e.return_date,
         s.first_name, s.last_name
       FROM boarding_exeats e
       JOIN students s ON e.student_id = s.id
       WHERE e.status IN ('approved', 'signed_out')
         AND e.return_date IS NOT NULL
         AND e.return_date < CURRENT_DATE
         AND e.actual_return_date IS NULL`
    );

    if (overdue.rows.length === 0) return 0;

    let processed = 0;
    for (const row of overdue.rows) {
      await query(
        `UPDATE boarding_exeats SET status = 'overdue' WHERE id = $1 AND status IN ('approved', 'signed_out')`,
        [row.id]
      );

      const noticeCheck = await query(
        `SELECT 1 FROM boarding_exeat_overdue_notices
         WHERE exeat_id = $1 AND channel = 'whatsapp' AND notice_date = CURRENT_DATE
         LIMIT 1`,
        [row.id]
      );
      if (noticeCheck.rows.length === 0) {
        await query(
          `INSERT INTO boarding_exeat_overdue_notices (tenant_id, exeat_id, channel, notice_date)
           VALUES ($1, $2, 'whatsapp', CURRENT_DATE)`,
          [row.tenant_id, row.id]
        );
        await notifyOverdueExeatWhatsApp({
          tenantId: row.tenant_id,
          studentId: row.student_id,
          studentName: `${row.first_name} ${row.last_name}`.trim(),
          returnDate: String(row.return_date),
          exeatId: row.id,
        });
      }
      processed++;
    }
    return processed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Overdue exeat job warning:', message);
    return 0;
  }
}

export function startOverdueExeatJob(): void {
  void processOverdueExeats();
  setInterval(
    () => {
      void processOverdueExeats();
    },
    60 * 60 * 1000
  );
}
