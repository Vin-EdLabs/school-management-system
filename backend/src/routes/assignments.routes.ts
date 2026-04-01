import { Router } from 'express';
import * as controller from '../controllers/assignments.controller.js';

const router = Router();

router.post('/', controller.create);
router.delete('/', controller.remove);
router.get('/teacher/:id', controller.byTeacher);
router.get('/class/:id', controller.byClass);

export default router;
