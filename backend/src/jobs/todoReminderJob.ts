import { query } from '../db/connection.js';
import { getIO } from '../socket.js';

export async function checkDueTodoReminders(): Promise<number> {
  try {
    const due = await query(
      `SELECT t.id, t.user_id, t.content, t.reminder_at
       FROM personal_todos t
       WHERE t.reminder_at IS NOT NULL
         AND t.reminder_at <= CURRENT_TIMESTAMP
         AND t.reminder_sent = false
         AND t.is_completed = false`
    );

    if (due.rows.length === 0) return 0;

    const io = getIO();
    for (const row of due.rows) {
      const userId = Number(row.user_id);
      io.to(`user:${userId}`).emit('todo-reminder', {
        id: Number(row.id),
        content: String(row.content),
        reminder_at: row.reminder_at ? new Date(String(row.reminder_at)).toISOString() : null,
      });
      await query(`UPDATE personal_todos SET reminder_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        row.id,
      ]);
    }
    return due.rows.length;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Todo reminder job warning:', message);
    return 0;
  }
}

export function startTodoReminderJob(): void {
  void checkDueTodoReminders();
  setInterval(() => {
    void checkDueTodoReminders();
  }, 60 * 1000);
}
