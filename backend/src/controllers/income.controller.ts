import type { Request, Response } from 'express';
import * as incomeService from '../services/income.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    // accept optional year from query or params
    const yearRaw = req.query.year ?? req.params.year;
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (year !== undefined && Number.isNaN(year)) return res.status(400).json(failure('Invalid year'));
    if (year) {
      const list = await incomeService.listIncomeForYear(year);
      return res.json(success(list));
    }
    const list = await incomeService.listAllIncome();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || req.body.amount == null) return res.status(400).json(failure('Missing amount'));
    const created = await incomeService.createIncome(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const item = await incomeService.getIncome(id);
    if (!item) return res.status(404).json(failure('Income record not found'));
    return res.json(success(item));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const updated = await incomeService.updateIncome(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const result = await incomeService.deleteIncome(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
