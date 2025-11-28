import type { Request, Response } from 'express';
import * as paymentsService from '../services/payments.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const list = await paymentsService.listPayments(req.query ?? {} as any);
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    const recorded = await paymentsService.recordPayment(req.body);
    return res.status(201).json(success(recorded));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const p = await paymentsService.getPayment(id);
    if (!p) return res.status(404).json(failure('Payment not found'));
    return res.json(success(p));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byStudent(req: Request, res: Response) {
  try {
    const studentId = Number(req.params.studentId);
    const payments = await paymentsService.getPaymentsForStudent(studentId);
    return res.json(success(payments));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byTerm(req: Request, res: Response) {
  try {
    const list = await paymentsService.listPayments({ termId: req.params.termId });
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function exportList(req: Request, res: Response) {
  try {
    const csvBuffer = await paymentsService.exportPaymentsCsv(req.query ?? {} as any);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    return res.send(csvBuffer);
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
