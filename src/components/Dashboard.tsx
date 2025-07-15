
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardHome from './dashboard/DashboardHome';
import AdministratorDashboard from './dashboard/AdministratorDashboard';
import FinancialDashboard from './dashboard/FinancialDashboard';
import StudentsModule from './students/StudentsModule';
import TeachersModule from './teachers/TeachersModule';
import ClassesModule from './classes/ClassesModule';
import FeesModule from './fees/FeesModule';
import IncomeModule from './income/IncomeModule';
import ExpensesModule from './expenses/ExpensesModule';
import ReportsModule from './reports/ReportsModule';
import SettingsModule from './settings/SettingsModule';
import AuditModule from './audit/AuditModule';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { hasAccess, user } = useAuth();
  const [activeModule, setActiveModule] = useState(() => {
    // Set default module based on user role
    if (user?.role === 'finance') {
      return 'financial-dashboard';
    } else if (user?.role === 'administrator') {
      return 'dashboard';
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
      case 'students':
        return <StudentsModule />;
      case 'teachers':
        return <TeachersModule />;
      case 'classes':
        return <ClassesModule />;
      case 'fees':
        return <FeesModule />;
      case 'income':
        return <IncomeModule />;
      case 'expenses':
        return <ExpensesModule />;
      case 'reports':
        return <ReportsModule />;
      case 'settings':
        return <SettingsModule />;
      case 'audit':
        return <AuditModule />;
      default:
        return user?.role === 'administrator' ? <AdministratorDashboard /> : <DashboardHome />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <div className="flex-1 overflow-auto">
        {renderActiveModule()}
      </div>
    </div>
  );
};

export default Dashboard;
