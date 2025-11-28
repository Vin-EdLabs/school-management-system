import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/login', authCtrl.login);
router.post('/logout', requireAuth, authCtrl.logout);
router.get('/session', authCtrl.session);
router.get('/roles', authCtrl.roles);

export default router;
