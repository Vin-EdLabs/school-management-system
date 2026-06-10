import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';

export type SetupStep = {
  key: 'subjects' | 'classes' | 'terms';
  label: string;
  description: string;
  done: boolean;
  /** In-app module id (ScholarNerve uses module navigation, not URL paths). */
  route: string;
};

export type SetupProgressState = {
  steps: SetupStep[];
  isComplete: boolean;
  isLoading: boolean;
  completedCount: number;
  totalSteps: number;
  refetch: () => Promise<void>;
};

type SetupProgressApi = {
  has_subjects: boolean;
  has_classes: boolean;
  has_terms: boolean;
  is_complete: boolean;
};

const STEP_DEFS: Omit<SetupStep, 'done'>[] = [
  {
    key: 'subjects',
    label: 'Add Subjects',
    description: 'Set up the subjects taught at your school',
    route: 'subjects',
  },
  {
    key: 'classes',
    label: 'Create Classes',
    description: 'Define the classes or grades in your school',
    route: 'classes',
  },
  {
    key: 'terms',
    label: 'Set Up Terms',
    description: 'Configure your academic terms or semesters',
    route: 'settings',
  },
];

export function useSetupProgress(): SetupProgressState {
  const { schoolId } = useSchool();
  const { user, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const [data, setData] = useState<SetupProgressApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isSchoolAdmin = user?.role === 'administrator' && user.tenantId != null;

  const fetchProgress = useCallback(async () => {
    if (!schoolId || !isSchoolAdmin) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      if (schoolId) {
        apiService.setTenantContext(schoolId);
      }
      const res = await apiService.get<SetupProgressApi>(`/schools/${schoolId}/setup-progress`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, isSchoolAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void fetchProgress();
  }, [authLoading, fetchProgress]);

  useEffect(() => {
    if (!socket || !schoolId || !isSchoolAdmin) return;
    const onChange = (evt: { entity?: string; tenantId?: number }) => {
      if (evt?.tenantId != null && evt.tenantId !== schoolId) return;
      const entity = evt?.entity || '';
      if (['subject', 'class', 'academic-term', 'academic-year', 'settings'].includes(entity)) {
        void fetchProgress();
      }
    };
    socket.on('tenant-data-changed', onChange);
    return () => {
      socket.off('tenant-data-changed', onChange);
    };
  }, [socket, schoolId, isSchoolAdmin, fetchProgress]);

  const steps = useMemo((): SetupStep[] => {
    const flags = {
      subjects: !!data?.has_subjects,
      classes: !!data?.has_classes,
      terms: !!data?.has_terms,
    };
    return STEP_DEFS.map((def) => ({
      ...def,
      done: flags[def.key],
    }));
  }, [data]);

  const completedCount = steps.filter((s) => s.done).length;

  return {
    steps,
    isComplete: !!data?.is_complete,
    isLoading: authLoading || isLoading,
    completedCount,
    totalSteps: STEP_DEFS.length,
    refetch: fetchProgress,
  };
}
