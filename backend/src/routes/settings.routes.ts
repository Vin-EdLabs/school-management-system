import express from 'express';
import * as controller from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.js';

import { requireRole } from '../middlewares/roles.js';

const router = express.Router();

const adminRoles = ['super-admin', 'admin', 'administrator'];

router.get('/', requireAuth, requireRole(adminRoles), controller.list);

router.get('/active-term', requireAuth, controller.getActiveTerm);
router.put('/active-term/:id', requireAuth, requireRole(adminRoles), controller.setActiveTerm);
router.post('/active-term', requireAuth, requireRole(adminRoles), controller.setActiveTerm); // backup for body match
router.get('/active-year', requireAuth, controller.getActiveYear);
router.put('/active-year', requireAuth, requireRole(adminRoles), controller.setActiveYear);

router.get('/terms', requireAuth, controller.listTerms);
router.post('/terms', requireAuth, requireRole(adminRoles), controller.createTerm);
router.put('/terms/:id', requireAuth, requireRole(adminRoles), controller.updateTerm);
router.delete('/terms/:id', requireAuth, requireRole(adminRoles), controller.deleteTerm);

export default router;
