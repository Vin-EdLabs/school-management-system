import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';
import { fetchTenantById } from '../services/tenantService';

interface School {
  id: number;
  name: string;
  subdomain?: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  is_demo?: boolean;
  boarding_enabled?: boolean;
}

interface SchoolContextType {
  schoolId: number | null;
  school: School | null;
  schools: School[];
  setSchoolId: (id: number | null) => void;
  loadSchools: () => Promise<void>;
  reloadSchool: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode; schoolIdFromUrl: number | null }> = ({ children, schoolIdFromUrl }) => {
  const { socket } = useSocket();
  const [schoolId, setSchoolIdState] = useState<number | null>(schoolIdFromUrl);
  const [school, setSchool] = useState<School | null>(null);
  const [schools, setSchools] = useState<School[]>([]);

  const setSchoolId = useCallback((id: number | null) => {
    setSchoolIdState(id);
    if (id !== null) {
      localStorage.setItem('currentSchoolId', id.toString());
      apiService.setTenantContext(id);
    } else {
      localStorage.removeItem('currentSchoolId');
      apiService.clearTenantContext();
    }
  }, []);

  const loadSchools = useCallback(async () => {
    try {
      const list = await apiService.get<School[]>('/schools');
      setSchools(Array.isArray(list) ? list : []);
    } catch {
      setSchools([]);
    }
  }, []);

  const reloadSchool = useCallback(async () => {
    if (!schoolId) {
      setSchool(null);
      return;
    }
    try {
      const s = await apiService.get<School>(`/schools/${schoolId}`);
      setSchool(s);
    } catch {
      const tenant = await fetchTenantById(schoolId);
      if (tenant) {
        setSchool({
          id: tenant.id,
          name: tenant.name,
          logo_url: tenant.logo_url || undefined,
          primary_color: tenant.primary_color || undefined,
          secondary_color: tenant.secondary_color || undefined,
          boarding_enabled: tenant.boarding_enabled === true,
        });
      } else {
        setSchool(null);
      }
    }
  }, [schoolId]);

  // Sync schoolId from URL prop and set tenant context
  useEffect(() => {
    if (schoolIdFromUrl && !isNaN(schoolIdFromUrl)) {
      setSchoolIdState(schoolIdFromUrl);
      localStorage.setItem('currentSchoolId', schoolIdFromUrl.toString());
      apiService.setTenantContext(schoolIdFromUrl);
    }
  }, [schoolIdFromUrl]);

  useEffect(() => {
    void reloadSchool();
  }, [reloadSchool]);

  useEffect(() => {
    const onBrandingChanged = () => {
      void reloadSchool();
    };
    window.addEventListener('school-branding-changed', onBrandingChanged);
    return () => window.removeEventListener('school-branding-changed', onBrandingChanged);
  }, [reloadSchool]);

  useEffect(() => {
    if (!socket || !schoolId) return;

    const onTenantDataChanged = (evt: { tenantId?: number; entity?: string; boarding_enabled?: boolean }) => {
      const evtTenantId = Number(evt?.tenantId);
      if (!evtTenantId || evtTenantId !== schoolId) return;
      if (evt?.entity === 'boarding-module' || typeof evt?.boarding_enabled === 'boolean') {
        void reloadSchool();
      }
    };

    socket.on('tenant-data-changed', onTenantDataChanged);
    return () => {
      socket.off('tenant-data-changed', onTenantDataChanged);
    };
  }, [socket, schoolId, reloadSchool]);

  return (
    <SchoolContext.Provider value={{ schoolId, school, schools, setSchoolId, loadSchools, reloadSchool }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};

// Safe variant for screens that may not be wrapped in SchoolProvider (e.g. Parent Portal).
export const useOptionalSchool = () => useContext(SchoolContext);
