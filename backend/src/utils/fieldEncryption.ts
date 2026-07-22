import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const IV_LENGTH = 16;

function encryptionKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'scholarnerve-dev-key-change-me';
  return crypto.createHash('sha256').update(raw).digest();
}

/** Encrypt sensitive values (e.g. Paystack secret keys) for storage. */
export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt values encrypted with encryptField. */
export function decryptField(payload: string): string {
  const [ivHex, dataHex] = String(payload || '').split(':');
  if (!ivHex || !dataHex) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
