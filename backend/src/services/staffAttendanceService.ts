import { query } from '../db/connection.js';
import { haversineDistance, isWithinRadius } from '../utils/haversine.js';

/** All school portal roles that must clock in/out (tenant users). */
export const ATTENDANCE_STAFF_ROLES = [
  'teacher',
  'staff',
  'headmaster',
  'administrator',
  'finance',
  'driver',
] as const;

export type AttendanceSettings = {
  id: number;
  tenant_id: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  school_start_time: string;
  school_end_time: string;
  late_threshold_minutes: number;
  created_at: string;
  updated_at: string;
};

export type StaffAttendanceRow = {
  id: number;
  tenant_id: number;
  staff_id: number;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  is_late: boolean;
  late_reason: string | null;
  check_in_method: 'self' | 'admin_override';
  admin_override_by: number | null;
  checkout_method: 'self' | 'auto' | 'admin_override' | null;
};

function roundCoord(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/** Normalize TIME / string to "HH:MM:SS". */
export function normalizeTimeString(value: unknown): string {
  if (value == null) return '00:00:00';
  const s = String(value).trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  // JS Date / pg Date object string
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && s.includes('T')) {
    return d.toISOString().slice(11, 19);
  }
  return s.length >= 5 ? `${s.slice(0, 5)}:00`.slice(0, 8) : '00:00:00';
}

export function timeToMinutes(time: string): number {
  const norm = normalizeTimeString(time);
  const [h, m, sec] = norm.split(':').map((p) => parseInt(p, 10) || 0);
  return h * 60 + m + (sec || 0) / 60;
}

/** Calendar date YYYY-MM-DD in Africa/Accra (Ghana / UTC+0). */
export function todayDateString(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
}

/** Check whether a date string or Date is a weekend (Saturday or Sunday) in Africa/Accra. */
export function isWeekend(dateOrIso?: Date | string): boolean {
  if (!dateOrIso) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Accra',
      weekday: 'short',
    }).format(new Date());
    return parts === 'Sat' || parts === 'Sun';
  }
  if (typeof dateOrIso === 'string') {
    const s = dateOrIso.trim();
    const iso = s.includes('T') ? s : `${s}T12:00:00Z`;
    const d = new Date(iso);
    const day = d.getUTCDay();
    return day === 0 || day === 6;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Accra',
    weekday: 'short',
  }).format(dateOrIso);
  return parts === 'Sat' || parts === 'Sun';
}

/** Minutes past midnight in Africa/Accra for a UTC timestamp. */
export function localMinutesOfDay(isoOrDate: Date | string): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return get('hour') * 60 + get('minute') + get('second') / 60;
}

export function isLateCheckIn(
  checkInAt: Date | string,
  schoolStartTime: string,
  lateThresholdMinutes: number
): boolean {
  const lateAfter =
    timeToMinutes(schoolStartTime) + (Number(lateThresholdMinutes) || 0);
  return localMinutesOfDay(checkInAt) > lateAfter + 0.001;
}

/** Build a timestamptz for today + TIME in Africa/Accra. */
export function combineDateAndTimeUtc(dateYmd: string, timeStr: string): Date {
  const t = normalizeTimeString(timeStr);
  // Africa/Accra is UTC+0 year-round
  return new Date(`${dateYmd}T${t}.000Z`);
}

