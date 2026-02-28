import express from 'express';
import * as controller from '../controllers/balances.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/term/:termId', requireAuth, controller.listByTerm);
router.get('/student/:studentId/term/:termId', requireAuth, controller.getStudentBalance);
router.put('/student/:studentId/term/:termId', requireAuth, controller.update);

export default router;
