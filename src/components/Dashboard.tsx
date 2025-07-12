
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardHome from './dashboard/DashboardHome';
import StudentsModule from './students/StudentsModule';
import TeachersModule from './teachers/TeachersModule';
import ClassesModule from './classes/ClassesModule';
import FeesModule from './fees/FeesModule';
import IncomeModule from './income/IncomeModule';
import ExpensesModule from './expenses/ExpensesModule';
import ReportsModule from './reports/ReportsModule';
import SettingsModule from './settings/SettingsModule';

const Dashboard = () => {
  const [activeModule, setActiveModule] = useState('dashboard');

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardHome />;
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
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <main className="flex-1 overflow-y-auto">
        {renderActiveModule()}
      </main>
    </div>
  );
};

export default Dashboard;
