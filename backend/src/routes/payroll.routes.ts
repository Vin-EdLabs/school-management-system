import express from 'express';
import * as controller from '../controllers/payroll.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

const router = express.Router();

const financeRoles = ['finance', 'accountant', 'super-admin'];

// Payroll run management
router.post('/', requireAuth, requireRole(financeRoles), controller.createPayrollRun);
router.get('/', requireAuth, requireRole(financeRoles), controller.listPayrollRuns);
router.get('/:payrollRunId', requireAuth, requireRole(financeRoles), controller.getPayrollRun);
router.post('/:payrollRunId/initialize', requireAuth, requireRole(financeRoles), controller.initializePayrollRun);

// Payment recording
router.post('/:payrollItemId/payment', requireAuth, requireRole(financeRoles), controller.recordPayrollPayment);
router.get('/staff/:staffId/history', requireAuth, requireRole(financeRoles), controller.getStaffPaymentHistory);

// Deductions & Bonuses
router.post('/:payrollItemId/deductions', requireAuth, requireRole(financeRoles), controller.addDeduction);
router.get('/:payrollItemId/deductions', requireAuth, requireRole(financeRoles), controller.getDeductions);
router.post('/:payrollItemId/bonuses', requireAuth, requireRole(financeRoles), controller.addBonus);

// Reports
router.post('/:payrollRunId/report', requireAuth, requireRole(financeRoles), controller.generateReport);

export default router;
