import { applyPendingSqlFileMigrations } from './fileMigrations.js';
import { ensureSupplementalSchema } from './ensureSchema.js';

applyPendingSqlFileMigrations()
  .then(() => ensureSupplementalSchema())
  .then(() => {
    console.log('✅ All migrations complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
