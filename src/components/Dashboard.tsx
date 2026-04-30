
import React, { useState } from 'react';
import SidebarWrapper from './SidebarWrapper';
import DashboardHome from './dashboard/DashboardHome';
import AdministratorDashboard from './dashboard/AdministratorDashboard';
import FinancialDashboard from './dashboard/FinancialDashboard';
import StudentsModule from './students/StudentsModule';
import TeachersModule from './teachers/TeachersModule';
import ClassesModule from './classes/ClassesModule';
import CalendarModule from './CalendarModule';
import FeesModule from './fees/FeesModule';
import IncomeModule from './income/IncomeModule';
import ExpensesModule from './expenses/ExpensesModule';
import PayrollModule from './payroll/PayrollModule';
import ReportsModule from './reports/ReportsModule';
import SettingsModule from './settings/SettingsModule';
import UsersModule from './users/UsersModule';
import AuditModule from './audit/AuditModule';
import PrintFeeStatusModule from './fees/PrintFeeStatusModule';
import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherClassesModule from './teacher/TeacherClassesModule';
import AttendanceModule from './teacher/AttendanceModule';
import GradesModule from './teacher/GradesModule';
import TeacherProfileModule from './teacher/TeacherProfileModule';
import TeacherPaymentHistoryModule from './teacher/TeacherPaymentHistoryModule';
import AiChatModule from './ai/AiChatModule';
import RecordsModule from './records/RecordsModule';
import SubjectsModule from './subjects/SubjectsModule';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { hasAccess, user } = useAuth();
  const [activeModule, setActiveModule] = useState(() => {
    // Set default module based on user role
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
      case 'teacher-payment-history':
        return <TeacherPaymentHistoryModule />;
      case 'fees':
        return <FeesModule />;
      case 'income':
        return <IncomeModule />;
      case 'expenses':
        return <ExpensesModule />;
      case 'payroll':
        return <PayrollModule />;
      case 'reports':
        return <ReportsModule />;
      case 'print-fee-status':
        return <PrintFeeStatusModule />;
      case 'users':
        return <UsersModule />;
      case 'settings':
        return <SettingsModule />;
      case 'audit':
        return <AuditModule />;
      case 'records':
        return <RecordsModule />;
      case 'subjects':
        return <SubjectsModule />;
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
