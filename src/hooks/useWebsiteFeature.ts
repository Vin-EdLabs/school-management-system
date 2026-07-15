import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { schoolWebsiteAdminService } from '@/services/schoolWebsiteService';

/** Returns whether Super Admin has enabled the website feature for this school. */
export function useWebsiteFeatureEnabled(): boolean | null {
  const { isAuthenticated, hasAccess } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !hasAccess('website-management')) {
      setEnabled(false);
      return;
    }
    void schoolWebsiteAdminService
      .getOverview()
      .then((o) => setEnabled(!!o.is_enabled))
      .catch(() => setEnabled(false));
  }, [isAuthenticated, hasAccess]);

  return enabled;
}
