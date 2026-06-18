import { query } from '../db/connection.js';
import type { SocketUser } from '../socket.js';

export type PresenceSessionRow = {
  socketId: string;
  userId: number;
  tenantId: number | null;
  username: string;
  fullName: string | null;
  role: string;
  connectedAt: string | null;
};

/** Stale sessions (missed disconnect) are purged after this many seconds. */
const STALE_SECONDS = 150;

export async function registerPresence(
  socketId: string,
  user: SocketUser,
  connectedAt: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO active_socket_sessions (
         socket_id, user_id, tenant_id, username, full_name, role, connected_at, last_seen_at
       ) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), NOW())
       ON CONFLICT (socket_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         tenant_id = EXCLUDED.tenant_id,
         username = EXCLUDED.username,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         last_seen_at = NOW()`,
      [socketId, user.id, user.tenantId, user.username, user.fullName, user.role, connectedAt]
    );
  } catch (err) {
    console.error('registerPresence error:', err);
  }
}

export async function touchPresence(socketId: string): Promise<void> {
  try {
    await query(
      `UPDATE active_socket_sessions SET last_seen_at = NOW() WHERE socket_id = $1`,
      [socketId]
    );
  } catch (err) {
    console.error('touchPresence error:', err);
  }
}

export async function removePresence(socketId: string): Promise<void> {
  try {
    await query(`DELETE FROM active_socket_sessions WHERE socket_id = $1`, [socketId]);
  } catch (err) {
    console.error('removePresence error:', err);
  }
}

export async function listActiveSessions(): Promise<PresenceSessionRow[]> {
  try {
    await query(
      `DELETE FROM active_socket_sessions
       WHERE last_seen_at < NOW() - ($1::text || ' seconds')::interval`,
      [String(STALE_SECONDS)]
    );

    const result = await query(
      `SELECT socket_id, user_id, tenant_id, username, full_name, role, connected_at
       FROM active_socket_sessions
       WHERE LOWER(TRIM(role)) <> 'parent'
       ORDER BY connected_at DESC`
    );

    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      socketId: String(row.socket_id),
      userId: Number(row.user_id),
      tenantId: row.tenant_id == null ? null : Number(row.tenant_id),
      username: String(row.username ?? ''),
      fullName: row.full_name == null ? null : String(row.full_name),
      role: String(row.role ?? ''),
      connectedAt: row.connected_at ? new Date(row.connected_at as string | Date).toISOString() : null,
    }));
  } catch (err) {
    console.error('listActiveSessions error:', err);
    return [];
  }
}