function mapSettings(row: any): AttendanceSettings {
  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    radius_meters: Number(row.radius_meters) || 100,
    school_start_time: normalizeTimeString(row.school_start_time).slice(0, 5),
    school_end_time: normalizeTimeString(row.school_end_time).slice(0, 5),
    late_threshold_minutes: Number(row.late_threshold_minutes) || 15,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAttendanceSettings(
  tenantId: number
): Promise<AttendanceSettings | null> {
  const res = await query(
    `SELECT * FROM school_attendance_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  if (!res.rows[0]) return null;
  return mapSettings(res.rows[0]);
}

export async function upsertAttendanceSettings(
  tenantId: number,
  body: {
    latitude: number;
    longitude: number;
    radius_meters?: number;
    school_start_time: string;
    school_end_time: string;
    late_threshold_minutes?: number;
  }
): Promise<AttendanceSettings> {
  const lat = roundCoord(Number(body.latitude));
  const lon = roundCoord(Number(body.longitude));
  const radius = Math.max(10, Math.min(5000, Number(body.radius_meters) || 100));
  const start = normalizeTimeString(body.school_start_time);
  const end = normalizeTimeString(body.school_end_time);
  const late = Math.max(0, Math.min(240, Number(body.late_threshold_minutes) ?? 15));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw Object.assign(new Error('Valid latitude and longitude are required'), { status: 400 });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw Object.assign(new Error('Coordinates out of range'), { status: 400 });
  }

  const res = await query(
    `INSERT INTO school_attendance_settings (
       tenant_id, latitude, longitude, radius_meters,
       school_start_time, school_end_time, late_threshold_minutes, updated_at
     ) VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE SET
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       radius_meters = EXCLUDED.radius_meters,
       school_start_time = EXCLUDED.school_start_time,
       school_end_time = EXCLUDED.school_end_time,
       late_threshold_minutes = EXCLUDED.late_threshold_minutes,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [tenantId, lat, lon, radius, start, end, late]
  );
  return mapSettings(res.rows[0]);
}

export async function listAllAttendanceSettings(): Promise<AttendanceSettings[]> {
  const res = await query(`SELECT * FROM school_attendance_settings ORDER BY tenant_id`);
  return res.rows.map(mapSettings);
}

export async function getMyToday(
  tenantId: number,
  staffId: number
): Promise<StaffAttendanceRow | null> {
  const today = todayDateString();
  const res = await query(
    `SELECT * FROM staff_attendance
     WHERE tenant_id = $1 AND staff_id = $2 AND date = $3::date
     LIMIT 1`,
    [tenantId, staffId, today]
  );
  return res.rows[0] || null;
}

export type CheckInResult =
  | { ok: true; record: StaffAttendanceRow }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function selfCheckIn(
  tenantId: number,
  staffId: number,
  latitude: number,
  longitude: number,
  lateReason?: string | null
): Promise<CheckInResult> {
  if (isWeekend()) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Staff clock-in is only available on weekdays (Monday to Friday).' },
    };
  }

  const settings = await getAttendanceSettings(tenantId);
  if (!settings || settings.latitude == null || settings.longitude == null) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Attendance settings are not configured. Ask an admin to set the school location.' },
    };
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, status: 400, body: { error: 'Valid GPS coordinates are required.' } };
  }

  if (
    !isWithinRadius(
      settings.latitude,
      settings.longitude,
      latitude,
      longitude,
      settings.radius_meters
    )
  ) {
    const distanceMeters = Math.round(
      haversineDistance(settings.latitude, settings.longitude, latitude, longitude)
    );
    return {
      ok: false,
      status: 400,
      body: {
        error: 'outside_zone',
        message: 'You are not within the school zone',
        distance_meters: distanceMeters,
        school: {
          latitude: settings.latitude,
          longitude: settings.longitude,
          radius_meters: settings.radius_meters,
        },
        outsideZone: true,
      },
    };
  }

  const today = todayDateString();
  const existing = await query(
    `SELECT id FROM staff_attendance
     WHERE tenant_id = $1 AND staff_id = $2 AND date = $3::date`,
    [tenantId, staffId, today]
  );
  if (existing.rows[0]) {
    return {
      ok: false,
      status: 400,
      body: { error: 'You have already checked in today.' },
    };
  }

  const now = new Date();
  const late = isLateCheckIn(now, settings.school_start_time, settings.late_threshold_minutes);
  const reason = String(lateReason || '').trim();
  if (late && !reason) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Late reason is required.', requiresReason: true, is_late: true },
    };
  }

  const res = await query(
    `INSERT INTO staff_attendance (
       tenant_id, staff_id, date, check_in_time,
       check_in_latitude, check_in_longitude,
       is_late, late_reason, check_in_method
     ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, 'self')
     RETURNING *`,
    [
      tenantId,
      staffId,
      today,
      now.toISOString(),
      roundCoord(latitude),
      roundCoord(longitude),
      late,
      late ? reason : null,
    ]
  );
  return { ok: true, record: res.rows[0] };
}

