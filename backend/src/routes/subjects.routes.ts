import express from 'express';
import * as controller from '../controllers/subjects.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, controller.listSubjects);
router.post('/', requireAuth, controller.createSubject);
router.get('/:id', requireAuth, controller.getSubject);
router.delete('/:id', requireAuth, controller.deleteSubject);

export default router;
