import type { Request, Response } from 'express';
import * as auditService from '../services/audit.service.js';
import { failure, success } from '../utils/response.js';

export async function listLogins(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const logs = await auditService.listLoginActivities(q);
    return res.json(success(logs));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function listAll(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const logs = await auditService.listAll(q);
    return res.json(success(logs));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
