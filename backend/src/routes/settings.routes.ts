import express from 'express';
import * as controller from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/active-term', requireAuth, controller.getActiveTerm);
router.put('/active-term', requireAuth, controller.setActiveTerm);
router.get('/active-year', requireAuth, controller.getActiveYear);
router.put('/active-year', requireAuth, controller.setActiveYear);

export default router;
