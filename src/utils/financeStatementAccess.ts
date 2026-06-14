import type { UserRole } from '../contexts/AuthContext';

/** Admin + Finance roles may generate statements for any student (admin panel). */
export function canAccessFinanceStatement(role: UserRole | string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'super-admin' || r === 'administrator' || r === 'finance';
}
