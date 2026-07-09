import type { QueryResult } from 'pg';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<Pick<QueryResult, 'rows'>>;
};

export function slugifyTenant(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'school'
  );
}

export async function isTenantSlugTaken(
  db: DbClient,
  slug: string,
  excludeTenantId?: number
): Promise<boolean> {
  const normalized = slugifyTenant(slug);
  const params: Array<string | number> = [normalized];
  let sql = `SELECT id FROM tenants
             WHERE (LOWER(COALESCE(slug, '')) = LOWER($1)
                OR LOWER(COALESCE(subdomain, '')) = LOWER($1))`;
  if (excludeTenantId != null) {
    sql += ' AND id <> $2';
    params.push(excludeTenantId);
  }
  sql += ' LIMIT 1';
  const res = await db.query(sql, params);
  return res.rows.length > 0;
}

/** Pick a unique portal slug; appends -2, -3, … when the base is taken. */
export async function allocateUniqueTenantSlug(db: DbClient, baseInput: string): Promise<string> {
  const base = slugifyTenant(baseInput);
  let candidate = base;
  let suffix = 2;
  while (await isTenantSlugTaken(db, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function formatTenantSlugConflictError(err: { detail?: string; constraint?: string }): string {
  const detail = String(err.detail || '').toLowerCase();
  const constraint = String(err.constraint || '').toLowerCase();
  if (detail.includes('slug') || constraint.includes('slug')) {
    return 'This portal URL (slug) is already in use. Choose a different one — school names can be the same.';
  }
  if (detail.includes('subdomain') || constraint.includes('subdomain')) {
    return 'This subdomain is already in use. Choose a different portal URL.';
  }
  return 'This portal URL is already in use. Use a different slug/subdomain — school names can be the same.';
}

/** Resolve slug for create: explicit slug must be free; otherwise auto-allocate from name. */
export async function resolveTenantSlugForCreate(
  db: DbClient,
  opts: { name: string; slug?: string | null; subdomain?: string | null }
): Promise<{ slug: string; subdomain: string } | { error: string; status: number }> {
  const explicit = (opts.slug || opts.subdomain || '').trim();
  if (explicit) {
    const slug = slugifyTenant(explicit);
    if (slug.length < 2) {
      return { error: 'Portal URL must be at least 2 characters (letters, numbers, hyphens).', status: 400 };
    }
    if (await isTenantSlugTaken(db, slug)) {
      return {
        error: 'This portal URL is already in use. Choose a different slug — multiple schools can share the same name.',
        status: 409,
      };
    }
    return { slug, subdomain: slug };
  }

  const slug = await allocateUniqueTenantSlug(db, opts.name);
  return { slug, subdomain: slug };
}

export async function resolveTenantSlugForUpdate(
  db: DbClient,
  tenantId: number,
  opts: { slug?: string | null; subdomain?: string | null }
): Promise<{ slug?: string; subdomain?: string } | { error: string; status: number }> {
  const currentRes = await db.query(`SELECT slug, subdomain FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
  const current = currentRes.rows[0] as { slug?: string | null; subdomain?: string | null } | undefined;
  if (!current) {
    return { error: 'School not found', status: 404 };
  }

  const currentPortal = slugifyTenant(String(current.slug || current.subdomain || ''));
  const rawPortal = (opts.slug ?? opts.subdomain ?? '').trim();

  if (!rawPortal) {
    return {};
  }

  const nextPortal = slugifyTenant(rawPortal);
  if (nextPortal.length < 2) {
    return { error: 'Portal URL must be at least 2 characters (letters, numbers, hyphens).', status: 400 };
  }

  if (nextPortal !== currentPortal && (await isTenantSlugTaken(db, nextPortal, tenantId))) {
    return {
      error: 'This portal URL is already in use by another school.',
      status: 409,
    };
  }

  return { slug: nextPortal, subdomain: nextPortal };
}