export async function adminCheckIn(
  tenantId: number,
  adminUserId: number,
  staffId: number,
  checkInTimeIso: string,
  lateReason?: string | null
): Promise<CheckInResult> {
  const settings = await getAttendanceSettings(tenantId);
  if (!settings) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Attendance settings are not configured.' },
    };
  }

  const staffRes = await query(
    `SELECT id, role FROM users
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_active, true) = true`,
    [staffId, tenantId]
  );
  if (!staffRes.rows[0]) {
    return { ok: false, status: 404, body: { error: 'Staff member not found.' } };
  }

  const checkInAt = new Date(checkInTimeIso);
  if (Number.isNaN(checkInAt.getTime())) {
    return { ok: false, status: 400, body: { error: 'Invalid check-in time.' } };
  }

  const dateYmd = checkInAt.toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
  const existing = await query(
    `SELECT id FROM staff_attendance
     WHERE tenant_id = $1 AND staff_id = $2 AND date = $3::date`,
    [tenantId, staffId, dateYmd]
  );
  if (existing.rows[0]) {
    return {
      ok: false,
      status: 400,
      body: { error: 'This staff member already has an attendance record for that date.' },
    };
  }

  const late = isLateCheckIn(
    checkInAt,
    settings.school_start_time,
    settings.late_threshold_minutes
  );
  const reason = String(lateReason || '').trim();
  if (late && !reason) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Late reason is required.', requiresReason: true, is_late: true },
    };
  }

  const res = await query(
    `INSERT INTO staff_attendance (
       tenant_id, staff_id, date, check_in_time,
       is_late, late_reason, check_in_method, admin_override_by
     ) VALUES ($1, $2, $3::date, $4, $5, $6, 'admin_override', $7)
     RETURNING *`,
    [tenantId, staffId, dateYmd, checkInAt.toISOString(), late, late ? reason : null, adminUserId]
  );
  return { ok: true, record: res.rows[0] };
}

export async function selfCheckOut(
  tenantId: number,
  staffId: number
): Promise<CheckInResult> {
  const today = todayDateString();
  const res = await query(
    `UPDATE staff_attendance
     SET check_out_time = CURRENT_TIMESTAMP,
         checkout_method = 'self',
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1
       AND staff_id = $2
       AND date = $3::date
       AND check_out_time IS NULL
     RETURNING *`,
    [tenantId, staffId, today]
  );
  if (!res.rows[0]) {
    return {
      ok: false,
      status: 400,
      body: { error: 'No open check-in found for today.' },
    };
  }
  return { ok: true, record: res.rows[0] };
}

/** Hard daily auto-checkout time (Africa/Accra) for all tenants. */
export const STAFF_AUTO_CHECKOUT_TIME = '18:00';

export async function autoCheckoutTenant(tenantId: number): Promise<number> {
  if (isWeekend()) return 0;
  const today = todayDateString();
  const checkoutAt = combineDateAndTimeUtc(today, STAFF_AUTO_CHECKOUT_TIME);

  const res = await query(
    `UPDATE staff_attendance
     SET check_out_time = $1,
         checkout_method = 'auto',
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2
       AND date = $3::date
       AND check_out_time IS NULL
     RETURNING id`,
    [checkoutAt.toISOString(), tenantId, today]
  );
  return res.rowCount ?? res.rows.length;
}

