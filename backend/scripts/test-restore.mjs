import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { getClient, query } = await import('../dist/db/connection.js');
  const { restoreTenantData } = await import('../dist/services/tenantBackupService.js');

  const backupArg = process.argv[2];
  const tenantId = Number(process.argv[3] || 19);
  const inspectOnly = process.argv.includes('--inspect-users');

  if (inspectOnly) {
    const r = await query(
      `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    console.log(JSON.stringify(r.rows, null, 2));
    return;
  }

  const backupPath =
    backupArg ||
    path.join(__dirname, '../backups/scholarnerve/safety_tenant_19_pre-reset_1781560264802.json');

  const raw = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { restored } = await restoreTenantData(client, tenantId, raw);
    await client.query('ROLLBACK');
    console.log(
      'RESTORE_TEST_OK',
      JSON.stringify({
        terms: restored.terms ?? 0,
        users: restored.users ?? 0,
        students: restored.students ?? 0,
        payments: restored.payments ?? 0,
        total: Object.values(restored).reduce((a, b) => a + b, 0),
      })
    );
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('RESTORE_TEST_FAIL', e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
