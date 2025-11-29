import { Router } from 'express';
import aggregationsRoutes from './aggregations.routes.js';
import auditRoutes from './audit.routes.js';
import authRoutes from './auth.routes.js';
import classesRoutes from './classes.routes.js';
import expensesRoutes from './expenses.routes.js';
import feeRoutes from './fee-structures.routes.js';
import incomeRoutes from './income.routes.js';
import notificationsRoutes from './notifications.routes.js';
import eventsRoutes from './events.routes.js';
import paymentsRoutes from './payments.routes.js';
import permissionsRoutes from './permissions.routes.js';
import reportsRoutes from './reports.routes.js';
import settingsRoutes from './settings.routes.js';
import studentsRoutes from './students.routes.js'

const router = Router();

router.use('/auth', authRoutes);
router.use('/students', studentsRoutes);
router.use('/classes', classesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/income', incomeRoutes);
router.use('/expenses', expensesRoutes);
router.use('/fee-structures', feeRoutes);
router.use('/audit', auditRoutes);
router.use('/reports', reportsRoutes);
router.use('/events', eventsRoutes);
router.use('/aggregations', aggregationsRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/permissions', permissionsRoutes);

export default router;
