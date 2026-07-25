import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type pg from 'pg';
import { query } from '../db/connection.js';

/** Tables backed up via custom SQL (no direct tenant_id column). */
const SPECIAL_TABLE_QUERIES: Record<
  string,
  { select: string; delete: string }
> = {
  school_setup_progress: {
    select: 'SELECT * FROM school_setup_progress WHERE school_id = $1 ORDER BY id ASC',
    delete: 'DELETE FROM school_setup_progress WHERE school_id = $1',
  },
  learning_questions: {
    select: 'SELECT * FROM learning_questions WHERE school_id = $1 ORDER BY id ASC',
    delete: 'DELETE FROM learning_questions WHERE school_id = $1',
  },
  message_replies: {
    select: `SELECT mr.* FROM message_replies mr
      INNER JOIN parent_messages pm ON pm.id = mr.message_id
      WHERE pm.tenant_id = $1 ORDER BY mr.id ASC`,
    delete: `DELETE FROM message_replies
      WHERE message_id IN (SELECT id FROM parent_messages WHERE tenant_id = $1)`,
  },
  global_chat_reactions: {
    select: `SELECT r.* FROM global_chat_reactions r
      INNER JOIN global_chat_messages m ON m.id = r.message_id
      WHERE m.tenant_id = $1 ORDER BY r.id ASC`,
    delete: `DELETE FROM global_chat_reactions
      WHERE message_id IN (SELECT id FROM global_chat_messages WHERE tenant_id = $1)`,
  },
  private_messages: {
    select: `SELECT pm.* FROM private_messages pm
      INNER JOIN private_conversations pc ON pc.id = pm.conversation_id
      WHERE pc.participant_a IN (SELECT id FROM users WHERE tenant_id = $1)
         OR pc.participant_b IN (SELECT id FROM users WHERE tenant_id = $1)
      ORDER BY pm.id ASC`,
    delete: `DELETE FROM private_messages
      WHERE conversation_id IN (
        SELECT id FROM private_conversations
        WHERE participant_a IN (SELECT id FROM users WHERE tenant_id = $1)
           OR participant_b IN (SELECT id FROM users WHERE tenant_id = $1)
      )`,
  },
  private_conversations: {
    select: `SELECT * FROM private_conversations
      WHERE participant_a IN (SELECT id FROM users WHERE tenant_id = $1)
         OR participant_b IN (SELECT id FROM users WHERE tenant_id = $1)
      ORDER BY id ASC`,
    delete: `DELETE FROM private_conversations
      WHERE participant_a IN (SELECT id FROM users WHERE tenant_id = $1)
         OR participant_b IN (SELECT id FROM users WHERE tenant_id = $1)`,
  },
  complaint_status_history: {
    select: `SELECT h.* FROM complaint_status_history h
      INNER JOIN complaints c ON c.id = h.complaint_id
      WHERE c.tenant_id = $1 ORDER BY h.id ASC`,
    delete: `DELETE FROM complaint_status_history
      WHERE complaint_id IN (SELECT id FROM complaints WHERE tenant_id = $1)`,
  },
  chat_channel_members: {
    select: `SELECT m.* FROM chat_channel_members m
      INNER JOIN chat_channels c ON c.id = m.channel_id
      WHERE c.tenant_id = $1 ORDER BY m.id ASC`,
    delete: `DELETE FROM chat_channel_members
      WHERE channel_id IN (SELECT id FROM chat_channels WHERE tenant_id = $1)`,
  },
  stops: {
    select: `SELECT s.* FROM stops s
      INNER JOIN routes r ON r.id = s.route_id
      WHERE r.tenant_id = $1 ORDER BY s.order_index ASC, s.id ASC`,
    delete: `DELETE FROM stops
      WHERE route_id IN (SELECT id FROM routes WHERE tenant_id = $1)`,
  },
  driver_profiles: {
    select: `SELECT dp.* FROM driver_profiles dp
      INNER JOIN users u ON u.id = dp.user_id
      WHERE u.tenant_id = $1 ORDER BY dp.user_id ASC`,
    delete: `DELETE FROM driver_profiles
      WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)`,
  },
  student_transport: {
    select: `SELECT st.* FROM student_transport st
      WHERE st.route_id IN (SELECT id FROM routes WHERE tenant_id = $1)
         OR st.student_id IN (SELECT id FROM students WHERE tenant_id = $1)
      ORDER BY st.enrolled_at ASC, st.id ASC`,
    delete: `DELETE FROM student_transport
      WHERE route_id IN (SELECT id FROM routes WHERE tenant_id = $1)
         OR student_id IN (SELECT id FROM students WHERE tenant_id = $1)`,
  },
};

