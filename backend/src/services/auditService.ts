import { query } from '../db/connection.js';
import { getIO } from '../socket.js';

export type AuditStatus = 'success' | 'failed';

export type AuditLogInput = {
  tenantId: number | null;
  userId: number | null;
  userRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  module?: string | null;
  status?: AuditStatus;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit log. Failures are swallowed so logging never breaks primary flows.
 */
export async function writeAuditLog(row: AuditLogInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, user_role, action, entity_type, entity_id,
        module, status, summary, details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
      [
        row.tenantId,
        row.userId,
        row.userRole ?? null,
        row.action,
        row.entityType ?? null,
        row.entityId ?? null,
        row.module ?? null,
        row.status ?? 'success',
        row.summary ?? null,
        row.details != null ? JSON.stringify(row.details) : null,
        row.ipAddress ?? null,
        row.userAgent ?? null,
      ]
    );
    if (row.tenantId != null) {
      try {
        const io = getIO();
        io.to(`tenant:${row.tenantId}`).emit('tenant-data-changed', {
          tenantId: row.tenantId,
          entity: 'audit-log',
          action: 'created',
          at: Date.now(),
        });
      } catch {
        /* socket optional */
      }
    }
  } catch (e) {
    console.error('[auditService] writeAuditLog failed:', (e as Error).message);
  }
}
