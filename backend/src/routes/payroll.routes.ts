import express from 'express';
import * as controller from '../controllers/payroll.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Payroll run management
router.post('/', requireAuth, controller.createPayrollRun);
router.get('/', requireAuth, controller.listPayrollRuns);
router.get('/:payrollRunId', requireAuth, controller.getPayrollRun);
router.post('/:payrollRunId/initialize', requireAuth, controller.initializePayrollRun);

// Payment recording
router.post('/:payrollItemId/payment', requireAuth, controller.recordPayrollPayment);
router.get('/staff/:staffId/history', requireAuth, controller.getStaffPaymentHistory);

// Deductions
router.post('/:payrollItemId/deductions', requireAuth, controller.addDeduction);
router.get('/:payrollItemId/deductions', requireAuth, controller.getDeductions);

// Reports
router.post('/:payrollRunId/report', requireAuth, controller.generateReport);

export default router;
