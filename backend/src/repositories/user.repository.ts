import { query } from '../config/db.js';

export async function findByUsername(username: string) {
  const res = await query('SELECT id, username, password_hash, role FROM users WHERE username = $1 LIMIT 1', [username]);
  return res.rows[0];
}

export async function createUser(username: string, passwordHash: string, role = 'staff') {
  const res = await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role', [username, passwordHash, role]);
  return res.rows[0];
}
