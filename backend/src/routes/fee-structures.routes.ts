import express from 'express';
import * as controller from '../controllers/feeStructures.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.get);
router.put('/:id', requireAuth, controller.update);
router.post('/:id/assign-class', requireAuth, controller.assignClass);
router.post('/:id/assign-term', requireAuth, controller.assignTerm);

export default router;