/** Preferred delete priority when FK topo sort has ties (children before parents). */
export const TENANT_CLEAR_ORDER = [
  'message_replies',
  'learning_teacher_quiz_attempts',
  'learning_teacher_quiz_questions',
  'quiz_sessions',
  'student_points',
  'learning_teacher_question_bank',
  'learning_teacher_quizzes',
  'learning_questions',
  'parent_notifications',
  'parent_fcm_tokens',
  'parent_push_subscriptions',
  'staff_user_push_subscriptions',
  'staff_user_notifications',
  'parent_messages',
  'receipt_corrections',
  'complaint_status_history',
  'complaints',
  'tenant_admin_notifications',
  'lost_card_reports',
  'student_admission_letters',
  'payment_transactions',
  'payment_submissions',
  'invoices',
  'daily_fee_collection_records',
  'daily_fee_payments',
  'daily_fee_structures',
  'school_closure_days',
  'student_transport',
  'stops',
  'class_timetable',
  'exam_timetable',
  'periods',
  'staff_attendance',
  'student_check_ins',
  'school_attendance_settings',
  'chat_messages',
  'chat_channel_members',
  'dm_conversations',
  'chat_channels',
  'generated_id_cards',
  'promotion_history',
  'term_closing_balances',
  'term_fee_structure_archives',
  'grade_audit_log',
  'report_card_archive',
  'grade_assignments',
  'student_grades',
  'term_report_comments',
  'term_report_releases',
  'student_ledger',
  'student_credits',
  'student_charges',
  'student_arrears',
  'student_arrears_balance',
  'term_arrears',
  'term_outstanding_balances',
  'graduation_details',
  'student_class_enrollments',
  'attendance',
  'receipts',
  'payments',
  'fund_transfers',
  'budget_alerts',
  'budget_lines',
  'term_budgets',
  'budget_categories',
  'income',
  'expenses',
  'payroll_other_staff',
  'salary_payments',
  'teacher_appointment_letters',
  'class_teachers',
  'teacher_subject_classes',
  'parent_portal_accounts',
  'parent_portal_family_groups',
  'support_messages',
  'global_chat_reactions',
  'global_chat_messages',
  'announcement_reads',
  'events',
  'audit_logs',
  'system_errors',
  'term_snapshots',
  'fee_structure_items',
  'ledger_fee_structures',
  'fee_structures',
  'payment_accounts',
  'receipt_number_seq',
  'payroll_settings',
  'tenant_paystack_config',
  'school_payment_settings',
  'grade_config_components',
  'grade_boundaries',
  'grade_configs',
  'school_website_applications',
  'school_website_gallery',
  'school_website_contact_messages',
  'school_website_employment_applications',
  'school_website_enable_requests',
  'school_website_events',
  'school_website_transcript_requests',
  'school_website_testimonial_submissions',
  'school_website_team_members',
  'school_website_alumni_profiles',
  'school_website_about',
  'school_website_admission_config',
  'school_website_careers_config',
  'school_website_contact',
  'school_websites',
  'personal_todos',
  'active_socket_sessions',
  'id_card_templates',
  'driver_profiles',
  'routes',
  'transport_drivers',
  'vehicles',
  'birthday_wishes_sent',
  'staff_field_suggestions',
  'other_staff',
  'students',
  'classes',
  'school_class_levels',
  'subjects',
  'teachers',
  'terms',
  'academic_terms',
  'academic_years',
  'private_messages',
  'private_conversations',
  'users',
  'school_settings',
  'school_setup_progress',
] as const;

/** Tables whose primary key is not a serial `id` column — used for backup SELECT ordering. */
const TABLE_SELECT_ORDER: Record<string, string> = {
  school_websites: 'tenant_id',
  school_website_about: 'tenant_id',
  school_website_admission_config: 'tenant_id',
  school_website_careers_config: 'tenant_id',
  school_website_contact: 'tenant_id',
  payroll_settings: 'tenant_id',
  receipt_number_seq: 'tenant_id',
  active_socket_sessions: 'socket_id',
  lost_card_reports: 'reported_at',
  vehicles: 'created_at',
  routes: 'created_at',
  stops: 'order_index',
  student_transport: 'enrolled_at',
  driver_profiles: 'user_id',
};

const tableOrderColumnCache = new Map<string, string | null>();

function isSafeSqlIdentifier(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(name);
}