/** Add minutes to a HH:MM / HH:MM:SS time string; returns HH:MM:SS. */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const total = Math.round(timeToMinutes(timeStr) + minutesToAdd);
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = Math.floor(wrapped % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Push-notify every active school user who has not checked in today.
 * Runs ~1 hour after school_start_time.
 */
export async function sendMissingCheckInReminders(tenantId: number): Promise<number> {
  if (isWeekend()) return 0;
  const { sendPushToStaffUser } = await import('./webPushService.js');
  const today = todayDateString();
  const roles = [...ATTENDANCE_STAFF_ROLES];

  const res = await query(
    `SELECT u.id
     FROM users u
     WHERE u.tenant_id = $1
       AND COALESCE(u.is_active, true) = true
       AND u.role = ANY($2::text[])
       AND NOT EXISTS (
         SELECT 1 FROM staff_attendance sa
         WHERE sa.tenant_id = u.tenant_id
           AND sa.staff_id = u.id
           AND sa.date = $3::date
       )
     ORDER BY u.id`,
    [tenantId, roles, today]
  );

  let sent = 0;
  for (const row of res.rows) {
    const userId = Number(row.id);
    try {
      await sendPushToStaffUser(userId, {
        title: 'Staff Clock-In Reminder',
        body: 'You have not clocked in yet today. Please check in at school.',
        url: '/',
      });
      sent += 1;
    } catch (err) {
      console.warn(
        `[staff-attendance] Reminder push failed for user ${userId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return sent;
}

export type TodayStaffStatus = {
  staff_id: number;
  name: string;
  role: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean;
  late_reason: string | null;
  check_in_method: string | null;
  status: 'present' | 'absent' | 'checked_out' | 'weekend';
};

export async function getTodayOverview(
  tenantId: number,
  roleFilter?: string | null
): Promise<TodayStaffStatus[]> {
  const today = todayDateString();
  const isTodayWeekend = isWeekend(today);
  const roles = [...ATTENDANCE_STAFF_ROLES];
  const params: unknown[] = [tenantId, today, roles];
  let roleClause = '';
  if (roleFilter === 'teacher') {
    roleClause = ` AND u.role = 'teacher'`;
  } else if (roleFilter === 'non-teaching' || roleFilter === 'staff') {
    roleClause = ` AND u.role IN ('staff', 'administrator', 'finance', 'headmaster', 'driver')`;
  }

  const res = await query(
    `SELECT
       u.id AS staff_id,
       COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS name,
       u.role,
       sa.check_in_time,
       sa.check_out_time,
       COALESCE(sa.is_late, false) AS is_late,
       sa.late_reason,
       sa.check_in_method
     FROM users u
     LEFT JOIN staff_attendance sa
       ON sa.staff_id = u.id AND sa.tenant_id = u.tenant_id AND sa.date = $2::date
     WHERE u.tenant_id = $1
       AND COALESCE(u.is_active, true) = true
       AND u.role = ANY($3::text[])
       ${roleClause}
     ORDER BY name ASC`,
    params
  );

  return res.rows.map((row: any) => {
    let status: TodayStaffStatus['status'] = isTodayWeekend ? 'weekend' : 'absent';
    if (row.check_in_time && row.check_out_time) status = 'checked_out';
    else if (row.check_in_time) status = 'present';
    return {
      staff_id: Number(row.staff_id),
      name: String(row.name),
      role: String(row.role),
      check_in_time: row.check_in_time || null,
      check_out_time: row.check_out_time || null,
      is_late: !!row.is_late,
      late_reason: row.late_reason || null,
      check_in_method: row.check_in_method || null,
      status,
    };
  });
}

export async function getHistory(
  tenantId: number,
  opts: {
    staffId?: number | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    isLate?: boolean | null;
    page?: number;
    limit?: number;
  }
): Promise<{ items: any[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions = ['sa.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let i = 2;

  if (opts.staffId != null) {
    conditions.push(`sa.staff_id = $${i++}`);
    params.push(opts.staffId);
  }
  if (opts.dateFrom) {
    conditions.push(`sa.date >= $${i++}::date`);
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push(`sa.date <= $${i++}::date`);
    params.push(opts.dateTo);
  }
  if (opts.isLate === true) {
    conditions.push(`sa.is_late = true`);
  } else if (opts.isLate === false) {
    conditions.push(`sa.is_late = false`);
  }

  const where = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM staff_attendance sa WHERE ${where}`,
    params
  );
  const total = Number(countRes.rows[0]?.total) || 0;

  params.push(limit, offset);
  const itemsRes = await query(
    `SELECT
       sa.*,
       COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS staff_name,
       u.role AS staff_role
     FROM staff_attendance sa
     JOIN users u ON u.id = sa.staff_id AND u.tenant_id = sa.tenant_id
     WHERE ${where}
     ORDER BY sa.date DESC, sa.check_in_time DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  return { items: itemsRes.rows, total, page, limit };
}

export async function getMyHistory(
  tenantId: number,
  staffId: number,
  opts: { dateFrom?: string | null; dateTo?: string | null; page?: number; limit?: number }
) {
  return getHistory(tenantId, { ...opts, staffId });
}

/** Preview helper: whether a given time would be late for the tenant. */
export function wouldBeLate(
  settings: AttendanceSettings,
  checkInAt: Date | string
): boolean {
  return isLateCheckIn(
    checkInAt,
    settings.school_start_time,
    settings.late_threshold_minutes
  );
}
