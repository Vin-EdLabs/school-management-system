
import React from 'react';
import LoginPage from '../components/LoginPage';
import Dashboard from '../components/Dashboard';
import AuditLoginTracker from '../components/AuditLoginTracker';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { BrandedLoadingScreen } from '@/components/common/BrandedLoading';

const Index = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { school } = useSchool();

  if (authLoading) {
    return (
      <>
        <AuditLoginTracker />
        <BrandedLoadingScreen logoUrl={school?.logo_url} label="Loading…" active />
      </>
    );
  }

  return (
    <>
      <AuditLoginTracker />
      {isAuthenticated ? <Dashboard /> : <LoginPage />}
    </>
  );
};

export default Index;
