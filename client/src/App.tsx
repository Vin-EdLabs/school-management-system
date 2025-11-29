
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import LoginPage from "./components/LoginPage";
import { AuditProvider } from "./contexts/AuditContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Inline ProtectedRoute to avoid runtime import resolution issues
const ProtectedRoute: React.FC<{ children: React.ReactElement; moduleKey?: string }> = ({ children, moduleKey }) => {
  const { isAuthenticated, hasAccess } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (moduleKey) {
    const allowed = hasAccess(moduleKey) || hasAccess(moduleKey + "-view-only");
    if (!allowed) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataProvider>
        <AuditProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* Dedicated routes for key pages */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                {/* Module active */}
                <Route path="/students" element={<ProtectedRoute moduleKey="students"><Dashboard initialModule="students" /></ProtectedRoute>} />
                <Route path="/teachers" element={<ProtectedRoute moduleKey="teachers"><Dashboard initialModule="teachers" /></ProtectedRoute>} />
                <Route path="/classes" element={<ProtectedRoute moduleKey="classes"><Dashboard initialModule="classes" /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute moduleKey="calendar"><Dashboard initialModule="calendar" /></ProtectedRoute>} />
                <Route path="/teacher-classes" element={<ProtectedRoute moduleKey="teacher-classes"><Dashboard initialModule="teacher-classes" /></ProtectedRoute>} />
                <Route path="/attendance" element={<ProtectedRoute moduleKey="attendance"><Dashboard initialModule="attendance" /></ProtectedRoute>} />
                <Route path="/grades" element={<ProtectedRoute moduleKey="grades"><Dashboard initialModule="grades" /></ProtectedRoute>} />
                <Route path="/fees" element={<ProtectedRoute moduleKey="fees"><Dashboard initialModule="fees" /></ProtectedRoute>} />
                <Route path="/income" element={<ProtectedRoute moduleKey="income"><Dashboard initialModule="income" /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute moduleKey="expenses"><Dashboard initialModule="expenses" /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><Dashboard initialModule="reports" /></ProtectedRoute>} />
                <Route path="/staff-payroll" element={<ProtectedRoute moduleKey="staff-payroll"><Dashboard initialModule="staff-payroll" /></ProtectedRoute>} />
                <Route path="/print-fee-status" element={<ProtectedRoute moduleKey="print-fee-status"><Dashboard initialModule="print-fee-status" /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><Dashboard initialModule="settings" /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute moduleKey="audit"><Dashboard initialModule="audit" /></ProtectedRoute>} />
                <Route path="/ai-assistant" element={<ProtectedRoute moduleKey="ai-assistant"><Dashboard initialModule="ai-assistant" /></ProtectedRoute>} />
                <Route path="/financial-dashboard" element={<ProtectedRoute moduleKey="financial-dashboard"><Dashboard initialModule="financial-dashboard" /></ProtectedRoute>} />
                <Route path="/teacher-dashboard" element={<ProtectedRoute moduleKey="teacher-dashboard"><Dashboard initialModule="teacher-dashboard" /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuditProvider>
      </DataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