async function resolveTableOrderColumn(table: string): Promise<string | null> {
  if (TABLE_SELECT_ORDER[table]) return TABLE_SELECT_ORDER[table];
  const cached = tableOrderColumnCache.get(table);
  if (cached !== undefined) return cached;

  const idRes = await query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
    ) AS exists`,
    [table]
  );
  if (idRes.rows[0]?.exists) {
    tableOrderColumnCache.set(table, 'id');
    return 'id';
  }

  const pkRes = await query(
    `SELECT a.attname AS column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE i.indisprimary
       AND n.nspname = 'public'
       AND c.relname = $1
     ORDER BY array_position(i.indkey, a.attnum)
     LIMIT 1`,
    [table]
  );
  const pk = String(pkRes.rows[0]?.column_name || '');
  const resolved = pk && isSafeSqlIdentifier(pk) ? pk : null;
  tableOrderColumnCache.set(table, resolved);
  return resolved;
}

type FkEdge = { child: string; parent: string };

let cachedForeignKeys: FkEdge[] | null = null;

async function loadPublicForeignKeys(client: pg.PoolClient): Promise<FkEdge[]> {
  if (cachedForeignKeys) return cachedForeignKeys;
  const res = await client.query(
    `SELECT
       tc.table_name AS child_table,
       ccu.table_name AS parent_table
     FROM information_schema.table_constraints tc
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = rc.unique_constraint_name
      AND ccu.constraint_schema = rc.unique_constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'`
  );
  cachedForeignKeys = res.rows.map((r: { child_table: string; parent_table: string }) => ({
    child: r.child_table,
    parent: r.parent_table,
  }));
  return cachedForeignKeys;
}

function sortTablesForDeletion(tables: string[], fks: FkEdge[]): string[] {
  const tableSet = new Set(tables);
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();
  const priority = new Map<string, number>();
  TENANT_CLEAR_ORDER.forEach((t, i) => priority.set(t, i));

  for (const t of tables) {
    inDegree.set(t, 0);
    dependents.set(t, new Set());
  }

  for (const { child, parent } of fks) {
    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) continue;
    inDegree.set(parent, (inDegree.get(parent) || 0) + 1);
    dependents.get(child)!.add(parent);
  }

  const queue = tables
    .filter((t) => (inDegree.get(t) || 0) === 0)
    .sort((a, b) => (priority.get(a) ?? 9999) - (priority.get(b) ?? 9999));

  const sorted: string[] = [];
  while (queue.length > 0) {
    const table = queue.shift()!;
    sorted.push(table);
    for (const parent of dependents.get(table) || []) {
      const next = (inDegree.get(parent) || 1) - 1;
      inDegree.set(parent, next);
      if (next === 0) {
        queue.push(parent);
        queue.sort((a, b) => (priority.get(a) ?? 9999) - (priority.get(b) ?? 9999));
      }
    }
  }

  if (sorted.length < tables.length) {
    for (const t of TENANT_CLEAR_ORDER) {
      if (tableSet.has(t) && !sorted.includes(t)) sorted.push(t);
    }
    for (const t of tables) {
      if (!sorted.includes(t)) sorted.push(t);
    }
  }

  return sorted;
}

export async function resolvePrimaryAdminUserId(
  client: pg.PoolClient,
  tenantId: number
): Promise<number | null> {
  const res = await client.query(
    `SELECT id FROM users
     WHERE tenant_id = $1 AND is_primary_admin = true AND is_active = true
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1`,
    [tenantId]
  );
  if (res.rows[0]?.id) return Number(res.rows[0].id);

  const fallback = await client.query(
    `SELECT id FROM users
     WHERE tenant_id = $1 AND role IN ('administrator', 'admin')
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1`,
    [tenantId]
  );
  return fallback.rows[0]?.id ? Number(fallback.rows[0].id) : null;
}

