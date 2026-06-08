import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

export function parseIconSize(pathname: string, querySize?: string): number {
  if (querySize) {
    const parsed = parseInt(querySize, 10);
    if (!Number.isNaN(parsed) && parsed >= 16 && parsed <= 1024) return parsed;
  }
  if (pathname.includes('512')) return 512;
  if (pathname.includes('256')) return 256;
  if (pathname.includes('128')) return 128;
  if (pathname.includes('apple-touch')) return 180;
  if (pathname.includes('32')) return 32;
  if (pathname.includes('16')) return 16;
  return 192;
}

export async function loadLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  if (!logoUrl) return null;

  if (logoUrl.startsWith('data:')) {
    const matches = logoUrl.match(/^data:([A-Za-z0-9+/.-]+);base64,(.+)$/s);
    if (!matches) return null;
    try {
      return Buffer.from(matches[2], 'base64');
    } catch {
      return null;
    }
  }

  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  if (logoUrl.startsWith('/uploads/')) {
    const relative = logoUrl.replace(/^\/uploads\//, '');
    const filePath = path.join(UPLOADS_ROOT, relative);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  return null;
}

export async function renderLogoPng(source: Buffer, size: number): Promise<Buffer> {
  const safeSize = Math.min(Math.max(size, 16), 1024);

  return sharp(source, { density: 300, failOn: 'none' })
    .rotate()
    .resize(safeSize, safeSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png({ compressionLevel: 9, quality: 90, effort: 6 })
    .toBuffer();
}

export async function compressLogoForStorage(buffer: Buffer, mime: string): Promise<string> {
  const pipeline = sharp(buffer, { density: 300, failOn: 'none' })
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true });

  const usePng = /png|svg|gif|webp/i.test(mime);
  const output = usePng
    ? await pipeline.png({ compressionLevel: 9, quality: 85 }).toBuffer()
    : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  const outMime = usePng ? 'image/png' : 'image/jpeg';
  return `data:${outMime};base64,${output.toString('base64')}`;
}
