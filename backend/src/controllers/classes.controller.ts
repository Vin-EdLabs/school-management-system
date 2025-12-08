import type { Request, Response } from 'express';
import * as classesService from '../services/classes.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const list = await classesService.listClasses();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    // Normalize payload: level is required, others optional
    const body = req.body || {};
    const level = body.level;
    if (!level) return res.status(400).json(failure('Missing level'));

    const rawTeacher = body.teacher_id ?? body.assignedTeacher ?? body.assigned_teacher ?? null;
    const stream = body.stream ?? null;
    const max_class_size = body.maxClassSize ?? body.max_class_size ?? 30;

    // create class (assignments managed via assignments endpoints)
    const created = await classesService.createClass({ level, stream, max_class_size });

    // if caller provided a teacher assignment, create it in the join table
    if (rawTeacher) {
      try {
        const assignmentsService = await import('../services/assignments.service.js');
        await assignmentsService.addAssignment(Number(rawTeacher), created.id);
      } catch (e) {
        // ignore assignment errors here
      }
    }
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const cls = await classesService.getClass(id);
    if (!cls) return res.status(404).json(failure('Class not found'));
    return res.json(success(cls));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    // normalize teacher_id in update payload to avoid empty-string -> integer errors
    const ub = { ...req.body } as any;
    if (ub.teacher_id === undefined && (ub.assignedTeacher !== undefined || ub.assigned_teacher !== undefined)) {
      const raw = ub.teacher_id ?? ub.assignedTeacher ?? ub.assigned_teacher;
      ub.teacher_id = (raw === '' || raw === null || raw === undefined) ? null : Number(raw);
    } else if (ub.teacher_id !== undefined) {
      ub.teacher_id = (ub.teacher_id === '' || ub.teacher_id === null) ? null : Number(ub.teacher_id);
    }

    const updated = await classesService.updateClass(id, ub);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const result = await classesService.deleteClass(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function students(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const roster = await classesService.getRoster(id);
    return res.json(success(roster));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
