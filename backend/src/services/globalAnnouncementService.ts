import { query } from '../db/connection.js';

export type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'update' | 'urgent';
export type AnnouncementTarget = 'all' | 'selected';
export type DisplayStatus = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

const TYPE_PRIORITY: Record<string, number> = {
  urgent: 0,
  warning: 1,
  maintenance: 2,
  update: 3,
  info: 4,
};

export type AnnouncementInput = {
  title: string;
  body: string;
  type?: AnnouncementType;
  target?: AnnouncementTarget;
  targetTenantIds?: number[] | null;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
};

export type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  type: string;
  target: string;
  target_tenant_ids: number[] | null;
  scheduled_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  read_count?: number;
  eligible_user_count?: number;
  display_status?: DisplayStatus;
  target_label?: string;
};

function computeDisplayStatus(row: {
  is_active: boolean;
  scheduled_at: string | null;
  expires_at: string | null;
}): DisplayStatus {
  if (!row.is_active) return 'Inactive';
  const now = Date.now();
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return 'Expired';
  if (row.scheduled_at && new Date(row.scheduled_at).getTime() > now) return 'Scheduled';
  return 'Active';
}

async function countEligibleUsers(target: string, targetTenantIds: number[] | null): Promise<number> {
  if (target === 'selected' && targetTenantIds?.length) {
    const res = await query(
      `SELECT COUNT(*)::int AS count FROM users u
       WHERE COALESCE(u.is_active, true) = true
         AND LOWER(u.role) IN ('administrator', 'finance', 'headmaster')
         AND u.tenant_id = ANY($1::int[])`,
      [targetTenantIds]
    );
    return res.rows[0]?.count ?? 0;
  }
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM users u
     WHERE COALESCE(u.is_active, true) = true
       AND LOWER(u.role) IN ('administrator', 'finance', 'headmaster')
       AND u.tenant_id IS NOT NULL`
  );
  return res.rows[0]?.count ?? 0;
}

async function enrichAnnouncement(row: AnnouncementRow): Promise<AnnouncementRow> {
  const readRes = await query(
    `SELECT COUNT(*)::int AS count FROM announcement_reads WHERE announcement_id = $1`,
    [row.id]
  );
  const eligible = await countEligibleUsers(row.target, row.target_tenant_ids);
  const targetIds = row.target_tenant_ids?.length ?? 0;
  return {
    ...row,
    read_count: readRes.rows[0]?.count ?? 0,
    eligible_user_count: eligible,
    display_status: computeDisplayStatus(row),
    target_label:
      row.target === 'all'
        ? 'All Schools'
        : `${targetIds} school${targetIds === 1 ? '' : 's'} selected`,
  };
}

export function replaceSchoolNamePlaceholder(body: string, schoolName: string): string {
  return body.replace(/\{\{school_name\}\}/gi, schoolName);
}

export function renderAnnouncementBody(body: string, schoolName: string): string {
  const withName = replaceSchoolNamePlaceholder(body, schoolName);
  return withName.replace(/\*\*(.+?)\*\*/g, '$1');
}

export async function listGlobalAnnouncements(): Promise<AnnouncementRow[]> {
  const res = await query(
    `SELECT * FROM global_announcements ORDER BY created_at DESC`
  );
  const rows = res.rows as AnnouncementRow[];
  return Promise.all(rows.map(enrichAnnouncement));
}

export async function createGlobalAnnouncement(
  input: AnnouncementInput,
  createdBy: number
): Promise<AnnouncementRow> {
  const target = input.target || 'all';
  const tenantIds =
    target === 'selected' && input.targetTenantIds?.length ? input.targetTenantIds : null;

  const res = await query(
    `INSERT INTO global_announcements
       (title, body, type, target, target_tenant_ids, scheduled_at, expires_at, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.title.trim(),
      input.body,
      input.type || 'info',
      target,
      tenantIds,
      input.scheduledAt || null,
      input.expiresAt || null,
      input.isActive !== false,
      createdBy,
    ]
  );
  return enrichAnnouncement(res.rows[0] as AnnouncementRow);
}

export async function updateGlobalAnnouncement(
  id: number,
  input: AnnouncementInput
): Promise<AnnouncementRow | null> {
  const target = input.target || 'all';
  const tenantIds =
    target === 'selected' && input.targetTenantIds?.length ? input.targetTenantIds : null;

  const res = await query(
    `UPDATE global_announcements
     SET title = $1, body = $2, type = $3, target = $4, target_tenant_ids = $5,
         scheduled_at = $6, expires_at = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
     WHERE id = $9
     RETURNING *`,
    [
      input.title.trim(),
      input.body,
      input.type || 'info',
      target,
      tenantIds,
      input.scheduledAt || null,
      input.expiresAt || null,
      input.isActive !== false,
      id,
    ]
  );
  if (!res.rows.length) return null;
  return enrichAnnouncement(res.rows[0] as AnnouncementRow);
}

