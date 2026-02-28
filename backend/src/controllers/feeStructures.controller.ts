import type { Request, Response } from 'express';
import * as feeService from '../services/feeStructures.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const list = await feeService.listStructures();
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || !req.body.name) return res.status(400).json(failure('Missing name'));
    const created = await feeService.createStructure(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const s = await feeService.getStructure(id);
    if (!s) return res.status(404).json(failure('Fee structure not found'));
    return res.json(success(s));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await feeService.updateStructure(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function assignClass(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const classId = Number(req.body.classId ?? req.body.class_id);
    const updated = await feeService.assignClass(id, classId);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function assignTerm(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const updated = await feeService.updateStructure(id, { term_id: req.body.term_id ?? req.body.termId });
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await feeService.deleteStructure(id);
    return res.json(success({ deleted: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
