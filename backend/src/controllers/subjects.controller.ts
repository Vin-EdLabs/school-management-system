import type { Request, Response } from 'express';
import * as repo from '../repositories/subjects.repository.js';
import { failure, success } from '../utils/response.js';

export async function listSubjects(req: Request, res: Response) {
  try {
    const raw = await repo.listSubjects();
    const list = (raw || []).map((s: any) => ({ id: String(s.id), name: s.name, code: s.code ?? null, teacher_id: s.teacher_id ? String(s.teacher_id) : null, teacher_username: s.teacher_username ?? null }));
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function createSubject(req: Request, res: Response) {
  try {
    if (!req.body?.name) return res.status(400).json(failure('Missing name'));
    const payload = { ...req.body, created_by: (req as any).user?.id };
    const created = await repo.createSubject(payload);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function getSubject(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const item = await repo.getSubject(id);
    if (!item) return res.status(404).json(failure('Subject not found'));
    return res.json(success(item));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
