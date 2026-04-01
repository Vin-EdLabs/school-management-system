import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import useClasses, { useClassStudents } from '@/hooks/useClasses';
import {
  useCreateBoundary,
  useDeleteBoundary,
  useGradeBoundaries as useListGradeBoundariesHook,
  useUpdateBoundary
} from '@/hooks/useGradeBoundaries';
import {
  useCreateExam,
  useCreateExamType,
  useExams, useExamTypes, useGrades,
  useLockExam,
  useSaveGrades, useUpdateGrade
} from '@/hooks/useGrades';
import { useSchedulesForTeacher } from '@/hooks/useSchedules';
import useSubjects from '@/hooks/useSubjects';
import gradesService from '@/services/gradesService';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye, EyeOff,
  Lock,
  Plus,
  Settings,
  TrendingUp,
  Unlock,
  Users,
  X
} from 'lucide-react';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/* UI COMPONENTS                                */
/* -------------------------------------------------------------------------- */

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// -- Button --
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'; size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-purple-600 text-white hover:bg-purple-700 shadow-sm",
      destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
      outline: "border border-border bg-transparent shadow-sm hover:bg-muted text-foreground",
      secondary: "bg-muted text-foreground hover:bg-secondary",
      ghost: "hover:bg-muted hover:text-foreground",
      link: "text-purple-900 underline-offset-4 hover:underline",
    };
    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-950 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// -- Input --
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-950 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// -- Label --
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

// -- Badge --
const Badge = ({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }) => {
  const variants = {
    default: "border-transparent bg-purple-600 text-white shadow hover:bg-purple-700",
    secondary: "border-transparent bg-muted text-foreground hover:bg-secondary",
    destructive: "border-transparent bg-red-500 text-white shadow hover:bg-red-600",
    outline: "text-foreground border-border",
  };
  return (
    <div className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-950 focus:ring-offset-2", variants[variant], className)} {...props} />
  );
};

// -- Card --
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-xl border bg-card text-gray-950 shadow", className)} {...props} />
));
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
));
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));

// -- Alert --
const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }>(({ className, variant = "default", ...props }, ref) => (
  <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-gray-950", className)} {...props} />
));
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed pl-7", className)} {...props} />
));

// -- Tabs --
const TabsContext = createContext<{ value: string; onValueChange: (v: string) => void }>({ value: '', onValueChange: () => { } });
const Tabs = ({ value, onValueChange, children, className }: any) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={className}>{children}</div>
  </TabsContext.Provider>
);
const TabsList = ({ className, children }: any) => (
  <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>{children}</div>
);
const TabsTrigger = ({ value, className, children }: any) => {
  const { value: selected, onValueChange } = useContext(TabsContext);
  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        selected === value ? "bg-card text-gray-950 shadow" : "hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
};
const TabsContent = ({ value, children, className }: any) => {
  const { value: selected } = useContext(TabsContext);
  if (selected !== value) return null;
  return <div className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-950 focus-visible:ring-offset-2", className)}>{children}</div>;
};

// -- Dialog --
const Dialog = ({ open, onOpenChange, children }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Close on click outside */}
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
      {/* Inject onClose into children */}
      {React.Children.map(children, child => React.cloneElement(child, { onClose: () => onOpenChange(false) }))}
    </div>
  );
};
const DialogContent = ({ children, className, onClose }: any) => (
  <div className={cn("relative z-50 grid w-full max-w-lg gap-4 border bg-card p-6 shadow-lg duration-200 sm:rounded-lg", className)}>
    <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted data-[state=open]:text-muted-foreground">
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
    {children}
  </div>
);
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
const DialogTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));

// -- Select (Simplified Custom Implementation) --
const SelectContext = createContext<{ value: any; onValueChange: (v: any) => void; open: boolean; setOpen: (v: boolean) => void }>({ value: '', onValueChange: () => { }, open: false, setOpen: () => { } });

