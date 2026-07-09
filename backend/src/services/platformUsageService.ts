import { query } from '../db/connection.js';
import {
  GRADE_EVENT_TYPES,
  TEACHER_STAFF_EVENT_TYPES,
  labelPlatformEventType,
} from './platformEventService.js';

export type DailyUsageRow = {
  date: string;
  total_events: number;
  logins: number;
  students: number;
  teachers_staff: number;
  grade_entries: number;
  attendance_marks: number;
  finance_txns: number;
  record_edits: number;
  active_tenants: number;
};

export type HourlyUsageRow = {
  hour: number;
  count: number;
};

export type UsageBreakdownItem = {
  eventType: string;
  label: string;
  count: number;
};

export type UsageSummary = {
  loginsToday: number;
  activeTenantsToday: number;
  eventsToday: number;
  topEventType: string;
  breakdown: UsageBreakdownItem[];
};

export async function getDailyUsage(days: number): Promise<DailyUsageRow[]> {
  const safeDays = Math.min(Math.max(Math.floor(days) || 30, 1), 90);
  const result = await query(
    `WITH day_series AS (
       SELECT generate_series(
         (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS day
     )
     SELECT
       to_char(ds.day, 'YYYY-MM-DD') AS date,
       COALESCE(COUNT(pe.id), 0)::int AS total_events,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = 'login'), 0)::int AS logins,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = 'student_action'), 0)::int AS students,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = ANY($3::text[])), 0)::int AS teachers_staff,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = ANY($2::text[])), 0)::int AS grade_entries,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = 'attendance_mark'), 0)::int AS attendance_marks,
       COALESCE(COUNT(pe.id) FILTER (WHERE pe.event_type = 'finance_txn'), 0)::int AS finance_txns,
       COALESCE(
         COUNT(pe.id) FILTER (
           WHERE pe.event_type IN ('record_edit', 'class_action', 'settings_action', 'other')
         ),
         0
       )::int AS record_edits,
       COALESCE(COUNT(DISTINCT pe.tenant_id) FILTER (WHERE pe.tenant_id IS NOT NULL), 0)::int AS active_tenants
     FROM day_series ds
     LEFT JOIN platform_events pe ON pe.created_at::date = ds.day
     GROUP BY ds.day
     ORDER BY ds.day`,
    [safeDays, [...GRADE_EVENT_TYPES], [...TEACHER_STAFF_EVENT_TYPES]]
  );
  return result.rows as DailyUsageRow[];
}

export async function getHourlyUsageToday(): Promise<HourlyUsageRow[]> {
  const result = await query(
    `WITH hour_series AS (
       SELECT generate_series(0, 23) AS hour
     )
     SELECT
       hs.hour::int AS hour,
       COALESCE(COUNT(pe.id), 0)::int AS count
     FROM hour_series hs
     LEFT JOIN platform_events pe
       ON pe.created_at >= CURRENT_DATE
      AND pe.created_at < CURRENT_DATE + INTERVAL '1 day'
      AND EXTRACT(HOUR FROM pe.created_at) = hs.hour
     GROUP BY hs.hour
     ORDER BY hs.hour`
  );
  return result.rows as HourlyUsageRow[];
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const [summaryRes, topRes, breakdownRes] = await Promise.all([
    query(
      `SELECT
         COALESCE(COUNT(*) FILTER (WHERE event_type = 'login'), 0)::int AS logins_today,
         COALESCE(COUNT(DISTINCT tenant_id) FILTER (WHERE tenant_id IS NOT NULL), 0)::int AS active_tenants_today,
         COALESCE(COUNT(*), 0)::int AS events_today
       FROM platform_events
       WHERE created_at >= CURRENT_DATE`
    ),
    query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM platform_events
       WHERE created_at >= CURRENT_DATE
       GROUP BY event_type
       ORDER BY count DESC, event_type ASC
       LIMIT 1`
    ),
    query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM platform_events
       WHERE created_at >= CURRENT_DATE
       GROUP BY event_type
       ORDER BY count DESC, event_type ASC
       LIMIT 12`
    ),
  ]);

  const summary = summaryRes.rows[0] || {
    logins_today: 0,
    active_tenants_today: 0,
    events_today: 0,
  };
  const topType = topRes.rows[0]?.event_type
    ? labelPlatformEventType(String(topRes.rows[0].event_type))
    : '—';

  const breakdown: UsageBreakdownItem[] = (breakdownRes.rows || []).map((row: { event_type: string; count: number }) => ({
    eventType: String(row.event_type),
    label: labelPlatformEventType(String(row.event_type)),
    count: Number(row.count) || 0,
  }));

  return {
    loginsToday: Number(summary.logins_today) || 0,
    activeTenantsToday: Number(summary.active_tenants_today) || 0,
    eventsToday: Number(summary.events_today) || 0,
    topEventType: topType,
    breakdown,
  };
}
