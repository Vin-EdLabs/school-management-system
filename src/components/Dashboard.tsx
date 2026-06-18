
import React, { useState, useMemo, useEffect } from 'react';
import SidebarWrapper from './SidebarWrapper';
import DashboardHome from './dashboard/DashboardHome';
import AdministratorDashboard from './dashboard/AdministratorDashboard';
import FinancialDashboard from './dashboard/FinancialDashboard';
import StudentsModule from './students/StudentsModule';
import TeachersModule from './teachers/TeachersModule';
import OtherStaffModule from './staff/OtherStaffModule';
import ClassesModule from './classes/ClassesModule';
import CalendarModule from './CalendarModule';
import FeesModule from './fees/FeesModule';
import IncomeModule from './income/IncomeModule';
import ExpensesModule from './expenses/ExpensesModule';
import PayrollModule from './payroll/PayrollModule';
import AdvancedReports from './reports/AdvancedReports';
import AcademicReports from './reports/AcademicReports';
import SettingsModule from './settings/SettingsModule';
import UsersModule from './users/UsersModule';
import AuditModule from './audit/AuditModule';
import PrintFeeStatusModule from './fees/PrintFeeStatusModule';
import TransactionsPage from './finance/TransactionsPage';
import CashBankModule from './finance/CashBankModule';
import PaymentAccountsModule from './configurations/PaymentAccountsModule';
import AppointmentLetterSettings from './configurations/AppointmentLetterSettings';
import AdmissionLetterSettings from './configurations/AdmissionLetterSettings';
import ManualAdjustmentsReport from './finance/ManualAdjustmentsReport';
import TermBudgetModule from './finance/TermBudgetModule';
import FinanceStatementModule from './finance/FinanceStatementModule';
import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherClassesModule from './teacher/TeacherClassesModule';
import AttendanceModule from './teacher/AttendanceModule';
import GradesModule from './teacher/GradesModule';
import TeacherProfileModule from './teacher/TeacherProfileModule';
import TeacherAppointmentLettersModule from './teacher/TeacherAppointmentLettersModule';
import TeacherPaymentHistoryModule from './teacher/TeacherPaymentHistoryModule';
import TeacherQuizModule from './teacher/TeacherQuizModule';
import AiChatModule from './ai/AiChatModule';
import RecordsModule from './records/RecordsModule';
import SubjectsModule from './subjects/SubjectsModule';
import SupportModule from './support/SupportModule';
import TransportOverview from './transport/TransportOverview';
import TransportMap from './transport/TransportMap';
import TransportRoutes from './transport/TransportRoutes';
import TransportVehicles from './transport/TransportVehicles';
import TransportDrivers from './transport/TransportDrivers';
import TransportStudents from './transport/TransportStudents';
import PushNotificationsModule from './notifications/PushNotificationsModule';
import ParentDeskAdminModule from './notifications/ParentDeskAdminModule';
import ParentAccountsModule from './parent/ParentAccountsModule';
import EndOfYearWizard from './academic/EndOfYearWizard';
import BirthdayModule from './birthday/BirthdayModule';
import GlobalAnnouncementPopup from './announcements/GlobalAnnouncementPopup';
import SetupProgressGate from './onboarding/SetupProgressGate';
import ActiveTermWelcomeGate from './onboarding/ActiveTermWelcomeGate';
import TermReadOnlyShell from './common/TermReadOnlyShell';
import ActiveTermRequiredShell from './common/ActiveTermRequiredShell';
import { useTermStatus } from '../contexts/TermStatusContext';
import { useAuth } from '../contexts/AuthContext';
import { useStaffPushSync } from '../hooks/useStaffPushSync';
import { useEnsureData } from '../hooks/useEnsureData';
import { useFinanceRealtime } from '../hooks/useFinanceRealtime';
import { domainsForModule } from '../config/moduleDataNeeds';

