import express from 'express';
import {
  authenticate,
  requireRole,
  requireTenant,
  type AuthRequest,
} from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  adminCheckIn,
  autoCheckoutTenant,
  getAttendanceSettings,
  getHistory,
  getMyHistory,
  getMyToday,
  getTodayOverview,
  isWeekend,
  selfCheckIn,
  selfCheckOut,
  upsertAttendanceSettings,
} from '../services/staffAttendanceService.js';
import { registerTenantAttendanceJobs } from '../jobs/staffAttendanceAutoCheckoutJob.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

const ADMIN_ROLES = ['super-admin', 'administrator'] as const;
const VIEW_ROLES = ['super-admin', 'administrator', 'headmaster'] as const;
const STAFF_ROLES = [
  'super-admin',
  'administrator',
  'headmaster',
  'teacher',
  'staff',
  'finance',
  'driver',
] as const;

function tenantIdOf(req: AuthRequest): number {
  return Number(req.user!.tenantId);
}

/** POST /settings — admin upsert */
router.post(
  '/settings',
  requireRole(...ADMIN_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = tenantIdOf(req);
      const {
        latitude,
        longitude,
        radius_meters,
        school_start_time,
        school_end_time,
        late_threshold_minutes,
      } = req.body || {};

      if (latitude == null || longitude == null || !school_start_time || !school_end_time) {
        return res.status(400).json({
          error: 'latitude, longitude, school_start_time, and school_end_time are required',
        });
      }

      const settings = await upsertAttendanceSettings(tenantId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: radius_meters != null ? Number(radius_meters) : undefined,
        school_start_time: String(school_start_time),
        school_end_time: String(school_end_time),
        late_threshold_minutes:
          late_threshold_minutes != null ? Number(late_threshold_minutes) : undefined,
      });

      registerTenantAttendanceJobs(tenantId, settings);
      res.json(settings);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status || 500;
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      res.status(status).json({ error: message });
    }
  }
);

/** GET /settings — admin / headmaster */
router.get(
  '/settings',
  requireRole(...VIEW_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const settings = await getAttendanceSettings(tenantIdOf(req));
      res.json(settings);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      res.status(500).json({ error: message });
    }
  }
);

/** POST /check-in — self geo check-in */
router.post('/check-in', requireRole(...STAFF_ROLES), async (req: AuthRequest, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const staffId = Number(req.user!.id);
    const { latitude, longitude, late_reason } = req.body || {};
    const result = await selfCheckIn(
      tenantId,
      staffId,
      Number(latitude),
      Number(longitude),
      late_reason != null ? String(late_reason) : null
    );
    if (!result.ok) return res.status(result.status).json(result.body);
    res.json(result.record);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    res.status(500).json({ error: message });
  }
});

/** POST /admin-check-in */
router.post(
  '/admin-check-in',
  requireRole(...ADMIN_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = tenantIdOf(req);
      const adminId = Number(req.user!.id);
      const { staff_id, check_in_time, late_reason } = req.body || {};
      if (staff_id == null || !check_in_time) {
        return res.status(400).json({ error: 'staff_id and check_in_time are required' });
      }
      const result = await adminCheckIn(
        tenantId,
        adminId,
        Number(staff_id),
        String(check_in_time),
        late_reason != null ? String(late_reason) : null
      );
      if (!result.ok) return res.status(result.status).json(result.body);
      res.json(result.record);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Admin check-in failed';
      res.status(500).json({ error: message });
    }
  }
);

/** POST /check-out — self */
router.post('/check-out', requireRole(...STAFF_ROLES), async (req: AuthRequest, res) => {
  try {
    const result = await selfCheckOut(tenantIdOf(req), Number(req.user!.id));
    if (!result.ok) return res.status(result.status).json(result.body);
    res.json(result.record);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-out failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /auto-checkout — internal/cron trigger for current tenant.
 * Also callable by admin for manual catch-up.
 */
router.post(
  '/auto-checkout',
  requireRole(...ADMIN_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const count = await autoCheckoutTenant(tenantIdOf(req));
      res.json({ checkedOut: count });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auto-checkout failed';
      res.status(500).json({ error: message });
    }
  }
);

/** GET /today — admin / headmaster overview */
router.get('/today', requireRole(...VIEW_ROLES), async (req: AuthRequest, res) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : null;
    const rows = await getTodayOverview(tenantIdOf(req), role);
    const isTodayWeekend = isWeekend();
    const summary = {
      total: rows.length,
      present: rows.filter((r) => r.status === 'present').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      checked_out: rows.filter((r) => r.status === 'checked_out').length,
      late: rows.filter((r) => r.is_late).length,
      weekend: rows.filter((r) => r.status === 'weekend').length,
      is_weekend: isTodayWeekend,
    };
    res.json({ summary, staff: rows, is_weekend: isTodayWeekend });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load today overview';
    res.status(500).json({ error: message });
  }
});

/** GET /history — admin / headmaster */
router.get('/history', requireRole(...VIEW_ROLES), async (req: AuthRequest, res) => {
  try {
    const isLateRaw = req.query.is_late;
    let isLate: boolean | null = null;
    if (isLateRaw === 'true' || isLateRaw === '1') isLate = true;
    else if (isLateRaw === 'false' || isLateRaw === '0') isLate = false;

    const data = await getHistory(tenantIdOf(req), {
      staffId: req.query.staff_id ? Number(req.query.staff_id) : null,
      dateFrom: typeof req.query.date_from === 'string' ? req.query.date_from : null,
      dateTo: typeof req.query.date_to === 'string' ? req.query.date_to : null,
      isLate,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load history';
    res.status(500).json({ error: message });
  }
});

/** GET /my-history — own records only */
router.get('/my-history', requireRole(...STAFF_ROLES), async (req: AuthRequest, res) => {
  try {
    const data = await getMyHistory(tenantIdOf(req), Number(req.user!.id), {
      dateFrom: typeof req.query.date_from === 'string' ? req.query.date_from : null,
      dateTo: typeof req.query.date_to === 'string' ? req.query.date_to : null,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load your history';
    res.status(500).json({ error: message });
  }
});

/** GET /my-today */
router.get('/my-today', requireRole(...STAFF_ROLES), async (req: AuthRequest, res) => {
  try {
    const record = await getMyToday(tenantIdOf(req), Number(req.user!.id));
    const settings = await getAttendanceSettings(tenantIdOf(req));
    const isTodayWeekend = isWeekend();
    res.json({
      record,
      is_weekend: isTodayWeekend,
      settings: settings
        ? {
            school_start_time: settings.school_start_time,
            school_end_time: settings.school_end_time,
            late_threshold_minutes: settings.late_threshold_minutes,
            radius_meters: settings.radius_meters,
            configured: settings.latitude != null && settings.longitude != null,
          }
        : { configured: false },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load today status';
    res.status(500).json({ error: message });
  }
});

export default router;
