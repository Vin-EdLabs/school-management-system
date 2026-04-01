import type { Request, Response } from 'express';
import * as expensesService from '../services/expenses.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const yearRaw = req.query.year ?? req.params.year;
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (year !== undefined && Number.isNaN(year)) return res.status(400).json(failure('Invalid year'));
    if (year) {
      const list = await expensesService.listExpensesForYear(year);
      return res.json(success(list));
    }
    const list = await expensesService.listAllExpenses();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || req.body.amount == null) return res.status(400).json(failure('Missing amount'));
    const created = await expensesService.createExpense(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const item = await expensesService.getExpense(id) as any;
    if (!item) return res.status(404).json(failure('Expense not found'));
    return res.json(success(item));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const updated = await expensesService.updateExpense(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const result = await expensesService.deleteExpense(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function categories(req: Request, res: Response) {
  try {
    const cats = await expensesService.listExpenseCategories();
    return res.json(success(cats));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
