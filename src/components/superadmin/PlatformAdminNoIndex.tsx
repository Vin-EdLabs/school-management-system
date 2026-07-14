import { useEffect } from 'react';

/** Prevent search engines from indexing the platform admin dashboard. */
export function PlatformAdminNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  return null;
}