const Select = ({ value, onValueChange, children }: any) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className="relative">{children}</div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({ className, children }: any) => {
  const { open, setOpen } = useContext(SelectContext);
  return (
    <button
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-950 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

const SelectValue = ({ placeholder }: any) => {
  const { value } = useContext(SelectContext);
  // Minimal SelectValue: prefer human-readable value if provided, otherwise placeholder.
  if (!value) return <span className="text-muted-foreground">{placeholder}</span>;
  // If value is a primitive string/number return it directly. More advanced
  // label resolution can be added later by lifting option lists into the
  // Select context.
  return <span className="block truncate">{String(value)}</span>;
};

const SelectContent = ({ children, className }: any) => {
  const { open } = useContext(SelectContext);
  if (!open) return null;
  return (
    <div className={cn("absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-card text-gray-950 shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 top-full mt-1 w-full", className)}>
      <div className="p-1 max-h-60 overflow-y-auto">{children}</div>
    </div>
  );
};

const SelectItem = ({ value, children, className }: any) => {
  const { onValueChange, setOpen, value: selectedValue } = useContext(SelectContext);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onValueChange(value);
        setOpen(false);
      }}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-muted focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        selectedValue === value && "font-semibold bg-muted/50",
        className
      )}
    >
      {children}
      {selectedValue === value && <CheckCircle className="absolute right-2 h-3 w-3 text-purple-600" />}
    </div>
  );
};


/* -------------------------------------------------------------------------- */
/* Hook-backed data (replaces mock data)                                    */
/* -------------------------------------------------------------------------- */

// React Query hooks provide the server-backed lists. We also keep local
// `localExams` state for newly-created exams that haven't been posted.
// The component merges server exams with local ones for UX parity with the
// mock-driven version.
const NOOP = () => { };

const formatClassLabel = (c: any) => {
  if (!c) return '';
  const level = c.level ?? c.Level ?? c.level_name ?? null;
  const stream = c.stream ?? c.Stream ?? c.stream_name ?? null;
  if (level) return `${level}${stream ? ' ' + stream : ''}`;
  return c.name || c.class_name || `Class ${c.id}`;
};

/* -------------------------------------------------------------------------- */
/* MAIN MODULE                                 */
/* -------------------------------------------------------------------------- */

