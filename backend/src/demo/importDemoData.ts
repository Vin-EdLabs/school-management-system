/**
 * CLI: npx tsx src/demo/importDemoData.ts <tenant_id>
 * Loads ScholarNerve demo seed data for the given tenant (transactional).
 */
import { importDemoDataForTenant } from './demoImportService.js';

const tenantId = parseInt(process.argv[2] || '', 10);

if (!tenantId || Number.isNaN(tenantId)) {
  console.error('Usage: npx tsx src/demo/importDemoData.ts <tenant_id>');
  process.exit(1);
}

importDemoDataForTenant(tenantId)
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(`\n❌ Demo import failed: ${err.message || err}`);
    process.exit(1);
  });
