
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
import DailyFeesModule from './daily-fees/DailyFeesModule';
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
import IdCardSettings from './configurations/IdCardSettings';
import GradeConfigurationSettings from './settings/GradeConfigurationSettings';
import IdCardsModule from './id-cards/IdCardsModule';
import LostCardsModule from './lost-cards/LostCardsModule';
import ManualAdjustmentsReport from './finance/ManualAdjustmentsReport';
import PaymentSubmissionsModule from './finance/PaymentSubmissionsModule';
import TermBudgetModule from './finance/TermBudgetModule';
import FinanceStatementModule from './finance/FinanceStatementModule';
import TeacherDashboard from './teacher/TeacherDashboard';
import ViewAllClasses from './classes/ViewAllClasses';
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
import BulkPrintIdCards from './id-cards/BulkPrintIdCards';
import InvoicesModule from './invoices/InvoicesModule';
import EndOfYearWizard from './academic/EndOfYearWizard';
import BirthdayModule from './birthday/BirthdayModule';
import HeadmasterDashboard from './headmaster/HeadmasterDashboard';
import AllStaffView from './staff/AllStaffView';
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
import { ImpersonationProvider } from '../contexts/ImpersonationContext';
import ImpersonationShell from './impersonation/ImpersonationShell';
import { IMPERSONATION_GO_MODULE_KEY } from '../utils/impersonationHelpers';
import { shouldUseAdministratorDashboard } from '../utils/schoolAdminView';

const Dashboard = () => {
  const { hasAccess, user } = useAuth();
  useStaffPushSync();
  useFinanceRealtime();
  const [activeModule, setActiveModule] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('/finance/transactions')) return 'transactions';
    if (path.includes('/finance/daily-fees')) return 'daily-fees';
    if (path.includes('/lost-cards/')) {
      try {
        const id = path.split('/lost-cards/')[1]?.split('/')[0];
        if (id) sessionStorage.setItem('lost-card-report-id', id);
      } catch { /* ignore */ }
      return 'lost-cards';
    }
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
    } else if (user?.role === 'headmaster') {
      return 'headmaster-dashboard';
    } else {
      return 'dashboard'; // super-admin
    }
  });

  const [lostCardReportId, setLostCardReportId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('lost-card-report-id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (activeModule !== 'lost-cards') return;
    try {
      const id = sessionStorage.getItem('lost-card-report-id');
      if (id) setLostCardReportId(id);
    } catch {
      /* ignore */
    }
  }, [activeModule]);

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
    if (user?.role === 'headmaster' && activeModule === 'dashboard') {
      setActiveModule('headmaster-dashboard');
    }
  }, [user?.role, activeModule]);

  /** After impersonation start/exit — land on the correct dashboard module */
  useEffect(() => {
    const goMod = sessionStorage.getItem(IMPERSONATION_GO_MODULE_KEY);
    if (!goMod || !user) return;
    sessionStorage.removeItem(IMPERSONATION_GO_MODULE_KEY);
    setActiveModule(goMod);
  }, [user?.id, user?.role]);

  const renderActiveModule = () => {
    // Check access before rendering
    const hasModuleAccess =
      hasAccess(activeModule) ||
      hasAccess(activeModule + '-view-only') ||
      (activeModule === 'other-staff' && (hasAccess('teachers') || hasAccess('teachers-view-only'))) ||
      (activeModule === 'appointment-letter-settings' && hasAccess('settings-full')) ||
      (activeModule === 'admission-letter-settings' && hasAccess('settings-full')) ||
      (activeModule === 'grade-configuration' && hasAccess('grade-configuration')) ||
      (activeModule === 'teacher-quizzes' && (hasAccess('grades') || user?.role === 'teacher')) ||
      (activeModule === 'headmaster-dashboard' && hasAccess('headmaster-dashboard')) ||
      (activeModule === 'headmaster-all-classes' && hasAccess('headmaster-all-classes')) ||
      (activeModule === 'headmaster-all-attendance' && hasAccess('headmaster-all-attendance')) ||
      (activeModule === 'headmaster-all-staff' && hasAccess('headmaster-all-staff')) ||
      (activeModule === 'headmaster-grades' && hasAccess('headmaster-grades')) ||
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
        if (shouldUseAdministratorDashboard(user?.role)) {
          return <AdministratorDashboard onNavigate={setActiveModule} />;
        }
        return <DashboardHome />;
      case 'headmaster-dashboard':
        return <HeadmasterDashboard onNavigate={setActiveModule} />;
      case 'headmaster-all-classes':
        return <ViewAllClasses readOnly />;
      case 'headmaster-all-attendance':
        return <AttendanceModule schoolWideReadOnly />;
      case 'headmaster-all-staff':
        return (
          <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Staff</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Teachers and non-teaching staff — read-only school directory.
              </p>
            </div>
            <AllStaffView />
          </div>
        );
      case 'headmaster-grades':
        return <GradesModule schoolWideReadOnly />;
      case 'financial-dashboard':
        return <FinancialDashboard />;
      case 'teacher-dashboard':
        return <TeacherDashboard />;
      case 'ai-assistant':
        return <AiChatModule />;
      case 'students':
        return <StudentsModule readOnly={hasAccess('students-view-only') && !hasAccess('students')} />;
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
      case 'daily-fees':
        return <DailyFeesModule onNavigate={setActiveModule} />;
      case 'invoices':
        return <InvoicesModule />;
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
      case 'payment-submissions':
        return <PaymentSubmissionsModule />;
      case 'users':
        return <UsersModule />;
      case 'settings':
        return <SettingsModule />;
      case 'payment-accounts':
        return <PaymentAccountsModule />;
      case 'grade-configuration':
        return (
          <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-10 pb-10">
            <GradeConfigurationSettings />
          </div>
        );
      case 'appointment-letter-settings':
        return <AppointmentLetterSettings />;
      case 'admission-letter-settings':
        return <AdmissionLetterSettings />;
      case 'id-card-settings':
        return <IdCardSettings onNavigate={setActiveModule} />;
      case 'id-cards':
        return <IdCardsModule onNavigate={setActiveModule} readOnly={user?.role === 'headmaster'} />;
      case 'lost-cards':
        return (
          <LostCardsModule
            initialReportId={lostCardReportId}
            onClearReportId={() => {
              setLostCardReportId(null);
              try {
                sessionStorage.removeItem('lost-card-report-id');
              } catch {
                /* ignore */
              }
            }}
          />
        );
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
      case 'id-cards-bulk-print':
        return <BulkPrintIdCards onNavigate={setActiveModule} />;
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
        if (user?.role === 'headmaster') {
          return <HeadmasterDashboard onNavigate={setActiveModule} />;
        }
        if (user?.role === 'teacher') {
          return <TeacherDashboard />;
        }
        if (shouldUseAdministratorDashboard(user?.role)) {
          return <AdministratorDashboard onNavigate={setActiveModule} />;
        }
        return <DashboardHome />;
    }
  };

  return (
    <ImpersonationProvider returnModule={activeModule}>
      <ImpersonationShell>
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
      </ImpersonationShell>
    </ImpersonationProvider>
  );
};

export default Dashboard;
