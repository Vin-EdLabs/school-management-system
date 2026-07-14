/** Obfuscated platform super-admin dashboard URL (not the user role name). */
export const PLATFORM_ADMIN_PATH = '/tn-7x4k2';

export function isPlatformAdminPath(pathname: string): boolean {
  return pathname === PLATFORM_ADMIN_PATH || pathname.startsWith(`${PLATFORM_ADMIN_PATH}/`);
}
