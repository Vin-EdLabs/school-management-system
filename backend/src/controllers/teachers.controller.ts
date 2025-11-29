import type { Request, Response } from 'express';
import * as service from '../services/teachers.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const list = await service.listTeachers();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const t = await service.getTeacher(id);
    if (!t) return res.status(404).json(failure('Teacher not found'));
    return res.json(success(t));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    const created = await service.createTeacher(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await service.updateTeacher(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deleteTeacher(Number(req.params.id));
    return res.json(success({ deleted: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export default { list, get, create, update, remove };
