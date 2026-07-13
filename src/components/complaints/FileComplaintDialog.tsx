import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, UserRound, AlertTriangle, Flag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  formDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { apiService } from '@/services/api';
import {
  complaintsService,
  type ComplaintSeverity,
  type ComplaintTeacherSubject,
  type ComplaintType,
} from '@/services/complaintsService';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

type TeacherClass = {
  id: number;
  class_name: string;
};

function studentLabel(s: {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  studentId?: string;
  student_id?: string;
  classAssigned?: string;
  className?: string;
}) {
  const name = `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.trim();
  const id = s.studentId || s.student_id || '';
  const cls = s.classAssigned || s.className || '';
  return { name, id, cls };
}

function studentInTeacherClasses(
  s: {
    classAssigned?: string;
    className?: string;
    classAssignedId?: number;
    class_assigned_id?: number;
  },
  classIds: Set<number>,
  classNames: Set<string>
) {
  const classId = Number(s.classAssignedId ?? s.class_assigned_id);
  if (Number.isFinite(classId) && classIds.has(classId)) return true;
  const className = String(s.classAssigned || s.className || '')
    .trim()
    .toLowerCase();
  return className.length > 0 && classNames.has(className);
}

const FileComplaintDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const { students, refresh } = useData();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<ComplaintType | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [subjectStudentId, setSubjectStudentId] = useState<number | null>(null);
  const [subjectTeacherId, setSubjectTeacherId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<ComplaintTeacherSubject[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ComplaintSeverity>('medium');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType(null);
    setStudentQuery('');
    setTeacherQuery('');
    setSubjectStudentId(null);
    setSubjectTeacherId(null);
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setIsAnonymous(false);
    setConfirmOpen(false);
    if (!students?.length) void refresh(['students']).catch(() => undefined);
    apiService
      .get<TeacherClass[]>('/teachers/me/classes')
      .then((list) => setTeacherClasses(Array.isArray(list) ? list : []))
      .catch(() => setTeacherClasses([]));
  }, [open, students?.length, refresh]);

  useEffect(() => {
    if (!open || type !== 'teacher') return;
    complaintsService
      .listTeacherSubjects()
      .then((res) => setTeachers(res.items || []))
      .catch(() => setTeachers([]));
  }, [open, type]);

  const teacherClassIds = useMemo(
    () => new Set(teacherClasses.map((c) => Number(c.id)).filter(Number.isFinite)),
    [teacherClasses]
  );
  const teacherClassNames = useMemo(
    () => new Set(teacherClasses.map((c) => c.class_name.trim().toLowerCase()).filter(Boolean)),
    [teacherClasses]
  );

  const myClassStudents = useMemo(() => {
    const pool = students || [];
    if (type !== 'student') return pool;
    return pool.filter((s: any) => studentInTeacherClasses(s, teacherClassIds, teacherClassNames));
  }, [students, type, teacherClassIds, teacherClassNames]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const pool = myClassStudents;
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((s: any) => {
        const { name, id, cls } = studentLabel(s);
        return (
          name.toLowerCase().includes(q) ||
          String(id).toLowerCase().includes(q) ||
          String(cls).toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [myClassStudents, studentQuery]);

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers.slice(0, 8);
    return teachers
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.staff_id || '').toLowerCase().includes(q) ||
          t.role.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [teachers, teacherQuery]);

  const selectedStudent = myClassStudents.find((s: any) => Number(s.id) === subjectStudentId);
  const selectedTeacher = teachers.find((t) => t.id === subjectTeacherId);

  const canSubmit =
    !!type &&
    title.trim().length > 0 &&
    description.trim().length >= 20 &&
    ((type === 'student' && subjectStudentId) || (type === 'teacher' && subjectTeacherId));

  const submitHint = useMemo(() => {
    if (step !== 2 || !type) return null;
    if (type === 'student' && !subjectStudentId) {
      if (teacherClasses.length === 0) {
        return 'You are not assigned to any class, so you cannot file student complaints.';
      }
      return 'Select a student from your class list (tap a name or press Enter on a match).';
    }
    if (type === 'teacher' && !subjectTeacherId) {
      return 'Select a teacher from the list.';
    }
    if (!title.trim()) return 'Enter a short title.';
    if (description.trim().length < 20) {
      return `Description needs ${20 - description.trim().length} more character(s).`;
    }
    return null;
  }, [step, type, subjectStudentId, subjectTeacherId, title, description, teacherClasses.length]);

  const selectStudent = (studentId: number) => {
    setSubjectStudentId(studentId);
    setStudentQuery('');
  };

  const handleStudentSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || filteredStudents.length === 0) return;
    e.preventDefault();
    selectStudent(Number(filteredStudents[0].id));
  };

  const submit = async () => {
    if (!type || !canSubmit) return;
    setSubmitting(true);
    try {
      await complaintsService.create({
        complaint_type: type,
        subject_student_id: type === 'student' ? subjectStudentId! : undefined,
        subject_teacher_id: type === 'teacher' ? subjectTeacherId! : undefined,
        title: title.trim(),
        description: description.trim(),
        severity,
        is_anonymous: type === 'teacher' ? isAnonymous : false,
      });
      toast({
        title: 'Complaint filed',
        description: 'School administration will review your complaint.',
      });
      setConfirmOpen(false);
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      toast({
        title: 'Could not file complaint',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={formDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                <Flag className="h-4 w-4" />
              </span>
              File a Complaint
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? 'Choose who this complaint is about.'
                : 'Provide clear, factual details for school administration.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setType('student');
                    setStep(2);
                  }}
                  className="rounded-2xl border-2 border-border p-5 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                >
                  <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <p className="font-semibold">About a Student</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Students in your assigned class only
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('teacher');
                    setStep(2);
                  }}
                  className="rounded-2xl border-2 border-border p-5 text-left hover:border-sky-400 hover:bg-sky-50/50 transition-colors"
                >
                  <div className="h-11 w-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <p className="font-semibold">About a Teacher</p>
                  <p className="text-xs text-muted-foreground mt-1">Staff-related concern (optional anonymity)</p>
                </button>
              </div>
            )}

            {step === 2 && type && (
              <div className="space-y-4">
                <button
                  type="button"
                  className="text-xs font-medium text-emerald-700 hover:underline"
                  onClick={() => {
                    setStep(1);
                    setSubjectStudentId(null);
                    setSubjectTeacherId(null);
                  }}
                >
                  ← Change type
                </button>

                {type === 'student' ? (
                  <div className="space-y-2">
                    <Label>Student in your class</Label>
                    {teacherClasses.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Showing students from:{' '}
                        {teacherClasses.map((c) => c.class_name).join(', ')}
                      </p>
                    )}
                    <Input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      onKeyDown={handleStudentSearchKeyDown}
                      placeholder="Search by name or ID…"
                      className="rounded-xl"
                      disabled={teacherClasses.length === 0}
                    />
                    {selectedStudent ? (
                      <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm flex justify-between gap-2">
                        <span>
                          <strong>{studentLabel(selectedStudent as any).name}</strong>
                          <span className="text-muted-foreground">
                            {' '}
                            · {studentLabel(selectedStudent as any).cls || 'No class'}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setSubjectStudentId(null)}
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto rounded-xl border divide-y">
                        {teacherClasses.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            You are not assigned to any class.
                          </p>
                        ) : filteredStudents.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            No students found in your class{studentQuery.trim() ? ' for this search' : ''}
                          </p>
                        ) : (
                          filteredStudents.map((s: any) => {
                            const meta = studentLabel(s);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                                onClick={() => selectStudent(Number(s.id))}
                              >
                                <p className="font-medium">{meta.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {meta.cls || 'No class'}
                                  {meta.id ? ` · ${meta.id}` : ''}
                                </p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Teacher</Label>
                    <Input
                      value={teacherQuery}
                      onChange={(e) => setTeacherQuery(e.target.value)}
                      placeholder="Search teacher by name…"
                      className="rounded-xl"
                    />
                    {selectedTeacher ? (
                      <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm flex justify-between gap-2">
                        <span>
                          <strong>{selectedTeacher.name}</strong>
                          <span className="text-muted-foreground capitalize">
                            {' '}
                            · {selectedTeacher.role.replace(/-/g, ' ')}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setSubjectTeacherId(null)}
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto rounded-xl border divide-y">
                        {filteredTeachers.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">No teachers found</p>
                        ) : (
                          filteredTeachers.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                              onClick={() => setSubjectTeacherId(t.id)}
                            >
                              <p className="font-medium">{t.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {t.role.replace(/-/g, ' ')}
                                {t.staff_id ? ` · ${t.staff_id}` : ''}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="complaint-title">Title</Label>
                  <Input
                    id="complaint-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    placeholder="Short summary"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complaint-desc">Description</Label>
                  <Textarea
                    id="complaint-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe what happened (min 20 characters)"
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">{description.trim().length}/20 minimum</p>
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as ComplaintSeverity)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low
                        </span>
                      </SelectItem>
                      <SelectItem value="medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium
                        </span>
                      </SelectItem>
                      <SelectItem value="high">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" /> High
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {type === 'teacher' && (
                  <div className="rounded-xl border bg-muted/30 px-3 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">File anonymously</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your name will not be shown to administrators reviewing this complaint.
                      </p>
                    </div>
                    <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                  </div>
                )}

                {submitHint && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{submitHint}</p>
                )}
              </div>
            )}
          </DialogBody>

          {step === 2 && (
            <DialogFooter className={`${detailDialogFooterClass} gap-2 sm:gap-2`}>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                className="rounded-xl"
                disabled={!canSubmit || submitting}
                onClick={() => setConfirmOpen(true)}
              >
                Submit complaint
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm submission
            </AlertDialogTitle>
            <AlertDialogDescription>
              Complaints are reviewed by school administration. Please ensure your complaint is accurate and
              factual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm & submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FileComplaintDialog;
