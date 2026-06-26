import React, { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Phone,
  MapPin,
  GraduationCap,
  Wallet,
  ClipboardList,
  BookOpen,
  Pencil,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateFormat';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import {
  classBadgeClass,
  enrollmentStatusLabel,
  isAlumniStudent,
  normalizeEnrollmentStatus,
  statusBadgeClass,
} from './studentRegistryUtils';
import { cn } from '@/lib/utils';
import {
  fetchStudentBalance,
  type StudentBalance,
} from '../../services/studentBalance';
import { useData } from '../../contexts/DataContext';
import { resolveStudentDisplayBalance } from '../../utils/resolveStudentDisplayBalance';

type PaymentLite = { studentId?: string; amount: number; date: string; paymentMethod?: string; term?: string };

type GradeRow = {
  student_id: number;
  score: number;
  assignment_name: string;
  max_score: number;
  subject: string;
  assignment_type: string;
};

type AttendanceRow = { date: string; present: boolean; class_name: string };

export type StudentQuickViewSheetProps = {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: PaymentLite[];
  currentTerm: string | undefined;
  feeStructures: FeeStructure[];
  onEdit: (student: Student) => void;
  onViewFull?: (student: Student) => void;
};

const StudentQuickViewSheet: React.FC<StudentQuickViewSheetProps> = ({
  student,
  open,
  onOpenChange,
  payments,
  currentTerm,
  feeStructures,
  onEdit,
  onViewFull,
}) => {
  const { ledgerBalances, loadDomains } = useData();
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [attErr, setAttErr] = useState(false);
  const [grades, setGrades] = useState<GradeRow[] | null>(null);
  const [gradesErr, setGradesErr] = useState(false);
  const [studentBalance, setStudentBalance] = useState<StudentBalance | null>(null);

  useEffect(() => {
    if (!open || !student) {
      setAttendance(null);
      setGrades(null);
      setStudentBalance(null);
      setAttErr(false);
      setGradesErr(false);
      return;
    }
    const sid = student.id;
    const cachedBalance = ledgerBalances?.[String(sid)];
    if (cachedBalance) {
      setStudentBalance(cachedBalance);
    } else {
      setStudentBalance(null);
      void loadDomains(['fees'], { silent: true });
    }

    let cancelled = false;
    (async () => {
      setAttendance(null);
      setGrades(null);
      const classId = student.classAssignedId;
      const attendancePromise = apiService
        .get<AttendanceRow[]>(`/attendance/student?studentId=${encodeURIComponent(sid)}`)
        .then((rows) => (Array.isArray(rows) ? rows : []))
        .catch(() => {
          if (!cancelled) setAttErr(true);
          return [] as AttendanceRow[];
        });
      const balancePromise = fetchStudentBalance(sid)
        .then((breakdown) => breakdown)
        .catch(() => null);

      const [rows, breakdown] = await Promise.all([attendancePromise, balancePromise]);
      if (cancelled) return;
      setAttendance(rows);
      if (breakdown) {
        setStudentBalance(breakdown);
      }
      if (!classId) {
        try {
          const g = await apiService.get<GradeRow[]>(`/grades?studentId=${encodeURIComponent(String(sid))}`);
          if (!cancelled) setGrades(Array.isArray(g) ? g : []);
        } catch {
          if (!cancelled) {
            setGrades([]);
            setGradesErr(true);
          }
        }
        return;
      }
      try {
        const g = await apiService.get<GradeRow[]>(`/grades?classId=${encodeURIComponent(String(classId))}`);
        if (cancelled) return;
        const list = Array.isArray(g) ? g : [];
        setGrades(list.filter((r) => String(r.student_id) === String(sid)));
      } catch {
        if (!cancelled) {
          setGrades([]);
          setGradesErr(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, student, ledgerBalances, loadDomains]);

  const feeSummary = useMemo(() => {
    if (!student) {
      return { termFee: 0, arrears: 0, due: 0, paid: 0, balance: 0 };
    }
    const term =
      currentTerm && currentTerm !== 'Not Set' ? currentTerm : undefined;
    const cached = ledgerBalances?.[String(student.id)];
    const source = studentBalance ?? cached ?? null;
    const display = resolveStudentDisplayBalance(
      student,
      source,
      feeStructures || [],
      term ?? null
    );
    return {
      termFee: display.currentTermFee,
      arrears: display.arrears,
      due: display.totalDue,
      paid: display.totalPaid,
      balance: display.outstanding,
    };
  }, [studentBalance, ledgerBalances, student, feeStructures, currentTerm]);

  const attStats = useMemo(() => {
    if (!attendance || attendance.length === 0) return { pct: null as number | null, present: 0, absent: 0, n: 0 };
    const slice = attendance.slice(0, 120);
    let present = 0;
    let absent = 0;
    for (const r of slice) {
      if (r.present) present++;
      else absent++;
    }
    const n = present + absent;
    const pct = n ? Math.round((present / n) * 100) : null;
    return { pct, present, absent, n };
  }, [attendance]);

  const gradePreview = useMemo(() => {
    if (!grades || grades.length === 0) return [];
    return [...grades].sort((a, b) => String(b.subject).localeCompare(String(a.subject)));
  }, [grades]);

  if (!student) return null;

  const status = normalizeEnrollmentStatus(student.enrollmentStatus);
  const alumni = isAlumniStudent(student);
  const fullName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l p-0 shadow-2xl sm:max-w-md md:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b bg-muted/20 px-5 pb-4 pt-6 text-left">
          <div className="flex items-start gap-3 pr-8">
            <Avatar className="h-14 w-14 rounded-xl border border-border shadow-sm">
              {student.passportPhotoUrl ? (
                <AvatarImage src={resolveLogoUrl(student.passportPhotoUrl) || undefined} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="rounded-xl text-sm font-semibold">
                {student.firstName?.[0]}
                {student.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold leading-tight tracking-tight">{fullName}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Student ID <span className="font-mono text-foreground/90">{student.studentId}</span>
              </SheetDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', classBadgeClass(student.classAssigned))}>
                  {alumni ? `Last: ${student.classAssigned || '—'}` : student.classAssigned || 'Unassigned'}
                </Badge>
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', statusBadgeClass(status))}>
                  {enrollmentStatusLabel(student.enrollmentStatus)}
                </Badge>
                {alumni && student.graduatedAt && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
                    {formatDisplayDate(student.graduatedAt)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {onViewFull && (
              <Button type="button" variant="outline" size="sm" className="gap-2 sm:w-auto" onClick={() => onViewFull(student)}>
                <Eye className="h-3.5 w-3.5" />
                Full profile
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" className="gap-2 sm:w-auto" onClick={() => onEdit(student)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="space-y-5 px-5 py-4 pb-8">
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Profile
              </h3>
              <div className="rounded-lg border bg-card/50 p-3 text-sm shadow-sm">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Gender</dt>
                    <dd className="font-medium">{student.gender || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Date of birth</dt>
                    <dd className="font-medium">{formatDisplayDate(student.dateOfBirth, '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Admission</dt>
                    <dd className="font-mono text-xs font-medium">{student.admissionNumber || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Nationality</dt>
                    <dd className="font-medium">{student.nationality || '—'}</dd>
                  </div>
                  {alumni && student.graduatedAt && (
                    <div className="col-span-2">
                      <dt className="text-[11px] text-muted-foreground">Graduated</dt>
                      <dd className="font-medium text-indigo-700 dark:text-indigo-300">
                        {formatDisplayDate(student.graduatedAt)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                Parent & emergency
              </h3>
              <div className="rounded-lg border bg-card/50 p-3 text-sm shadow-sm space-y-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">Guardian</p>
                  <p className="font-medium">{student.guardianName || '—'}</p>
                </div>
                <div className="flex items-center gap-2 font-mono text-sm">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{student.guardianContact || '—'}</span>
                </div>
                <Separator />
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground/90">{student.homeAddress || '—'}</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Fees ({alumni ? 'all time' : currentTerm && currentTerm !== 'Not Set' ? currentTerm : 'all terms'})
              </h3>
              <div className="rounded-lg border bg-card/50 p-3 shadow-sm">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Arrears</dt>
                    <dd className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      GHS {feeSummary.arrears.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Total due</dt>
                    <dd className="font-semibold tabular-nums">GHS {feeSummary.due.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Paid</dt>
                    <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      GHS {feeSummary.paid.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Balance</dt>
                    <dd
                      className={cn(
                        'font-semibold tabular-nums',
                        feeSummary.balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                      )}
                    >
                      GHS {feeSummary.balance.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                Attendance
              </h3>
              <div className="rounded-lg border bg-card/50 p-3 text-sm shadow-sm">
                {attendance === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[75%]" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : attErr ? (
                  <p className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Could not load attendance.
                  </p>
                ) : attStats.n === 0 ? (
                  <p className="text-xs text-muted-foreground">No attendance records yet.</p>
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold tabular-nums">{attStats.pct}%</span>
                    <span className="text-muted-foreground">
                      {' '}
                      present ({attStats.present} of {attStats.n} recent days)
                    </span>
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                Academic summary
              </h3>
              <div className="rounded-lg border bg-card/50 shadow-sm">
                {grades === null ? (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[83%]" />
                  </div>
                ) : gradesErr ? (
                  <p className="flex items-center gap-2 p-3 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Could not load grades.
                  </p>
                ) : gradePreview.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No graded items for this class yet.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {gradePreview.map((g, i) => (
                      <li key={`${g.assignment_name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="min-w-0 truncate text-xs">
                          <span className="font-medium text-foreground">{g.subject}</span>
                          <span className="text-muted-foreground"> · {g.assignment_name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums">
                          {g.score}/{g.max_score}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                Academic context
              </h3>
              <div className="rounded-lg border bg-card/50 p-3 text-xs text-muted-foreground shadow-sm space-y-1">
                <p>Previous school: {student.previousSchool || '—'}</p>
                <p>Admission date: {formatDisplayDate(student.dateOfAdmission, '—')}</p>
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StudentQuickViewSheet;
