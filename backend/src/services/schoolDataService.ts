import type pg from 'pg';
import { query } from '../db/connection.js';

/** Tables exported in backup JSON (insert order — parents before children). */
export const SCHOOL_BACKUP_TABLES = [
  'school_settings',
  'academic_terms',
  'academic_years',
  'terms',
  'classes',
  'subjects',
  'students',
  'teachers',
  'fees',
  'fee_structures',
  'ledger_fee_structures',
  'payments',
  'receipts',
  'student_ledger',
  'student_credits',
  'student_arrears',
  'student_arrears_balance',
  'term_arrears',
  'term_outstanding_balances',
  'income',
  'expenses',
  'attendance',
  'grade_assignments',
  'student_grades',
  'grade_audit_log',
  'salary_payments',
  'payroll_other_staff',
  'payroll_settings',
  'class_teachers',
  'parent_portal_accounts',
  'support_messages',
  'term_report_releases',
  'events',
  'receipt_number_seq',
] as const;

/** Delete order — children before parents (FK-safe). */
export const SCHOOL_RESET_TABLES = [
  'student_ledger',
  'grade_audit_log',
  'student_grades',
  'grade_assignments',
  'attendance',
  'receipts',
  'payments',
  'student_credits',
  'income',
  'expenses',
  'student_arrears',
  'student_arrears_balance',
  'term_arrears',
  'term_outstanding_balances',
  'ledger_fee_structures',
  'fees',
  'fee_structures',
  'salary_payments',
  'payroll_other_staff',
  'payroll_settings',
  'class_teachers',
  'parent_portal_accounts',
  'support_messages',
  'term_report_releases',
  'students',
  'classes',
  'subjects',
  'teachers',
  'terms',
  'academic_years',
  'academic_terms',
  'events',
  'receipt_number_seq',
] as const;

export type SchoolBackupPayload = {
  version?: string;
  generatedAt?: string;
  school?: { id?: number; name?: string };
  data?: Record<string, Record<string, unknown>[]>;
};

export type BackupValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
  schoolName?: string;
  sourceTenantId?: number;
};

function normalizeBackupPayload(raw: unknown): SchoolBackupPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SchoolBackupPayload;
}

export function validateSchoolBackup(tenantId: number, raw: unknown): BackupValidation {
  const payload = normalizeBackupPayload(raw);
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};

  if (!payload) {
    return { valid: false, errors: ['Invalid JSON backup file.'], warnings, stats };
  }

  if (!payload.data || typeof payload.data !== 'object') {
    errors.push('Backup is missing the "data" section.');
  }

  const sourceId = Number(payload.school?.id);
  if (!Number.isFinite(sourceId)) {
    warnings.push('Backup does not record a source school id — import will target the selected school only.');
  } else if (sourceId !== tenantId) {
    warnings.push(
      `Backup was created for school #${sourceId} (${payload.school?.name || 'unknown'}) but will restore into school #${tenantId}.`
    );
  }

  for (const table of SCHOOL_BACKUP_TABLES) {
    const rows = payload.data?.[table];
    if (Array.isArray(rows)) {
      stats[table] = rows.length;
    }
  }

  if ((stats.students ?? 0) === 0 && (stats.classes ?? 0) === 0) {
    warnings.push('Backup contains no students or classes — it may be empty.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
    schoolName: payload.school?.name,
    sourceTenantId: Number.isFinite(sourceId) ? sourceId : undefined,
  };
}

export async function exportSchoolBackup(tenantId: number): Promise<{
  version: string;
  generatedAt: string;
  school: Record<string, unknown>;
  data: Record<string, unknown[]>;
}> {
  const tenant = await query(
    `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
            subscription_status, is_active, created_at, updated_at
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (tenant.rows.length === 0) {
    throw new Error('School not found');
  }

  const data: Record<string, unknown[]> = {};
  for (const table of SCHOOL_BACKUP_TABLES) {
    try {
      const result = await query(`SELECT * FROM ${table} WHERE tenant_id = $1`, [tenantId]);
      data[table] = result.rows;
    } catch (err: unknown) {
      console.warn(`[backup] Skipped ${table}:`, (err as Error)?.message || err);
      data[table] = [];
    }
  }

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    school: tenant.rows[0],
    data,
  };
}

export async function resetSchoolOperationalData(client: pg.PoolClient, tenantId: number): Promise<void> {
  for (const [index, table] of SCHOOL_RESET_TABLES.entries()) {
    const savepoint = `reset_savepoint_${index}`;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    } catch (err: unknown) {
      console.warn(`[school reset] Skip/Fail table ${table}:`, (err as Error)?.message || err);
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (rollbackErr: unknown) {
        console.warn(`[school reset] Failed to rollback savepoint for ${table}:`, (rollbackErr as Error)?.message || rollbackErr);
      }
    }
  }

  await client.query(
    `UPDATE school_settings
     SET address = NULL, contact = NULL, email = NULL,
         current_year = $2, current_term = NULL,
         receipt_prefix = 'R', postal_address = NULL,
         contact_phone = NULL, receipt_footer = NULL,
         bank_details = NULL, phone_number = NULL, whatsapp_number = NULL,
         office_hours = NULL, physical_address = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1`,
    [tenantId, new Date().getFullYear().toString()]
  );
}

function serializeCell(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) {
          return parsed;
        }
      } catch {
        // Keep as-is if not valid JSON.
      }
    }
    return value;
  }
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function insertBackupRows(
  client: pg.PoolClient,
  table: string,
  tenantId: number,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (!rows.length) return 0;

  let inserted = 0;
  for (const raw of rows) {
    const row: Record<string, unknown> = { ...raw, tenant_id: tenantId };
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (keys.length === 0) continue;

    const values = keys.map((k) => serializeCell(row[k]));
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    try {
      await client.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
      inserted++;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      throw new Error(`Failed importing ${table}: ${msg}`);
    }
  }
  return inserted;
}

export async function importSchoolBackup(
  client: pg.PoolClient,
  tenantId: number,
  raw: unknown
): Promise<{ imported: Record<string, number> }> {
  const validation = validateSchoolBackup(tenantId, raw);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const payload = normalizeBackupPayload(raw)!;
  await resetSchoolOperationalData(client, tenantId);
  await client.query('DELETE FROM school_settings WHERE tenant_id = $1', [tenantId]);

  const imported: Record<string, number> = {};
  for (const table of SCHOOL_BACKUP_TABLES) {
    const rows = payload.data?.[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      imported[table] = 0;
      continue;
    }
    imported[table] = await insertBackupRows(client, table, tenantId, rows as Record<string, unknown>[]);
  }

  return { imported };
}
