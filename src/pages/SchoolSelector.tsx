import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_ADMIN_PATH } from '@/constants/platformAdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { toast } from '@/hooks/use-toast';
import { Building, GraduationCap, ArrowRight, Shield } from 'lucide-react';
import { BrandedLoading } from '@/components/common/BrandedLoading';

interface School {
  id: number;
  name: string;
  subdomain?: string;
}

const SchoolSelector = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolIdInput, setSchoolIdInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSchools = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const list = await apiService.get<School[]>('/schools', { skipTenant: true });
        setSchools(Array.isArray(list) ? list.filter((s) => !s.archived_at) : []);
      } catch {
        setSchools([]);
      } finally {
        setLoading(false);
      }
    };
    loadSchools();
  }, [isAuthenticated]);

  const handleSelectSchool = (schoolId: number) => {
    apiService.setTenantContext(schoolId);
    localStorage.setItem('currentSchoolId', schoolId.toString());
    navigate(`/school/${schoolId}`);
  };

  const handleGoById = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(schoolIdInput.trim(), 10);
    if (!isNaN(id) && id > 0) {
      if (isAuthenticated) {
        handleSelectSchool(id);
      } else {
        navigate(`/school/${id}`);
      }
    } else {
      toast({
        title: 'Invalid School ID',
        description: 'Please enter a valid number (e.g. 1, 2)',
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl">SCHOLARNERVE School Management</CardTitle>
            <p className="text-slate-600 text-sm mt-2">
              Enter your school ID to go to the login page
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleGoById} className="space-y-4">
              <div>
                <Label htmlFor="schoolId" className="text-slate-700">School ID</Label>
                <Input
                  id="schoolId"
                  type="text"
                  placeholder="e.g. 1 or 2"
                  value={schoolIdInput}
                  onChange={(e) => setSchoolIdInput(e.target.value)}
                  className="mt-2"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Go to Login
              </Button>
            </form>
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <p className="text-xs text-slate-500 text-center font-medium">Platform Admin</p>
              <Button
                type="button"
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                onClick={() => navigate(PLATFORM_ADMIN_PATH)}
              >
                <Shield className="w-4 h-4 mr-2" />
                Super Admin Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Building className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle>Select School</CardTitle>
          <p className="text-gray-500 text-sm mt-2">
            {user?.role === 'super-admin' 
              ? 'Choose a school to manage' 
              : 'Select your school'}
          </p>
          {user?.role === 'super-admin' && (
            <Button variant="outline" size="sm" onClick={() => navigate(PLATFORM_ADMIN_PATH)} className="mt-2">
              Super Admin Panel
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <BrandedLoading label="One moment…" className="py-6 px-2" />
          ) : schools.length > 0 ? (
            <div className="space-y-2">
              {schools.map((school) => (
                <Button
                  key={school.id}
                  variant="outline"
                  className="w-full justify-between h-auto py-4"
                  onClick={() => handleSelectSchool(school.id)}
                >
                  <span className="font-medium">{school.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No schools found</p>
          )}

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">Or enter school ID directly:</p>
            <form onSubmit={handleGoById} className="flex gap-2">
              <Input
                type="text"
                placeholder="School ID"
                value={schoolIdInput}
                onChange={(e) => setSchoolIdInput(e.target.value)}
              />
              <Button type="submit">Go</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSelector;
