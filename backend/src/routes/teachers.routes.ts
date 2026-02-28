import express from 'express';
import * as controller from '../controllers/teachers.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// NOTE: static routes MUST stay above /:id — Express 5 still matches in registration order
router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/next-id', requireAuth, controller.getNextId);   // ← before /:id
router.get('/:id', requireAuth, controller.get);
router.patch('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);

export default router;
