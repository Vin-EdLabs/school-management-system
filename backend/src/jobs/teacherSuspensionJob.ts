import { processExpiredSuspensions } from '../services/teacherStatusService.js';

/** Re-enable teachers whose suspension end date has passed. Runs daily. */
export function startTeacherSuspensionJob() {
  const run = async () => {
    try {
      const count = await processExpiredSuspensions();
      if (count > 0) {
        console.log(`[teacherSuspensionJob] Auto-reactivated ${count} teacher(s)`);
      }
    } catch (e) {
      console.error('[teacherSuspensionJob] Error:', e);
    }
  };
  run();
  setInterval(run, 24 * 60 * 60 * 1000);
}
