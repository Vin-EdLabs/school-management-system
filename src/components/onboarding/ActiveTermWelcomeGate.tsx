import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import { isStaffImpersonationActive } from '@/utils/impersonationHelpers';
import ActiveTermWelcomeModal, {
  dismissActiveTermWelcomeForSession,
  isActiveTermWelcomeDismissed,
} from './ActiveTermWelcomeModal';

type ActiveTermWelcomeGateProps = {
  activeModule: string;
  setActiveModule: (module: string) => void;
};

/**
 * Greets the user on login when no academic term is active yet.
 */
const ActiveTermWelcomeGate: React.FC<ActiveTermWelcomeGateProps> = ({
  activeModule,
  setActiveModule,
}) => {
  const { user, loading: authLoading } = useAuth();
  const { school } = useSchool();
  const { hasActiveTerm, isLoading: termLoading } = useActiveTerm();
  const [open, setOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  const canManageTerms =
    user?.role === 'super-admin' ||
    user?.role === 'administrator' ||
    user?.role === 'finance' ||
    (user?.role === 'administrator' && user?.isPrimaryAdmin);

  const shouldWelcome =
    !!school?.id &&
    canManageTerms &&
    !termLoading &&
    !authLoading &&
    !hasActiveTerm;

  const tryOpenOnce = useCallback(() => {
    if (!school?.id || !shouldWelcome) return;
    if (isActiveTermWelcomeDismissed(school.id)) return;
    setOpen(true);
  }, [school?.id, shouldWelcome]);

  useEffect(() => {
    if (authLoading || termLoading) return;
    if (!shouldWelcome) {
      hasAutoOpenedRef.current = false;
      return;
    }
    if (hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    tryOpenOnce();
  }, [authLoading, termLoading, shouldWelcome, tryOpenOnce]);

  useEffect(() => {
    if (hasActiveTerm) {
      setOpen(false);
    }
  }, [hasActiveTerm]);

  if (!shouldWelcome || isStaffImpersonationActive()) return null;

  const displayName = user?.fullName || user?.username || 'Admin';
  const schoolName = school?.name || 'your school';

  return (
    <ActiveTermWelcomeModal
      open={open}
      onOpenChange={setOpen}
      userName={displayName}
      schoolName={schoolName}
      onGoToSettings={() => setActiveModule('settings')}
      onDismissForSession={() => {
        if (school?.id) dismissActiveTermWelcomeForSession(school.id);
      }}
    />
  );
};

export default ActiveTermWelcomeGate;
