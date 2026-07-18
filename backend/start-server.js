/**
 * Windows-safe dev starter.
 * Avoids `npx tsx watch` — that nested spawn often hits EPERM on Windows
 * (antivirus, paths with spaces, or too many node processes).
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting Backend Server...');
console.log('');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev:watch'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
