import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';

export interface ParentAuthRequest extends Request {
  parent?: {
    accountId: number;
    studentId: number;
    tenantId: number;
    impersonatorId?: number | null;
  };
}

export async function authenticateParent(
  req: ParentAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      role?: string;
      parentAccountId?: number;
      impersonatorId?: number | string;
    };
    if (decoded.role !== 'parent') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const row = await query(
      'SELECT id, student_id, tenant_id FROM parent_portal_accounts WHERE id = $1 AND is_active = true',
      [decoded.parentAccountId]
    );
    if (row.rows.length === 0) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.parent = {
      accountId: row.rows[0].id,
      studentId: row.rows[0].student_id,
      tenantId: row.rows[0].tenant_id,
      impersonatorId: decoded.impersonatorId
        ? parseInt(String(decoded.impersonatorId), 10)
        : null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