export async function getPrimaryAdminProfile(
  client: pg.PoolClient,
  tenantId: number
): Promise<{ id: number; name: string; email: string } | null> {
  const id = await resolvePrimaryAdminUserId(client, tenantId);
  if (!id) return null;
  const res = await client.query(`SELECT id, full_name, email, username FROM users WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.full_name || row.username || 'Admin'),
    email: String(row.email || row.username || ''),
  };
}

/** Preserved on reset when keepTenant is true (school shell + login accounts). */
const PRESERVE_WHEN_KEEP_TENANT = new Set(['tenants', 'users', 'school_settings']);

export type ClearTenantDataOptions = {
  keepTenant?: boolean;
  /** When false (restore), users and school_settings are wiped before re-import. Default true for reset. */
  preserveAccounts?: boolean;
  /** When set, delete all tenant users except this id (primary admin preservation on reset). */
  preserveUserId?: number;
};

/** Columns that reference users(id); nulled on restore when the user id is missing from backup. */
const USER_FK_COLUMNS: Record<string, string[]> = {
  terms: ['closed_by_user_id'],
  term_snapshots: ['created_by_user_id'],
  payments: ['recorded_by'],
  student_grades: ['graded_by'],
  term_report_releases: ['released_by'],
  grade_audit_log: ['changed_by'],
  receipt_corrections: ['created_by_user_id'],
  student_ledger: ['created_by'],
  audit_logs: ['user_id'],
  announcement_reads: ['user_id'],
  staff_user_push_subscriptions: ['user_id'],
  global_chat_messages: ['user_id'],
  support_messages: ['user_id'],
  private_conversations: ['participant_a', 'participant_b'],
  private_messages: ['sender_id'],
  learning_teacher_quizzes: ['teacher_user_id'],
  learning_teacher_question_bank: ['teacher_user_id'],
  quiz_sessions: ['teacher_user_id'],
};

/** Restore parents before children. */
export const TENANT_RESTORE_ORDER = [
  'tenants',
  'academic_years',
  'academic_terms',
  'users',
  'school_settings',
  'terms',
  'school_class_levels',
  'classes',
  'subjects',
  'teachers',
  'other_staff',
  'students',
  'payment_accounts',
  'fee_structures',
  'ledger_fee_structures',
  'payments',
  'receipts',
  'income',
  'expenses',
  'fund_transfers',
  'student_ledger',
  'receipt_corrections',
  'student_credits',
  'student_arrears',
  'student_arrears_balance',
  'term_arrears',
  'term_outstanding_balances',
  'class_teachers',
  'graduation_details',
  'student_class_enrollments',
  'student_grades',
  'grade_assignments',
  'grade_audit_log',
  'salary_payments',
  'payroll_other_staff',
  'payroll_settings',
  'teacher_appointment_letters',
  'attendance',
  'term_report_releases',
  'term_report_comments',
  'term_snapshots',
  'budget_categories',
  'term_budgets',
  'budget_lines',
  'budget_alerts',
  'parent_portal_family_groups',
  'parent_portal_accounts',
  'parent_push_subscriptions',
  'staff_user_push_subscriptions',
  'parent_fcm_tokens',
  'parent_notifications',
  'parent_messages',
  'message_replies',
  'support_messages',
  'global_chat_reactions',
  'global_chat_messages',
  'private_conversations',
  'private_messages',
  'announcement_reads',
  'events',
  'learning_questions',
  'learning_teacher_quizzes',
  'learning_teacher_quiz_questions',
  'learning_teacher_question_bank',
  'quiz_sessions',
  'student_points',
  'learning_teacher_quiz_attempts',
  'receipt_number_seq',
  'audit_logs',
  'system_errors',
  'school_setup_progress',
] as const;

export type TenantBackupManifest = {
  version: string;
  backup_type: 'full_tenant_backup';
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  created_at: string;
  created_by: string;
  table_counts: Record<string, number>;
  total_records: number;
  checksum: string;
};

export type FullTenantBackupFile = {
  manifest: TenantBackupManifest;
  data: Record<string, Record<string, unknown>[]>;
  /** Legacy fields for older clients */
  version?: string;
  generatedAt?: string;
  school?: Record<string, unknown>;
};

let cachedTenantTables: string[] | null = null;
const tenantIdColumnCache = new Map<string, boolean>();

async function tableHasTenantIdColumn(client: pg.PoolClient, table: string): Promise<boolean> {
  const cached = tenantIdColumnCache.get(table);
  if (cached !== undefined) return cached;
  const res = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'
    ) AS exists`,
    [table]
  );
  const exists = !!res.rows[0]?.exists;
  tenantIdColumnCache.set(table, exists);
  return exists;
}

export async function discoverTenantTables(): Promise<string[]> {
  if (cachedTenantTables) return cachedTenantTables;
  const res = await query(
    `SELECT DISTINCT table_name
     FROM information_schema.columns
     WHERE column_name = 'tenant_id'
       AND table_schema = 'public'
     ORDER BY table_name`
  );
  cachedTenantTables = res.rows
    .map((r: { table_name: string }) => r.table_name)
    .filter((t) => t !== 'tenants');
  return cachedTenantTables;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

export function generateChecksum(data: Record<string, unknown[]>): string {
  return crypto.createHash('sha256').update(stableStringify(data)).digest('hex');
}

async function fetchTableRows(tenantId: number, table: string): Promise<Record<string, unknown>[]> {
  const special = SPECIAL_TABLE_QUERIES[table];
  if (special) {
    const res = await query(special.select, [tenantId]);
    return res.rows;
  }
  const orderCol = await resolveTableOrderColumn(table);
  const orderClause = orderCol ? ` ORDER BY ${orderCol} ASC` : '';
  try {
    const res = await query(`SELECT * FROM ${table} WHERE tenant_id = $1${orderClause}`, [tenantId]);
    return res.rows;
  } catch (err: unknown) {
    console.warn(`[backup] Skipped ${table}:`, (err as Error)?.message || err);
    return [];
  }
}

export async function buildTenantBackupData(tenantId: number): Promise<{
  tenant: Record<string, unknown>;
  data: Record<string, Record<string, unknown>[]>;
}> {
  const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  if (tenantRes.rows.length === 0) {
    throw new Error('School not found');
  }
  const tenant = tenantRes.rows[0] as Record<string, unknown>;

  const discovered = await discoverTenantTables();
  const allTables = new Set<string>([
    'tenants',
    ...discovered,
    ...Object.keys(SPECIAL_TABLE_QUERIES),
  ]);

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of allTables) {
    if (table === 'tenants') {
      data.tenants = [tenant];
      continue;
    }
    data[table] = await fetchTableRows(tenantId, table);
  }

  return { tenant, data };
}

