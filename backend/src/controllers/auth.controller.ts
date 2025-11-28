import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { failure, success } from '../utils/response.js';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json(failure('Username and password required', { field: 'username|password' }));
  }
  try {
    const result = await authService.login(username, password);
    if (result.error) return res.status(401).json(failure(result.message));
    return res.json(success(result));
  } catch (err: any) {
    return res.status(500).json(failure(err.message ?? 'Login failed'));
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(400).json(failure('Token required'));
  try {
    await authService.logout(token);
    return res.json(success({ loggedOut: true }));
  } catch (err: any) {
    return res.status(500).json(failure(err.message ?? 'Logout failed'));
  }
}

export async function session(req: Request, res: Response) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(200).json(success({ user: null }));
  try {
    const sess = await authService.session(token);
    return res.json(success(sess));
  } catch (err: any) {
    return res.status(401).json(failure(err.message ?? 'Invalid session'));
  }
}

export async function roles(req: Request, res: Response) {
  // Static list for now
  return res.json(success(['admin', 'staff', 'teacher']));
}
