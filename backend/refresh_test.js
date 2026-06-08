import { refreshArrearsForTenant } from './src/services/arrearsService.js';
import { initializeDatabase } from './src/db/connection.js';

async function run() {
  await initializeDatabase();
  console.log('--- STARTING REFRESH ---');
  const result = await refreshArrearsForTenant(5);
  console.log('--- RESULT ---', result);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
