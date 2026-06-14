import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Wallet, CheckCircle, XCircle, FileText } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { type TeacherMySalaryResponse, formatTeacherMoney, salaryStatusBadgeClass } from './teacherSalaryPortal';
import LazyTeacherAvatar from '../teachers/LazyTeacherAvatar';
import TeacherAppointmentLettersPanel from './TeacherAppointmentLettersPanel';

interface TeacherProfile {
  id: number;
  full_name: string;
  staff_id: string;
  email: string | null;
  phone_number: string | null;
  subjects_taught: string[];
  class_name: string | null;
  monthly_salary: number;
  passport_photo_url?: string | null;
  has_passport_photo?: boolean;
}

interface TeacherClass {
  id: number;
  class_name: string;
  is_main: boolean;
}

const TeacherProfileModule = () => {
  const { schoolId } = useSchool();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [salaryInfo, setSalaryInfo] = useState<TeacherMySalaryResponse | null>(null);
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
          apiService.get<TeacherMySalaryResponse>('/payroll/my-salary').catch(() => null),
        ]);
        setProfile(profRes);
        setTeacherClasses(Array.isArray(classesRes) ? classesRes : []);
        setSalaryInfo(salaryRes);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  if (loading) {
    return <div className="px-4 py-5 sm:p-6 animate-pulse text-slate-500">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="px-4 py-5 sm:p-6">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
            <p className="text-gray-500">Your profile is not set up. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPhoto = profile.has_passport_photo ?? !!(profile.passport_photo_url && profile.passport_photo_url.length > 0);

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start gap-3">
        <LazyTeacherAvatar
          teacherId={String(profile.id)}
          fullName={profile.full_name}
          hasPassportPhoto={hasPhoto}
          className="h-12 w-12"
          eager
        />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">My Profile</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Your account and work information</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b">
            <LazyTeacherAvatar
              teacherId={String(profile.id)}
              fullName={profile.full_name}
              hasPassportPhoto={hasPhoto}
              className="h-24 w-24"
              eager
            />
            <p className="text-sm text-muted-foreground">
              Your passport photo is managed by the school administrator. Contact them if it needs updating.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-baseline py-2 border-b"><span className="text-gray-600 text-sm shrink-0">Full Name</span><span className="font-medium text-right sm:text-left break-words">{profile.full_name}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-baseline py-2 border-b"><span className="text-gray-600 text-sm shrink-0">Staff ID</span><span className="font-mono text-right sm:text-left break-all">{profile.staff_id}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-baseline py-2 border-b"><span className="text-gray-600 text-sm shrink-0">Email</span><span className="text-right sm:text-left break-all">{profile.email || '—'}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-baseline py-2 border-b"><span className="text-gray-600 text-sm shrink-0">Phone</span><span className="text-right sm:text-left">{profile.phone_number || '—'}</span></div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Appointment Letters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherAppointmentLettersPanel
            compact
            teacher={
              profile
                ? {
                    id: profile.id,
                    full_name: profile.full_name,
                    staff_id: profile.staff_id,
                    has_passport_photo: hasPhoto,
                    passport_photo_url: profile.passport_photo_url,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {salaryInfo && (
        <Card className="overflow-hidden border-emerald-200/50 dark:border-emerald-900/30 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Wallet className="w-5 h-5 shrink-0" />
              Salary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {(() => {
              const c = salaryInfo.currency || 'GHS';
              const snap = salaryInfo.currentMonthSnapshot;
              return (
                <>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-muted/30 p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract (typical)</p>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Gross / month</span>
                      <span className="font-mono tabular-nums font-semibold">{formatTeacherMoney(c, salaryInfo.monthlySalary)}</span>
                    </div>
                    {salaryInfo.ssnitEnabled !== false && (
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">SSNIT ({salaryInfo.defaultSsnitPercent ?? 5.5}%)</span>
                        <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">−{formatTeacherMoney(c, salaryInfo.ssnitDeduction)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 text-sm pt-1 border-t border-border">
                      <span className="font-medium">Net (typical)</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{formatTeacherMoney(c, salaryInfo.netSalary)}</span>
                    </div>
                  </div>
                  {snap && (
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This calendar month</p>
                      <div className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground">Net due</span>
                        <span className="font-mono tabular-nums">{formatTeacherMoney(c, snap.netSalary)}</span>
                      </div>
                      <div className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="font-mono tabular-nums">{formatTeacherMoney(c, snap.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={salaryStatusBadgeClass(snap.status)}>
                          {snap.status === 'Paid' ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                          {snap.status}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Full month-by-month breakdown (gross, SSNIT, net, paid) is in <strong className="text-foreground">Payment History</strong>.
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherProfileModule;
