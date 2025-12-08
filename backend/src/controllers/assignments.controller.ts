import type { Request, Response } from 'express';
import * as service from '../services/assignments.service.js';
import { success, failure } from '../utils/response.js';

export async function create(req: Request, res: Response) {
  try {
    const { teacher_id, class_id } = req.body || {};
    if (!teacher_id || !class_id) return res.status(400).json(failure('Missing teacher_id or class_id'));
    const created = await service.addAssignment(Number(teacher_id), Number(class_id));
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const { teacher_id, class_id } = req.body || {};
    if (!teacher_id || !class_id) return res.status(400).json(failure('Missing teacher_id or class_id'));
    const removed = await service.removeAssignment(Number(teacher_id), Number(class_id));
    return res.json(success(removed));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byTeacher(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const list = await service.listByTeacher(id);
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function byClass(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const list = await service.listByClass(id);
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export default { create, remove, byTeacher, byClass };
