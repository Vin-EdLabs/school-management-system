import cron, { type ScheduledTask } from 'node-cron';
import {
  addMinutesToTime,
  autoCheckoutTenant,
  isWeekend,
  listAllAttendanceSettings,
  normalizeTimeString,
  sendMissingCheckInReminders,
  STAFF_AUTO_CHECKOUT_TIME,
  type AttendanceSettings,
} from '../services/staffAttendanceService.js';

const TIMEZONE = 'Africa/Accra';
const checkoutJobs = new Map<number, ScheduledTask>();
const reminderJobs = new Map<number, ScheduledTask>();

function cronExpressionFromTime(timeStr: string, weekdaysOnly = true): string | null {
  const norm = normalizeTimeString(timeStr);
  const [hh, mm] = norm.split(':').map((p) => parseInt(p, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const dow = weekdaysOnly ? '1-5' : '*';
  return `${mm} ${hh} * * ${dow}`;
}

function stopJob(map: Map<number, ScheduledTask>, tenantId: number): void {
  const existing = map.get(tenantId);
  if (existing) {
    existing.stop();
    map.delete(tenantId);
  }
}

export function unregisterTenantAutoCheckout(tenantId: number): void {
  stopJob(checkoutJobs, tenantId);
}

export function unregisterTenantCheckInReminder(tenantId: number): void {
  stopJob(reminderJobs, tenantId);
}

export function unregisterTenantAttendanceJobs(tenantId: number): void {
  unregisterTenantAutoCheckout(tenantId);
  unregisterTenantCheckInReminder(tenantId);
}

/** Daily force check-out at 18:00 (Africa/Accra) for open sessions. */
export function registerTenantAutoCheckout(
  tenantId: number,
  _schoolEndTime?: string
): boolean {
  unregisterTenantAutoCheckout(tenantId);
  const expr = cronExpressionFromTime(STAFF_AUTO_CHECKOUT_TIME, true);
  if (!expr) return false;

  const task = cron.schedule(
    expr,
    () => {
      if (isWeekend()) return;
      void autoCheckoutTenant(tenantId)
        .then((n) => {
          if (n > 0) {
            console.log(`[staff-attendance] Auto-checked out ${n} staff for tenant ${tenantId} at 18:00`);
          }
        })
        .catch((err) => {
          console.warn(
            `[staff-attendance] Auto-checkout failed for tenant ${tenantId}:`,
            err instanceof Error ? err.message : err
          );
        });
    },
    { timezone: TIMEZONE }
  );

  checkoutJobs.set(tenantId, task);
  return true;
}

/** Push reminder 1 hour after school_start_time for users who have not clocked in. */
export function registerTenantCheckInReminder(
  tenantId: number,
  schoolStartTime: string
): boolean {
  unregisterTenantCheckInReminder(tenantId);
  const reminderTime = addMinutesToTime(schoolStartTime, 60);
  const expr = cronExpressionFromTime(reminderTime, true);
  if (!expr) {
    console.warn(
      `[staff-attendance] Invalid reminder time for tenant ${tenantId} (from start ${schoolStartTime})`
    );
    return false;
  }

  const task = cron.schedule(
    expr,
    () => {
      if (isWeekend()) return;
      void sendMissingCheckInReminders(tenantId)
        .then((n) => {
          if (n > 0) {
            console.log(
              `[staff-attendance] Sent ${n} check-in reminder(s) for tenant ${tenantId}`
            );
          }
        })
        .catch((err) => {
          console.warn(
            `[staff-attendance] Check-in reminders failed for tenant ${tenantId}:`,
            err instanceof Error ? err.message : err
          );
        });
    },
    { timezone: TIMEZONE }
  );

  reminderJobs.set(tenantId, task);
  return true;
}

/** Register 6pm auto-checkout + start+1h check-in reminder for a tenant. */
export function registerTenantAttendanceJobs(
  tenantId: number,
  settings: Pick<AttendanceSettings, 'school_start_time' | 'school_end_time'>
): void {
  registerTenantAutoCheckout(tenantId, STAFF_AUTO_CHECKOUT_TIME);
  registerTenantCheckInReminder(tenantId, settings.school_start_time);
}

/** Load all tenant attendance settings and schedule jobs. */
export async function startStaffAttendanceAutoCheckoutJobs(): Promise<void> {
  try {
    const settings = await listAllAttendanceSettings();
    let registered = 0;
    for (const row of settings) {
      registerTenantAttendanceJobs(row.tenant_id, row);
      registered += 1;
    }
    console.log(
      `[staff-attendance] Registered clock-in reminder + 18:00 auto-checkout for ${registered} tenant(s)`
    );
  } catch (err) {
    console.warn(
      '[staff-attendance] Failed to start attendance jobs:',
      err instanceof Error ? err.message : err
    );
  }
}
