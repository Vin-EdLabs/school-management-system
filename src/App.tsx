
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
import { ThemeProvider } from "./contexts/ThemeContext";

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
  const [schoolResolveError, setSchoolResolveError] = React.useState<string | null>(null);
  const [resolveAttempt, setResolveAttempt] = React.useState(0);

  React.useEffect(() => {
    setSchoolResolveError(null);
    const schoolIdNum = schoolId ? parseInt(schoolId, 10) : null;

    if (schoolId && (schoolIdNum === null || Number.isNaN(schoolIdNum))) {
      setResolvedId(null);
      setSchoolResolveError(
        'This link does not contain a valid school ID. Use the numeric ID from your school or open the portal from the home page.'
      );
      setResolving(false);
      return;
    }

    if (schoolIdNum !== null && !Number.isNaN(schoolIdNum)) {
      setResolvedId(schoolIdNum);
      setResolving(false);
      return;
    }

    if (slug) {
      setResolving(true);
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      fetch(`${base}/tenant/by-slug/${encodeURIComponent(slug)}`)
        .then(async (r) => {
          const text = await r.text();
          let d: { tenant?: { id?: number }; error?: string } = {};
          if (text.trim()) {
            try {
              d = JSON.parse(text);
            } catch {
              setResolvedId(null);
              setSchoolResolveError(
                r.ok
                  ? 'The server returned an unexpected response. Check your API configuration.'
                  : `Could not load this school (HTTP ${r.status}).`
              );
              return;
            }
          }
          if (!r.ok) {
            setResolvedId(null);
            setSchoolResolveError(
              typeof d.error === 'string' && d.error.trim()
                ? d.error
                : `Could not load this school (HTTP ${r.status}).`
            );
            return;
          }
          if (d?.tenant?.id != null) {
            setResolvedId(d.tenant.id);
          } else {
            setResolvedId(null);
            setSchoolResolveError('No school matches this link. Check the spelling or ask your school for an updated link.');
          }
        })
        .catch((e) => {
          setResolvedId(null);
          const m = e instanceof Error ? e.message : String(e);
          const low = m.toLowerCase();
          setSchoolResolveError(
            low.includes('failed to fetch') || low.includes('network')
              ? 'Cannot reach the server. Check your connection and that the API is running and the site URL is correct.'
              : m || 'Could not load school.'
          );
        })
        .finally(() => setResolving(false));
      return;
    }

    setResolvedId(null);
    setResolving(false);
  }, [schoolId, slug, resolveAttempt]);

  if (resolving) {
    return (
      <BrandedLoadingScreen
        label="Opening your school…"
        active={resolving}
        onRetry={() => {
          setSchoolResolveError(null);
          setResolveAttempt((n) => n + 1);
          if (slug && !schoolId) setResolving(true);
        }}
      />
    );
  }
  if (!resolvedId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <p className="text-lg font-semibold">School portal unavailable</p>
        <p className="text-muted-foreground max-w-md">{schoolResolveError ?? 'We could not open this school.'}</p>
        <Link to="/" className="text-primary underline underline-offset-4">
          Back to home
        </Link>
      </div>
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
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/register-school" element={<RegisterSchool />} />
                    <Route path="/super-admin" element={<SuperAdminDashboard />} />
                    <Route path="/school/:schoolId/*" element={<IndexWithSchool />} />
                    <Route path="/sch/:slug/*" element={<LegacySubdomainRedirect />} />
                    <Route path="/portal/:tenantId" element={<LegacyPortalRedirect />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
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
