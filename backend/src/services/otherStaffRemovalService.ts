import type { PoolClient } from 'pg';
import { query, getClient } from '../db/connection.js';

export type OtherStaffDeletionType = 'soft' | 'hard';

const REMOVED_NAME = '[Removed]';

async function staffHasPaymentRecords(tenantId: number, staffId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM salary_payments
     WHERE tenant_id = $1 AND payee_type = 'staff' AND payee_id = $2
     LIMIT 1`,
    [tenantId, staffId]
  );
  return res.rows.length > 0;
}

async function disableStaffLogin(client: PoolClient, tenantId: number, staffId: number) {
  await client.query(
    `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND other_staff_id = $2`,
    [tenantId, staffId]
  ).catch(() => undefined);
}

async function scrubStaffRow(
  client: PoolClient,
  tenantId: number,
  staffId: number,
  deletionType: OtherStaffDeletionType,
  originalName: string,
  originalStaffId: string | null
) {
  const preservedName =
    originalName.trim() && originalName.trim() !== REMOVED_NAME ? originalName.trim() : null;
  await client.query(
    `UPDATE other_staff
     SET removed_original_name = COALESCE(removed_original_name, $4),
         removed_original_staff_id = COALESCE(removed_original_staff_id, $5),
         email = NULL,
         phone_number = NULL,
         passport_photo_url = NULL,
         home_address = NULL,
         national_id = NULL,
         notes = NULL,
         staff_id = '__removed_' || id::text,
         employment_status = 'inactive',
         is_deleted = true,
         deleted_at = COALESCE(deleted_at, NOW()),
         deletion_type = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [staffId, tenantId, deletionType, preservedName, originalStaffId]
  ).catch(async () => {
    await client.query(
      `UPDATE other_staff
       SET removed_original_name = COALESCE(removed_original_name, $3),
           removed_original_staff_id = COALESCE(removed_original_staff_id, $4),
           email = NULL,
           phone_number = NULL,
           passport_photo_url = NULL,
           home_address = NULL,
           national_id = NULL,
           notes = NULL,
           staff_id = '__removed_' || id::text,
           employment_status = 'inactive',
           is_deleted = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [staffId, tenantId, preservedName, originalStaffId]
    );
  });
}

export type RemoveOtherStaffResult = {
  outcome: 'deleted' | 'scrubbed';
  deletionType: OtherStaffDeletionType;
  staffId: number;
  hadPaymentRecords: boolean;
};

export async function removeOtherStaff(
  tenantId: number,
  staffId: number,
  deletionType: OtherStaffDeletionType
): Promise<RemoveOtherStaffResult> {
  const existing = await query(
    `SELECT id, full_name, staff_id, is_deleted FROM other_staff WHERE id = $1 AND tenant_id = $2`,
    [staffId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Staff member not found'), { status: 404 });
  }
  if (existing.rows[0].is_deleted) {
    throw Object.assign(new Error('Staff member is already removed'), { status: 400 });
  }

  const row = existing.rows[0];
  const hadPaymentRecords = await staffHasPaymentRecords(tenantId, staffId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await disableStaffLogin(client, tenantId, staffId);

    if (!hadPaymentRecords) {
      await client.query('DELETE FROM other_staff WHERE id = $1 AND tenant_id = $2', [staffId, tenantId]);
      await client.query('COMMIT');
      return { outcome: 'deleted', deletionType, staffId, hadPaymentRecords: false };
    }

    await scrubStaffRow(
      client,
      tenantId,
      staffId,
      deletionType,
      String(row.full_name || ''),
      row.staff_id ? String(row.staff_id) : null
    );
    await client.query('COMMIT');
    return { outcome: 'scrubbed', deletionType, staffId, hadPaymentRecords: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
