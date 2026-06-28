import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import {
  getAuditRequestContext,
  isPlatformSuperAdmin,
} from '../middleware/auditContext.js';

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
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function impersonationMeta(ctx: NonNullable<ReturnType<typeof getAuditRequestContext>>) {
  const imp = ctx.impersonator!;
  const impName = imp.fullName || imp.username || `User #${imp.id}`;
  const actingName =
    ctx.actingUser?.fullName ||
    ctx.actingUser?.username ||
    (ctx.actingUser?.role === 'parent' ? 'parent portal' : null);
  return { impName, actingName };
}

function buildImpersonationSummary(impName: string, actingName: string | null, baseSummary: string): string {
  const base = (baseSummary || '').trim();
  const lead = actingName ? `${impName} acting as ${actingName}` : impName;
  if (!base) return lead;
  if (base.toLowerCase().startsWith(lead.toLowerCase())) return base;
  if (actingName && base.toLowerCase().includes(`acting as ${actingName.toLowerCase()}`)) return base;

  let stripped = base;
  if (actingName) {
    stripped = stripped.replace(new RegExp(`\\s*[—–-]\\s*by\\s+${escapeRegExp(actingName)}\\s*$`, 'i'), '').trim();
  }
  return `${lead}: ${stripped}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Attribute audit rows to the real admin/parent viewer, not the impersonated account. */
function applyImpersonationAuditAttribution(row: AuditLogInput): AuditLogInput {
  const ctx = getAuditRequestContext();
  if (!ctx?.impersonator?.id) return row;

  const imp = ctx.impersonator;
  const { impName, actingName } = impersonationMeta(ctx);
  const baseSummary = row.summary || row.action;
  const summary = buildImpersonationSummary(impName, actingName, baseSummary);
  const details = {
    ...(row.details || {}),
    impersonation: true,
    impersonatorId: imp.id,
    impersonatorName: impName,
    actingAsUserId: ctx?.actingUser?.id ?? null,
    actingAsName: actingName,
    actingAsRole: ctx?.actingUser?.role ?? row.userRole,
  };

  const impTenantId = imp.tenantId ?? null;
  if (isPlatformSuperAdmin(imp.role, impTenantId)) {
    const targetTenantId = ctx?.actingUser?.tenantId ?? row.tenantId;
    return {
      ...row,
      tenantId: null,
      module: 'superadmin',
      userId: imp.id,
      userRole: imp.role,
      summary,
      details: {
        ...details,
        platformScope: true,
        targetTenantId,
        originalModule: row.module,
        originalAction: row.action,
      },
    };
  }

  return {
    ...row,
    userId: imp.id,
    userRole: imp.role,
    summary,
    details,
  };
}

/**
 * Append-only audit log. Failures are swallowed so logging never breaks primary flows.
 */
export async function writeAuditLog(row: AuditLogInput): Promise<void> {
  const scoped = applyImpersonationAuditAttribution(row);
  try {
    await query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, user_role, action, entity_type, entity_id,
        module, status, summary, details, before_values, after_values, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)`,
      [
        scoped.tenantId,
        scoped.userId,
        scoped.userRole ?? null,
        scoped.action,
        scoped.entityType ?? null,
        scoped.entityId ?? null,
        scoped.module ?? null,
        scoped.status ?? 'success',
        scoped.summary ?? null,
        scoped.details != null ? JSON.stringify(scoped.details) : null,
        scoped.beforeValues != null ? JSON.stringify(scoped.beforeValues) : null,
        scoped.afterValues != null ? JSON.stringify(scoped.afterValues) : null,
        scoped.ipAddress ?? null,
        scoped.userAgent ?? null,
      ]
    );
    if (scoped.tenantId != null) {
      try {
        const io = getIO();
        io.to(`tenant:${scoped.tenantId}`).emit('tenant-data-changed', {
          tenantId: scoped.tenantId,
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
