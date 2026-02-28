
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import AdministratorDashboard from "./pages/dashboard/AdministratorDashboard";
import FinancialDashboard from "./pages/dashboard/FinancialDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import LoginPage from "./components/LoginPage";
import { AuditProvider } from "./contexts/AuditContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import StudentsModule from "./pages/students/StudentsModule";
import TeachersModule from "./pages/teachers/TeachersModule";
import SubjectsModule from "./pages/subjects/SubjectsModule";
import ClassesModule from "./pages/classes/ClassesModule";
import CalendarModule from "./pages/CalendarModule";
import TeacherClassesModule from "./pages/teacher/TeacherClassesModule";
import AttendanceModule from "./pages/teacher/AttendanceModule";
import GradesModule from "./pages/teacher/GradesModule";
import FeesModule from "./pages/fees/FeesModule";
import IncomeModule from "./pages/income/IncomeModule";
import ExpensesModule from "./pages/expenses/ExpensesModule";
import ReportsModule from "./pages/reports/ReportsModule";
import PayrollManagement from "./pages/payroll/PayrollManagement";
import PrintFeeStatusModule from "./pages/fees/PrintFeeStatusModule";
import SettingsModule from "./pages/settings/SettingsModule";
import AuditModule from "./pages/audit/AuditModule";
import AiChatModule from "./pages/ai/AiChatModule";
import StaffManagement from "./pages/staff/StaffManagement";
import SchedulesModule from "./pages/schedules/SchedulesModule";
import TimetableModule from "./pages/schedules/TimetableModule";
import AttendanceReports from "./pages/teacher/AttendanceReports";

import { ThemeProvider } from "./components/ThemeProvider";

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
  <ThemeProvider defaultTheme="system" storageKey="school-ui-theme">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuditProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* Dedicated routes for key pages */}
                <Route path="/login" element={<LoginPage />} />
                {/* Module routes wrapped in DashboardLayout */}
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardHome />} />
                  <Route path="/administrator-dashboard" element={<AdministratorDashboard />} />
                  <Route path="/financial-dashboard" element={<ProtectedRoute moduleKey="financial-dashboard"><FinancialDashboard /></ProtectedRoute>} />
                  <Route path="/teacher-dashboard" element={<ProtectedRoute moduleKey="teacher-dashboard"><TeacherDashboard /></ProtectedRoute>} />

                  <Route path="/students" element={<ProtectedRoute moduleKey="students"><StudentsModule /></ProtectedRoute>} />
                  <Route path="/teachers" element={<ProtectedRoute moduleKey="teachers"><TeachersModule /></ProtectedRoute>} />
                  <Route path="/subjects" element={<ProtectedRoute moduleKey="subjects"><SubjectsModule /></ProtectedRoute>} />
                  <Route path="/classes" element={<ProtectedRoute moduleKey="classes"><ClassesModule /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute moduleKey="calendar"><CalendarModule /></ProtectedRoute>} />
                  <Route path="/teacher-classes" element={<ProtectedRoute moduleKey="teacher-classes"><TeacherClassesModule /></ProtectedRoute>} />
                  <Route path="/attendance" element={<ProtectedRoute moduleKey="attendance"><AttendanceModule /></ProtectedRoute>} />
                  <Route path="/grades" element={<ProtectedRoute moduleKey="grades"><GradesModule /></ProtectedRoute>} />
                  <Route path="/fees" element={<ProtectedRoute moduleKey="fees"><FeesModule /></ProtectedRoute>} />
                  <Route path="/income" element={<ProtectedRoute moduleKey="income"><IncomeModule /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute moduleKey="expenses"><ExpensesModule /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><ReportsModule /></ProtectedRoute>} />
                  <Route path="/payroll" element={<ProtectedRoute moduleKey="payroll"><PayrollManagement /></ProtectedRoute>} />
                  <Route path="/staff" element={<ProtectedRoute moduleKey="staff"><StaffManagement /></ProtectedRoute>} />
                  <Route path="/schedules" element={<ProtectedRoute moduleKey="schedules"><SchedulesModule /></ProtectedRoute>} />
                  <Route path="/timetable" element={<ProtectedRoute moduleKey="schedules"><TimetableModule /></ProtectedRoute>} />
                  <Route path="/attendance-reports" element={<ProtectedRoute moduleKey="attendance-reports"><AttendanceReports /></ProtectedRoute>} />
                  <Route path="/print-fee-status" element={<ProtectedRoute moduleKey="print-fee-status"><PrintFeeStatusModule /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><SettingsModule /></ProtectedRoute>} />
                  <Route path="/audit" element={<ProtectedRoute moduleKey="audit"><AuditModule /></ProtectedRoute>} />
                  <Route path="/ai-assistant" element={<ProtectedRoute moduleKey="ai-assistant"><AiChatModule /></ProtectedRoute>} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuditProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
