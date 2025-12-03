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
    if (!req.body || !req.body.name) return res.status(400).json(failure('Missing name'));
    const created = await classesService.createClass(req.body);
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
    const updated = await classesService.updateClass(id, req.body);
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
