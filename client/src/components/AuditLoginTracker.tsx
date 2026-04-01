
import { useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';

const AuditLoginTracker = () => {
  const { addAuditLog } = useAudit();

  useEffect(() => {
    const handleLogin = (event: any) => {
      const { username, staffId, role } = event.detail;
      // record login using the staffId when available
      addAuditLog({
        actionType: 'Login',
        module: 'Authentication'
      });
    };

    window.addEventListener('userLogin', handleLogin);
    return () => window.removeEventListener('userLogin', handleLogin);
  }, [addAuditLog]);

  return null;
};

export default AuditLoginTracker;
