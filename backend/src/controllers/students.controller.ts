import type { Request, Response } from 'express';
import * as studentsService from '../services/students.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const q = String(req.query.q ?? '');
    if (q) {
      const results = await studentsService.searchStudents(q);
      return res.json(success(results));
    }
    const list = await studentsService.listStudents();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || !req.body.first_name) return res.status(400).json(failure('Missing first_name'));
    if (!req.body || !req.body.last_name) return res.status(400).json(failure('Missing last_name'));
    const created = await studentsService.createStudent(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const student = await studentsService.getStudent(id);
    if (!student) return res.status(404).json(failure('Student not found'));
    return res.json(success(student));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await studentsService.updateStudent(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    // soft-delete placeholder
    return res.json(success({ archived: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function assignClass(req: Request, res: Response) {
  try {
    // placeholder for class assignment logic
    return res.json(success({ assigned: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
