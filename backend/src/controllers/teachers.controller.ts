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
    // Safety net: if routing ever sends "next-id" here, return 400 not 404
    if (req.params.id === 'next-id') return res.status(400).json(failure('Invalid teacher id'));
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(failure('Invalid teacher id'));
    const t = await service.getTeacher(id);
    if (!t) return res.status(404).json(failure('Teacher not found'));
    return res.json(success(t));
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
    if (!req.body || (!req.body.staffId && !req.body.staff_id)) {
      // staffId is optional — backend will auto-generate if omitted
    }
    const created = await service.createTeacher(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(failure('Invalid teacher id'));
    const updated = await service.updateTeacher(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    if (err.message === 'Teacher not found') return res.status(404).json(failure(err.message));
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(failure('Invalid teacher id'));
    await service.deleteTeacher(id);
    return res.json(success({ deleted: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export default { list, get, getNextId, create, update, remove };
