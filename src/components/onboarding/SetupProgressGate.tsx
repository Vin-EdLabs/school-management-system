import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import SetupProgressModal, {
  dismissSetupForSession,
  isSetupDismissedForSession,
} from './SetupProgressModal';

type SetupProgressGateProps = {
  activeModule: string;
  setActiveModule: (module: string) => void;
};

/**
 * Soft onboarding checklist for school administrators.
 * Non-blocking — dismissible per session, reappears on next login until complete.
 */
const SetupProgressGate: React.FC<SetupProgressGateProps> = ({ activeModule, setActiveModule }) => {
  const { user, loading: authLoading } = useAuth();
  const { schoolId } = useSchool();
  const { steps, isComplete, isLoading, completedCount, totalSteps, refetch } = useSetupProgress();
  const [open, setOpen] = useState(false);
  const prevModuleRef = useRef(activeModule);
  const navigatedFromSetupRef = useRef(false);

  const isSchoolAdmin = user?.role === 'administrator' && user.tenantId != null;

  const tryOpen = useCallback(() => {
    if (!schoolId || !isSchoolAdmin || isLoading || isComplete) return;
    if (isSetupDismissedForSession(schoolId)) return;
    setOpen(true);
  }, [schoolId, isSchoolAdmin, isLoading, isComplete]);

  // Auto-open once after login when setup is incomplete
  useEffect(() => {
    if (authLoading || isLoading) return;
    tryOpen();
  }, [authLoading, isLoading, tryOpen]);

  // Refetch when returning from a setup module and reopen if still incomplete
  useEffect(() => {
    const prev = prevModuleRef.current;
    prevModuleRef.current = activeModule;

    const setupModules = ['subjects', 'classes', 'settings'];
    const wasOnSetup = setupModules.includes(prev);
    const leftSetup = wasOnSetup && !setupModules.includes(activeModule);

    if (navigatedFromSetupRef.current && (leftSetup || setupModules.includes(activeModule))) {
      navigatedFromSetupRef.current = false;
      void refetch().then(() => {
        if (!isSetupDismissedForSession(schoolId!)) {
          setOpen(true);
        }
      });
    }
  }, [activeModule, refetch, schoolId]);

  useEffect(() => {
    if (isComplete) {
      setOpen(false);
    }
  }, [isComplete]);

  if (!isSchoolAdmin || isComplete) {
    return null;
  }

  return (
    <SetupProgressModal
      open={open}
      onOpenChange={setOpen}
      steps={steps}
      isComplete={isComplete}
      completedCount={completedCount}
      totalSteps={totalSteps}
      onNavigate={(moduleId) => {
        navigatedFromSetupRef.current = true;
        setActiveModule(moduleId);
      }}
      onDismissForSession={() => {
        if (schoolId) dismissSetupForSession(schoolId);
      }}
    />
  );
};

export default SetupProgressGate;
