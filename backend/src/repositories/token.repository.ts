import { query } from '../config/db.js';

export async function blacklistToken(token: string) {
  return query('INSERT INTO blacklisted_tokens (token) VALUES ($1)', [token]);
}

export async function isBlacklisted(token: string) {
  const res = await query('SELECT token FROM blacklisted_tokens WHERE token = $1 LIMIT 1', [token]);
  return (res.rowCount ?? 0) > 0;
}
