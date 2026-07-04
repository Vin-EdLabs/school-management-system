import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { isStaffImpersonationActive } from '@/utils/impersonationHelpers';
import SetupProgressModal, {
  dismissSetupForSession,
  isSetupDismissedForSession,
} from './SetupProgressModal';

type SetupProgressGateProps = {
  activeModule: string;
  setActiveModule: (module: string) => void;
};

const SETUP_MODULES = new Set(['subjects', 'classes', 'settings']);

/**
 * Soft onboarding checklist — opens once per login session when setup is genuinely incomplete.
 */
const SetupProgressGate: React.FC<SetupProgressGateProps> = ({ activeModule, setActiveModule }) => {
  const { user, loading: authLoading, actsAsPrimaryAdmin } = useAuth();
  const { schoolId } = useSchool();
  const { steps, isComplete, isLoading, loadFailed, completedCount, totalSteps, refetch } =
    useSetupProgress();
  const [open, setOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);
  const navigatedFromSetupRef = useRef(false);
  const prevModuleRef = useRef(activeModule);

  const isPrimarySchoolAdmin = actsAsPrimaryAdmin;

  const shouldShowChecklist =
    isPrimarySchoolAdmin && !loadFailed && !isLoading && !isComplete && completedCount < totalSteps;

  const tryOpenOnce = useCallback(() => {
    if (!schoolId || !shouldShowChecklist) return;
    if (isSetupDismissedForSession(schoolId)) return;
    if (hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    setOpen(true);
  }, [schoolId, shouldShowChecklist]);

  useEffect(() => {
    if (authLoading || isLoading) return;
    tryOpenOnce();
  }, [authLoading, isLoading, tryOpenOnce]);

  // After "Set Up →", refresh when admin returns to dashboard — show updated checklist once
  useEffect(() => {
    const prev = prevModuleRef.current;
    prevModuleRef.current = activeModule;

    if (!navigatedFromSetupRef.current || !schoolId) return;

    const leftSetupModule = SETUP_MODULES.has(prev) && !SETUP_MODULES.has(activeModule);
    const onDashboard = activeModule === 'dashboard';

    if (leftSetupModule || onDashboard) {
      navigatedFromSetupRef.current = false;
      void refetch().then(() => {
        if (isSetupDismissedForSession(schoolId)) return;
        setOpen(true);
      });
    }
  }, [activeModule, refetch, schoolId]);

  useEffect(() => {
    if (isComplete) {
      setOpen(false);
    }
  }, [isComplete]);

  if (!isPrimarySchoolAdmin || loadFailed || isComplete || isStaffImpersonationActive()) {
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
