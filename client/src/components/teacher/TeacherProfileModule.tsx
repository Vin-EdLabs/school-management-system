import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Wallet, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';

interface TeacherProfile {
  id: number;
  full_name: string;
  staff_id: string;
  email: string | null;
  phone_number: string | null;
  subjects_taught: string[];
  class_name: string | null;
  monthly_salary: number;
}

interface TeacherClass {
  id: number;
  class_name: string;
  is_main: boolean;
}

interface SalaryInfo {
  monthlySalary: number;
  currentMonthStatus: string;
}

const TeacherProfileModule = () => {
  const { schoolId } = useSchool();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profRes, classesRes, salaryRes] = await Promise.all([
          apiService.get<TeacherProfile>('/teachers/me').catch(() => null),
          apiService.get<TeacherClass[]>('/teachers/me/classes').catch(() => []),
          apiService.get<SalaryInfo & { fullName: string; staffId: string; paymentHistory?: unknown }>('/payroll/my-salary').catch(() => null),
        ]);
        setProfile(profRes);
        setTeacherClasses(Array.isArray(classesRes) ? classesRes : []);
        setSalaryInfo(salaryRes ? { monthlySalary: salaryRes.monthlySalary, currentMonthStatus: salaryRes.currentMonthStatus } : null);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  if (loading) {
    return <div className="p-6 animate-pulse text-slate-500">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
            <p className="text-gray-500">Your profile is not set up. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-gray-600">Your account and work information</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Full Name</span><span className="font-medium">{profile.full_name}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Staff ID</span><span className="font-mono">{profile.staff_id}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Email</span><span>{profile.email || '—'}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Phone</span><span>{profile.phone_number || '—'}</span></div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Classes Assigned</p>
            <div className="flex flex-wrap gap-2">
              {teacherClasses.length ? teacherClasses.map((c) => (
                <Badge key={c.id} variant="outline">{c.class_name}{c.is_main ? ' (Main)' : ''}</Badge>
              )) : <span className="text-gray-500">None</span>}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Subjects Taught</p>
            <div className="flex flex-wrap gap-2">
              {profile.subjects_taught?.length ? profile.subjects_taught.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>) : <span className="text-gray-500">None</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {salaryInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Salary Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Monthly Salary</span>
              <span className="font-semibold text-lg">GHS {salaryInfo.monthlySalary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">This Month</span>
              <Badge variant={salaryInfo.currentMonthStatus === 'Paid' ? 'default' : 'secondary'} className={salaryInfo.currentMonthStatus === 'Paid' ? 'bg-emerald-600' : ''}>
                {salaryInfo.currentMonthStatus === 'Paid' ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                {salaryInfo.currentMonthStatus}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">View full payment history in the Payment History section.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherProfileModule;
