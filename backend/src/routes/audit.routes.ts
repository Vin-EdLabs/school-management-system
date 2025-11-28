import express from 'express';
import * as controller from '../controllers/audit.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/logins', requireAuth, controller.listLogins);
router.get('/activity', requireAuth, controller.listAll);
router.get('/export', requireAuth, controller.listAll);

export default router;
