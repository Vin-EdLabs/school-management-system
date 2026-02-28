
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CalendarModule from './CalendarModule';
import SidebarWrapper from './SidebarWrapper';
import AiChatModule from './ai/AiChatModule';
import AuditModule from './audit/AuditModule';
import ClassesModule from './classes/ClassesModule';
import AdministratorDashboard from './dashboard/AdministratorDashboard';
import DashboardHome from './dashboard/DashboardHome';
import FinancialDashboard from './dashboard/FinancialDashboard';
import ExpensesModule from './expenses/ExpensesModule';
import FeesModule from './fees/FeesModule';
import PrintFeeStatusModule from './fees/PrintFeeStatusModule';
import StaffManagement from './staff/StaffManagement';
import IncomeModule from './income/IncomeModule';
import PayrollManagement from './payroll/PayrollManagement';
import ReportsModule from './reports/ReportsModule';
import SchedulesModule from './schedules/SchedulesModule';
import TimetableModule from './schedules/TimetableModule';
import SettingsModule from './settings/SettingsModule';
import StudentsModule from './students/StudentsModule';
import SubjectsModule from './subjects/SubjectsModule';
import AttendanceModule from './teacher/AttendanceModule';
import AttendanceReports from './teacher/AttendanceReports';
import GradesModule from './teacher/GradesModule';
import TeacherClassesModule from './teacher/TeacherClassesModule';
import TeacherDashboard from './teacher/TeacherDashboard';
import TeachersModule from './teachers/TeachersModule';

type DashboardProps = {
  initialModule?: string;
};

const Dashboard: React.FC<DashboardProps> = ({ initialModule }) => {
  const { hasAccess, user } = useAuth();
  const [activeModule, setActiveModule] = useState(() => {
    // Use the initialModule prop if provided, otherwise default by role
    if (initialModule) return initialModule;
    if (user?.role === 'finance') {
      return 'financial-dashboard';
    } else if (user?.role === 'administrator') {
      return 'dashboard';
    } else if (user?.role === 'teacher') {
      return 'teacher-dashboard';
    } else {
      return 'dashboard'; // super-admin
    }
  });

  const renderActiveModule = () => {
    // Check access before rendering
    if (!hasAccess(activeModule) && !hasAccess(activeModule + '-view-only')) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this module.</p>
        </div>
      );
    }

    switch (activeModule) {
      case 'dashboard':
        // Show different dashboard based on role
        if (user?.role === 'administrator') {
          return <AdministratorDashboard onNavigate={setActiveModule} />;
        }
        return <DashboardHome onNavigate={setActiveModule} />;
      case 'financial-dashboard':
        return <FinancialDashboard onNavigate={setActiveModule} />;
      case 'teacher-dashboard':
        return <TeacherDashboard onNavigate={setActiveModule} />;
      case 'ai-assistant':
        return <AiChatModule />;
      case 'students':
        return <StudentsModule />;
      case 'staff':
        return <StaffManagement />;
      case 'subjects':
        return <SubjectsModule />;
      case 'teachers':
        return <TeachersModule />;
      case 'classes':
        return <ClassesModule />;
      case 'schedules':
        return <SchedulesModule />;
      case 'timetable':
        return <TimetableModule />;
      case 'calendar':
        return <CalendarModule />;
      case 'teacher-classes':
        return <TeacherClassesModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'attendance-reports':
        return <AttendanceReports />;
      case 'grades':
        return <GradesModule />;
      case 'fees':
        return <FeesModule />;
      case 'income':
        return <IncomeModule />;
      case 'expenses':
        return <ExpensesModule />;
      case 'reports':
        return <ReportsModule />;
      case 'payroll':
        return <PayrollManagement />;
      case 'print-fee-status':
        return <PrintFeeStatusModule />;
      case 'settings':
        return <SettingsModule />;
      case 'audit':
        return <AuditModule />;
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
      {renderActiveModule()}
    </SidebarWrapper>
  );
};

export default Dashboard;
