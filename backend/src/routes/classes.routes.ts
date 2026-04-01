import express from 'express';
import * as controller from '../controllers/classes.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.get);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);
router.get('/:id/students', requireAuth, controller.students);

export default router;
