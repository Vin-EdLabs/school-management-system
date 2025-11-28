import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import * as auditRepo from '../repositories/audit.repository.js';
import * as tokenRepo from '../repositories/token.repository.js';
import * as userRepo from '../repositories/user.repository.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export async function login(username: string, password: string) {
  const user = await userRepo.findByUsername(username);
  if (!user) return { error: true, message: 'Invalid credentials' };
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return { error: true, message: 'Invalid credentials' };
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET as jwt.Secret, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  try {
    await auditRepo.insertLoginAudit(user.id, { username });
  } catch (e) {
    console.warn('Failed to write audit login', e);
  }
  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

export async function logout(token: string) {
  try {
    await tokenRepo.blacklistToken(token);
  } catch (e) {
    console.warn('Failed to blacklist token', e);
  }
}

export async function session(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET as jwt.Secret) as any;
    const blacklisted = await tokenRepo.isBlacklisted(token);
    if (blacklisted) throw new Error('Logged out');
    return { user: { id: payload.id, username: payload.username, role: payload.role } };
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}
