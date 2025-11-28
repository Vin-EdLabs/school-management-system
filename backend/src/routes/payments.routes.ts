import express from 'express';
import * as controller from '../controllers/payments.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.get);
router.get('/student/:studentId', requireAuth, controller.byStudent);
router.get('/term/:termId', requireAuth, controller.byTerm);
router.get('/export', requireAuth, controller.exportList);

export default router;
