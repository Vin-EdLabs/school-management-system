/** Mask an email for display — e.g. john@gmail.com → j***n@gmail.com */
export function maskEmailAddress(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const at = clean.indexOf('@');
  if (at <= 0) return '***@***.com';

  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);

  let maskedLocal: string;
  if (local.length <= 1) {
    maskedLocal = `${local.charAt(0) || '*'}***`;
  } else if (local.length === 2) {
    maskedLocal = `${local[0]}*${local[1]}`;
  } else {
    maskedLocal = `${local[0]}***${local[local.length - 1]}`;
  }

  return `${maskedLocal}@${domain}`;
}