const Dashboard = () => {
  const { hasAccess, user } = useAuth();
  useStaffPushSync();
  useFinanceRealtime();
  const [activeModule, setActiveModule] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('/finance/transactions')) return 'transactions';
    if (path.endsWith('/transport')) return 'transport-overview';
    if (path.includes('/transport/map')) return 'transport-map';
    if (path.includes('/transport/routes')) return 'transport-routes';
    if (path.includes('/transport/vehicles')) return 'transport-vehicles';
    if (path.includes('/transport/drivers')) return 'transport-drivers';
    if (path.includes('/transport/students')) return 'transport-students';
    // Set default module based on user role
    if (user?.role === 'finance') {
      return 'financial-dashboard';
    } else if (user?.role === 'administrator') {
      return 'dashboard';
    } else if (user?.role === 'teacher' || user?.role === 'staff') {
      return 'teacher-dashboard';
    } else {
      return 'dashboard'; // super-admin
    }
  });

  const domains = useMemo(() => domainsForModule(activeModule), [activeModule]);
  useEnsureData(domains);
  const { setViewingTermLabel } = useTermStatus();

  useEffect(() => {
    if (activeModule !== 'reports') {
      setViewingTermLabel(null);
    }
  }, [activeModule, setViewingTermLabel]);

  useEffect(() => {
    if (user?.role === 'finance' && activeModule === 'dashboard') {
      setActiveModule('financial-dashboard');
    }
  }, [user?.role, activeModule]);

  const renderActiveModule = () => {
    // Check access before rendering
    const hasModuleAccess =
      hasAccess(activeModule) ||
      hasAccess(activeModule + '-view-only') ||
      (activeModule === 'other-staff' && (hasAccess('teachers') || hasAccess('teachers-view-only'))) ||
      (activeModule === 'appointment-letter-settings' && hasAccess('settings-full')) ||
      (activeModule === 'admission-letter-settings' && hasAccess('settings-full')) ||
      (activeModule === 'teacher-quizzes' && (hasAccess('grades') || user?.role === 'teacher')) ||
      (activeModule === 'academic-reports' && hasAccess('reports'));
    if (!hasModuleAccess) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this module.</p>
        </div>
      );
    }

    switch (activeModule) {
      case 'dashboard':
        if (user?.role === 'finance') {
          return <FinancialDashboard />;
        }
        // Show different dashboard based on role
        if (user?.role === 'administrator') {
          return <AdministratorDashboard />;
        }
        return <DashboardHome />;
      case 'financial-dashboard':
        return <FinancialDashboard />;
      case 'teacher-dashboard':
        return <TeacherDashboard />;
      case 'ai-assistant':
        return <AiChatModule />;
      case 'students':
        return <StudentsModule />;
      case 'teachers':
        return <TeachersModule />;
      case 'other-staff':
        return <OtherStaffModule />;
      case 'classes':
        return <ClassesModule />;
      case 'calendar':
        return <CalendarModule />;
      case 'teacher-classes':
        return <TeacherClassesModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'grades':
        return <GradesModule />;
      case 'teacher-profile':
        return <TeacherProfileModule />;
      case 'teacher-appointment-letters':
        return <TeacherAppointmentLettersModule />;
      case 'teacher-payment-history':
        return <TeacherPaymentHistoryModule />;
      case 'teacher-quizzes':
        return <TeacherQuizModule />;
      case 'fees':
        return <FeesModule onNavigate={setActiveModule} />;
      case 'finance-statement':
        return <FinanceStatementModule />;
      case 'income':
        return <IncomeModule />;
      case 'expenses':
        return <ExpensesModule />;
      case 'term-budget':
        return <TermBudgetModule />;
      case 'payroll':
        return <PayrollModule />;
      case 'reports':
        return <AdvancedReports />;
      case 'academic-reports':
        return <AcademicReports />;
      case 'print-fee-status':
        return <PrintFeeStatusModule />;
      case 'transactions':
        return <TransactionsPage onNavigate={setActiveModule} />;
      case 'cash-bank':
        return <CashBankModule />;
      case 'manual-adjustments':
        return <ManualAdjustmentsReport />;
      case 'users':
        return <UsersModule />;
      case 'settings':
        return <SettingsModule />;
      case 'payment-accounts':
        return <PaymentAccountsModule />;
      case 'appointment-letter-settings':
        return <AppointmentLetterSettings />;
      case 'admission-letter-settings':
        return <AdmissionLetterSettings />;
      case 'audit':
        return <AuditModule />;
      case 'records':
        return <RecordsModule />;
      case 'subjects':
        return <SubjectsModule />;
      case 'support-chat':
        return <SupportModule />;
      case 'push-notifications':
        return <PushNotificationsModule />;
      case 'parent-desk':
        return <ParentDeskAdminModule />;
      case 'parent-accounts':
        return <ParentAccountsModule />;
      case 'birthdays':
        return <BirthdayModule />;
      case 'end-of-year':
        return <EndOfYearWizard />;
      case 'transport-overview':
        return <TransportOverview onNavigate={setActiveModule} />;
      case 'transport-map':
        return <TransportMap />;
      case 'transport-routes':
        return <TransportRoutes onNavigate={setActiveModule} />;
      case 'transport-vehicles':
        return <TransportVehicles />;
      case 'transport-drivers':
        return <TransportDrivers />;
      case 'transport-students':
        return <TransportStudents />;
      default:
        if (user?.role === 'teacher') {
          return <TeacherDashboard />;
        } else if (user?.role === 'administrator') {
          return <AdministratorDashboard />;
        }
        return <DashboardHome />;
    }
  };

  return (
    <SidebarWrapper
      activeModule={activeModule}
      setActiveModule={setActiveModule}
    >
      <GlobalAnnouncementPopup />
      <ActiveTermWelcomeGate activeModule={activeModule} setActiveModule={setActiveModule} />
      <SetupProgressGate activeModule={activeModule} setActiveModule={setActiveModule} />
      <ActiveTermRequiredShell
        activeModule={activeModule}
        onOpenSettings={() => setActiveModule('settings')}
      >
        <TermReadOnlyShell activeModule={activeModule}>{renderActiveModule()}</TermReadOnlyShell>
      </ActiveTermRequiredShell>
    </SidebarWrapper>
  );
};

export default Dashboard;
