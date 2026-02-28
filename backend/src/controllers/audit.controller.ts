import type { Request, Response } from 'express';
import * as auditService from '../services/audit.service.js';
import { failure, success } from '../utils/response.js';

export async function listLogins(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const logs = await auditService.listLoginAudits(q);
    return res.json(success(logs));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function listAll(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const logs = await auditService.listActivityAudits(q);
    return res.json(success(logs));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function createActivity(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json(failure('Unauthorized'));
    await auditService.createActivityAudit(userId, req.body);
    return res.json(success({ message: 'Audit recorded' }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function deleteActivity(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await auditService.deleteAuditRecord(id);
    return res.json(success({ message: 'Audit record deleted' }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}

export async function clearAllActivities(req: Request, res: Response) {
  try {
    await auditService.clearAllAuditRecords();
    return res.json(success({ message: 'All audit records cleared' }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message));
  }
}
