import { Router } from 'express';
import * as controller from '../controllers/schedules.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

const router = Router();

// Management routes (admin + super-admin)
router.post('/', requireAuth, requireRole(['admin','super-admin']), controller.create);
router.put('/:id', requireAuth, requireRole(['admin','super-admin']), controller.update);
router.delete('/:id', requireAuth, requireRole(['admin','super-admin']), controller.remove);

// Read routes (any authenticated user can view schedules)
router.get('/teacher/:id', requireAuth, controller.byTeacher);
router.get('/class/:id', requireAuth, controller.byClass);
router.get('/', requireAuth, controller.listAll);

export default router;
