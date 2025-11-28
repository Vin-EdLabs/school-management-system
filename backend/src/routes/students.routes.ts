import type { Request, Response } from 'express';
import { Router } from 'express';
import * as studentsService from '../services/students.service.js';
import { failure, success } from '../utils/response.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  // TODO: add pagination and filters
  try {
    const q = String(req.query.q ?? '');
    if (q) {
      const results = await studentsService.searchStudents(q);
      return res.json(success(results));
    }
    // For now return empty list (implement listing in students.service later)
    return res.json(success([]));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const created = await studentsService.createStudent(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '');
  try {
    const results = await studentsService.searchStudents(q);
    return res.json(success(results));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const student = await studentsService.getStudent(id);
    if (!student) return res.status(404).json(failure('Student not found'));
    return res.json(success(student));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updated = await studentsService.updateStudent(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  // soft-delete / archive should be implemented in repository
  return res.json(success({ archived: true }));
});

router.put('/:id/class', async (req: Request, res: Response) => {
  // implement class assignment in service/repo later
  return res.json(success({ assigned: true }));
});

export default router;
