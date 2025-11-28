import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { failure } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface AuthRequest extends Request {
  user?: any;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json(failure('Missing authorization token'));
  }
  const token = auth.split(' ')[1]!; // non-null because we checked the scheme
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json(failure('Invalid or expired token'));
  }
}
