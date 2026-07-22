import { sendClassPeriodReminders } from '../services/classPeriodReminderService.js';

const INTERVAL_MS = 60 * 1000;

export function startClassPeriodReminderJob(): void {
  void sendClassPeriodReminders();
  setInterval(() => {
    void sendClassPeriodReminders();
  }, INTERVAL_MS);
  console.log('[timetable] Class period reminder job started (every 60s, Africa/Accra)');
}
