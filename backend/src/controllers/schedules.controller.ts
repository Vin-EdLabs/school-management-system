import type { Request, Response } from 'express';
import * as service from '../services/schedules.service.js';
import { ConflictError } from '../utils/errors.js';
import { failure, success } from '../utils/response.js';

export async function create(req: Request, res: Response) {
  try {
    const payload = req.body || {};
    const created = await service.createSchedule(payload);
    return res.status(201).json(success(created));
  } catch (err: any) {
    if (err instanceof ConflictError) {
      return res.status(409).json(failure(err.message, err.details));
    }
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await service.updateSchedule(id, req.body || {});
    return res.json(success(updated));
  } catch (err: any) {
    if (err instanceof ConflictError) {
      return res.status(409).json(failure(err.message, err.details));
    }
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await service.deleteSchedule(id);
    return res.json(success({ deleted: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byTeacher(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await service.listByTeacher(id);
    return res.json(success(rows));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byClass(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const rows = await service.listByClass(id);
    return res.json(success(rows));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function listAll(req: Request, res: Response) {
  try {
    const rows = await service.listAll();
    return res.json(success(rows));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export default { create, update, remove, byTeacher, byClass, listAll };