const GradesModule = () => {
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [customExamType, setCustomExamType] = useState('');
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [maxScore, setMaxScore] = useState('100');
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));

  const [exams, setExams] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  // Grade boundaries
  const [gradeBoundaries, setGradeBoundaries] = useState<any[]>([
    { grade: 'A+', min: 97, max: 100 },
    { grade: 'A', min: 93, max: 96 },
    { grade: 'A-', min: 90, max: 92 },
    { grade: 'B+', min: 87, max: 89 },
    { grade: 'B', min: 83, max: 86 },
    { grade: 'B-', min: 80, max: 82 },
    { grade: 'C+', min: 77, max: 79 },
    { grade: 'C', min: 73, max: 76 },
    { grade: 'C-', min: 70, max: 72 },
    { grade: 'D+', min: 67, max: 69 },
    { grade: 'D', min: 65, max: 66 },
    { grade: 'F', min: 0, max: 64 }
  ]);

  const addBoundary = () => {
    setGradeBoundaries(prev => [...prev, { grade: 'New', min: 0, max: 0 }]);
  };

  const deletedBoundaryIds = useRef<number[]>([]);

  const removeBoundary = (index: number) => {
    setGradeBoundaries(prev => {
      const item = prev[index];
      if (item && (item as any).id) deletedBoundaryIds.current.push(Number((item as any).id));
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateBoundaryLabel = (index: number, label: string) => {
    setGradeBoundaries(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], grade: label };
      return copy;
    });
  };

  const moveBoundary = (index: number, direction: 'up' | 'down') => {
    setGradeBoundaries(prev => {
      const copy = [...prev];
      const to = direction === 'up' ? index - 1 : index + 1;
      if (to < 0 || to >= copy.length) return prev;
      const tmp = copy[to];
      copy[to] = copy[index];
      copy[index] = tmp;
      return copy;
    });
  };

  const [showBoundariesDialog, setShowBoundariesDialog] = useState(false);
  const [showCreateExamDialog, setShowCreateExamDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('entry');

  const saveTimers = useRef<Record<string, any>>({});

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Hooks / server-backed data
  const { classes } = useClasses() as any;
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super-admin';
  const schedulesForTeacherQuery = useSchedulesForTeacher((user as any)?.teacherId ?? (user as any)?.id);
  const schedulesForTeacher = (schedulesForTeacherQuery as any)?.data || [];

  const availableClasses = useMemo(() => {
    if (!user || user.role !== 'teacher') return classes || [];
    const assigned = (classes || []).filter((c: any) => {
      const assignedId = c.assignedTeacher ?? c.assignedTeacherId ?? c.teacher_id ?? c.teacherId;
      return assignedId !== undefined && assignedId !== null && String(assignedId) === String((user as any).id || user.teacherId);
    });
    const scheduledClassIds = new Set(Array.isArray(schedulesForTeacher)
      ? schedulesForTeacher.map((s: any) => String(s.class_id ?? s.classId ?? s.class))
      : []);
    const scheduled = (classes || []).filter((c: any) => scheduledClassIds.has(String(c.id)));
    // union keeping order from classes
    const map = new Map<string, any>();
    (assigned || []).forEach((c: any) => map.set(String(c.id), c));
    (scheduled || []).forEach((c: any) => map.set(String(c.id), c));
    // fallback: if teacher has no assignments/schedules, show nothing (explicit)
    const result = Array.from(map.values());
    return result.length > 0 ? result : [];
  }, [classes, user, schedulesForTeacher]);
  const { subjects } = useSubjects() as any;
  const examTypesQuery = useExamTypes();
  const examTypes = (examTypesQuery as any)?.data || [];

  const examsQuery = useExams({ classId: selectedClass });
  const serverExams = (examsQuery as any)?.data || [];

  const gradesQuery = useGrades(Number(selectedAssignment) || undefined as any);
  const serverGrades = (gradesQuery as any)?.data || [];

  const saveGradesMutation = useSaveGrades();
  const updateGradeMutation = useUpdateGrade();
  const createExamMutation = useCreateExam();
  const createExamTypeMutation = useCreateExamType();
  const lockExamMutation = useLockExam();

  const boundariesQuery = useListGradeBoundariesHook();
  const createBoundaryMutation = useCreateBoundary();
  const updateBoundaryMutation = useUpdateBoundary();
  const deleteBoundaryMutation = useDeleteBoundary();
  const qc = useQueryClient();
  const [savingBoundaries, setSavingBoundaries] = useState(false);
  const { addAuditLog } = useAudit();

  const { data: classStudentsResp } = useClassStudents(Number(selectedClass) || 0) as any;
  const classStudents = (classStudentsResp as any)?.data || [];

  // Local exams created in the UI but not yet persisted to the server
  const [localExams, setLocalExams] = useState<any[]>([]);

  // Merge server exams and local exams for display
  useEffect(() => {
    // Avoid duplicates by id
    const ids = new Set<string>();
    const merged: any[] = [];
    [...serverExams, ...localExams].forEach((e: any) => {
      if (!ids.has(String(e.id))) {
        ids.add(String(e.id));
        merged.push(e);
      }
    });
    setExams(prev => {
      try {
        const same = prev.length === merged.length && prev.every((p, i) => String(p.id) === String(merged[i].id));
        return same ? prev : merged;
      } catch (e) {
        return merged;
      }
    });
  }, [serverExams, localExams]);

  // Auto-select first class when classes load (dev convenience)
  useEffect(() => {
    const firstId = String((availableClasses || [])[0]?.id ?? '');
    if (firstId && String(selectedClass) !== firstId) {
      setSelectedClass(firstId);
    }
  }, [availableClasses]);

  // Keep local grades in sync when server grades arrive
  useEffect(() => {
    if (serverGrades && serverGrades.length > 0) {
      setGrades(prev => {
        try {
          const same = prev.length === serverGrades.length && prev.every((p, i) => String(p.id) === String(serverGrades[i].id));
          return same ? prev : serverGrades;
        } catch (e) {
          return serverGrades;
        }
      });
    }
  }, [serverGrades]);

  const getLetterGrade = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    for (const boundary of gradeBoundaries) {
      if (percentage >= boundary.min && percentage <= boundary.max) {
        return boundary.grade;
      }
    }
    return 'F';
  };

  // Normalize student objects to the shape the UI expects (name, rollNo, id)
  const normalizedStudents = (classStudents || []).map((s: any) => ({
    id: String(s.id ?? s.ID ?? s.student_id),
    name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    rollNo: s.admission_no ?? s.admissionNo ?? s.rollNo ?? '',
    classId: String(s.class_id ?? s.classId ?? selectedClass)
  }));

  // When boundaries dialog opens, populate local state from server
  useEffect(() => {
    (async () => {
      if (!showBoundariesDialog) return;
      const data = (boundariesQuery as any)?.data || [];
      let mapped = (data || []).map((b: any) => ({ id: b.id, grade: b.grade, min: Number(b.min), max: Number(b.max), school_id: b.school_id ?? null, class_id: b.class_id ?? null }));

      // If no class-specific boundaries found, fall back to global (school-wide) defaults
      if ((!mapped || mapped.length === 0) && selectedClass) {
        try {
          const global = await gradesService.listBoundaries();
          if (global && global.length > 0) {
            mapped = (global || []).map((b: any) => ({ id: b.id, grade: b.grade, min: Number(b.min), max: Number(b.max), school_id: b.school_id ?? null, class_id: b.class_id ?? null }));
          }
        } catch (e) {
          // ignore fallback errors, we'll just keep mapped empty
          // eslint-disable-next-line no-console
          console.error('Failed to fetch global boundaries fallback', e);
        }
      }

      setGradeBoundaries(mapped);
      deletedBoundaryIds.current = [];
    })();
  }, [showBoundariesDialog, (boundariesQuery as any)?.data]);

  const validateBoundariesClient = (list: any[]) => {
    for (const b of list) {
      if (b.min === undefined || b.max === undefined) return 'All boundaries must have min and max';
      if (Number(b.min) > Number(b.max)) return `Boundary '${b.grade}' min must be <= max`;
    }
    // check overlap
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const aMin = Number(a.min), aMax = Number(a.max), bMin = Number(b.min), bMax = Number(b.max);
        if (aMin <= bMax && aMax >= bMin) return `Boundary '${a.grade}' overlaps with '${b.grade}'`;
      }
    }
    return null;
  };

  const filteredStudents = normalizedStudents; // classStudents endpoint already scopes by class

  const currentExam = exams.find(e => String(e.id) === String(selectedAssignment));
  const currentMaxScore = currentExam?.maxScore || 100;

  const handleCreateExam = () => {
    if (!selectedClass || !selectedSubject) {
      showToast('Please select class and subject');
      return;
    }

    const examTypeName = customExamType || (examTypes.find((t: any) => String(t.id) === String(selectedExamType))?.name) || selectedExamType || 'Exam';
    const subjectName = (subjects || []).find((s: any) => String(s.id) === String(selectedSubject))?.name || 'Subject';

    const newExam = {
      id: `exam-${Date.now()}`,
      name: `${examTypeName} — ${subjectName}`,
      type: examTypeName,
      maxScore: Number(maxScore) || 100,
      examDate,
      classId: selectedClass,
      subjectId: selectedSubject,
      term: selectedTerm,
      isPublished: false
    };
    // Add a local (optimistic) exam so the instructor can select it immediately
    setLocalExams(prev => [...prev, newExam]);

    // Prepare payload matching backend expectations
    (async () => {
      try {
        let exam_type_id: number | null = null;
        // If user chose custom, create an exam type first
        if (selectedExamType === 'custom' && customExamType) {
          const createdType = await createExamTypeMutation.mutateAsync?.({ name: customExamType });
          exam_type_id = createdType?.id ?? null;
        } else if (selectedExamType) {
          // selectedExamType might be an id string
          const n = Number(selectedExamType);
          exam_type_id = Number.isNaN(n) ? null : n;
        }

        const payload = {
          exam_type_id: exam_type_id,
          class_id: Number(selectedClass),
          subject_id: Number(selectedSubject),
          term: selectedTerm || null,
          exam_date: examDate || null
        };

        const created = await createExamMutation.mutateAsync?.(payload);
        // If server returned created exam, replace optimistic selection
        if (created && created.id) {
          // remove local optimistic exam that matches by name
          setLocalExams(prev => prev.filter(x => x.id !== newExam.id));
          setSelectedAssignment(String(created.id));
          addAuditLog({
            actionType: 'Edit',
            module: 'Grades',
            itemId: String(created.id),
            itemName: newExam.name,
            reason: 'Created Exam'
          });
          showToast('Exam created successfully!');
        } else {
          // fallback: keep optimistic exam selected
          setSelectedAssignment(newExam.id);
          addAuditLog({
            actionType: 'Edit',
            module: 'Grades',
            itemId: newExam.id,
            itemName: newExam.name,
            reason: 'Created Local Exam'
          });
          showToast('Exam created locally (server did not return id)');
        }
      } catch (err) {
        // If server create failed, keep local exam so user can continue, but inform
        console.error('create exam error', err);
        setSelectedAssignment(newExam.id);
        showToast('Failed to save exam to server; using local exam');
      }
    })();
    setShowCreateExamDialog(false);
    setCustomExamType('');
  };

  const scheduleSave = (grade: any) => {

    const key = `${grade.studentId}-${grade.assignmentId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);

    saveTimers.current[key] = setTimeout(() => {
      // If this is a server-backed exam (id is numeric or not starting with 'exam-')
      const aid = String(grade.assignmentId || '');
      if (!aid.startsWith('exam-') && !Number.isNaN(Number(aid))) {
        try {
          saveGradesMutation.mutate?.({
            examId: Number(aid), records: [{
              studentId: grade.studentId,
              score: grade.score,
              status: grade.status,
              remarks: grade.remarks
            }]
          }, {
            onSuccess: () => {
              addAuditLog({
                actionType: 'Edit',
                module: 'Grades',
                itemId: String(grade.studentId),
                itemName: `Grade Entry for Exam #${aid}`,
                reason: `Updated student ${grade.studentId} with score ${grade.score}`
              });
              showToast('Saved');
            },
            onError: (err: any) => {
              console.error('Save grades error', err);
              showToast('Failed to save grade');
            }
          });
        } catch (e) {
          console.error('saveGradesMutation error', e);
        }
      } else {
        // Local exam — keep local state only
        console.log('Auto-saved (local):', grade);
      }

      delete saveTimers.current[key];
    }, 900);
  };

  const visibleGrades = grades.filter(g =>
    String(g.assignmentId) === String(selectedAssignment) && g.status === 'OK' && typeof g.score === 'number' && g.score !== null
  );

  const scores = visibleGrades.map((g: any) => g.score);
  const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
  const passMark = currentMaxScore * 0.5;
  const passCount = scores.filter((s: number) => s >= passMark).length;
  const failCount = scores.filter((s: number) => s < passMark).length;
  const passRate = scores.length > 0 ? (passCount / scores.length * 100).toFixed(1) : 0;

  const gradeDistribution = gradeBoundaries.map(boundary => {
    const count = visibleGrades.filter(g => {
      const percentage = (g.score / currentMaxScore) * 100;
      return percentage >= boundary.min && percentage <= boundary.max;
    }).length;
    return { grade: boundary.grade, count };
  });

  const handleExport = () => {
    const rows = [['Student Name', 'Roll No', 'Score', 'Max Score', 'Grade', 'Status', 'Remarks'].join(',')];

    filteredStudents.forEach(student => {
      const grade = grades.find(g => g.studentId === student.id && String(g.assignmentId) === String(selectedAssignment));
      rows.push([
        student.name,
        student.rollNo,
        grade?.score ?? '',
        currentMaxScore,
        grade?.grade || '',
        grade?.status || 'OK',
        grade?.remarks || ''
      ].join(','));
    });

    // In a real app we would create the file. Here we just show a toast.
    showToast('Grades exported to CSV successfully!');
  };

  return (
    <div className="min-h-screen bg-muted/50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top fade-in duration-300">
            <Alert className="bg-card shadow-lg border-green-500">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription>{toastMessage}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Grade Management</h1>
              <p className="text-muted-foreground">Smart grade entry and analytics system</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBoundariesDialog(true)}
              className="flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Grade Boundaries</span>
            </Button>
            <Button
              onClick={() => setShowCreateExamDialog(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 border-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Exam</span>
            </Button>
          </div>
        </div>

        {/* Selection Bar */}
        <Card className="border-2 border-gray-100">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Class *</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    {(classes || []).find((c: any) => String(c.id) === String(selectedClass)) ? (
                      <span>{formatClassLabel((classes || []).find((c: any) => String(c.id) === String(selectedClass)))}</span>
                    ) : (
                      <SelectValue placeholder="Select class" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(classes || []).map((cls: any) => (
                      <SelectItem key={String(cls.id)} value={String(cls.id)}>{formatClassLabel(cls)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    {(subjects || []).find((s: any) => String(s.id) === String(selectedSubject)) ? (
                      <span>{(subjects || []).find((s: any) => String(s.id) === String(selectedSubject))?.name}</span>
                    ) : (
                      <SelectValue placeholder="Select subject" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(subjects || []).map((s: any) => (
                      <SelectItem key={String(s.id)} value={String(s.id)}>{s.name || s.title || s.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Term / Semester</Label>
                <Input
                  placeholder="e.g., Term 1"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Exam / Assessment</Label>
                <Select value={selectedAssignment} onValueChange={(val: any) => {
                  setSelectedAssignment(val);
                  const exam = exams.find(e => e.id === val);
                }}>
                  <SelectTrigger>
                    {selectedAssignment ? (
                      <span>{exams.find((e: any) => String(e.id) === String(selectedAssignment))?.name}</span>
                    ) : (
                      <SelectValue placeholder="Select exam" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {exams.filter((e: any) => String(e.classId) === String(selectedClass)).length === 0 && <div className="p-2 text-sm text-muted-foreground">No exams yet</div>}
                    {exams
                      .filter((e: any) => String(e.classId) === String(selectedClass) && (!selectedSubject || String(e.subjectId) === String(selectedSubject)))
                      .map((a: any) => (
                        <SelectItem key={String(a.id)} value={String(a.id)}>
                          <div className="flex items-center space-x-2">
                            <span>{a.name}</span>
                            {a.isLocked && <Lock className="w-3 h-3" />}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Bar */}
        {selectedAssignment && (
          <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-2">

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
            <TabsTrigger value="entry" className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Grade Entry</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>
                      {selectedAssignment
                        ? `Grades: ${exams.find(e => e.id === selectedAssignment)?.name}`
                        : "Student Grades Grid"}
                    </span>
                  </div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {filteredStudents.length} students
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedAssignment ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Exam Selected</h3>
                    <p className="text-muted-foreground mb-4">Create or select an exam to start entering grades</p>
                    <Button onClick={() => setShowCreateExamDialog(true)} className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Exam
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-visible">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b-2 border-border">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Student</th>
                          <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Score</th>
                          <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Grade</th>
                          <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => {
                          const existing = grades.find(g =>
                            g.studentId === student.id && String(g.assignmentId) === String(selectedAssignment)
                          );

                          const isHighest = existing?.score === highestScore && highestScore > 0 && scores.length > 1;
                          const isLowest = existing?.score === lowestScore && lowestScore > 0 && scores.length > 1;

                          return (
                            <tr
                              key={student.id}
                              className={`border-b hover:bg-muted/50 transition-colors ${isHighest ? 'bg-green-50' : isLowest ? 'bg-red-50' : ''
                                }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xs">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{student.name}</p>
                                    <p className="text-xs text-muted-foreground">{student.rollNo}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center space-x-2">
                                  <Input
                                    type="number"
                                    className={`w-20 text-center ${existing?.score != null && existing.score > currentMaxScore ? 'border-red-500 ring-red-200' : ''
                                      }`}
                                    placeholder="—"
                                    value={existing?.score !== null && existing?.score !== undefined ? String(existing.score) : ''}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const v = raw === '' ? null : Number(raw);

                                      setGrades(prev => {
                                        const found = prev.find(p =>
                                          p.studentId === student.id && p.assignmentId === selectedAssignment
                                        );

                                        if (found) {
                                          return prev.map(p =>
                                            (p.studentId === student.id && p.assignmentId === selectedAssignment)
                                              ? {
                                                ...p,
                                                score: v,
                                                grade: v !== null ? getLetterGrade(v, currentMaxScore) : ''
                                              }
                                              : p
                                          );
                                        }

                                        return [...prev, {
                                          id: `grade-${Date.now()}`,
                                          studentId: student.id,
                                          studentName: student.name,
                                          assignmentId: selectedAssignment,
                                          score: v,
                                          maxScore: currentMaxScore,
                                          grade: v !== null ? getLetterGrade(v, currentMaxScore) : '',
                                          status: 'OK',
                                          remarks: ''
                                        }];
                                      });

                                      if (v !== null) {
                                        scheduleSave({
                                          studentId: student.id,
                                          assignmentId: selectedAssignment,
                                          score: v,
                                          status: existing?.status || 'OK',
                                          remarks: existing?.remarks || ''
                                        });
                                      }
                                    }}
                                  />
                                  <span className="text-muted-foreground text-xs">/ {currentMaxScore}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge
                                  variant={
                                    existing?.grade?.startsWith('A') ? 'default' :
                                      existing?.grade?.startsWith('B') ? 'secondary' :
                                        existing?.grade === 'F' ? 'destructive' : 'outline'
                                  }
                                  className="font-bold min-w-[2rem] justify-center"
                                >
                                  {existing?.grade || '—'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Select
                                  value={existing?.status ?? 'OK'}
                                  onValueChange={(status: any) => {
                                    setGrades(prev => {
                                      const found = prev.find(p =>
                                        p.studentId === student.id && p.assignmentId === selectedAssignment
                                      );

                                      if (found) {
                                        return prev.map(p =>
                                          (p.studentId === student.id && p.assignmentId === selectedAssignment)
                                            ? { ...p, status }
                                            : p
                                        );
                                      }

                                      return [...prev, {
                                        id: `grade-${Date.now()}`,
                                        studentId: student.id,
                                        studentName: student.name,
                                        assignmentId: selectedAssignment,
                                        score: null,
                                        maxScore: currentMaxScore,
                                        grade: '',
                                        status,
                                        remarks: ''
                                      }];
                                    });

                                    scheduleSave({
                                      studentId: student.id,
                                      assignmentId: selectedAssignment,
                                      score: existing?.score || null,
                                      status,
                                      remarks: existing?.remarks || ''
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="OK">OK</SelectItem>
                                    <SelectItem value="ABS">Absent</SelectItem>
                                    <SelectItem value="EXM">Exempted</SelectItem>
                                    <SelectItem value="MIS">Missing</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-3 px-4">
                                <Input
                                  placeholder="Add remarks..."
                                  value={existing?.remarks ?? ''}
                                  onChange={(e) => {
                                    const remarks = e.target.value;

                                    setGrades(prev => {
                                      const found = prev.find(p =>
                                        p.studentId === student.id && p.assignmentId === selectedAssignment
                                      );

                                      if (found) {
                                        return prev.map(p =>
                                          (p.studentId === student.id && p.assignmentId === selectedAssignment)
                                            ? { ...p, remarks }
                                            : p
                                        );
                                      }

                                      return [...prev, {
                                        id: `grade-${Date.now()}`,
                                        studentId: student.id,
                                        studentName: student.name,
                                        assignmentId: selectedAssignment,
                                        score: null,
                                        maxScore: currentMaxScore,
                                        grade: '',
                                        status: 'OK',
                                        remarks
                                      }];
                                    });

                                    scheduleSave({
                                      studentId: student.id,
                                      assignmentId: selectedAssignment,
                                      score: existing?.score || null,
                                      status: existing?.status || 'OK',
                                      remarks
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Quick Summary */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-foreground">{scores.length}</div>
                          <div className="text-xs text-muted-foreground">Entered</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{passCount}</div>
                          <div className="text-xs text-muted-foreground">Passed</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">{failCount}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{passRate}%</div>
                          <div className="text-xs text-muted-foreground">Pass Rate</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{avgScore.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Average</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            {!selectedAssignment ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Exam Selected</h3>
                    <p className="text-muted-foreground">Select an exam to view analytics</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Performance Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span>Performance Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="text-sm text-purple-600 font-medium">Average Score</div>
                        <div className="text-3xl font-bold text-purple-700 mt-1">{avgScore.toFixed(1)}</div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="text-sm text-blue-600 font-medium">Pass Rate</div>
                        <div className="text-3xl font-bold text-blue-700 mt-1">{passRate}%</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="text-sm text-green-600 font-medium">Highest Score</div>
                        <div className="text-3xl font-bold text-green-700 mt-1">{highestScore}</div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="text-sm text-red-600 font-medium">Lowest Score</div>
                        <div className="text-3xl font-bold text-red-700 mt-1">{lowestScore}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Grade Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Grade Distribution</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {gradeDistribution.map((item) => {
                        const percentage = visibleGrades.length > 0
                          ? (item.count / visibleGrades.length) * 100
                          : 0;

                        return (
                          <div key={item.grade} className="flex items-center text-sm">
                            <div className="w-8 font-bold text-muted-foreground">{item.grade}</div>
                            <div className="flex-1 mx-3">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-12 text-right text-muted-foreground">
                              {item.count} <span className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Exam Dialog */}
        <Dialog open={showCreateExamDialog} onOpenChange={setShowCreateExamDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Set up a new assessment for {formatClassLabel((classes || []).find((c: any) => String(c.id) === String(selectedClass))) || 'the class'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Class</Label>
                  <Select value={selectedClass} onValueChange={(v: any) => setSelectedClass(String(v))}>
                    <SelectTrigger>
                      {(classes || []).find((c: any) => String(c.id) === String(selectedClass)) ? (
                        <span>{formatClassLabel((classes || []).find((c: any) => String(c.id) === String(selectedClass)))}</span>
                      ) : (
                        <SelectValue placeholder="Select class" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {(classes || []).map((c: any) => (
                        <SelectItem key={String(c.id)} value={String(c.id)}>{formatClassLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <Select value={selectedSubject} onValueChange={(v: any) => setSelectedSubject(String(v))}>
                    <SelectTrigger>
                      {(subjects || []).find((s: any) => String(s.id) === String(selectedSubject)) ? (
                        <span>{(subjects || []).find((s: any) => String(s.id) === String(selectedSubject))?.name}</span>
                      ) : (
                        <SelectValue placeholder="Select subject" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {(subjects || []).map((s: any) => (
                        <SelectItem key={String(s.id)} value={String(s.id)}>{s.name || s.title || s.code || `Subject ${s.id}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Exam Type</Label>
                <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                  <SelectTrigger>
                    {selectedExamType === 'custom' ? (
                      <span>Custom...</span>
                    ) : (examTypes || []).find((t: any) => String(t.id) === String(selectedExamType)) ? (
                      <span>{(examTypes || []).find((t: any) => String(t.id) === String(selectedExamType))?.name}</span>
                    ) : (
                      <SelectValue placeholder="Select type" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(examTypes || []).map((t: any) => (
                      <SelectItem key={String(t.id)} value={String(t.id)}>{t.name || t.label || String(t.id)}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedExamType === 'custom' && (
                <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
                  <Label>Custom Name</Label>
                  <Input
                    value={customExamType}
                    onChange={(e) => setCustomExamType(e.target.value)}
                    placeholder="e.g. Pop Quiz 1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Max Score</Label>
                  <Input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateExamDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateExam}>Create Exam</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Grade Boundaries Dialog */}
        <Dialog open={showBoundariesDialog} onOpenChange={setShowBoundariesDialog}>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Grade Boundaries</DialogTitle>
              <DialogDescription>
                Configure score ranges for letter grades.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4 font-medium text-sm text-muted-foreground mb-2">
                <div>Grade</div>
                <div>Min (%)</div>
                <div>Max (%)</div>
              </div>
              <div className="flex justify-end mb-2">
                {isSuperAdmin ? (
                  <Button variant="outline" size="sm" onClick={addBoundary}>Add Boundary</Button>
                ) : (
                  <div className="text-sm text-muted-foreground">Viewing only — contact super-admin to change</div>
                )}
              </div>
              {gradeBoundaries.map((boundary, index) => (
                <div key={`boundary-${index}`} className="grid grid-cols-3 gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <Input
                      value={boundary.grade}
                      onChange={(e) => isSuperAdmin && updateBoundaryLabel(index, e.target.value)}
                      readOnly={!isSuperAdmin}
                      className="font-bold text-center bg-muted p-2 rounded text-sm"
                    />

                    {isSuperAdmin && (
                      <div className="flex flex-col space-y-1">
                        <button
                          type="button"
                          onClick={() => moveBoundary(index, 'up')}
                          className="rounded p-1 bg-card border text-xs shadow hover:bg-muted/50"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBoundary(index, 'down')}
                          className="rounded p-1 bg-card border text-xs shadow hover:bg-muted/50"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {isSuperAdmin && (
                      <button onClick={() => removeBoundary(index)} className="rounded-full bg-card border p-1 text-xs shadow hover:bg-muted/50" title="Remove">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={boundary.min}
                    readOnly={!isSuperAdmin}
                    onChange={(e) => {
                      if (!isSuperAdmin) return;
                      const newBoundaries = [...gradeBoundaries];
                      newBoundaries[index].min = Number(e.target.value);
                      setGradeBoundaries(newBoundaries);
                    }}
                  />
                  <Input
                    type="number"
                    value={boundary.max}
                    readOnly={!isSuperAdmin}
                    onChange={(e) => {
                      if (!isSuperAdmin) return;
                      const newBoundaries = [...gradeBoundaries];
                      newBoundaries[index].max = Number(e.target.value);
                      setGradeBoundaries(newBoundaries);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowBoundariesDialog(false)}>Cancel</Button>
              {isSuperAdmin && (
                <Button onClick={async () => {
                  const err = validateBoundariesClient(gradeBoundaries);
                  if (err) { showToast(err); return; }

                  setSavingBoundaries(true);
                  try {
                    // delete removed (parallel)
                    await Promise.all(deletedBoundaryIds.current.map((id) => deleteBoundaryMutation.mutateAsync(id)));

                    // upsert remaining (parallel)
                    const ops = gradeBoundaries.map((b) => {
                      const payload = { grade: b.grade, min: Number(b.min), max: Number(b.max), school_id: null, class_id: null };
                      if (b.id) return updateBoundaryMutation.mutateAsync({ id: Number(b.id), payload });
                      return createBoundaryMutation.mutateAsync(payload);
                    });
                    await Promise.all(ops);

                    // ensure fresh data
                    await qc.invalidateQueries({ queryKey: ['gradeBoundaries'] });

                    addAuditLog({
                      actionType: 'Edit',
                      module: 'Grades',
                      itemName: 'Grade Boundaries Matrix',
                      reason: 'Updated or defined grade boundaries'
                    });

                    showToast('Grade boundaries saved');
                    setShowBoundariesDialog(false);
                  } catch (e: any) {
                    console.error('Save boundaries error', e);
                    const msg = (e && (e.response?.data?.message || e.message)) || 'Failed to save boundaries';
                    showToast(msg);
                  } finally {
                    setSavingBoundaries(false);
                  }
                }} disabled={savingBoundaries}>{savingBoundaries ? 'Saving...' : 'Save Settings'}</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default GradesModule;