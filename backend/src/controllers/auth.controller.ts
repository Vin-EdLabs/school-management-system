import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { failure, success } from '../utils/response.js';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body ?? {};
  // Log received payload (mask password) to aid debugging
  try {
    console.log(`Auth login attempt - username: ${String(username)}, passwordProvided: ${password ? 'yes' : 'no'}`);
  } catch (e) {
    // swallow logging errors
  }

  if (!username || !password) {
    return res.status(400).json(failure('Username and password required', { field: 'username|password' }));
  }

  try {
    const result = await authService.login(username, password);
    if (result.error) {
      // Log reason for failure from service
      console.warn(`Auth failure for user=${String(username)}: ${result.message}`);
      return res.status(401).json(failure(result.message));
    }
    // Set access token as httpOnly cookie and return only user info
    const token = (result as any).token;
    const user = (result as any).user;
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // 7 days
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    try {
      res.cookie('access_token', token, cookieOptions);
    } catch (e) {
      console.warn('Failed to set cookie for login', e);
    }
    return res.json(success({ user }));
  } catch (err: any) {
    // Log full error with stack for debugging (only include stack in response in development)
    console.error('Unhandled error during login:', err?.stack ?? err);
    const message = err?.message ?? 'Login failed';
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json(failure(message, { stack: err?.stack }));
    }
    return res.status(500).json(failure(message));
  }
}

export async function logout(req: Request, res: Response) {
  // Try to read token from cookie
  const cookie = req.headers.cookie ?? '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('access_token='));
  const token = match ? match.split('=')[1] : undefined;
  try {
    if (token) await authService.logout(token);
  } catch (err: any) {
    console.warn('Error logging out token:', err?.message ?? err);
  }
  // clear cookie on logout
  try { res.clearCookie('access_token'); } catch (e) {}
  return res.json(success({ loggedOut: true }));
}

export async function session(req: Request, res: Response) {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('access_token='));
  const token = match ? match.split('=')[1] : undefined;
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
