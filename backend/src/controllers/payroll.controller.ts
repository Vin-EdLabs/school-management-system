import type { Request, Response } from 'express';
import * as payrollService from '../services/payroll.service.js';
import { failure, success } from '../utils/response.js';

export async function createPayrollRun(req: Request, res: Response) {
  try {
    const { monthYear } = req.body;
    if (!monthYear) {
      return res.status(400).json(failure('monthYear is required (format: YYYY-MM)'));
    }

    const run = await payrollService.createPayrollRun(monthYear);
    return res.status(201).json(success(run));
  } catch (err: any) {
    return res.status(400).json(failure(err.message ?? 'Failed to create payroll run'));
  }
}

export async function initializePayrollRun(req: Request, res: Response) {
  try {
    const { payrollRunId } = req.params;
    const id = Number(payrollRunId);

    const result = await payrollService.initializePayrollRun(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(400).json(failure(err.message ?? 'Failed to initialize payroll run'));
  }
}

export async function getPayrollRun(req: Request, res: Response) {
  try {
    const { payrollRunId } = req.params;
    const id = Number(payrollRunId);

    const run = await payrollService.getPayrollRunWithItems(id);
    return res.json(success(run));
  } catch (err: any) {
    return res.status(404).json(failure(err.message ?? 'Payroll run not found'));
  }
}

export async function listPayrollRuns(req: Request, res: Response) {
  try {
    const runs = await payrollService.listPayrollRuns();
    return res.json(success(runs));
  } catch (err: any) {
    return res.status(500).json(failure(err.message ?? 'Failed to list payroll runs'));
  }
}

export async function recordPayrollPayment(req: Request, res: Response) {
  try {
    const { payrollItemId } = req.params;
    const { paymentDate, paymentMethod, referenceNumber } = req.body;

    if (!paymentDate) {
      return res.status(400).json(failure('paymentDate is required'));
    }

    const result = await payrollService.processPayrollPayment(
      Number(payrollItemId),
      paymentDate,
      paymentMethod || 'bank_transfer',
      referenceNumber
    );

    return res.json(success(result));
  } catch (err: any) {
    return res.status(400).json(failure(err.message ?? 'Failed to record payment'));
  }
}

export async function getStaffPaymentHistory(req: Request, res: Response) {
  try {
    const { staffId } = req.params;
    const history = await payrollService.getStaffPaymentHistory(Number(staffId));
    return res.json(success(history));
  } catch (err: any) {
    return res.status(500).json(failure(err.message ?? 'Failed to get payment history'));
  }
}

export async function addDeduction(req: Request, res: Response) {
  try {
    const { payrollItemId } = req.params;
    const { deductionType, amount, description } = req.body;

    if (!deductionType || !amount) {
      return res.status(400).json(failure('deductionType and amount are required'));
    }

    const result = await payrollService.addDeductionToPayrollItem(
      Number(payrollItemId),
      deductionType,
      amount,
      description
    );

    return res.json(success(result));
  } catch (err: any) {
    return res.status(400).json(failure(err.message ?? 'Failed to add deduction'));
  }
}

export async function getDeductions(req: Request, res: Response) {
  try {
    const { payrollItemId } = req.params;
    const deductions = await payrollService.getPayrollDeductions(Number(payrollItemId));
    return res.json(success(deductions));
  } catch (err: any) {
    return res.status(500).json(failure(err.message ?? 'Failed to get deductions'));
  }
}

export async function generateReport(req: Request, res: Response) {
  try {
    const { payrollRunId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json(failure('Unauthorized'));
    }

    const report = await payrollService.generatePayrollReport(Number(payrollRunId), userId);
    return res.json(success(report));
  } catch (err: any) {
    return res.status(400).json(failure(err.message ?? 'Failed to generate report'));
  }
}

export default {
  createPayrollRun,
  initializePayrollRun,
  getPayrollRun,
  listPayrollRuns,
  recordPayrollPayment,
  getStaffPaymentHistory,
  addDeduction,
  getDeductions,
  generateReport
};
