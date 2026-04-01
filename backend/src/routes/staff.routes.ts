import express from 'express';
import * as controller from '../controllers/staff.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.get('/next-id', requireAuth, controller.getNextId);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.get);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);
router.post('/:id/pay', requireAuth, controller.pay);

export default router;
