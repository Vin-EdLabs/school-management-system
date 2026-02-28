// Simple Node.js server starter script
// This can be used as an alternative if ts-node has issues

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Backend Server...');
console.log('');

// Use tsx for TypeScript execution
const server = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code);
});