export async function deleteGlobalAnnouncement(id: number): Promise<{
  deleted: boolean;
  title: string | null;
  schoolsReached: number;
}> {
  const existing = await query(`SELECT title, target, target_tenant_ids FROM global_announcements WHERE id = $1`, [
    id,
  ]);
  if (!existing.rows.length) return { deleted: false, title: null, schoolsReached: 0 };
  const row = existing.rows[0];
  let schoolsReached = 0;
  if (row.target === 'all') {
    const c = await query(`SELECT COUNT(*)::int AS count FROM tenants WHERE COALESCE(is_active, true) = true`);
    schoolsReached = c.rows[0]?.count ?? 0;
  } else {
    schoolsReached = Array.isArray(row.target_tenant_ids) ? row.target_tenant_ids.length : 0;
  }
  await query(`DELETE FROM global_announcements WHERE id = $1`, [id]);
  return { deleted: true, title: row.title, schoolsReached };
}

export async function toggleGlobalAnnouncement(id: number): Promise<AnnouncementRow | null> {
  const res = await query(
    `UPDATE global_announcements
     SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  if (!res.rows.length) return null;
  return enrichAnnouncement(res.rows[0] as AnnouncementRow);
}

export async function getUnreadAnnouncementsForUser(
  userId: number,
  tenantId: number,
  schoolName: string
): Promise<
  Array<{
    id: number;
    title: string;
    body: string;
    type: string;
    created_at: string;
    displayBody: string;
  }>
> {
  const res = await query(
    `SELECT ga.id, ga.title, ga.body, ga.type, ga.created_at
     FROM global_announcements ga
     LEFT JOIN announcement_reads ar
       ON ar.announcement_id = ga.id AND ar.user_id = $1
     WHERE ga.is_active = true
       AND ar.id IS NULL
       AND (
         ga.target = 'all'
         OR ($2 = ANY(ga.target_tenant_ids))
       )
       AND (ga.scheduled_at IS NULL OR ga.scheduled_at <= NOW())
       AND (ga.expires_at IS NULL OR ga.expires_at > NOW())
     ORDER BY
       CASE ga.type
         WHEN 'urgent' THEN 0
         WHEN 'warning' THEN 1
         WHEN 'maintenance' THEN 2
         WHEN 'update' THEN 3
         ELSE 4
       END,
       ga.created_at DESC`,
    [userId, tenantId]
  );

  return res.rows.map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    type: String(row.type || 'info'),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    displayBody: replaceSchoolNamePlaceholder(String(row.body), schoolName),
  }));
}

export async function markAnnouncementRead(
  announcementId: number,
  userId: number,
  tenantId: number
): Promise<boolean> {
  const check = await query(`SELECT id FROM global_announcements WHERE id = $1`, [announcementId]);
  if (!check.rows.length) return false;

  await query(
    `INSERT INTO announcement_reads (announcement_id, tenant_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (announcement_id, user_id) DO NOTHING`,
    [announcementId, tenantId, userId]
  );
  return true;
}

export async function getAnnouncementReaders(
  announcementId: number
): Promise<
  Array<{
    user_id: number;
    full_name: string | null;
    email: string | null;
    tenant_id: number | null;
    read_at: string;
  }>
> {
  const res = await query(
    `SELECT ar.user_id,
            COALESCE(NULLIF(TRIM(t.full_name), ''), NULLIF(TRIM(s.full_name), ''), NULLIF(TRIM(u.full_name), ''), u.username) AS full_name,
            u.email,
            ar.tenant_id,
            ar.read_at
     FROM announcement_reads ar
     JOIN users u ON u.id = ar.user_id
     LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
     WHERE ar.announcement_id = $1
     ORDER BY ar.read_at DESC`,
    [announcementId]
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    user_id: Number(r.user_id),
    full_name: r.full_name ? String(r.full_name) : null,
    email: r.email ? String(r.email) : null,
    tenant_id: r.tenant_id != null ? Number(r.tenant_id) : null,
    read_at: r.read_at instanceof Date ? r.read_at.toISOString() : String(r.read_at),
  }));
}

export { TYPE_PRIORITY };
