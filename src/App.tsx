
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { AuditProvider } from "./contexts/AuditContext";
import { DataProvider } from "./contexts/DataContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { ActiveTermProvider } from "./contexts/ActiveTermContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SchoolSelector from "./pages/SchoolSelector";
import LandingPage from "./pages/LandingPage";
import RegisterSchool from "./pages/RegisterSchool";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { ParentPortalRoute } from "./pages/ParentPortal";

import { ThemeProvider } from "./contexts/ThemeContext";

const queryClient = new QueryClient();

const IndexWithSchool = () => {
  const { schoolId, slug } = useParams<{ schoolId?: string; slug?: string }>();
  const [resolvedId, setResolvedId] = React.useState<number | null>(() => {
    const id = schoolId ? parseInt(schoolId, 10) : null;
    return id && !isNaN(id) ? id : null;
  });
  const [resolving, setResolving] = React.useState(!schoolId && !!slug);

  React.useEffect(() => {
    const schoolIdNum = schoolId ? parseInt(schoolId, 10) : null;
    if (schoolIdNum && !isNaN(schoolIdNum)) {
      setResolvedId(schoolIdNum);
      setResolving(false);
      return;
    }
    if (slug) {
      setResolving(true);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/tenant/by-slug/${slug}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.tenant?.id) setResolvedId(d.tenant.id);
          else setResolvedId(null);
        })
        .catch(() => setResolvedId(null))
        .finally(() => setResolving(false));
    } else if (!schoolId) {
      setResolvedId(null);
      setResolving(false);
    }
  }, [schoolId, slug]);

  if (resolving) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">Loading school...</div>;
  if (!resolvedId) return <Navigate to="/" replace />;

  return (
    <SchoolProvider schoolIdFromUrl={resolvedId}>
      <DataProvider>
        <ActiveTermProvider>
          <AuditProvider>
            <Index />
          </AuditProvider>
        </ActiveTermProvider>
      </DataProvider>
    </SchoolProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/register-school" element={<RegisterSchool />} />
                <Route path="/super-admin" element={<SuperAdminDashboard />} />
                <Route path="/school/:schoolId/*" element={<IndexWithSchool />} />
                <Route path="/s/:slug/*" element={<IndexWithSchool />} />
                <Route path="/portal/:tenantId" element={<ParentPortalRoute />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
