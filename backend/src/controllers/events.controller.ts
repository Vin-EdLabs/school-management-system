import type { Request, Response } from 'express';
import * as eventsService from '../services/events.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const list = await eventsService.listEvents(limit);
    return res.json(success(list));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.body || !req.body.title) return res.status(400).json(failure('Missing title'));
    if (!req.body.date) return res.status(400).json(failure('Missing required fields'));
    const created = await eventsService.createEvent(req.body);
    return res.status(201).json(success(created));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function get(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const item = await eventsService.getEvent(id) as any;
    if (!item) return res.status(404).json(failure('Event not found'));
    return res.json(success(item));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const updated = await eventsService.updateEvent(id, req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json(failure('Invalid id'));
    const result = await eventsService.deleteEvent(id);
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
