import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getBirthdaysToday,
  getUpcomingBirthdays,
  getBirthdaysByMonthSections,
  getClassBirthdaysToday,
  getClassTeacherIds,
  sendBirthdayNotifications,
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

router.get('/today', async (req: AuthRequest, res: any) => {
  try {
    const tenantId = resolveTenantId(req);
    const birthdays = await getBirthdaysToday(tenantId);
    await sendBirthdayNotifications(tenantId, birthdays);
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

    const classIds = await getClassTeacherIds(tenantId, parseInt(teacherId));
    if (classIds.length === 0) return res.json([]);

    const allBirthdays: any[] = [];
    for (const classId of classIds) {
      const birthdays = await getClassBirthdaysToday(tenantId, classId);
      allBirthdays.push(...birthdays);
    }
    res.json(allBirthdays);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch class birthdays' });
  }
});

export default router;
