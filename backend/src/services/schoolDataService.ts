import type pg from 'pg';
import {
  exportFullTenantBackup,
  validateTenantBackup,
  clearTenantData,
  restoreTenantData,
  writeSafetyBackup,
  TENANT_RESTORE_ORDER,
  TENANT_CLEAR_ORDER,
  discoverTenantTables,
  generateChecksum,
} from './tenantBackupService.js';

/** @deprecated Use TENANT_RESTORE_ORDER — kept for imports that reference the old name. */
export const SCHOOL_BACKUP_TABLES = TENANT_RESTORE_ORDER.filter((t) => t !== 'tenants') as readonly string[];

/** @deprecated Use TENANT_CLEAR_ORDER */
export const SCHOOL_RESET_TABLES = TENANT_CLEAR_ORDER as readonly string[];

export type SchoolBackupPayload = {
  version?: string;
  generatedAt?: string;
  school?: { id?: number; name?: string };
  data?: Record<string, Record<string, unknown>[]>;
  manifest?: import('./tenantBackupService.js').TenantBackupManifest;
};

export type BackupValidation = import('./tenantBackupService.js').BackupValidation;

export function validateSchoolBackup(tenantId: number, raw: unknown): BackupValidation {
  return validateTenantBackup(tenantId, raw);
}

export async function exportSchoolBackup(
  tenantId: number,
  createdBy = 'system'
): Promise<Awaited<ReturnType<typeof exportFullTenantBackup>>> {
  return exportFullTenantBackup(tenantId, createdBy);
}

export async function resetSchoolOperationalData(client: pg.PoolClient, tenantId: number): Promise<void> {
  await clearTenantData(client, tenantId, { keepTenant: true });
}

export async function importSchoolBackup(
  client: pg.PoolClient,
  tenantId: number,
  raw: unknown
): Promise<{ imported: Record<string, number> }> {
  const { restored } = await restoreTenantData(client, tenantId, raw);
  return { imported: restored };
}

export {
  exportFullTenantBackup,
  validateTenantBackup,
  clearTenantData,
  restoreTenantData,
  writeSafetyBackup,
  discoverTenantTables,
  generateChecksum,
};
