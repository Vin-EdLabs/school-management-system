import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { insertStaffNotification } from './staffNotificationService.js';
import { sendPushToStaffUser } from './webPushService.js';
import { TIMETABLE_DAYS, type TimetableDay } from './timetableService.js';

const TIMEZONE = 'Africa/Accra';
/** Notify this many minutes before period start. */
const REMINDER_MINUTES = 5;
/** Accept matches within ± this many minutes of the reminder target. */
const REMINDER_WINDOW_MINUTES = 2;

function accraParts(now = new Date()): { day: TimetableDay | null; minutes: number; dateKey: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday') as TimetableDay;
  const day = (TIMETABLE_DAYS as readonly string[]).includes(weekday) ? weekday : null;
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  return { day, minutes: hour * 60 + minute, dateKey };
}

function parseTimeToMinutes(value: string): number {
  const parts = String(value || '').split(':');
  return parseInt(parts[0] || '0', 10) * 60 + parseInt(parts[1] || '0', 10);
}

function formatTimeLabel(value: string): string {
  const parts = String(value || '').split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

type UpcomingSlot = {
  slot_id: number;
  tenant_id: number;
  teacher_id: number;
  subject_name: string;
  class_name: string;
  period_name: string;
  start_time: string;
};

async function findUpcomingSlotsForTenant(
  tenantId: number,
  day: TimetableDay,
  nowMinutes: number
): Promise<UpcomingSlot[]> {
  const targetMinutes = nowMinutes + REMINDER_MINUTES;
  const res = await query(
    `SELECT ct.id AS slot_id,
            ct.tenant_id,
            ct.teacher_id,
            s.name AS subject_name,
            c.class_name,
            p.name AS period_name,
            p.start_time::text AS start_time
       FROM class_timetable ct
       JOIN terms tm ON tm.id = ct.term_id AND tm.tenant_id = ct.tenant_id AND tm.is_current = true
       JOIN periods p ON p.id = ct.period_id AND p.tenant_id = ct.tenant_id
       JOIN subjects s ON s.id = ct.subject_id AND s.tenant_id = ct.tenant_id
       JOIN classes c ON c.id = ct.class_id AND c.tenant_id = ct.tenant_id
      WHERE ct.tenant_id = $1
        AND ct.day_of_week = $2
        AND ct.teacher_id IS NOT NULL
        AND COALESCE(p.is_break, false) = false`,
    [tenantId, day]
  );

  return (res.rows as UpcomingSlot[]).filter((row) => {
    const startMinutes = parseTimeToMinutes(row.start_time);
    return Math.abs(startMinutes - targetMinutes) <= REMINDER_WINDOW_MINUTES;
  });
}

async function resolveUserIdForTeacher(tenantId: number, teacherId: number): Promise<number | null> {
  const res = await query(
    `SELECT id FROM users
      WHERE tenant_id = $1 AND teacher_id = $2 AND is_active = true
      LIMIT 1`,
    [tenantId, teacherId]
  );
  return res.rows[0]?.id != null ? Number(res.rows[0].id) : null;
}

export async function sendClassPeriodReminders(): Promise<number> {
  const { day, minutes, dateKey } = accraParts();
  if (!day) return 0;

  const tenantsRes = await query(`SELECT id FROM tenants WHERE is_active = true`);
  let sent = 0;

  for (const row of tenantsRes.rows) {
    const tenantId = Number(row.id);
    const slots = await findUpcomingSlotsForTenant(tenantId, day, minutes);

    for (const slot of slots) {
      const userId = await resolveUserIdForTeacher(tenantId, slot.teacher_id);
      if (!userId) continue;

      const timeLabel = formatTimeLabel(slot.start_time);
      const title = 'Class starting soon';
      const message = `${slot.subject_name} with ${slot.class_name} at ${timeLabel} (${slot.period_name || 'Period'}).`;
      const referenceKey = `class-reminder:${slot.slot_id}:${dateKey}`;

      const notificationId = await insertStaffNotification({
        tenantId,
        userId,
        kind: 'general',
        title,
        message,
        url: '/?module=timetable',
        referenceKey,
      });
      if (!notificationId) continue;

      await sendPushToStaffUser(userId, {
        title,
        body: message,
        url: '/?module=timetable',
      }).catch(() => undefined);

      sent += 1;
    }

    if (slots.length > 0) {
      try {
        getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'staff-notification',
        });
      } catch {
        /* non-fatal */
      }
    }
  }

  return sent;
}