export async function exportFullTenantBackup(
  tenantId: number,
  createdBy: string
): Promise<FullTenantBackupFile> {
  const { tenant, data } = await buildTenantBackupData(tenantId);
  const table_counts = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v.length])
  );
  const total_records = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
  const checksum = generateChecksum(data);
  const created_at = new Date().toISOString();

  const manifest: TenantBackupManifest = {
    version: '1.0',
    backup_type: 'full_tenant_backup',
    tenant_id: tenantId,
    tenant_name: String(tenant.name || 'School'),
    tenant_slug: String(tenant.slug || ''),
    created_at,
    created_by: createdBy,
    table_counts,
    total_records,
    checksum,
  };

  return {
    manifest,
    data,
    version: manifest.version,
    generatedAt: created_at,
    school: tenant,
  };
}

export function isFullTenantBackup(raw: unknown): raw is FullTenantBackupFile {
  if (!raw || typeof raw !== 'object') return false;
  const m = (raw as FullTenantBackupFile).manifest;
  return !!m && m.backup_type === 'full_tenant_backup';
}

export function normalizeBackupData(raw: unknown): Record<string, Record<string, unknown>[]> | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as FullTenantBackupFile & { data?: Record<string, unknown[]> };
  if (!payload.data || typeof payload.data !== 'object') return null;
  return payload.data as Record<string, Record<string, unknown>[]>;
}

export type BackupValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
  schoolName?: string;
  sourceTenantId?: number;
  manifest?: TenantBackupManifest;
  total_records?: number;
};

export function validateTenantBackup(tenantId: number, raw: unknown): BackupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};

  const data = normalizeBackupData(raw);
  if (!data) {
    return { valid: false, errors: ['Invalid JSON backup file or missing data section.'], warnings, stats };
  }

  if (isFullTenantBackup(raw)) {
    const { manifest } = raw;
    const expected = generateChecksum(data);
    if (expected !== manifest.checksum) {
      errors.push('Backup file is corrupted or tampered — checksum mismatch.');
    }
    if (manifest.tenant_id !== tenantId) {
      errors.push(
        `Backup belongs to tenant ${manifest.tenant_id} (${manifest.tenant_name}), not tenant ${tenantId}.`
      );
    }
    Object.assign(stats, manifest.table_counts);
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
      schoolName: manifest.tenant_name,
      sourceTenantId: manifest.tenant_id,
      manifest,
      total_records: manifest.total_records,
    };
  }

  // Legacy backup format
  const legacy = raw as { school?: { id?: number; name?: string } };
  const sourceId = Number(legacy.school?.id);
  if (!Number.isFinite(sourceId)) {
    warnings.push('Backup does not record a source school id — import will target the selected school only.');
  } else if (sourceId !== tenantId) {
    warnings.push(
      `Backup was created for school #${sourceId} (${legacy.school?.name || 'unknown'}) but will restore into school #${tenantId}.`
    );
  }
  for (const [table, rows] of Object.entries(data)) {
    if (Array.isArray(rows)) stats[table] = rows.length;
  }
  if ((stats.students ?? 0) === 0 && (stats.classes ?? 0) === 0) {
    warnings.push('Backup contains no students or classes — it may be empty.');
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
    schoolName: legacy.school?.name,
    sourceTenantId: Number.isFinite(sourceId) ? sourceId : undefined,
    total_records: Object.values(stats).reduce((a, b) => a + b, 0),
  };
}

async function deleteFromTable(client: pg.PoolClient, tenantId: number, table: string): Promise<number> {
  const special = SPECIAL_TABLE_QUERIES[table];
  if (special) {
    const res = await client.query(special.delete, [tenantId]);
    return res.rowCount ?? 0;
  }
  if (!(await tableHasTenantIdColumn(client, table))) {
    throw new Error(
      `Table "${table}" has no tenant_id column — add a tenant-scoped delete in SPECIAL_TABLE_QUERIES`
    );
  }
  const res = await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
  return res.rowCount ?? 0;
}

async function tableExists(client: pg.PoolClient, table: string): Promise<boolean> {
  const res = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [table]
  );
  return !!res.rows[0]?.exists;
}

