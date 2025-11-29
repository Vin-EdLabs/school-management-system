import express from 'express';
import * as controller from '../controllers/teachers.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.get);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);

export default router;
