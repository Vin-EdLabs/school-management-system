import express from 'express';
import * as controller from '../controllers/income.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

const router = express.Router();

router.get('/', requireAuth, requireRole(['finance', 'accountant', 'super-admin']), controller.list);
router.post('/', requireAuth, requireRole(['finance', 'accountant', 'super-admin']), controller.create);
router.put('/:id', requireAuth, requireRole(['finance', 'accountant', 'super-admin']), controller.update);
router.delete('/:id', requireAuth, requireRole(['finance', 'accountant', 'super-admin']), controller.remove);
router.get('/year/:year', requireAuth, requireRole(['finance', 'accountant', 'super-admin']), controller.list);

export default router;
