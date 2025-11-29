import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { failure } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface AuthRequest extends Request {
  user?: any;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Support Authorization header OR access_token cookie (httpOnly)
  const auth = req.headers.authorization;
  let token: string | undefined;

  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  } else if (req.headers.cookie) {
    const match = String(req.headers.cookie).split(';').map(s => s.trim()).find(s => s.startsWith('access_token='));
    if (match) token = match.split('=')[1];
  }

  if (!token) return res.status(401).json(failure('Missing authorization token'));

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json(failure('Invalid or expired token'));
  }
}
