import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Load .env.local first (local machine overrides)
dotenv.config({ path: path.join(rootDir, '.env.local') });

// 2. Load .env second for default/shared fallbacks (will not overwrite .env.local)
dotenv.config({ path: path.join(rootDir, '.env') });
