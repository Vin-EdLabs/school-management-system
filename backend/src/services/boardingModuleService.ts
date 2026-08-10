import { query } from '../db/connection.js';

/** Whether the boarding module is enabled for a tenant (school). */
export async function isBoardingEnabledForTenant(tenantId: number): Promise<boolean> {
  const result = await query('SELECT boarding_enabled FROM tenants WHERE id = $1', [tenantId]);
  if (result.rows.length === 0) return false;
  return result.rows[0].boarding_enabled === true;
}