async function resetSchoolSettingsDefaults(client: pg.PoolClient, tenantId: number): Promise<void> {
  const year = new Date().getFullYear().toString();
  const updated = await client.query(
    `UPDATE school_settings
     SET address = NULL, contact = NULL,
         current_year = $2, current_term = NULL,
         receipt_prefix = 'R', postal_address = NULL,
         contact_phone = NULL, receipt_footer = NULL,
         bank_details = NULL, phone_number = NULL, whatsapp_number = NULL,
         office_hours = NULL, physical_address = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1`,
    [tenantId, year]
  );
  if ((updated.rowCount ?? 0) === 0) {
    await client.query(
      `INSERT INTO school_settings (tenant_id, school_name, current_year)
       SELECT id, name, $2 FROM tenants WHERE id = $1
       ON CONFLICT (tenant_id) DO UPDATE SET current_year = EXCLUDED.current_year`,
      [tenantId, year]
    );
  }
}

export type TenantClearResult = {
  deletedTables: number;
  deletedRows: Record<string, number>;
  preservedAdmin?: { id: number; name: string; email: string } | null;
};

async function runPreClearTenantFixups(client: pg.PoolClient, tenantId: number): Promise<void> {
  await client.query(
    `UPDATE students
     SET admission_academic_term_id = NULL,
         inactivated_academic_term_id = NULL
     WHERE tenant_id = $1`,
    [tenantId]
  ).catch(() => undefined);

  await client.query(
    `UPDATE school_website_applications SET student_id = NULL
     WHERE tenant_id = $1 AND student_id IS NOT NULL`,
    [tenantId]
  ).catch(() => undefined);

  await client.query(
    `UPDATE complaints SET subject_student_id = NULL
     WHERE tenant_id = $1 AND subject_student_id IS NOT NULL`,
    [tenantId]
  ).catch(() => undefined);
}

export async function verifyTenantOperationalDataCleared(
  client: pg.PoolClient,
  tenantId: number
): Promise<{ ok: boolean; remaining: Record<string, number> }> {
  const checks = [
    ['students', 'SELECT COUNT(*)::int AS n FROM students WHERE tenant_id = $1'],
    ['teachers', 'SELECT COUNT(*)::int AS n FROM teachers WHERE tenant_id = $1'],
    ['other_staff', 'SELECT COUNT(*)::int AS n FROM other_staff WHERE tenant_id = $1'],
    ['payments', 'SELECT COUNT(*)::int AS n FROM payments WHERE tenant_id = $1'],
    ['classes', 'SELECT COUNT(*)::int AS n FROM classes WHERE tenant_id = $1'],
    ['student_ledger', 'SELECT COUNT(*)::int AS n FROM student_ledger WHERE tenant_id = $1'],
    ['attendance', 'SELECT COUNT(*)::int AS n FROM attendance WHERE tenant_id = $1'],
    ['staff_attendance', 'SELECT COUNT(*)::int AS n FROM staff_attendance WHERE tenant_id = $1'],
    ['complaints', 'SELECT COUNT(*)::int AS n FROM complaints WHERE tenant_id = $1'],
    ['chat_messages', 'SELECT COUNT(*)::int AS n FROM chat_messages WHERE tenant_id = $1'],
    ['parent_messages', 'SELECT COUNT(*)::int AS n FROM parent_messages WHERE tenant_id = $1'],
    ['parent_portal_accounts', 'SELECT COUNT(*)::int AS n FROM parent_portal_accounts WHERE tenant_id = $1'],
    ['student_admission_letters', 'SELECT COUNT(*)::int AS n FROM student_admission_letters WHERE tenant_id = $1'],
    [
      'student_transport',
      `SELECT COUNT(*)::int AS n FROM student_transport st
       WHERE st.route_id IN (SELECT id FROM routes WHERE tenant_id = $1)
          OR st.student_id IN (SELECT id FROM students WHERE tenant_id = $1)`,
    ],
    ['class_timetable', 'SELECT COUNT(*)::int AS n FROM class_timetable WHERE tenant_id = $1'],
    ['exam_timetable', 'SELECT COUNT(*)::int AS n FROM exam_timetable WHERE tenant_id = $1'],
    ['periods', 'SELECT COUNT(*)::int AS n FROM periods WHERE tenant_id = $1'],
    ['grade_assignments', 'SELECT COUNT(*)::int AS n FROM grade_assignments WHERE tenant_id = $1'],
    ['salary_payments', 'SELECT COUNT(*)::int AS n FROM salary_payments WHERE tenant_id = $1'],
  ] as const;

  const remaining: Record<string, number> = {};
  for (const [key, sql] of checks) {
    const res = await client.query(sql, [tenantId]);
    const n = Number(res.rows[0]?.n ?? 0);
    if (n > 0) remaining[key] = n;
  }
  return { ok: Object.keys(remaining).length === 0, remaining };
}

