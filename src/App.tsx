
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { TeacherNotificationProvider } from "./contexts/TeacherNotificationContext";
import { AuditProvider } from "./contexts/AuditContext";
import { DataProvider } from "./contexts/DataContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { ActiveTermProvider } from "./contexts/ActiveTermContext";
import { TermStatusProvider } from "./contexts/TermStatusContext";
import Index from "./pages/Index";
import VerifyCardPage from "./pages/VerifyCardPage";
import NotFound from "./pages/NotFound";
import SchoolSelector from "./pages/SchoolSelector";
import LandingPage from "./pages/LandingPage";
import RegisterSchool from "./pages/RegisterSchool";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { ParentPortalRoute } from "./pages/ParentPortal";
import { detectTenantSlugFromHost, getSubdomainUrl, normalizeLegacyPathOnSubdomain } from "./utils/tenantHost";
import { PwaUpdateManager } from "@/components/pwa/PwaUpdateManager";
import { NetworkStatusBanner } from "@/components/ui/NetworkStatusBanner";
import { BrandedLoadingScreen } from "@/components/common/BrandedLoading";
import { PublicErrorPage } from "@/components/common/PublicErrorPage";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  parseTenantLookup,
  schoolPortalErrorPresentation,
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

const LegacySubdomainRedirect = () => {
  const { slug } = useParams<{ slug?: string }>();
  
  React.useEffect(() => {
    if (slug) {
      const targetBase = getSubdomainUrl(slug);
      const restOfPath = window.location.pathname.replace(new RegExp(`^/sch/${slug}`), '');
      window.location.replace(`${targetBase}${restOfPath}${window.location.search}${window.location.hash}`);
    }
  }, [slug]);

  return <BrandedLoadingScreen label="Redirecting to your portal..." />;
};

const LegacyPortalRedirect = () => {
  const { tenantId } = useParams<{ tenantId?: string }>();
  const [redirecting, setRedirecting] = React.useState(true);

  React.useEffect(() => {
    if (!tenantId) {
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
    return <BrandedLoadingScreen label="Redirecting to parent portal..." tone="dark" />;
  }

  return <ParentPortalRoute />;
};

const IndexWithSchool = () => {
  const { schoolId, slug: routeSlug } = useParams<{ schoolId?: string; slug?: string }>();
  const slug = routeSlug || detectTenantSlugFromHost();
  const [resolvedId, setResolvedId] = React.useState<number | null>(() => {
    const id = schoolId ? parseInt(schoolId, 10) : null;
    return id && !isNaN(id) ? id : null;
  });
  const [resolving, setResolving] = React.useState(!schoolId && !!slug);
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
    return (
      <BrandedLoadingScreen
        label="Opening your school…"
        active={resolving}
        onRetry={() => {
          setSchoolPortalError(null);
          setResolveAttempt((n) => n + 1);
        }}
      />
    );
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

const App = () => {
  const subdomainSlug = detectTenantSlugFromHost();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <TeacherNotificationProvider>
            <TooltipProvider>
              <NetworkStatusBanner />
              <PwaUpdateManager />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <SubdomainPathNormalizer />
                {subdomainSlug ? (
                  <Routes>
                   
                    {/* --- WILDCARD SUBDOMAIN ROUTING (Clean URL bar, e.g. rosa.localhost:8080) --- */}
                    <Route path="/portal" element={<ParentPortalRoute />} />
                    <Route path="/portal/*" element={<ParentPortalRoute />} />
                    <Route path="/verify/:entityType/:entityId" element={<VerifyCardPage />} />
                    
                    {/* Standard Shared Dashboard Routes */}
                    <Route path="/register-school" element={<RegisterSchool />} />
                    <Route path="/super-admin" element={<SuperAdminDashboard />} />
                    
                    {/* School Portal Dashboard mounts directly at root and handles all sub-navigation (e.g. /teachers) */}
                    <Route path="/" element={<IndexWithSchool />} />
                    <Route path="/*" element={<IndexWithSchool />} />
                  </Routes>
                ) : (
                  <Routes>
                    {/* --- APEX DOMAIN / STATIC SUBDOMAIN ROUTING --- */}
                    <Route path="/verify/:entityType/:entityId" element={<VerifyCardPage />} />
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/register-school" element={<RegisterSchool />} />
                    <Route path="/super-admin" element={<SuperAdminDashboard />} />
                    <Route path="/school/:schoolId/*" element={<IndexWithSchool />} />
                    <Route path="/sch/:slug/*" element={<LegacySubdomainRedirect />} />
                    <Route path="/portal/:tenantId" element={<LegacyPortalRedirect />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                )}
              </BrowserRouter>
            </TooltipProvider>
            </TeacherNotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
