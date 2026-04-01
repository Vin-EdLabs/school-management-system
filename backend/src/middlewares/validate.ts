import type { NextFunction, Request, Response } from 'express';
import { failure } from '../utils/response.js';

export function requireFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) return res.status(400).json(failure('Missing required fields', { missing }));
    next();
  };
}
