
import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import LoginPage from '../components/LoginPage';
import Dashboard from '../components/Dashboard';
import AuditLoginTracker from '../components/AuditLoginTracker';
import { useAuth } from '../contexts/AuthContext';

const IndexContent = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <AuditLoginTracker />
      {isAuthenticated ? <Dashboard /> : <LoginPage />}
    </>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <IndexContent />
    </AuthProvider>
  );
};

export default Index;
