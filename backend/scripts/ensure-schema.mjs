/**
 * Run supplemental schema repair. Builds dist first if needed.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distFile = join(root, 'dist/db/ensureSchema.js');

if (!existsSync(distFile)) {
  console.log('⚠️  dist/db/ensureSchema.js not found — running npm run build…');
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
  if (build.status !== 0) {
    console.error('\n❌ Build failed. Fix errors above, then retry: npm run schema:ensure');
    process.exit(build.status || 1);
  }
  if (!existsSync(distFile)) {
    console.error('\n❌ Build finished but dist/db/ensureSchema.js is still missing.');
    console.error('   Run: git pull && npm run build');
    process.exit(1);
  }
}

const { ensureSupplementalSchema } = await import('../dist/db/ensureSchema.js');
await ensureSupplementalSchema();
process.exit(0);
