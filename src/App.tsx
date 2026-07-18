
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PlatformSettingsProvider } from "./contexts/PlatformSettingsContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ChatSocketProvider } from "./contexts/ChatSocketContext";
import { TeacherNotificationProvider } from "./contexts/TeacherNotificationContext";
import { AuditProvider } from "./contexts/AuditContext";
import { DataProvider } from "./contexts/DataContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { ActiveTermProvider } from "./contexts/ActiveTermContext";
import { TermStatusProvider } from "./contexts/TermStatusContext";
import Index from "./pages/Index";
import VerifyCardPage from "./pages/VerifyCardPage";
import PublicCheckinPage from "./pages/PublicCheckinPage";
import NotFound from "./pages/NotFound";
import SchoolSelector from "./pages/SchoolSelector";
import LandingPage from "./pages/LandingPage";
import PublicLandingSwitch from "./pages/PublicLandingSwitch";
import RegisterSchool from "./pages/RegisterSchool";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { ParentPortalRoute } from "./pages/ParentPortal";
import { detectTenantSlugFromHost, getSubdomainUrl, normalizeLegacyPathOnSubdomain } from "./utils/tenantHost";
import { isPartnersHost } from "./utils/partnersHost";
import PartnerPortalApp from "./pages/partners/PartnerPortalApp";
import {
  buildLegacyRedirectUrl,
  DEFAULT_WEBSITE_URL_SUFFIX,
  detectSchoolWebsiteSlugFromHost,
  getSchoolWebsitePublicUrl,
  parseLegacySchoolWebsiteHost,
  parsePublicWebsiteHost,
} from "./utils/schoolWebsiteHost";
import SchoolWebsiteApp from "./pages/school-website/SchoolWebsiteApp";
import { PLATFORM_ADMIN_PATH } from '@/constants/platformAdminRoute';
import { NetworkStatusBanner } from "@/components/ui/NetworkStatusBanner";
import { BrandedLoadingScreen, isSplashGone } from "@/components/common/BrandedLoading";
import { PARENT_IMPERSONATE_HANDOFF_KEY, STAFF_IMPERSONATE_HANDOFF_KEY } from "@/utils/impersonationHelpers";
import ImpersonationTransitionGate from "@/components/impersonation/ImpersonationTransitionGate";
import { PublicErrorPage } from "@/components/common/PublicErrorPage";
import { ThemeProvider } from "./contexts/ThemeContext";
import ZoomNudge from "@/components/common/ZoomNudge";
import { PwaUpdateManager } from "@/components/pwa/PwaUpdateManager";
import {
  parseTenantLookup,
  schoolPortalErrorPresentation,
  schoolPortalErrorHidesLandingLink,
  type SchoolPortalErrorState,
} from "./utils/schoolPortalError";
import { MapPinOff } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const HostAwareLanding = () => {
  const slug = detectTenantSlugFromHost();
  if (slug) return <Navigate to="/" replace />; // Keep URL clean, let the root route render it
  return <LandingPage />;
};

function PartnersLegacyRedirect() {
  React.useEffect(() => {
    const hash = window.location.hash === '#apply' ? '#apply' : '#partners';
    window.location.replace(`/${hash}`);
  }, []);
  return null;
}

