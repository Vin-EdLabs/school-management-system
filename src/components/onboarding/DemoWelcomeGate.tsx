import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { isStaffImpersonationActive } from '@/utils/impersonationHelpers';
import DemoWelcomeModal, {
  dismissDemoWelcomeForSession,
  isDemoWelcomeDismissed,
} from './DemoWelcomeModal';

/**
 * Greets users once per login when the school is running demo/sample data.
 */
const DemoWelcomeGate: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { school } = useSchool();
  const [open, setOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  const isDemoSchool = school?.is_demo === true;

  const shouldWelcome =
    !!school?.id &&
    isDemoSchool &&
    !authLoading &&
    user?.role !== 'super-admin';

  const tryOpenOnce = useCallback(() => {
    if (!school?.id || !shouldWelcome) return;
    if (isDemoWelcomeDismissed(school.id)) return;
    setOpen(true);
  }, [school?.id, shouldWelcome]);

  useEffect(() => {
    if (authLoading || !school?.id) return;
    if (!shouldWelcome) {
      hasAutoOpenedRef.current = false;
      return;
    }
    if (hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    tryOpenOnce();
  }, [authLoading, school?.id, shouldWelcome, tryOpenOnce]);

  if (!shouldWelcome || isStaffImpersonationActive()) return null;

  const displayName = user?.fullName || user?.username || 'there';
  const schoolName = school?.name || 'this school';

  return (
    <DemoWelcomeModal
      open={open}
      onOpenChange={setOpen}
      userName={displayName}
      schoolName={schoolName}
      onDismissForSession={() => {
        if (school?.id) dismissDemoWelcomeForSession(school.id);
      }}
    />
  );
};

export default DemoWelcomeGate;
