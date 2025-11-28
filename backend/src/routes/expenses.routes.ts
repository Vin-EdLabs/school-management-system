import express from 'express';
import * as controller from '../controllers/expenses.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);
router.get('/year/:year', requireAuth, controller.list);
router.get('/categories', requireAuth, controller.categories);

export default router;