const SubdomainPathNormalizer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const target = normalizeLegacyPathOnSubdomain(location.pathname);
    if (target && target !== location.pathname) {
      navigate(`${target}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

const SchoolWebsiteCanonicalRedirect = () => {
  React.useEffect(() => {
    const legacy = parseLegacySchoolWebsiteHost(window.location.hostname);
    if (legacy) {
      const targetBase = buildLegacyRedirectUrl(legacy.slug, DEFAULT_WEBSITE_URL_SUFFIX);
      const target = new URL(targetBase);
      target.pathname = window.location.pathname;
      target.search = window.location.search;
      target.hash = window.location.hash;
      if (target.origin !== window.location.origin) {
        window.location.replace(target.toString());
      }
      return;
    }

    const parsed = parsePublicWebsiteHost(window.location.hostname);
    if (!parsed) return;

    const apiBase =
      import.meta.env.VITE_API_BASE_URL ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001/api'
        : `${window.location.protocol}//${window.location.host}/api`);

    void fetch(
      `${apiBase}/public-website/site?host=${encodeURIComponent(window.location.hostname)}`,
      { headers: { 'X-Tenant-Slug': parsed.slug } }
    )
      .then(async (res) => {
        if (!res.ok) return;
        const bundle = (await res.json()) as {
          website?: {
            slug?: string;
            public_subdomain?: string | null;
            effective_public_subdomain?: string;
            website_url_suffix?: string;
          };
          tenant?: { slug?: string };
        };
        const effective = bundle.website?.effective_public_subdomain;
        const suffix = bundle.website?.website_url_suffix || 'edu';
        if (!effective || (parsed.slug === effective && parsed.suffix === suffix)) return;
        const tenantSlug = bundle.website?.slug || bundle.tenant?.slug || parsed.slug;
        const targetBase = getSchoolWebsitePublicUrl(tenantSlug, suffix, bundle.website?.public_subdomain);
        const target = new URL(targetBase);
        target.pathname = window.location.pathname;
        target.search = window.location.search;
        target.hash = window.location.hash;
        if (target.hostname !== window.location.hostname) {
          window.location.replace(target.toString());
        }
      })
      .catch(() => {});
  }, []);
  return null;
};

const LegacySubdomainRedirect = () => {
  const { slug } = useParams<{ slug?: string }>();
  
  React.useEffect(() => {
    if (slug) {
      const targetBase = getSubdomainUrl(slug);
      const restOfPath = window.location.pathname.replace(new RegExp(`^/sch/${slug}`), '');
      window.location.replace(`${targetBase}${restOfPath}${window.location.search}${window.location.hash}`);
    }
  }, [slug]);

  return isSplashGone() ? <BrandedLoadingScreen label="Redirecting to your portal..." /> : null;
};

const LegacyPortalRedirect = () => {
  const { tenantId } = useParams<{ tenantId?: string }>();
  const [redirecting, setRedirecting] = React.useState(true);

  React.useEffect(() => {
    if (!tenantId) {
      setRedirecting(false);
      return;
    }

    if (sessionStorage.getItem(PARENT_IMPERSONATE_HANDOFF_KEY) === tenantId) {
      sessionStorage.removeItem(PARENT_IMPERSONATE_HANDOFF_KEY);
      setRedirecting(false);
      return;
    }

    if (isNaN(Number(tenantId))) {
      const targetBase = getSubdomainUrl(tenantId);
      const restOfPath = window.location.pathname.replace(new RegExp(`^/portal/${tenantId}`), '/portal');
      window.location.replace(`${targetBase}${restOfPath}${window.location.search}${window.location.hash}`);
      return;
    }

    const base = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
    fetch(`${base}/tenant/by-id/${tenantId}`)
      .then(async (r) => {
        const d = await r.json();
        const slug = d?.tenant?.slug;
        if (slug) {
          const targetBase = getSubdomainUrl(slug);
          window.location.replace(`${targetBase}/portal${window.location.search}${window.location.hash}`);
          return;
        }
        setRedirecting(false);
      })
      .catch(() => setRedirecting(false));
  }, [tenantId]);

  if (redirecting) {
    return isSplashGone() ? (
      <BrandedLoadingScreen label="Redirecting to parent portal..." tone="dark" />
    ) : null;
  }

  return <ParentPortalRoute />;
};

