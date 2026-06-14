/**
 * Wipes ALL finance data for one tenant or every tenant.
 * Usage:
 *   node scripts/clear-all-finance-data.mjs           # all tenants
 *   node scripts/clear-all-finance-data.mjs --tenant=1  # single tenant
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'school_management_system',
});

async function clearFinanceForTenant(client, tenantId) {
  const run = (sql, params = [tenantId]) => client.query(sql, params);

  // Break self-references before deletes
  await run(
    `UPDATE payments SET corrects_payment_id = NULL, corrected_by_payment_id = NULL WHERE tenant_id = $1`
  ).catch(() => {});
  await run(
    `UPDATE fund_transfers SET original_transfer_id = NULL WHERE tenant_id = $1`
  ).catch(() => {});

  await run(`DELETE FROM receipt_corrections WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM receipts WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM fund_transfers WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM income WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM salary_payments WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM expenses WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM payments WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM payment_accounts WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM student_ledger WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM ledger_fee_structures WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM fee_structures WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM term_arrears WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM student_arrears WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM student_arrears_balance WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM student_credits WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM term_outstanding_balances WHERE tenant_id = $1`).catch(() => {});

  // Term budgets
  await run(
    `DELETE FROM budget_alerts WHERE tenant_id = $1`
  ).catch(() => {});
  await run(
    `DELETE FROM budget_lines WHERE tenant_id = $1`
  ).catch(() => {});
  await run(
    `DELETE FROM term_budgets WHERE tenant_id = $1`
  ).catch(() => {});

  // Ledger terms / academic calendar (fresh start)
  await run(`DELETE FROM terms WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM academic_years WHERE tenant_id = $1`).catch(() => {});
  await run(`DELETE FROM academic_terms WHERE tenant_id = $1`).catch(() => {});

  await run(
    `UPDATE school_settings
     SET current_term = NULL, current_year = NULL, legacy_payment_migration_completed = false
     WHERE tenant_id = $1`
  ).catch(() => {});

  await run(
    `UPDATE school_setup_progress SET has_terms = false, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE school_id = $1`
  ).catch(() => {});

  await run(
    `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
     VALUES ($1, 0, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE SET last_number = 0, updated_at = CURRENT_TIMESTAMP`
  ).catch(() => {});

  await run(
    `UPDATE school_settings SET legacy_payment_migration_completed = false WHERE tenant_id = $1`
  ).catch(() => {});

  console.log(`  Cleared finance data for tenant ${tenantId}`);
}

async function main() {
  const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? parseInt(tenantArg.split('=')[1], 10) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (tenantId) {
      await clearFinanceForTenant(client, tenantId);
    } else {
      const { rows } = await client.query('SELECT id FROM tenants ORDER BY id');
      if (rows.length === 0) {
        console.log('No tenants found.');
      }
      for (const row of rows) {
        await clearFinanceForTenant(client, row.id);
      }
    }

    await client.query('COMMIT');
    console.log('Done. Configure payment accounts, academic terms, and fee structures fresh in the app.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
