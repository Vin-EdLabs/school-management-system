import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    // placeholder: list all settings if implemented
    return res.json(success({}));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function getActiveTerm(req: Request, res: Response) {
  try {
    const term = await settingsService.getActiveTerm();
    return res.json(success(term));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function setActiveTerm(req: Request, res: Response) {
  try {
    if (!req.body) return res.status(400).json(failure('Missing body'));
    const updated = await settingsService.setActiveTerm(req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function getActiveYear(req: Request, res: Response) {
  try {
    const year = await settingsService.getActiveYear();
    return res.json(success(year));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function setActiveYear(req: Request, res: Response) {
  try {
    if (!req.body) return res.status(400).json(failure('Missing body'));
    const updated = await settingsService.setActiveYear(req.body);
    return res.json(success(updated));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
