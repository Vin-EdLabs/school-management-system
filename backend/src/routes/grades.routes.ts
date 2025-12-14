import express from 'express';
import * as controller from '../controllers/grades.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Exam types
router.get('/types', requireAuth, controller.listExamTypes);
router.post('/types', requireAuth, controller.createExamType);

// Exams
router.get('/', requireAuth, controller.listExams);
router.post('/', requireAuth, controller.createExam);
router.put('/:id/lock', requireAuth, controller.lockExam);

// Grades for an exam
router.get('/:id/grades', requireAuth, controller.getGrades);
router.post('/:id/grades', requireAuth, controller.saveGrades);

// Grade boundaries
router.get('/boundaries', requireAuth, controller.listBoundaries);
router.post('/boundaries', requireAuth, controller.createBoundary);
router.put('/boundaries/:id', requireAuth, controller.updateBoundary);
router.delete('/boundaries/:id', requireAuth, controller.deleteBoundary);

// Single grade operations
router.put('/grade/:id', requireAuth, controller.updateGrade);
router.delete('/grade/:id', requireAuth, controller.removeGrade);

// Analytics
router.get('/:id/analytics', requireAuth, controller.analytics);

export default router;
