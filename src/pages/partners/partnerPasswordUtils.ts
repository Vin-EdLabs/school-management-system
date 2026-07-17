export const PARTNER_MIN_PASSWORD = 6;

/** Generate a readable random password (8 chars, letters + numbers). */
export function suggestPartnerPassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Save login to localStorage and browser password manager when available. */
export async function persistPartnerLogin(identifier: string, password: string): Promise<void> {
  const { savePartnerLoginCredentials } = await import('@/services/partnerApi');
  savePartnerLoginCredentials(identifier, password);
  try {
    if (typeof window !== 'undefined' && 'PasswordCredential' in window) {
      const cred = new (window as any).PasswordCredential({
        id: identifier,
        password,
        name: identifier,
      });
      await navigator.credentials.store(cred);
    }
  } catch {
    /* Password Manager unavailable */
  }
}