export async function clearTenantData(
  client: pg.PoolClient,
  tenantId: number,
  opts?: ClearTenantDataOptions
): Promise<TenantClearResult> {
  const keepTenant = opts?.keepTenant !== false;
  const preserveAccounts = opts?.preserveAccounts !== false;
  let preserveUserId = opts?.preserveUserId;

  if (keepTenant && !preserveUserId && !preserveAccounts) {
    preserveUserId = (await resolvePrimaryAdminUserId(client, tenantId)) ?? undefined;
  }

  const discovered = await discoverTenantTables();
  const candidateTables = [
    ...new Set<string>([
      ...Object.keys(SPECIAL_TABLE_QUERIES),
      ...TENANT_CLEAR_ORDER,
      ...discovered,
    ]),
  ].filter((t) => t !== 'tenants');

  const fks = await loadPublicForeignKeys(client);
  const ordered = sortTablesForDeletion(candidateTables, fks);

  const deletedRows: Record<string, number> = {};
  let deletedTables = 0;

  await runPreClearTenantFixups(client, tenantId);

  for (const table of ordered) {
    if (keepTenant && preserveAccounts && !preserveUserId && PRESERVE_WHEN_KEEP_TENANT.has(table)) {
      continue;
    }

    const exists = await tableExists(client, table);
    if (!exists) continue;

    try {
      let rowCount = 0;
      if (table === 'users' && keepTenant && preserveUserId) {
        const res = await client.query(`DELETE FROM users WHERE tenant_id = $1 AND id <> $2`, [
          tenantId,
          preserveUserId,
        ]);
        rowCount = res.rowCount ?? 0;
      } else if (table === 'school_settings' && keepTenant && preserveAccounts && !preserveUserId) {
        /* preserved — reset defaults below */
      } else {
        rowCount = await deleteFromTable(client, tenantId, table);
      }
      deletedRows[table] = rowCount;
      deletedTables++;
      console.log(`✅ Cleared ${table} (${rowCount} rows)`);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string; constraint?: string };
      const reason = pgErr.constraint
        ? `${pgErr.message || String(err)} [${pgErr.constraint}]`
        : pgErr.message || String(err);
      console.error(`❌ Failed at ${table}: ${reason}`);
      throw new Error(`Tenant clear failed at ${table}: ${reason}`);
    }
  }

  if (keepTenant && (preserveAccounts || preserveUserId)) {
    await resetSchoolSettingsDefaults(client, tenantId);
  }

  if (keepTenant) {
    await client.query(`UPDATE tenants SET is_demo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      tenantId,
    ]);
  }

  let preservedAdmin: { id: number; name: string; email: string } | null = null;
  if (keepTenant && preserveUserId) {
    const check = await client.query(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2`, [
      preserveUserId,
      tenantId,
    ]);
    if (check.rows.length === 0) {
      throw new Error(`Primary admin user #${preserveUserId} was not preserved after reset`);
    }
    preservedAdmin = await getPrimaryAdminProfile(client, tenantId);
  }

  const verification = await verifyTenantOperationalDataCleared(client, tenantId);
  if (!verification.ok) {
    const summary = Object.entries(verification.remaining)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    throw new Error(`Reset incomplete — data still remains (${summary})`);
  }

  return { deletedTables, deletedRows, preservedAdmin };
}

function serializeCell(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

type ColumnTypeMap = Map<string, string>;
const tableColumnTypeCache = new Map<string, ColumnTypeMap>();

async function getTableColumnTypes(client: pg.PoolClient, table: string): Promise<ColumnTypeMap> {
  const cached = tableColumnTypeCache.get(table);
  if (cached) return cached;
  const res = await client.query(
    `SELECT column_name, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  const map: ColumnTypeMap = new Map();
  for (const row of res.rows as Array<{ column_name: string; udt_name: string }>) {
    map.set(row.column_name, row.udt_name);
  }
  tableColumnTypeCache.set(table, map);
  return map;
}

function serializeCellForColumn(value: unknown, udtName?: string): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (udtName === 'json' || udtName === 'jsonb') {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (udtName?.startsWith('_')) return value;
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Tables that use ON CONFLICT during restore when a row already exists. */
const RESTORE_UPSERT_CONFLICT: Record<string, string> = {
  school_settings: '(tenant_id)',
  receipt_number_seq: '(tenant_id)',
  school_setup_progress: '(school_id)',
};

/**
 * Append-only tables with global SERIAL ids — strip id on restore to avoid
 * cross-tenant primary key collisions (nothing references these ids via FK).
 */
const RESTORE_STRIP_ID_TABLES = new Set(['audit_logs', 'system_errors']);

function sanitizeUserForeignKeys(
  table: string,
  row: Record<string, unknown>,
  userIds: Set<number>
): void {
  const cols = USER_FK_COLUMNS[table];
  if (!cols?.length) return;
  for (const col of cols) {
    const id = Number(row[col]);
    if (Number.isFinite(id) && !userIds.has(id)) {
      row[col] = null;
    }
  }
}

async function insertBackupRows(
  client: pg.PoolClient,
  table: string,
  tenantId: number,
  rows: Record<string, unknown>[],
  userIds: Set<number>
): Promise<number> {
  if (!rows.length) return 0;
  const conflict = RESTORE_UPSERT_CONFLICT[table];
  const columnTypes = await getTableColumnTypes(client, table);
  let inserted = 0;
  for (const raw of rows) {
    const row: Record<string, unknown> = { ...raw };
    if (RESTORE_STRIP_ID_TABLES.has(table)) {
      delete row.id;
    }
    sanitizeUserForeignKeys(table, row, userIds);
    if (table !== 'tenants' && table !== 'school_setup_progress' && table !== 'learning_questions') {
      row.tenant_id = tenantId;
    }
    if (table === 'school_setup_progress') {
      row.school_id = tenantId;
    }
    if (table === 'learning_questions') {
      row.school_id = tenantId;
    }

    const keys = Object.keys(row).filter((k) => row[k] !== undefined && columnTypes.has(k));
    if (keys.length === 0) continue;
    const values = keys.map((k) => serializeCellForColumn(row[k], columnTypes.get(k)));
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    if (conflict) {
      const updateKeys = keys.filter((k) => k !== 'id');
      if (updateKeys.length === 0) {
        await client.query(
          `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT ${conflict} DO NOTHING`,
          values
        );
      } else {
        const updateSet = updateKeys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${cols}) VALUES (${placeholders})
           ON CONFLICT ${conflict} DO UPDATE SET ${updateSet}`,
          values
        );
      }
    } else {
      await client.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
    }
    inserted++;
  }
  return inserted;
}

