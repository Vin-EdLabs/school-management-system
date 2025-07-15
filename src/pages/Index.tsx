
import React from 'react';
import LoginPage from '../components/LoginPage';
import Dashboard from '../components/Dashboard';
import AuditLoginTracker from '../components/AuditLoginTracker';
import { useAuth } from '../contexts/AuthContext';

const Index = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <AuditLoginTracker />
      {isAuthenticated ? <Dashboard /> : <LoginPage />}
    </>
  );
};

export default Index;
