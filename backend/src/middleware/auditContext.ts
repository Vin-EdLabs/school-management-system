import { AsyncLocalStorage } from 'async_hooks';
import type { AuthRequest } from './auth.js';

export type AuditActor = {
  id: number;
  role: string;
  tenantId?: number | null;
  username?: string;
  fullName?: string | null;
};

export type AuditRequestContext = {
  impersonator?: AuditActor;
  actingUser?: {
    id?: number | null;
    tenantId?: number | null;
    username?: string;
    fullName?: string | null;
    role?: string;
  };
};

const storage = new AsyncLocalStorage<AuditRequestContext>();

function normalizeRole(role: string | null | undefined): string {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
}

export function isPlatformSuperAdmin(role: string, _tenantId?: number | null | undefined): boolean {
  return normalizeRole(role) === 'super-admin';
}

export function getAuditRequestContext(): AuditRequestContext | undefined {
  return storage.getStore();
}

export function runWithAuditContext<T>(ctx: AuditRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function buildAuditContextFromAuth(req: AuthRequest): AuditRequestContext {
  const ctx: AuditRequestContext = {};
  if (req.impersonator) {
    ctx.impersonator = { ...req.impersonator };
  }
  if (req.user) {
    ctx.actingUser = {
      id: req.user.id,
      tenantId: req.user.tenantId,
      username: req.user.username,
      fullName: req.user.fullName,
      role: req.user.role,
    };
  }
  return ctx;
}

export function buildAuditContextFromParent(opts: {
  impersonatorId?: number | null;
  impersonatorRole?: string | null;
  tenantId: number;
  studentId: number;
  accountId: number;
}): AuditRequestContext {
  const ctx: AuditRequestContext = {
    actingUser: {
      id: opts.accountId,
      tenantId: opts.tenantId,
      role: 'parent',
    },
  };
  if (opts.impersonatorId) {
    ctx.impersonator = {
      id: opts.impersonatorId,
      role: normalizeRole(opts.impersonatorRole || 'administrator'),
    };
  }
  return ctx;
}

/** Load impersonator tenant for platform vs school routing */
export async function enrichImpersonatorTenant(
  impersonator: AuditActor,
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ tenant_id: number | null }> }>
): Promise<AuditActor> {
  if (impersonator.tenantId !== undefined) return impersonator;
  try {
    const res = await query('SELECT tenant_id FROM users WHERE id = $1', [impersonator.id]);
    return { ...impersonator, tenantId: res.rows[0]?.tenant_id ?? null };
  } catch {
    return impersonator;
  }
}
