import React, { useCallback, useMemo, useState } from 'react';
import { useData, type Student } from '@/contexts/DataContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GraduationCap, Search, Eye, Pencil } from 'lucide-react';
import {
  enrollmentStatusLabel,
  isAlumniStudent,
  normalizeEnrollmentStatus,
  statusBadgeClass,
} from './studentRegistryUtils';
import { resolveLogoUrl } from '@/services/tenantService';
import { formatDisplayDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import StudentDetailsDialog from './StudentDetailsDialog';
import StudentQuickViewSheet from './StudentQuickViewSheet';
import EditStudentDialog from './EditStudentDialog';

const AlumniStudents: React.FC = () => {
  const { students, payments, feeStructures } = useData();
  const { currentTerm } = useActiveTerm();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [quickViewStudent, setQuickViewStudent] = useState<Student | null>(null);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);

  const alumni = useMemo(
    () =>
      students
        .filter((s) => isAlumniStudent(s) || normalizeEnrollmentStatus(s.enrollmentStatus) === 'graduated')
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [students]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return alumni;
    return alumni.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        String(s.studentId).toLowerCase().includes(q) ||
        (s.admissionNumber || '').toLowerCase().includes(q) ||
        (s.classAssigned || '').toLowerCase().includes(q)
    );
  }, [alumni, searchTerm]);

  const openQuickView = (student: Student) => {
    setQuickViewStudent(student);
    setQuickSheetOpen(true);
  };

  const openFullProfile = (student: Student) => {
    setSelectedStudent(student);
    setShowDetailsDialog(true);
  };

  const openEdit = (student: Student) => {
    setSelectedStudent(student);
    setShowEditDialog(true);
  };

  const totalPaidAllTime = useCallback(
    (studentId: string) =>
      (payments || [])
        .filter((p) => String(p.studentId) === String(studentId))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments]
  );

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Alumni
            <Badge variant="outline" className="font-normal">
              {alumni.length} graduate{alumni.length === 1 ? '' : 's'}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click any alumni to view their full records — profile, fees, attendance, and grades are preserved.
          </p>
          <div className="relative mt-3 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or last class…"
              className="h-10 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {alumni.length === 0
                ? 'No alumni yet. Students appear here after JHS 3 is moved to Alumni or the end-of-year cycle runs.'
                : 'No alumni match your search.'}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((s) => {
                const status = normalizeEnrollmentStatus(s.enrollmentStatus);
                const paid = totalPaidAllTime(s.id);
                return (
                  <li key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
                      onClick={() => openQuickView(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openQuickView(s);
                        }
                      }}
                    >
                      <Avatar className="h-11 w-11 rounded-xl border border-border/80">
                        {s.passportPhotoUrl ? (
                          <AvatarImage src={resolveLogoUrl(s.passportPhotoUrl) || undefined} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="rounded-xl text-xs font-semibold">
                          {s.firstName?.[0]}
                          {s.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID {s.studentId}
                          {s.classAssigned ? ` · Last class: ${s.classAssigned}` : ''}
                          {s.graduatedAt ? ` · Graduated ${formatDisplayDate(s.graduatedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-[11px] font-medium', statusBadgeClass(status))}
                        >
                          {enrollmentStatusLabel(s.enrollmentStatus)}
                        </Badge>
                        {paid > 0 && (
                          <Badge variant="outline" className="text-[11px] font-medium tabular-nums">
                            Paid GHS {paid.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Full profile"
                          onClick={() => openFullProfile(s)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit alumni"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <StudentDetailsDialog
        student={selectedStudent}
        open={showDetailsDialog}
        onClose={() => {
          setShowDetailsDialog(false);
          setSelectedStudent(null);
        }}
        payments={payments as any}
        totalFeesForStudent={0}
      />

      <EditStudentDialog
        student={selectedStudent}
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
      />

      <StudentQuickViewSheet
        student={quickViewStudent}
        open={quickSheetOpen}
        onOpenChange={(o) => {
          setQuickSheetOpen(o);
          if (!o) setQuickViewStudent(null);
        }}
        payments={payments as any}
        currentTerm={currentTerm}
        feeStructures={feeStructures}
        onViewFull={(st) => {
          setQuickSheetOpen(false);
          setQuickViewStudent(null);
          openFullProfile(st);
        }}
        onEdit={(st) => {
          setQuickSheetOpen(false);
          setQuickViewStudent(null);
          openEdit(st);
        }}
      />
    </>
  );
};

export default AlumniStudents;
