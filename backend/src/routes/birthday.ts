import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getBirthdaysToday,
  getUpcomingBirthdays,
  getBirthdaysByMonthSections,
  getClassBirthdaysToday,
  getMyClassesBirthdaysToday,
  getTeacherClassesBirthdaysByMonthSections,
  sendBirthdayNotifications,
  getBirthdayMessageConfig,
  saveBirthdayMessageConfig,
  DEFAULT_BIRTHDAY_MESSAGE_CONFIG,
} from '../services/birthdayService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

function resolveTenantId(req: AuthRequest): number {
  const fromUser = req.user?.tenantId;
  if (fromUser != null && !Number.isNaN(Number(fromUser))) return Number(fromUser);
  throw new Error('School context required');
}

router.get('/settings', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const config = await getBirthdayMessageConfig(tenantId);
    res.json({ config, placeholders: ['{{name}}', '{{age}}', '{{class}}'], defaults: DEFAULT_BIRTHDAY_MESSAGE_CONFIG });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load birthday settings' });
  }
});

router.put('/settings', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const config = await saveBirthdayMessageConfig(tenantId, req.body || {});
    res.json({ config });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save birthday settings' });
  }
});

router.get('/today', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const birthdays = await getBirthdaysToday(tenantId);
    const role = req.user?.role;
    if (role === 'super-admin' || role === 'administrator') {
      await sendBirthdayNotifications(tenantId, birthdays);
    }
    res.json(birthdays);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch birthdays' });
  }
});

router.get('/upcoming', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    if (req.query.scope === 'months') {
      const sections = await getBirthdaysByMonthSections(tenantId);
      return res.json(sections);
    }
    const days = parseInt(req.query.days as string) || 30;
    const upcoming = await getUpcomingBirthdays(tenantId, days);
    res.json(upcoming);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch upcoming birthdays' });
  }
});

router.get('/class/:classId/today', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const classId = parseInt(req.params.classId);
    if (isNaN(classId)) return res.status(400).json({ error: 'Invalid class ID' });
    const birthdays = await getClassBirthdaysToday(tenantId, classId);
    res.json(birthdays);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch class birthdays' });
  }
});

router.get('/my-classes/today', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const teacherId = req.user?.teacherId;
    if (!teacherId) return res.status(403).json({ error: 'Only teachers can access this' });

    const birthdays = await getMyClassesBirthdaysToday(tenantId, parseInt(teacherId, 10));
    res.json(birthdays);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch class birthdays' });
  }
});

router.get('/my-classes/upcoming', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const teacherId = req.user?.teacherId;
    if (!teacherId) return res.status(403).json({ error: 'Only teachers can access this' });

    if (req.query.scope === 'months') {
      const sections = await getTeacherClassesBirthdaysByMonthSections(
        tenantId,
        parseInt(teacherId, 10)
      );
      return res.json(sections);
    }

    const days = parseInt(req.query.days as string, 10) || 30;
    const sections = await getTeacherClassesBirthdaysByMonthSections(
      tenantId,
      parseInt(teacherId, 10)
    );
    const upcoming = sections.groups.filter((group) => {
      const groupDate = new Date(group.date + 'T12:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((groupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= days;
    });
    res.json(upcoming);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch class birthdays' });
  }
});

export default router;
