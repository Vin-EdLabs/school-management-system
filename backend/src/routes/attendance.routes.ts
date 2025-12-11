import express from 'express';
import * as controller from '../controllers/attendance.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Mark single attendance
router.post('/', requireAuth, controller.markAttendance);

// Bulk mark attendance
router.post('/bulk', requireAuth, controller.bulkMarkAttendance);

// Get attendance by class and date
router.get('/class/:classId', requireAuth, controller.getAttendanceByClass);

// Get attendance by class and date range
router.get('/class/:classId/range', requireAuth, controller.getAttendanceByDateRange);

// Get attendance by student
router.get('/student/:studentId', requireAuth, controller.getAttendanceByStudent);

// Delete attendance
router.delete('/:id', requireAuth, controller.deleteAttendance);

export default router;
