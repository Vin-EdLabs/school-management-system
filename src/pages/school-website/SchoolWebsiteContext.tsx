import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type PublicWebsiteBundle,
  schoolWebsitePublicService,
} from '@/services/schoolWebsiteService';
import {
  detectSchoolWebsiteSlugFromHost,
  detectSchoolWebsiteSuffixFromHost,
  getSchoolWebsitePublicUrl,
} from '@/utils/schoolWebsiteHost';

type Ctx = {
  slug: string;
  loading: boolean;
  error: string | null;
  data: PublicWebsiteBundle | null;
  accent: string;
  schoolName: string;
  reload: () => void;
};

const SchoolWebsiteContext = createContext<Ctx | null>(null);

export function SchoolWebsiteProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicWebsiteBundle | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void schoolWebsitePublicService
      .getSite(slug)
      .then((bundle) => {
        setData(bundle);
        const hostSlug = detectSchoolWebsiteSlugFromHost();
        const hostSuffix = detectSchoolWebsiteSuffixFromHost();
        const effective = bundle.website?.effective_public_subdomain;
        const canonicalSuffix = bundle.website?.website_url_suffix || 'edu';
        const tenantSlug = bundle.website?.slug || bundle.tenant?.slug || slug;
        if (
          hostSlug &&
          effective &&
          (hostSlug !== effective || (hostSuffix && hostSuffix !== canonicalSuffix))
        ) {
          const targetBase = getSchoolWebsitePublicUrl(
            tenantSlug,
            canonicalSuffix,
            bundle.website?.public_subdomain
          );
          const target = new URL(targetBase);
          target.pathname = window.location.pathname;
          target.search = window.location.search;
          target.hash = window.location.hash;
          if (target.hostname !== window.location.hostname) {
            window.location.replace(target.toString());
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load website'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({
      slug,
      loading,
      error,
      data,
      // School accent from CMS, falling back to ScholarNerve blue.
      accent: data?.website?.accent_color || '#2563eb',
      schoolName: data?.website?.school_name || data?.tenant?.name || 'School',
      reload: load,
    }),
    [slug, loading, error, data, load]
  );

  return <SchoolWebsiteContext.Provider value={value}>{children}</SchoolWebsiteContext.Provider>;
}

export function useSchoolWebsite() {
  const ctx = useContext(SchoolWebsiteContext);
  if (!ctx) throw new Error('useSchoolWebsite must be used within SchoolWebsiteProvider');
  return ctx;
}
