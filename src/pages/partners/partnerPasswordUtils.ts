import { savePartnerLoginCredentials, PARTNER_LOGIN_REALM } from '@/services/partnerApi';

export const PARTNER_MIN_PASSWORD = 6;

/** Autocomplete tokens — isolate partner portal from school/parent logins in password managers. */
export const PARTNER_LOGIN_AUTOCOMPLETE = {
  identifier: 'section-sn-partners username',
  password: 'section-sn-partners current-password',
} as const;

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
  savePartnerLoginCredentials(identifier, password);
  try {
    if (typeof window !== 'undefined' && 'PasswordCredential' in window) {
      const iconURL = `${window.location.origin}/partners/scholarnerve-partner-emblem.png`;
      const cred = new (window as any).PasswordCredential({
        id: identifier,
        password,
        name: `ScholarNerve Partners (${PARTNER_LOGIN_REALM})`,
        iconURL,
      });
      await navigator.credentials.store(cred);
    }
  } catch {
    /* Password Manager unavailable */
  }
}
