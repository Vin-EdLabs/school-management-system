import express from 'express';
import * as controller from '../controllers/payments.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

const router = express.Router();

const financeManageRoles = ['finance', 'accountant', 'super-admin'];
const financeViewRoles = ['finance', 'accountant', 'super-admin', 'admin', 'administrator'];

router.get('/', requireAuth, requireRole(financeViewRoles), controller.list);
router.post('/', requireAuth, requireRole(financeManageRoles), controller.create);
router.get('/:id', requireAuth, requireRole(financeViewRoles), controller.get);
router.get('/student/:studentId', requireAuth, requireRole(financeViewRoles), controller.byStudent);
router.get('/term/:termId', requireAuth, requireRole(financeViewRoles), controller.byTerm);
router.get('/export', requireAuth, requireRole(financeManageRoles), controller.exportList);

export default router;
