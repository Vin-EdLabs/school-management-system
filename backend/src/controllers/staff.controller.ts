import type { Request, Response } from 'express';
import * as service from '../services/staff.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const list = await service.listStaff();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const s = await service.getStaff(id);
    if (!s) return res.status(404).json(failure('Staff member not found'));
    return res.json(success(s));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function getNextId(req: Request, res: Response) {
  try {
    const nextId = await service.getNextStaffId();
    return res.json(success({ nextId }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || (!req.body.username && !req.body.staffId && !req.body.staff_id)) return res.status(400).json(failure('Missing staff identifier'));
    // Pass all body fields through so service can extract profile meta
    const created = await service.createStaff(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await service.updateStaff(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteStaff(Number(req.params.id));
    return res.json(success({ deleted: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function pay(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const date = req.body?.date ?? new Date().toISOString().split('T')[0];
    const result = await service.payStaff(id, date);
    if (!result) return res.status(404).json(failure('Staff member not found'));
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export default { list, get, getNextId, create, update, remove, pay };
