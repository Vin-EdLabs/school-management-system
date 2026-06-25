import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { School, Users, ClipboardCheck, BookOpen, Wallet, CheckCircle, XCircle, Cake, Sparkles, Gift } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { type TeacherMySalaryResponse, formatTeacherMoney, salaryStatusBadgeClass } from './teacherSalaryPortal';
import { formatDisplayDate } from '../../utils/dateFormat';
import TeacherSubjectClassDisplay from '../teachers/TeacherSubjectClassDisplay';
import type { TeacherSubjectClassesResponse } from '@/types/teacherSubjectClass';

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
  level: string | null;
  stream: string | null;
  is_main: boolean;
  student_count: string;
}

type SalaryInfo = TeacherMySalaryResponse;

const resolvePhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (/^https?:\/\//i.test(photoUrl) || photoUrl.startsWith('data:')) return photoUrl;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${origin}${normalized}`;
};

const TeacherDashboard = () => {
  const { schoolId } = useSchool();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo | null>(null);
  const [subjectClasses, setSubjectClasses] = useState<TeacherSubjectClassesResponse | null>(null);
  const [birthdayStudents, setBirthdayStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setProfileError(false);
      try {
        const [profRes, classesRes, salaryRes, birthdayRes, subjectClassRes] = await Promise.all([
          apiService.get<TeacherProfile>('/teachers/me').catch(() => null),
          apiService.get<TeacherClass[]>('/teachers/me/classes').catch(() => []),
          apiService.get<SalaryInfo>('/payroll/my-salary').catch(() => null),
          apiService.get<any[]>('/birthdays/my-classes/today').catch(() => []),
          apiService.get<TeacherSubjectClassesResponse>('/teachers/me/subject-classes').catch(() => null),
        ]);
        setProfile(profRes);
        setTeacherClasses(Array.isArray(classesRes) ? classesRes : []);
        setSalaryInfo(salaryRes);
        setBirthdayStudents(Array.isArray(birthdayRes) ? birthdayRes : []);
        setSubjectClasses(subjectClassRes);
        if (!profRes) setProfileError(true);
      } catch {
        setProfileError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  const totalStudents = teacherClasses.reduce((sum, c) => sum + parseInt(c.student_count || '0', 10), 0);

  if (loading) {
    return (
      <div className="px-4 py-5 sm:p-6">
        <div className="animate-pulse text-slate-500">Loading your dashboard...</div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="px-4 py-5 sm:p-6">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Profile Not Found</h3>
            <p className="text-gray-500">Your teacher profile is not set up. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Welcome Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 leading-tight break-words">
              Welcome back, {profile.full_name}!
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Your teaching overview for today</p>
          </div>
        </div>
        <div className="text-left sm:text-right text-xs sm:text-sm text-gray-500 shrink-0 pl-14 sm:pl-0">
          <p>{formatDisplayDate(new Date())}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">My Classes</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{teacherClasses.length}</p>
              </div>
              <School className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subjects</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{subjectClasses?.by_subject?.length || profile.subjects_taught?.length || 0}</p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-600">Staff ID</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{profile.staff_id}</p>
              </div>
              <BookOpen className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {birthdayStudents.length > 0 && (
        <Card className="border-amber-200/60 dark:border-amber-800/40 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="w-5 h-5 text-amber-500" />
              My Students&apos; Birthdays Today
              <Badge className="ml-auto bg-amber-500 text-white">{birthdayStudents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {birthdayStudents.map((person: any) => (
                <div key={person.id} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/40">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">
                      {person.fullName}
                      <span className="font-normal text-gray-500 ml-1">turns {person.age}!</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {person.className && `${person.className}`}
                    </p>
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <School className="w-5 h-5" />
              <span>My Classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacherClasses.length === 0 ? (
              <div className="text-center py-8">
                <School className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Assigned</h3>
                <p className="text-gray-500">You don't have any classes assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {teacherClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between min-h-[52px] p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl touch-manipulation">
                    <div>
                      <h4 className="font-medium text-gray-900">{cls.class_name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>{cls.student_count} students</span>
                        {cls.is_main && <Badge variant="secondary">Main</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile & Salary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>My Profile & Salary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"><span className="text-sm text-gray-600 shrink-0">Name</span><span className="font-medium text-right sm:text-left break-words">{profile.full_name}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"><span className="text-sm text-gray-600 shrink-0">Staff ID</span><span className="font-mono text-right sm:text-left break-all">{profile.staff_id}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"><span className="text-sm text-gray-600 shrink-0">Email</span><span className="text-right sm:text-left break-all">{profile.email || '—'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"><span className="text-sm text-gray-600 shrink-0">Phone</span><span className="text-right sm:text-left">{profile.phone_number || '—'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"><span className="text-sm text-gray-600 shrink-0">Classes</span><span className="text-right sm:text-left break-words">{teacherClasses.map(c => c.class_name).join(', ') || 'None'}</span></div>
              <div>
                <span className="text-sm text-gray-600">Teaching assignments:</span>
                <div className="mt-2">
                  <TeacherSubjectClassDisplay
                    bySubject={subjectClasses?.by_subject}
                    byClass={subjectClasses?.by_class}
                    layout="by-subject"
                    emptyMessage="None"
                  />
                </div>
              </div>
            </div>

            {salaryInfo && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <h4 className="font-medium flex items-center gap-2 mb-3 text-gray-900 dark:text-gray-100">
                  <Wallet className="w-4 h-4 shrink-0" />
                  Salary
                </h4>
                {(() => {
                  const c = salaryInfo.currency || 'GHS';
                  const snap = salaryInfo.currentMonthSnapshot;
                  return (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 dark:from-emerald-950/25 dark:to-teal-950/10 p-3 sm:p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90 dark:text-emerald-200/90">Contract (typical month)</p>
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Gross</span>
                          <span className="font-mono tabular-nums font-medium">{formatTeacherMoney(c, salaryInfo.monthlySalary)}</span>
                        </div>
                        {salaryInfo.ssnitEnabled !== false && (
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">SSNIT</span>
                            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">−{formatTeacherMoney(c, salaryInfo.ssnitDeduction)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-2 text-sm pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                          <span className="font-medium text-gray-800 dark:text-gray-200">Net</span>
                          <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{formatTeacherMoney(c, salaryInfo.netSalary)}</span>
                        </div>
                      </div>
                      {snap && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-3 sm:p-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">This month</p>
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Net due</span>
                            <span className="font-mono tabular-nums font-medium">{formatTeacherMoney(c, snap.netSalary)}</span>
                          </div>
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Paid</span>
                            <span className="font-mono tabular-nums">{formatTeacherMoney(c, snap.amountPaid)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 pt-1">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                            <Badge className={salaryStatusBadgeClass(snap.status)}>
                              {snap.status === 'Paid' ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                              {snap.status}
                            </Badge>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">Open <strong className="text-gray-700 dark:text-gray-300">Payment History</strong> for every month, gross, SSNIT, and paid amounts.</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Class overview — counts only; open My Classes for full rosters */}
      {teacherClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>My classes ({totalStudents} students)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherClasses.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between min-h-[52px] p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{cls.class_name}</p>
                    <p className="text-sm text-gray-500">{cls.level || 'Class'} · {cls.stream || 'Main'}</p>
                  </div>
                  <Badge variant="secondary">{parseInt(cls.student_count || '0', 10)} students</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherDashboard;
