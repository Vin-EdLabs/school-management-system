import { getClient, query } from '../db/connection.js';
import { loadDemoSeedData } from './demoImportService.js';
import { seedDemoWebsiteContent } from './demoWebsiteSeed.js';

const tenantId = Number(process.argv[2] || 20);

async function main() {
  const seed = loadDemoSeedData();
  const client = await getClient();

  try {
    const tenantRes = await query(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
    if (!tenantRes.rows[0]) throw new Error(`Tenant ${tenantId} not found`);

    const ids = new Map<string, number>();
    const teachers = await client.query(`SELECT id, staff_id FROM teachers WHERE tenant_id = $1`, [tenantId]);
    for (const t of seed.teachers) {
      const row = teachers.rows.find((r) => r.staff_id === t.staff_id);
      if (row) ids.set(t.key, Number(row.id));
    }
    const staff = await client.query(`SELECT id, staff_id FROM other_staff WHERE tenant_id = $1`, [tenantId]);
    for (const s of seed.other_staff) {
      const row = staff.rows.find((r) => r.staff_id === s.staff_id);
      if (row) ids.set(s.key, Number(row.id));
    }

    await client.query('BEGIN');
    const result = await seedDemoWebsiteContent(client, tenantId, seed, ids, {
      studentCount: seed.student_config?.count ?? 100,
      classCount: seed.classes.length,
      schoolName: String(tenantRes.rows[0].name),
    });
    await client.query('COMMIT');

    console.log('Website refreshed:', result);
    const about = await query(
      `SELECT director_photo_url FROM school_website_about WHERE tenant_id = $1`,
      [tenantId]
    );
    console.log('Director photo:', about.rows[0]?.director_photo_url);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
