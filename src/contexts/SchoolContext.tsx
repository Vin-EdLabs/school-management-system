import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
}

interface SchoolContextType {
  schoolId: number | null;
  school: School | null;
  schools: School[];
  setSchoolId: (id: number | null) => void;
  loadSchools: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode; schoolIdFromUrl: number | null }> = ({ children, schoolIdFromUrl }) => {
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

  // Sync schoolId from URL prop and set tenant context
  useEffect(() => {
    if (schoolIdFromUrl && !isNaN(schoolIdFromUrl)) {
      setSchoolIdState(schoolIdFromUrl);
      localStorage.setItem('currentSchoolId', schoolIdFromUrl.toString());
      apiService.setTenantContext(schoolIdFromUrl);
    }
  }, [schoolIdFromUrl]);

  // Load school details when schoolId is set (auth API first, then public tenant fallback)
  useEffect(() => {
    if (!schoolId) {
      setSchool(null);
      return;
    }
    const loadSchool = async () => {
      try {
        const s = await apiService.get<School>(`/schools/${schoolId}`);
        setSchool(s);
      } catch {
        // Fallback: use public tenant API (works without auth, for branding)
        const tenant = await fetchTenantById(schoolId);
        if (tenant) {
          setSchool({
            id: tenant.id,
            name: tenant.name,
            logo_url: tenant.logo_url || undefined,
            primary_color: tenant.primary_color || undefined,
            secondary_color: tenant.secondary_color || undefined,
          });
        } else {
          setSchool(null);
        }
      }
    };
    loadSchool();
  }, [schoolId]);

  return (
    <SchoolContext.Provider value={{ schoolId, school, schools, setSchoolId, loadSchools }}>
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
