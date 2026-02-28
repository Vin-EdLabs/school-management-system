import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service.js';
import { failure, success } from '../utils/response.js';

export async function list(req: Request, res: Response) {
  try {
    const settings = await settingsService.getAllSettings();
    return res.json(success(settings));
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
    const id = Number(req.params.id || req.body.id);
    if (!id) return res.status(400).json(failure('Missing term id'));
    const updated = await settingsService.setActiveTerm(id);
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

export async function listTerms(req: Request, res: Response) {
  try {
    const terms = await settingsService.listTerms();
    return res.json(success(terms));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function createTerm(req: Request, res: Response) {
  try {
    const term = await settingsService.createTerm(req.body);
    return res.json(success(term));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function updateTerm(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const term = await settingsService.updateTerm(id, req.body);
    return res.json(success(term));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function deleteTerm(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await settingsService.deleteTerm(id);
    return res.json(success(true));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
