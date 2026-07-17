import { useLocation } from 'react-router-dom';

export type PartnerTabId = 'dashboard' | 'schools' | 'commissions' | 'more';

export function usePartnerTab(): PartnerTabId {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, '') || '/';
  if (path.endsWith('/schools')) return 'schools';
  if (path.endsWith('/commissions')) return 'commissions';
  if (path.endsWith('/more') || path.endsWith('/training') || path.endsWith('/profile')) return 'more';
  return 'dashboard';
}
