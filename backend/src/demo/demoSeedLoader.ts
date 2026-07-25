import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DemoSeedData } from './demoImportService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DEMO_SEED_PATH = path.join(__dirname, 'demoSeedData.json');

/** Resolve demo seed JSON — dist copy after build, with src fallback for dev. */
export function resolveDemoSeedJsonPath(): string {
  if (fs.existsSync(DIST_DEMO_SEED_PATH)) return DIST_DEMO_SEED_PATH;
  const srcPath = path.join(process.cwd(), 'src/demo/demoSeedData.json');
  if (fs.existsSync(srcPath)) return srcPath;
  const repoRootPath = path.join(process.cwd(), 'backend/src/demo/demoSeedData.json');
  if (fs.existsSync(repoRootPath)) return repoRootPath;
  throw new Error(`Demo seed file not found (expected ${DIST_DEMO_SEED_PATH})`);
}

export function loadDemoSeedData(jsonPath?: string): DemoSeedData {
  const resolved = jsonPath || resolveDemoSeedJsonPath();
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw) as DemoSeedData;
}

export const DEMO_SEED_JSON_PATH = resolveDemoSeedJsonPath();
