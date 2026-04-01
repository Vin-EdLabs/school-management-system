import express from 'express';
import * as controller from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/fees/term/:termId', requireAuth, controller.termReport);
router.get('/income/year/:year', requireAuth, controller.summary);
router.get('/expenses/year/:year', requireAuth, controller.summary);
router.get('/net/year/:year', requireAuth, controller.summary);

export default router;
