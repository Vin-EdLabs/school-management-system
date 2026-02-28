
import React from 'react';
import { Navigate } from 'react-router-dom';
import AuditLoginTracker from '../components/AuditLoginTracker';
import { useAuth } from '../contexts/AuthContext';

const Index = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <AuditLoginTracker />
      {isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
    </>
  );
};

export default Index;
