import express from 'express';
import * as controller from '../controllers/feeStructures.controller.js';
import { requireAuth } from '../middlewares/auth.js';

import { requireRole } from '../middlewares/roles.js';

const router = express.Router();

const manageRoles = ['finance', 'accountant', 'super-admin', 'admin', 'administrator'];
const viewRoles = ['finance', 'accountant', 'super-admin', 'admin', 'administrator', 'teacher'];

router.get('/', requireAuth, requireRole(viewRoles), controller.list);
router.post('/', requireAuth, requireRole(manageRoles), controller.create);
router.get('/:id', requireAuth, requireRole(viewRoles), controller.get);
router.put('/:id', requireAuth, requireRole(manageRoles), controller.update);
router.patch('/:id', requireAuth, requireRole(manageRoles), controller.update);
router.delete('/:id', requireAuth, requireRole(manageRoles), controller.remove);
router.post('/:id/assign-class', requireAuth, requireRole(manageRoles), controller.assignClass);
router.post('/:id/assign-term', requireAuth, requireRole(manageRoles), controller.assignTerm);

export default router;