async function updateTenantFromBackup(
  client: pg.PoolClient,
  tenantId: number,
  row: Record<string, unknown>
): Promise<void> {
  const skip = new Set(['id', 'created_at']);
  const keys = Object.keys(row).filter((k) => !skip.has(k) && row[k] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
  const values = keys.map((k) => serializeCell(row[k]));
  await client.query(`UPDATE tenants SET ${sets} WHERE id = $1`, [tenantId, ...values]);
}

async function resetTableSequence(client: pg.PoolClient, table: string): Promise<void> {
  try {
    const safeTable = table.replace(/[^a-z0-9_]/gi, '');
    if (!safeTable) return;
    await client.query(
      `SELECT setval(
        pg_get_serial_sequence('${safeTable}', 'id'),
        COALESCE((SELECT MAX(id) FROM ${safeTable}), 1),
        true
      )`
    );
  } catch {
    /* table may lack serial id */
  }
}

export async function restoreTenantData(
  client: pg.PoolClient,
  tenantId: number,
  raw: unknown
): Promise<{ restored: Record<string, number> }> {
  const validation = validateTenantBackup(tenantId, raw);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }
  const data = normalizeBackupData(raw)!;

  const userIds = new Set<number>();
  const userRows = data.users;
  if (Array.isArray(userRows)) {
    for (const u of userRows) {
      const id = Number((u as Record<string, unknown>).id);
      if (Number.isFinite(id)) userIds.add(id);
    }
  }

  await clearTenantData(client, tenantId, { keepTenant: true, preserveAccounts: false });

  const discovered = await discoverTenantTables();
  const restoreOrder = [
    ...new Set<string>([...TENANT_RESTORE_ORDER, ...discovered, ...Object.keys(SPECIAL_TABLE_QUERIES)]),
  ];

  const restored: Record<string, number> = {};
  for (const table of restoreOrder) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      restored[table] = 0;
      continue;
    }
    if (!(await tableExists(client, table))) {
      restored[table] = 0;
      continue;
    }
    if (table === 'tenants') {
      await updateTenantFromBackup(client, tenantId, rows[0] as Record<string, unknown>);
      restored[table] = 1;
      continue;
    }
    try {
      restored[table] = await insertBackupRows(
        client,
        table,
        tenantId,
        rows as Record<string, unknown>[],
        userIds
      );
      await resetTableSequence(client, table);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string; message?: string };
      const detail =
        pgErr.code === '23505'
          ? `duplicate key${pgErr.constraint ? ` (${pgErr.constraint})` : ''} in ${table}`
          : pgErr.message || String(err);
      throw new Error(`Restore failed while importing ${table}: ${detail}`);
    }
  }

  return { restored };
}

export function getSafetyBackupDir(): string {
  return path.resolve(
    process.env.SCHOLARNERVE_BACKUP_DIR || path.join(process.cwd(), 'backups', 'scholarnerve')
  );
}

export async function writeSafetyBackup(
  tenantId: number,
  label: 'pre-restore' | 'pre-reset' | 'pre-demo-import'
): Promise<string> {
  const backup = await exportFullTenantBackup(tenantId, 'system-safety-backup');
  const dir = getSafetyBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  const filename = `safety_tenant_${tenantId}_${label}_${Date.now()}.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
  return filepath;
}
