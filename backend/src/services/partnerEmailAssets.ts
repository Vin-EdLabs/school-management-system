import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PARTNER_EMBLEM_FILE = path.join(__dirname, '../../assets/partners/scholarnerve-partner-emblem.png');
const PARTNER_EMBLEM_PUBLIC = path.join(__dirname, '../../../public/partners/scholarnerve-partner-emblem.png');

/** Content-ID referenced in HTML: cid:scholarnerve-partner-emblem@scholarnerve */
export const PARTNER_EMAIL_LOGO_CID = 'scholarnerve-partner-emblem@scholarnerve';

let emblemCache: Buffer | null = null;
let dataUriCache: string | null = null;

export async function loadPartnerEmblemBytes(): Promise<Buffer> {
  if (emblemCache) return emblemCache;
  try {
    emblemCache = await fs.readFile(PARTNER_EMBLEM_FILE);
  } catch {
    emblemCache = await fs.readFile(PARTNER_EMBLEM_PUBLIC);
  }
  return emblemCache;
}

/** Inline data URI — reliable for admin preview and dev log mode. */
export async function getPartnerLogoDataUri(): Promise<string> {
  if (dataUriCache) return dataUriCache;
  const bytes = await loadPartnerEmblemBytes();
  dataUriCache = `data:image/png;base64,${bytes.toString('base64')}`;
  return dataUriCache;
}

/** Nodemailer inline attachment so logo shows in Gmail/Outlook (no external URL). */
export async function getPartnerLogoAttachment() {
  const content = await loadPartnerEmblemBytes();
  return {
    filename: 'scholarnerve-partner-emblem.png',
    content,
    cid: PARTNER_EMAIL_LOGO_CID,
    contentDisposition: 'inline' as const,
    contentType: 'image/png',
  };
}

export function partnerLogoCidSrc(): string {
  return `cid:${PARTNER_EMAIL_LOGO_CID}`;
}
