import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type PublicWebsiteBundle,
  schoolWebsitePublicService,
} from '@/services/schoolWebsiteService';

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
      .then(setData)
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
