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
  fs.copyFileSync(demoSeedSrc, demoSeedDest);
  console.log('✅ Copied src/demo/demoSeedData.json → dist/demo/demoSeedData.json');
} else {
  console.warn('copy-migrations: demo seed JSON not found', demoSeedSrc);
}