const IndexWithSchool = () => {
  const { schoolId, slug: routeSlug } = useParams<{ schoolId?: string; slug?: string }>();
  const slug = routeSlug || detectTenantSlugFromHost();
  const [resolvedId, setResolvedId] = React.useState<number | null>(() => {
    const id = schoolId ? parseInt(schoolId, 10) : null;
    if (id && !isNaN(id) && sessionStorage.getItem(STAFF_IMPERSONATE_HANDOFF_KEY) === String(id)) {
      sessionStorage.removeItem(STAFF_IMPERSONATE_HANDOFF_KEY);
      return id;
    }
    return id && !isNaN(id) ? id : null;
  });
  const [resolving, setResolving] = React.useState(() => {
    const id = schoolId ? parseInt(schoolId, 10) : null;
    if (id && !isNaN(id) && sessionStorage.getItem(STAFF_IMPERSONATE_HANDOFF_KEY) === String(id)) {
      return false;
    }
    return !schoolId && !!slug;
  });
  const [schoolPortalError, setSchoolPortalError] = React.useState<SchoolPortalErrorState | null>(null);
  const [resolveAttempt, setResolveAttempt] = React.useState(0);

  const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;

  const lookupTenant = React.useCallback(async (url: string) => {
    const r = await fetch(url);
    const text = await r.text();
    let payload: Record<string, unknown> = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {
          resolvedId: null as number | null,
          error: {
            kind: 'server' as const,
            message: r.ok
              ? 'The server returned an unexpected response. Check your API configuration.'
              : `Could not load this school (HTTP ${r.status}).`,
          },
        };
      }
    }
    return parseTenantLookup(r.status, payload as Parameters<typeof parseTenantLookup>[1]);
  }, []);

  React.useEffect(() => {
    setSchoolPortalError(null);
    const schoolIdNum = schoolId ? parseInt(schoolId, 10) : null;

    if (schoolIdNum && sessionStorage.getItem(STAFF_IMPERSONATE_HANDOFF_KEY) === String(schoolIdNum)) {
      sessionStorage.removeItem(STAFF_IMPERSONATE_HANDOFF_KEY);
      setResolvedId(schoolIdNum);
      setResolving(false);
      return;
    }

    if (schoolId && (schoolIdNum === null || Number.isNaN(schoolIdNum))) {
      setResolvedId(null);
      setSchoolPortalError({
        kind: 'invalid',
        message:
          'This link does not contain a valid school ID. Use the numeric ID from your school or open the portal from the home page.',
      });
      setResolving(false);
      return;
    }

    const run = async () => {
      if (schoolIdNum !== null && !Number.isNaN(schoolIdNum)) {
        setResolving(true);
        try {
          const result = await lookupTenant(`${apiBase}/tenant/by-id/${schoolIdNum}`);
          setResolvedId(result.resolvedId);
          setSchoolPortalError(result.error);
        } catch (e) {
          setResolvedId(null);
          const m = e instanceof Error ? e.message : String(e);
          const low = m.toLowerCase();
          setSchoolPortalError({
            kind: 'network',
            message:
              low.includes('failed to fetch') || low.includes('network')
                ? 'Cannot reach the server. Check your connection and that the API is running.'
                : m || 'Could not load school.',
          });
        } finally {
          setResolving(false);
        }
        return;
      }

      if (slug) {
        setResolving(true);
        try {
          const result = await lookupTenant(`${apiBase}/tenant/by-slug/${encodeURIComponent(slug)}`);
          setResolvedId(result.resolvedId);
          setSchoolPortalError(result.error);
        } catch (e) {
          setResolvedId(null);
          const m = e instanceof Error ? e.message : String(e);
          const low = m.toLowerCase();
          setSchoolPortalError({
            kind: 'network',
            message:
              low.includes('failed to fetch') || low.includes('network')
                ? 'Cannot reach the server. Check your connection and that the API is running.'
                : m || 'Could not load school.',
          });
        } finally {
          setResolving(false);
        }
        return;
      }

      setResolvedId(null);
      setResolving(false);
    };

    void run();
  }, [schoolId, slug, resolveAttempt, apiBase, lookupTenant]);

  if (resolving) {
    return isSplashGone() ? (
      <BrandedLoadingScreen
        label="Opening your school…"
        active={resolving}
        onRetry={() => {
          setSchoolPortalError(null);
          setResolveAttempt((n) => n + 1);
        }}
      />
    ) : null;
  }
  if (!resolvedId) {
    const detailParts = [slug ? `School: ${slug}` : null, schoolId ? `ID: ${schoolId}` : null].filter(Boolean);
    const errorState: SchoolPortalErrorState = schoolPortalError ?? {
      kind: 'unknown',
      message: 'We could not open this school. The link may be wrong or the school may not be registered on ScholarNerve yet.',
    };
    const presentation = schoolPortalErrorPresentation(errorState);
    return (
      <PublicErrorPage
        variant={presentation.variant}
        eyebrow={presentation.eyebrow}
        title={presentation.title}
        description={presentation.description}
        schoolName={errorState.schoolName}
        detail={detailParts.length > 0 ? detailParts.join(' · ') : undefined}
        icon={presentation.icon}
        showLandingLink={!schoolPortalErrorHidesLandingLink(errorState)}
        onRetry={
          slug || schoolId
            ? () => {
                setSchoolPortalError(null);
                setResolveAttempt((n) => n + 1);
              }
            : undefined
        }
        retryLabel="Try again"
      />
    );
  }

  return (
    <SchoolProvider schoolIdFromUrl={resolvedId}>
      <DataProvider>
        <ActiveTermProvider>
          <TermStatusProvider>
          <AuditProvider>
            <Index />
          </AuditProvider>
          </TermStatusProvider>
        </ActiveTermProvider>
      </DataProvider>
    </SchoolProvider>
  );
};

