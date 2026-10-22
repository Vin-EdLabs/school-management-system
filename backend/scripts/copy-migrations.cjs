const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../db/migrations');
const dest = path.join(__dirname, '../dist/db/migrations');

if (!fs.existsSync(src)) {
  console.warn('copy-migrations: source not found', src);
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true, force: true });
console.log('✅ Copied db/migrations → dist/db/migrations');

const demoSeedSrc = path.join(__dirname, '../src/demo/demoSeedData.json');
const demoSeedDest = path.join(__dirname, '../dist/demo/demoSeedData.json');

if (fs.existsSync(demoSeedSrc)) {
  fs.mkdirSync(path.dirname(demoSeedDest), { recursive: true });
  // copyFileSync also chmods the destination, which fails with EPERM when a previous build
  // (e.g. run with sudo) left the file owned by another user. Replace the file and write the
  // bytes directly instead — no chmod involved.
  try {
    fs.rmSync(demoSeedDest, { force: true });
  } catch {
    /* not removable — fall through and overwrite in place */
  }
  fs.writeFileSync(demoSeedDest, fs.readFileSync(demoSeedSrc));
  console.log('✅ Copied src/demo/demoSeedData.json → dist/demo/demoSeedData.json');
} else {
  console.warn('copy-migrations: demo seed JSON not found', demoSeedSrc);
}