const SchoolWebsitePreviewRoute = () => {
  const slug = detectSchoolWebsiteSlugFromHost() || detectTenantSlugFromHost() || new URLSearchParams(window.location.search).get('slug') || '';
  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-slate-600">School website preview requires a tenant slug.</p>
      </div>
    );
  }
  return <SchoolWebsiteApp slug={slug} />;
};

const App = () => {
  const partnersHost = isPartnersHost();
  const websiteSlug = partnersHost ? null : detectSchoolWebsiteSlugFromHost();
  const subdomainSlug = partnersHost || websiteSlug ? null : detectTenantSlugFromHost();

  // partners.scholarnerve.com — the Partner Network PWA, fully isolated from
  // the school/staff/parent app trees.
  if (partnersHost) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/*" element={<PartnerPortalApp />} />
              </Routes>
            </TooltipProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
        <AuthProvider>
          <PlatformSettingsProvider>
          <ImpersonationTransitionGate />
          <ZoomNudge />
          <SocketProvider>
            <ChatSocketProvider>
            <TeacherNotificationProvider>
            <TooltipProvider>
              <NetworkStatusBanner />
              <PwaUpdateManager />
              <Toaster />
              <Sonner />
              <SubdomainPathNormalizer />
              <SchoolWebsiteCanonicalRedirect />
                {websiteSlug ? (
                  <Routes>
                    <Route path="/*" element={<SchoolWebsiteApp slug={websiteSlug} />} />
                  </Routes>
                ) : subdomainSlug ? (
                  <Routes>
                   
                    {/* --- WILDCARD SUBDOMAIN ROUTING (Clean URL bar, e.g. rosa.localhost:8080) --- */}
                    <Route path="/portal" element={<ParentPortalRoute />} />
                    <Route path="/portal/*" element={<ParentPortalRoute />} />
                    <Route path="/verify/:entityType/:entityId" element={<VerifyCardPage />} />
                    <Route path="/checkin" element={<PublicCheckinPage />} />
                    <Route path="/website/*" element={<SchoolWebsitePreviewRoute />} />
                    
                    {/* Standard Shared Dashboard Routes */}
                    <Route path="/register-school" element={<RegisterSchool />} />
                    <Route path={PLATFORM_ADMIN_PATH} element={<SuperAdminDashboard />} />
                    
                    {/* School Portal Dashboard mounts directly at root and handles all sub-navigation (e.g. /teachers) */}
                    <Route path="/" element={<IndexWithSchool />} />
                    <Route path="/*" element={<IndexWithSchool />} />
                  </Routes>
                ) : (
                  <Routes>
                    {/* --- APEX DOMAIN / STATIC SUBDOMAIN ROUTING --- */}
                    <Route path="/verify/:entityType/:entityId" element={<VerifyCardPage />} />
                    <Route path="/checkin" element={<PublicCheckinPage />} />
                    <Route path="/" element={<PublicLandingSwitch />} />
                    <Route path="/partners" element={<PartnersLegacyRedirect />} />
                    <Route path="/partners/*" element={<PartnersLegacyRedirect />} />
                    <Route path="/register-school" element={<RegisterSchool />} />
                    <Route path={PLATFORM_ADMIN_PATH} element={<SuperAdminDashboard />} />
                    <Route path="/school/:schoolId/*" element={<IndexWithSchool />} />
                    <Route path="/sch/:slug/*" element={<LegacySubdomainRedirect />} />
                    <Route path="/portal/:tenantId" element={<LegacyPortalRedirect />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                )}
            </TooltipProvider>
            </TeacherNotificationProvider>
            </ChatSocketProvider>
          </SocketProvider>
          </PlatformSettingsProvider>
        </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
