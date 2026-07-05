import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, detailDialogContentClass, detailDialogHeaderClass, detailDialogBodyClass, detailDialogFooterClass } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  BookOpen, Plus, Eye, ArrowRight, Trophy, Printer,
  ChevronDown, ChevronRight, Trash2, PencilLine, Save,
  X, Clock, UserCheck, History, Send, EyeOff, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDisplayDate, formatDisplayDateTime } from '../../utils/dateFormat';
import { downloadTermReportCardPdf } from '../reports/buildTermReportCardPdf';
import { buildReportCardPrintHtml, openReportCardPrintWindow } from '../reports/buildReportCardPrintHtml';
import {
  type TermReport,
  type TermReportStudent,
  parseTeacherRemarkDetails,
  derivePromotedToState,
  deriveReopeningDateState,
  resolveAttendanceForStudent,
  normalizeTeacherRemarks,
  listIncompleteReportFieldsForStudent,
} from '../reports/termReportTypes';
import SignaturePad from '@/components/common/SignaturePad';
import StaffReportCardViewport from '@/components/reports/StaffReportCardViewport';
import PasswordConfirmDialog from '@/components/common/PasswordConfirmDialog';
import type { SubjectClassGroupedByClass, TeacherSubjectClassesResponse } from '@/types/teacherSubjectClass';
import { calculateGrade, type AssessmentScore, type GradeConfig } from '@/utils/gradeCalculator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherClass { id: number; class_name: string; is_main?: boolean; }

interface Assignment {
  id: number;
  class_id: number;
  subject: string;
  subject_id?: number | null;
  name: string;
  assignment_type: string;
  max_score: number;
  max_marks?: number;
  is_exam?: boolean;
  component_id?: number | null;
  component_name?: string | null;
}

interface GradeRecord {
  id: number;
  student_id: number;
  assignment_id: number;
  score: number;
  first_name: string;
  last_name: string;
  admission_number: string;
  subject: string;
  assignment_type: string;
  max_score: number;
  graded_by_name: string | null;
  updated_at: string | null;
  created_at: string | null;
}

interface GradeRow {
  studentDbId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  score: number | null;
  gradedByName: string | null;
  updatedAt: string | null;
  hasMoved: boolean;
  currentClassName: string | null;
}

interface GradeHistoryItem {
  id: number;
  old_score: number | null;
  new_score: number;
  changed_by_name: string | null;
  changed_at: string;
}


// TermReport types imported from ../reports/termReportTypes

const EXAM_TYPE_VALUE = 'exam';
const EXAM_DUPLICATE_MESSAGE = 'An End of Term Exam already exists for this subject this term';

const ASSESSMENT_TYPES = ['Test', 'Exam', 'Quiz', 'Dictation', 'Exercise', 'Assignment', 'Project', 'Homework'];

const getLetterGrade = (pct: number) => {
  if (pct >= 80) return { letter: 'A', color: 'text-green-700 bg-green-50 border border-green-200' };
  if (pct >= 70) return { letter: 'B', color: 'text-blue-700 bg-blue-50 border border-blue-200' };
  if (pct >= 60) return { letter: 'C', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200' };
  if (pct >= 50) return { letter: 'D', color: 'text-orange-700 bg-orange-50 border border-orange-200' };
  return { letter: 'F', color: 'text-red-700 bg-red-50 border border-red-200' };
};

const positionSuffix = (n: number) =>
  n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

const getBECEGradeInfo = (score: number) => {
  if (score >= 80) return 1;
  if (score >= 70) return 2;
  if (score >= 60) return 3;
  if (score >= 45) return 4;
  if (score >= 40) return 5;
  if (score >= 35) return 6;
  if (score >= 30) return 7;
  if (score >= 25) return 8;
  return 9;
};

const getGhanaianGradeInfo = (score: number) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' };
  if (score >= 70) return { grade: 'B', remark: 'Very Good' };
  if (score >= 60) return { grade: 'C', remark: 'Good' };
  if (score >= 45) return { grade: 'D', remark: 'Credit' };
  if (score >= 35) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
};

const calculateBECE = (subjectScores: Record<string, { score: number }>) => {
  const cores = { english: 9, science: 9, maths: 9, social: 9 };
  const electives: number[] = [];

  Object.entries(subjectScores || {}).forEach(([subj, info]) => {
    const sName = subj.toLowerCase();
    const g = getBECEGradeInfo(info?.score || 0);
    if (sName.includes('english')) {
      cores.english = g;
    } else if (sName.includes('science')) {
      cores.science = g;
    } else if (sName.includes('math')) {
      cores.maths = g;
    } else if (sName.includes('social')) {
      cores.social = g;
    } else {
      electives.push(g);
    }
  });

  electives.sort((a, b) => a - b);
  const bestElectives = electives.slice(0, 2);
  while (bestElectives.length < 2) {
    bestElectives.push(9);
  }

  const coreSum = cores.english + cores.science + cores.maths + cores.social;
  const electiveSum = bestElectives.reduce((sum, val) => sum + val, 0);
  const aggregate = coreSum + electiveSum;

  return { cores, bestElectives, aggregate };
};

const relativeTime = (isoString: string | null): string => {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDisplayDate(isoString);
};

function groupAssignmentsByComponent(
  items: Assignment[],
  components: Array<{ id: number; name: string }>
): Array<{ header: string; items: Assignment[] }> {
  const groups: Array<{ header: string; order: number; items: Assignment[] }> = [];
  const byKey = new Map<string, Assignment[]>();

  for (const a of items) {
    const key = a.is_exam ? '__exam__' : String(a.component_id ?? '__other__');
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }

  components.forEach((c, idx) => {
    const list = byKey.get(String(c.id));
    if (list?.length) groups.push({ header: c.name, order: idx, items: list });
  });

  const other = byKey.get('__other__');
  if (other?.length) groups.push({ header: 'Other', order: 998, items: other });

  const exam = byKey.get('__exam__');
  if (exam?.length) groups.push({ header: 'End of Term Exam', order: 999, items: exam });

  return groups.sort((a, b) => a.order - b.order).map(({ header, items: groupItems }) => ({
    header,
    items: groupItems,
  }));
}

const resolvePhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (/^https?:\/\//i.test(photoUrl) || photoUrl.startsWith('data:')) return photoUrl;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${origin}${normalized}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

const GradesModule = ({ schoolWideReadOnly = false }: { schoolWideReadOnly?: boolean }) => {
  const { schoolId, school } = useSchool();
  const { students, classes, subjects: globalSubjects } = useData();
  const { user } = useAuth();
  const isHeadmasterGradesMode = user?.role === 'headmaster' && schoolWideReadOnly;
  const isHeadmasterUser = user?.role === 'headmaster';
  const isSchoolAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
  const isAdminViewer =
    (schoolWideReadOnly && !isHeadmasterGradesMode) ||
    user?.role === 'administrator' ||
    user?.role === 'super-admin';
  const canEditHeadmasterRemarks = isHeadmasterUser && !isAdminViewer;
  const seesAllClasses = isAdminViewer || isHeadmasterGradesMode;
  const printRef = useRef<HTMLDivElement>(null);
  const reportCardRef = useRef<HTMLDivElement>(null);

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [subjectClassesByClass, setSubjectClassesByClass] = useState<SubjectClassGroupedByClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Bulk-edit state
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkScores, setBulkScores] = useState<Record<number, string>>({}); // studentDbId → score string
  const [bulkSaving, setBulkSaving] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addAssessmentTypeError, setAddAssessmentTypeError] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    subject: '', subjectCustom: '', name: '', assessmentType: '', maxScore: '100',
  });
  const [gradeConfig, setGradeConfig] = useState<{
    components: Array<{ id: number; name: string; weightInClassScore: number }>;
    gradeConfig: { classScoreWeight: number; examWeight: number };
    boundaries: Array<{ gradeLabel: string; minPercent: number; maxPercent: number; remark: string }>;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'grades' | 'report'>('grades');
  const [termReport, setTermReport] = useState<TermReport | null>(null);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<number | null>(null);
  const [teacherRemarkDraft, setTeacherRemarkDraft] = useState('');
  const [headmasterRemarkDraft, setHeadmasterRemarkDraft] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [remarksHydratedStudentId, setRemarksHydratedStudentId] = useState<number | null>(null);
  const [remarksDirty, setRemarksDirty] = useState(false);
  const markRemarksDirty = useCallback(() => setRemarksDirty(true), []);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const pendingNavActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState<Assignment | null>(null);
  const [deleteAssignmentLoading, setDeleteAssignmentLoading] = useState(false);

  const deleteTargetGradeCount = useMemo(() => {
    if (!deleteAssignmentTarget) return 0;
    return grades.filter(
      (g) => g.assignment_id === deleteAssignmentTarget.id && g.score != null
    ).length;
  }, [deleteAssignmentTarget, grades]);

  const [sigPadType, setSigPadType] = useState<'teacher' | 'head'>('teacher');
  const [isSigPadOpen, setIsSigPadOpen] = useState(false);
  const [classTeacherSig, setClassTeacherSig] = useState('');
  const [headTeacherSig, setHeadTeacherSig] = useState('');
  const [sigLoaded, setSigLoaded] = useState(false);

  const isMainClassTeacherForClass = useMemo(() => {
    if (isHeadmasterGradesMode || isAdminViewer) return false;
    if (termReport?.isMainClassTeacherForUser != null) return !!termReport.isMainClassTeacherForUser;
    const row = teacherClasses.find((c) => String(c.id) === selectedClassId);
    return !!row?.is_main;
  }, [
    isHeadmasterGradesMode,
    isAdminViewer,
    termReport?.isMainClassTeacherForUser,
    teacherClasses,
    selectedClassId,
  ]);
  const canEditClassTeacherReport =
    !isAdminViewer && !isHeadmasterGradesMode && isMainClassTeacherForClass;
  const canAdminControlRelease = isSchoolAdmin && seesAllClasses;
  const canReleaseToParents =
    canEditClassTeacherReport || isHeadmasterGradesMode || canAdminControlRelease;
  const canDrawHeadmasterSignature = isHeadmasterGradesMode && !isAdminViewer;

  // Load signatures from DB on mount
  useEffect(() => {
    if (sigLoaded) return;
    const load = async () => {
      try {
        if (user?.teacherId) {
          const tRes = await apiService.get<{ signature?: string | null }>(`/teachers/${user.teacherId}/signature`);
          if (tRes?.signature) {
            if (user?.role !== 'headmaster' || !schoolWideReadOnly) {
              setClassTeacherSig(tRes.signature);
            }
          }
        }
        if (user?.role === 'headmaster' && user?.teacherId) {
          const hmRes = await apiService.get<{ signature?: string | null }>(`/teachers/${user.teacherId}/signature`);
          if (hmRes?.signature) setHeadTeacherSig(hmRes.signature);
        } else {
          const sRes = await apiService.get<{ signatureImage?: string | null }>('/settings/appointment-letter');
          if (sRes?.signatureImage) setHeadTeacherSig(sRes.signatureImage);
        }
      } catch {
        // fall back to localStorage if API fails
        if (localStorage.getItem('class_teacher_sig')) setClassTeacherSig(localStorage.getItem('class_teacher_sig') || '');
        if (localStorage.getItem('head_teacher_sig')) setHeadTeacherSig(localStorage.getItem('head_teacher_sig') || '');
      } finally {
        setSigLoaded(true);
      }
    };
    void load();
  }, [user?.teacherId, user?.role, schoolWideReadOnly]);

  // Refresh headmaster signature when opening report cards (e.g. after saving in Settings)
  useEffect(() => {
    if (activeTab !== 'report' || user?.role !== 'headmaster' || !user?.teacherId) return;
    void apiService
      .get<{ signature?: string | null }>(`/teachers/${user.teacherId}/signature`)
      .then((res) => {
        if (res?.signature) setHeadTeacherSig(res.signature);
      })
      .catch(() => {});
  }, [activeTab, user?.role, user?.teacherId]);

  // Grade history dropdown — key is `${studentId}-${assignmentId}`
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [historyCache, setHistoryCache] = useState<Record<string, GradeHistoryItem[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  const allClassesAsTeacherClass = useMemo<TeacherClass[]>(() => {
    return classes.map(c => ({ id: Number(c.id), class_name: c.className }));
  }, [classes]);

  const subjectsForSelectedClass = useMemo(() => {
    if (seesAllClasses) return globalSubjects;
    const row = subjectClassesByClass.find((c) => String(c.class_id) === selectedClassId);
    const allowed = new Set((row?.subjects || []).map((s) => s.subject_name.toLowerCase()));
    if (!allowed.size) return [];
    return globalSubjects.filter((s) => allowed.has(s.name.toLowerCase()));
  }, [seesAllClasses, globalSubjects, subjectClassesByClass, selectedClassId]);

  const subjectsForAddAssessment = useMemo(() => {
    if (isSchoolAdmin || isHeadmasterUser) return globalSubjects;
    return subjectsForSelectedClass;
  }, [isSchoolAdmin, isHeadmasterUser, globalSubjects, subjectsForSelectedClass]);

  const openAddAssessment = useCallback(() => {
    setAddAssessmentTypeError('');
    setNewAssignment({
      subject: '',
      subjectCustom: '',
      name: '',
      assessmentType: '',
      maxScore: '100',
    });
    setIsAddOpen(true);
  }, []);

  useEffect(() => {
    void apiService
      .get<{
        components: Array<{ id: number; name: string; weightInClassScore: number }>;
        gradeConfig: { classScoreWeight: number; examWeight: number };
        boundaries: Array<{ gradeLabel: string; minPercent: number; maxPercent: number; remark: string }>;
      }>('/grade-config')
      .then((data) => setGradeConfig(data))
      .catch(() => setGradeConfig(null));
  }, [schoolId]);

  useEffect(() => {
    if (seesAllClasses) return;
    void apiService
      .get<TeacherSubjectClassesResponse>('/teachers/me/subject-classes')
      .then((d) => setSubjectClassesByClass(d.by_class || []))
      .catch(() => setSubjectClassesByClass([]));
  }, [seesAllClasses, schoolId]);

  useEffect(() => {
    if (seesAllClasses) {
      const applyList = (list: TeacherClass[]) => {
        setTeacherClasses(list);
        if (list.length && !selectedClassId) setSelectedClassId(String(list[0].id));
        setLoading(false);
      };
      if (allClassesAsTeacherClass.length > 0) {
        applyList(allClassesAsTeacherClass);
        return;
      }
      setLoading(true);
      void apiService
        .get<Array<{ id: number; class_name: string }>>('/classes')
        .then((rows) => {
          const list = Array.isArray(rows)
            ? rows.map((c) => ({ id: Number(c.id), class_name: c.class_name }))
            : [];
          applyList(list);
        })
        .catch(() => {
          setTeacherClasses([]);
          setLoading(false);
        });
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const list = await apiService.get<TeacherClass[]>('/teachers/me/classes');
        setTeacherClasses(Array.isArray(list) ? list : []);
        if (list?.length && !selectedClassId) setSelectedClassId(String(list[0].id));
      } catch { setTeacherClasses([]); }
      finally { setLoading(false); }
    };
    load();
  }, [schoolId, seesAllClasses, allClassesAsTeacherClass]);

  useEffect(() => {
    if (!selectedClassId) return;
    setSelectedAssignmentId('');
    setIsBulkEditing(false);
    setBulkScores({});
    loadAssignments();
    loadGrades();
  }, [selectedClassId]);

  // Exit bulk edit and clear history state when assignment changes
  useEffect(() => {
    setIsBulkEditing(false);
    setBulkScores({});
    setExpandedHistory(new Set());
    setHistoryCache({});
  }, [selectedAssignmentId]);

  const loadAssignments = useCallback(async () => {
    try {
      const list = await apiService.get<Assignment[]>(`/grades/assignments?classId=${selectedClassId}`);
      const sorted = Array.isArray(list) ? list : [];
      setAssignments(sorted);
      const subjects = [...new Set(sorted.map(a => a.subject))];
      setExpandedSubjects(new Set(subjects));
      if (subjects.length && !selectedAssignmentId) {
        setSelectedAssignmentId(String(sorted[0].id));
      }
    } catch { setAssignments([]); }
  }, [selectedClassId]);

  const loadGrades = useCallback(async () => {
    try {
      const list = await apiService.get<GradeRecord[]>(`/grades?classId=${selectedClassId}`);
      setGrades(Array.isArray(list) ? list : []);
    } catch { setGrades([]); }
  }, [selectedClassId]);

  // Students currently in this class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = teacherClasses.find(c => String(c.id) === selectedClassId);
    return students.filter(s =>
      cls && (s.classAssigned === cls.class_name || (s.classAssignedId && String(s.classAssignedId) === selectedClassId))
    );
  }, [selectedClassId, students, teacherClasses]);

  const assignmentsBySubject = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      if (!map[a.subject]) map[a.subject] = [];
      map[a.subject].push(a);
    }
    return map;
  }, [assignments]);

  const activeSubjects = useMemo(() => Object.keys(assignmentsBySubject).sort(), [assignmentsBySubject]);

  const gradedAssignmentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const g of grades) {
      if (g.score !== null && g.score !== undefined) ids.add(g.assignment_id);
    }
    return ids;
  }, [grades]);

  const canDeleteAssessment = useCallback(
    (assignmentId: number) => {
      if (isHeadmasterGradesMode) return false;
      if (gradedAssignmentIds.has(assignmentId)) return isSchoolAdmin;
      return !isAdminViewer || isSchoolAdmin;
    },
    [gradedAssignmentIds, isHeadmasterGradesMode, isSchoolAdmin, isAdminViewer]
  );

  // Build grade rows including moved students
  const gradeRows = useMemo<GradeRow[]>(() => {
    if (!selectedAssignmentId) return [];
    const assignmentGrades = grades.filter(g => g.assignment_id === parseInt(selectedAssignmentId, 10));
    const gradedIds = new Set(assignmentGrades.map(g => g.student_id));

    const graded: GradeRow[] = assignmentGrades.map(g => {
      const found = students.find(s => s.id === String(g.student_id));
      const isStillInClass = found
        ? (found.classAssignedId && String(found.classAssignedId) === selectedClassId) ||
        found.classAssigned === teacherClasses.find(c => String(c.id) === selectedClassId)?.class_name
        : false;
      return {
        studentDbId: g.student_id,
        firstName: g.first_name,
        lastName: g.last_name,
        admissionNumber: g.admission_number,
        score: g.score ?? null,
        gradedByName: g.graded_by_name ?? null,
        updatedAt: g.updated_at ?? g.created_at ?? null,
        hasMoved: !isStillInClass,
        currentClassName: found?.classAssigned || null,
      };
    });

    const ungraded: GradeRow[] = classStudents
      .filter(s => !gradedIds.has(parseInt(s.id, 10)))
      .map(s => ({
        studentDbId: parseInt(s.id, 10),
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.studentId,
        score: null,
        gradedByName: null,
        updatedAt: null,
        hasMoved: false,
        currentClassName: s.classAssigned,
      }));

    return [...graded, ...ungraded];
  }, [selectedAssignmentId, grades, classStudents, students, selectedClassId, teacherClasses]);

  const selectedAssignment = assignments.find(a => String(a.id) === selectedAssignmentId);
  const gradedCount = gradeRows.filter(r => r.score !== null).length;
  const movedCount = gradeRows.filter(r => r.hasMoved).length;

  const calcConfig = useMemo((): GradeConfig | null => {
    if (!gradeConfig) return null;
    return {
      classScoreWeight: gradeConfig.gradeConfig.classScoreWeight,
      examWeight: gradeConfig.gradeConfig.examWeight,
      components: gradeConfig.components.map((c) => ({
        id: c.id,
        name: c.name,
        weightInClassScore: c.weightInClassScore,
      })),
      boundaries: (gradeConfig.boundaries || []).map((b) => ({
        gradeLabel: b.gradeLabel,
        minPercent: b.minPercent,
        maxPercent: b.maxPercent,
        remark: b.remark,
      })),
    };
  }, [gradeConfig]);

  const studentPreviewPercent = useMemo(() => {
    const map = new Map<number, number>();
    if (!calcConfig || !selectedAssignment) return map;

    const subject = selectedAssignment.subject;
    const subjectAssignments = assignments.filter((a) => a.subject === subject);

    for (const row of gradeRows) {
      const assessmentScores: AssessmentScore[] = [];
      for (const a of subjectAssignments) {
        let rawScore: number | null = null;
        if (String(a.id) === selectedAssignmentId && isBulkEditing) {
          const val = bulkScores[row.studentDbId];
          if (val !== '' && val !== undefined) rawScore = parseFloat(val);
        } else if (String(a.id) === selectedAssignmentId) {
          rawScore = row.score;
        } else {
          const g = grades.find((gr) => gr.student_id === row.studentDbId && gr.assignment_id === a.id);
          rawScore = g?.score ?? null;
        }
        if (rawScore === null || Number.isNaN(rawScore)) continue;
        assessmentScores.push({
          assessmentId: a.id,
          componentId: a.is_exam ? null : a.component_id ?? null,
          isExam: !!a.is_exam,
          maxMarks: Number(a.max_marks ?? a.max_score) || 100,
          rawScore,
        });
      }
      if (assessmentScores.length > 0) {
        map.set(row.studentDbId, calculateGrade(assessmentScores, calcConfig).totalPercent);
      }
    }
    return map;
  }, [calcConfig, selectedAssignment, assignments, gradeRows, grades, selectedAssignmentId, isBulkEditing, bulkScores]);

  // ── Bulk edit ────────────────────────────────────────────────────────────────

  const enterBulkEdit = () => {
    const initial: Record<number, string> = {};
    gradeRows.forEach(r => { initial[r.studentDbId] = r.score !== null ? String(r.score) : ''; });
    setBulkScores(initial);
    setIsBulkEditing(true);
  };

  const cancelBulkEdit = () => {
    setIsBulkEditing(false);
    setBulkScores({});
  };

  const handleBulkSave = async () => {
    if (!selectedAssignmentId) return;
    const maxScore = Number(selectedAssignment?.max_marks ?? selectedAssignment?.max_score) || 100;

    // Validate
    for (const [sid, val] of Object.entries(bulkScores)) {
      if (val === '' || val === undefined) continue;
      const n = parseFloat(val);
      if (isNaN(n) || n < 0 || n > maxScore) {
        toast({ title: `Invalid score for a student — must be 0–${maxScore}`, variant: 'destructive' });
        return;
      }
    }

    const records = gradeRows
      .map(r => ({ studentId: r.studentDbId, assignmentId: parseInt(selectedAssignmentId, 10), score: bulkScores[r.studentDbId] ?? '' }))
      .filter(r => r.score !== '');

    if (records.length === 0) {
      toast({ title: 'No scores entered', variant: 'destructive' });
      return;
    }

    setBulkSaving(true);
    try {
      const result: any = await apiService.post('/grades/batch', { records });
      toast({ title: `Saved ${result.saved ?? records.length} grade(s)` });
      setIsBulkEditing(false);
      setBulkScores({});
      await loadGrades();
    } catch (e: any) {
      toast({ title: 'Error saving grades', description: e?.message, variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Assignment management ────────────────────────────────────────────────────

  const handleAddAssignment = async () => {
    const subjectName = newAssignment.subject === '__custom__'
      ? newAssignment.subjectCustom.trim()
      : newAssignment.subject.trim();
    if (!subjectName || !newAssignment.name.trim()) {
      toast({ title: 'Subject and name are required', variant: 'destructive' });
      return;
    }
    if (!newAssignment.assessmentType) {
      toast({ title: 'Select a type', variant: 'destructive' });
      return;
    }
    const isExam = newAssignment.assessmentType === EXAM_TYPE_VALUE;
    const maxScore = parseFloat(newAssignment.maxScore);
    if (isNaN(maxScore) || maxScore <= 0) {
      toast({ title: 'Max marks must be a positive number', variant: 'destructive' });
      return;
    }
    const subjectRow = globalSubjects.find((s) => s.name === subjectName);
    const subjectId = subjectRow?.id;
    if (!subjectId) {
      toast({
        title: 'Use a configured subject',
        description: 'Pick a subject from the list (not custom) so it links to the grade system.',
        variant: 'destructive',
      });
      return;
    }
    setAddAssessmentTypeError('');
    try {
      await apiService.post('/assessments', {
        classId: parseInt(selectedClassId, 10),
        subjectId,
        name: newAssignment.name.trim(),
        isExam,
        componentId: isExam ? null : parseInt(newAssignment.assessmentType, 10),
        maxMarks: maxScore,
      });
      toast({ title: `Assessment added under ${subjectName}` });
      setNewAssignment({ subject: '', subjectCustom: '', name: '', assessmentType: '', maxScore: '100' });
      setAddAssessmentTypeError('');
      setIsAddOpen(false);
      await loadAssignments();
      await loadGrades();
    } catch (e: any) {
      const message = String(e?.message || '');
      const isExamConflict =
        e?.status === 409 ||
        message.toLowerCase().includes('end of term exam') ||
        message.toLowerCase().includes('end-of-term exam');
      if (isExamConflict) {
        setAddAssessmentTypeError(EXAM_DUPLICATE_MESSAGE);
      } else {
        toast({ title: 'Error', description: message || 'Failed to add assessment', variant: 'destructive' });
      }
    }
  };

  const handleDeleteAssignment = async (password?: string) => {
    if (!deleteAssignmentTarget) return;
    const isGraded = gradedAssignmentIds.has(deleteAssignmentTarget.id);
    if (isGraded && !isSchoolAdmin) {
      toast({
        title: 'Cannot delete',
        description: 'Only school administrators can delete assessments that already have grades.',
        variant: 'destructive',
      });
      setDeleteAssignmentTarget(null);
      return;
    }
    setDeleteAssignmentLoading(true);
    try {
      if (isGraded) {
        await apiService.delete(`/grades/assignments/${deleteAssignmentTarget.id}`, {
          password: password ?? '',
        });
      } else {
        await apiService.delete(`/grades/assignments/${deleteAssignmentTarget.id}`);
      }
      toast({
        title: isGraded ? 'Graded assessment deleted' : 'Assessment deleted',
        description: isGraded ? 'All recorded grades for this assessment were removed.' : undefined,
      });
      if (selectedAssignmentId === String(deleteAssignmentTarget.id)) setSelectedAssignmentId('');
      setDeleteAssignmentTarget(null);
      await loadAssignments();
      await loadGrades();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setDeleteAssignmentLoading(false);
    }
  };

  // ── Grade history dropdown ────────────────────────────────────────────────────

  const toggleHistory = async (studentDbId: number) => {
    if (!selectedAssignmentId) return;
    const key = `${studentDbId}-${selectedAssignmentId}`;

    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

    // Fetch only once per key
    if (historyCache[key] !== undefined) return;

    setHistoryLoading(prev => new Set(prev).add(key));
    try {
      const rows = await apiService.get<GradeHistoryItem[]>(
        `/grades/history?studentId=${studentDbId}&assignmentId=${selectedAssignmentId}`
      );
      setHistoryCache(prev => ({ ...prev, [key]: Array.isArray(rows) ? rows : [] }));
    } catch {
      setHistoryCache(prev => ({ ...prev, [key]: [] }));
    } finally {
      setHistoryLoading(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  // Ghanaian basic school report sheet fields
  const [conductDraft, setConductDraft] = useState('');
  const [attitudeDraft, setAttitudeDraft] = useState('');
  const [interestDraft, setInterestDraft] = useState('');
  const [attendanceDraft, setAttendanceDraft] = useState('');
  const [attendanceOutOfDraft, setAttendanceOutOfDraft] = useState('');
  const [promotedToDraft, setPromotedToDraft] = useState('');
  const [classPromotedTo, setClassPromotedTo] = useState('');
  const [promotedOverrides, setPromotedOverrides] = useState<Record<number, string>>({});
  const [classReopeningDate, setClassReopeningDate] = useState('');
  const [reopeningDateDraft, setReopeningDateDraft] = useState('');
  const [applyPromotedLoading, setApplyPromotedLoading] = useState(false);
  const reopeningApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reopeningApplyStatus, setReopeningApplyStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const buildArchiveSignaturesPayload = useCallback(() => ({
    classTeacherSig: classTeacherSig || null,
    headTeacherSig: headTeacherSig || null,
    headmasterTitle: termReport?.headmasterTitle || 'Headmaster',
    headmasterName: termReport?.headmasterName || null,
  }), [classTeacherSig, headTeacherSig, termReport?.headmasterTitle, termReport?.headmasterName]);

  const syncSignaturesToRecords = useCallback(async (signatures: ReturnType<typeof buildArchiveSignaturesPayload>) => {
    if (!selectedClassId || !termReport) return;
    await apiService.post('/grades/sync-report-signatures', {
      classId: Number(selectedClassId),
      signatures,
    });
  }, [selectedClassId, termReport]);

  const saveSignature = (dataUrl: string) => {
    if (sigPadType === 'teacher' && !canEditClassTeacherReport) {
      toast({ title: 'Not allowed', description: 'Only the main class teacher can sign the report card.', variant: 'destructive' });
      return;
    }
    if (sigPadType === 'head' && !canDrawHeadmasterSignature) {
      toast({ title: 'Not allowed', description: 'Only the headmaster can sign here.', variant: 'destructive' });
      return;
    }
    if (sigPadType === 'teacher') {
        setClassTeacherSig(dataUrl);
        if (user?.teacherId) {
          apiService.put(`/teachers/${user.teacherId}/signature`, { signature: dataUrl }).catch(() => {});
        }
      } else {
        setHeadTeacherSig(dataUrl);
        if (user?.role === 'headmaster' && user?.teacherId) {
          apiService.put(`/teachers/${user.teacherId}/signature`, { signature: dataUrl }).catch(() => {});
        } else {
          apiService.put('/settings/appointment-letter', { signatureImage: dataUrl }).catch(() => {});
        }
      }
      setIsSigPadOpen(false);
      toast({ title: 'Signature saved' });
      const signatures = {
        classTeacherSig: sigPadType === 'teacher' ? dataUrl : classTeacherSig || null,
        headTeacherSig: sigPadType === 'head' ? dataUrl : headTeacherSig || null,
        headmasterTitle: termReport?.headmasterTitle || 'Headmaster',
        headmasterName: termReport?.headmasterName || null,
      };
      void syncSignaturesToRecords(signatures).catch(() => {});
  };

  const getPromotedToForStudent = useCallback((studentId: number) => {
    return promotedOverrides[studentId] ?? classPromotedTo;
  }, [promotedOverrides, classPromotedTo]);

  const applyStudentReportFields = useCallback((
    studentId: number,
    report: TermReport,
    promotedState?: { classPromotedTo: string; promotedOverrides: Record<number, string> }
  ) => {
    const rawRemark = report.teacherRemarks?.[studentId] || '';
    const parsed = parseTeacherRemarkDetails(rawRemark);
    const attendance = resolveAttendanceForStudent(studentId, parsed, report);
    const classDefault = promotedState?.classPromotedTo ?? classPromotedTo;
    const overrides = promotedState?.promotedOverrides ?? promotedOverrides;

    setTeacherRemarkDraft(parsed.text);
    setConductDraft(parsed.conduct);
    setAttitudeDraft(parsed.attitude);
    setInterestDraft(parsed.interest);
    setAttendanceDraft(attendance.attendance);
    setAttendanceOutOfDraft(attendance.attendanceOutOf);
    setPromotedToDraft(overrides[studentId] ?? (classDefault || parsed.promotedTo));
    setReopeningDateDraft(classReopeningDate || parsed.reopeningDate);
    setHeadmasterRemarkDraft(report.headmasterRemarks?.[studentId] || '');
    setRemarksHydratedStudentId(studentId);
    setRemarksDirty(false);
  }, [classPromotedTo, promotedOverrides, classReopeningDate]);

  const applyReopeningDateToAll = useCallback(async (date: string) => {
    if (!selectedClassId || !termReport || !canEditClassTeacherReport) return;
    const trimmed = date.trim();
    if (!trimmed) return;

    setReopeningApplyStatus('saving');
    try {
      const updatedRemarks: Record<number, string> = {
        ...normalizeTeacherRemarks(termReport.teacherRemarks),
      };
      const signatures = buildArchiveSignaturesPayload();
      let changed = 0;

      for (const s of termReport.students) {
        const existing = parseTeacherRemarkDetails(updatedRemarks[s.studentId] || '');
        if (existing.reopeningDate === trimmed) continue;
        const isCurrent = s.studentId === selectedReportStudentId;
        const att = resolveAttendanceForStudent(s.studentId, existing, termReport);
        const serialized = JSON.stringify({
          text: isCurrent ? teacherRemarkDraft : existing.text,
          conduct: isCurrent ? conductDraft : existing.conduct,
          attitude: isCurrent ? attitudeDraft : existing.attitude,
          interest: isCurrent ? interestDraft : existing.interest,
          attendance: isCurrent ? attendanceDraft : (existing.attendance || att.attendance),
          attendanceOutOf: isCurrent ? attendanceOutOfDraft : (existing.attendanceOutOf || att.attendanceOutOf),
          promotedTo: isCurrent
            ? (promotedToDraft.trim() || promotedOverrides[s.studentId] || classPromotedTo || existing.promotedTo)
            : (promotedOverrides[s.studentId] || classPromotedTo || existing.promotedTo),
          reopeningDate: trimmed,
        });
        await apiService.post('/grades/term-report-remarks', {
          classId: Number(selectedClassId),
          studentId: s.studentId,
          teacherRemark: serialized,
          signatures,
        });
        updatedRemarks[s.studentId] = serialized;
        changed += 1;
      }

      if (changed > 0) {
        const nextReport: TermReport = { ...termReport, teacherRemarks: updatedRemarks };
        setClassReopeningDate(trimmed);
        setTermReport(nextReport);
        setRemarksDirty(false);
        setAutoSaveStatus('saved');
      }
      setReopeningApplyStatus('saved');
      window.setTimeout(() => setReopeningApplyStatus('idle'), 2000);
    } catch {
      setReopeningApplyStatus('idle');
    }
  }, [
    selectedClassId,
    termReport,
    canEditClassTeacherReport,
    selectedReportStudentId,
    teacherRemarkDraft,
    conductDraft,
    attitudeDraft,
    interestDraft,
    attendanceDraft,
    attendanceOutOfDraft,
    promotedToDraft,
    promotedOverrides,
    classPromotedTo,
    buildArchiveSignaturesPayload,
  ]);

  const handleReopeningDateChange = useCallback((value: string) => {
    setReopeningDateDraft(value);
    setClassReopeningDate(value);
    markRemarksDirty();
    if (reopeningApplyTimerRef.current) clearTimeout(reopeningApplyTimerRef.current);
    if (!value.trim() || !canEditClassTeacherReport) return;
    reopeningApplyTimerRef.current = setTimeout(() => {
      void applyReopeningDateToAll(value);
    }, 700);
  }, [applyReopeningDateToAll, canEditClassTeacherReport, markRemarksDirty]);

  useEffect(() => {
    return () => {
      if (reopeningApplyTimerRef.current) clearTimeout(reopeningApplyTimerRef.current);
    };
  }, []);

  const mergeFreshRemarksForStudent = useCallback(async (studentId: number, report: TermReport): Promise<TermReport> => {
    if (!selectedClassId) return report;
    try {
      const fresh = await apiService.get<{ teacherRemark?: string; headmasterRemark?: string }>(
        `/grades/term-report-remarks?classId=${selectedClassId}&studentId=${studentId}`
      );
      return {
        ...report,
        teacherRemarks: {
          ...normalizeTeacherRemarks(report.teacherRemarks),
          [studentId]:
            fresh.teacherRemark !== undefined && fresh.teacherRemark !== null
              ? fresh.teacherRemark
              : (report.teacherRemarks?.[studentId] ?? ''),
        },
        headmasterRemarks: {
          ...(report.headmasterRemarks || {}),
          [studentId]:
            fresh.headmasterRemark !== undefined && fresh.headmasterRemark !== null
              ? fresh.headmasterRemark
              : (report.headmasterRemarks?.[studentId] ?? ''),
        },
      };
    } catch {
      return report;
    }
  }, [selectedClassId]);

  const handlePromotedToChange = (value: string) => {
    markRemarksDirty();
    setPromotedToDraft(value);
    if (!selectedReportStudentId) return;
    if (promotedOverrides[selectedReportStudentId] !== undefined) {
      if (classPromotedTo && value.trim() === classPromotedTo) {
        setPromotedOverrides((prev) => {
          const next = { ...prev };
          delete next[selectedReportStudentId];
          return next;
        });
      } else {
        setPromotedOverrides((prev) => ({ ...prev, [selectedReportStudentId]: value }));
      }
    } else if (!classPromotedTo) {
      setClassPromotedTo(value);
    } else if (value !== classPromotedTo) {
      setPromotedOverrides((prev) => ({ ...prev, [selectedReportStudentId]: value }));
    }
  };

  const handleApplyPromotedToAll = useCallback(async () => {
    if (!selectedClassId || !termReport || isAdminViewer || isHeadmasterGradesMode) return;
    const newDefault = promotedToDraft.trim();
    if (!newDefault) {
      toast({ title: 'Enter a class name', description: 'Type the promoted-to class before applying.', variant: 'destructive' });
      return;
    }

    const keptOverrides: Record<number, string> = {};
    for (const [id, val] of Object.entries(promotedOverrides)) {
      const trimmed = String(val).trim();
      if (trimmed && trimmed !== newDefault) {
        keptOverrides[Number(id)] = trimmed;
      }
    }

    setApplyPromotedLoading(true);
    try {
      const studentsToUpdate = termReport.students.filter((s) => keptOverrides[s.studentId] === undefined);
      const updatedRemarks: Record<number, string> = {
        ...normalizeTeacherRemarks(termReport.teacherRemarks),
      };
      const signatures = buildArchiveSignaturesPayload();

      for (const s of studentsToUpdate) {
        const existing = parseTeacherRemarkDetails(updatedRemarks[s.studentId] || '');
        const att = resolveAttendanceForStudent(s.studentId, existing, termReport);
        const isCurrent = s.studentId === selectedReportStudentId;
        const serialized = JSON.stringify({
          text: isCurrent ? teacherRemarkDraft : existing.text,
          conduct: isCurrent ? conductDraft : existing.conduct,
          attitude: isCurrent ? attitudeDraft : existing.attitude,
          interest: isCurrent ? interestDraft : existing.interest,
          attendance: isCurrent ? attendanceDraft : (existing.attendance || att.attendance),
          attendanceOutOf: isCurrent ? attendanceOutOfDraft : (existing.attendanceOutOf || att.attendanceOutOf),
          promotedTo: newDefault,
          reopeningDate: isCurrent ? reopeningDateDraft : (classReopeningDate || existing.reopeningDate),
        });
        await apiService.post('/grades/term-report-remarks', {
          classId: Number(selectedClassId),
          studentId: s.studentId,
          teacherRemark: serialized,
          signatures,
        });
        updatedRemarks[s.studentId] = serialized;
      }

      const nextReport: TermReport = { ...termReport, teacherRemarks: updatedRemarks };
      const studentIds = nextReport.students.map((st) => st.studentId);
      const promotedState = derivePromotedToState(nextReport.teacherRemarks || {}, studentIds);

      setClassPromotedTo(newDefault);
      setPromotedOverrides(keptOverrides);
      setTermReport(nextReport);

      if (selectedReportStudentId) {
        applyStudentReportFields(selectedReportStudentId, nextReport, {
          classPromotedTo: newDefault,
          promotedOverrides: keptOverrides,
        });
      }

      setRemarksDirty(false);
      setAutoSaveStatus('saved');
      toast({
        title: 'Applied to all students',
        description:
          keptOverrides && Object.keys(keptOverrides).length > 0
            ? `Promoted to "${newDefault}" for the class. Custom entries were kept.`
            : `Promoted to "${newDefault}" for every student in this class.`,
      });
    } catch (e: any) {
      toast({ title: 'Could not apply to all', description: e?.message, variant: 'destructive' });
    } finally {
      setApplyPromotedLoading(false);
    }
  }, [
    selectedClassId, termReport, isAdminViewer, isHeadmasterGradesMode, promotedToDraft, promotedOverrides,
    teacherRemarkDraft, conductDraft, attitudeDraft, interestDraft, attendanceDraft, attendanceOutOfDraft,
    reopeningDateDraft, selectedReportStudentId, buildArchiveSignaturesPayload, applyStudentReportFields,
  ]);

  // ── Term report ──────────────────────────────────────────────────────────────

  const saveReportRemarksForStudent = useCallback(async (
    targetStudentId: number,
    options?: { silent?: boolean; skipBulk?: boolean }
  ): Promise<Record<number, string> | null> => {
    if (!selectedClassId || !termReport) return null;

    const resolvedPromotedTo =
      targetStudentId === selectedReportStudentId
        ? (promotedToDraft.trim() || promotedOverrides[targetStudentId] || classPromotedTo || '')
        : (promotedOverrides[targetStudentId] || classPromotedTo || '');

    const serializedTeacherRemark = JSON.stringify({
      text: targetStudentId === selectedReportStudentId ? teacherRemarkDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').text,
      conduct: targetStudentId === selectedReportStudentId ? conductDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').conduct,
      attitude: targetStudentId === selectedReportStudentId ? attitudeDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').attitude,
      interest: targetStudentId === selectedReportStudentId ? interestDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').interest,
      attendance: targetStudentId === selectedReportStudentId ? attendanceDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').attendance,
      attendanceOutOf: targetStudentId === selectedReportStudentId ? attendanceOutOfDraft : parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').attendanceOutOf,
      promotedTo: resolvedPromotedTo,
      reopeningDate: targetStudentId === selectedReportStudentId
        ? reopeningDateDraft
        : (classReopeningDate || parseTeacherRemarkDetails(termReport.teacherRemarks?.[targetStudentId] || '').reopeningDate),
    });

    const headmasterValue =
      targetStudentId === selectedReportStudentId
        ? headmasterRemarkDraft
        : (termReport.headmasterRemarks?.[targetStudentId] || '');

    if (isHeadmasterGradesMode) {
      if (!options?.silent) setRemarkSaving(true);
      try {
        const res = await apiService.post<{ headmasterRemark?: string; teacherRemark?: string }>('/grades/term-report-remarks', {
          classId: Number(selectedClassId),
          studentId: targetStudentId,
          headmasterRemark: headmasterValue,
          signatures: buildArchiveSignaturesPayload(),
        });
        const nextReport: TermReport = {
          ...termReport,
          headmasterRemarks: {
            ...(termReport.headmasterRemarks || {}),
            [targetStudentId]: res.headmasterRemark ?? headmasterValue,
          },
        };
        setTermReport(nextReport);
        if (targetStudentId === selectedReportStudentId) {
          const studentIds = nextReport.students.map((s) => s.studentId);
          const promotedState = derivePromotedToState(nextReport.teacherRemarks || {}, studentIds);
          applyStudentReportFields(targetStudentId, nextReport, promotedState);
        }
        setRemarksDirty(false);
        if (!options?.silent) toast({ title: 'Saved', description: 'Report card details saved.' });
        return normalizeTeacherRemarks(nextReport.teacherRemarks);
      } catch (e: any) {
        if (!options?.silent) {
          toast({ title: 'Error saving remarks', description: e?.message, variant: 'destructive' });
        } else {
          toast({ title: 'Auto-save failed', description: e?.message, variant: 'destructive' });
        }
        return null;
      } finally {
        if (!options?.silent) setRemarkSaving(false);
      }
    }

    if (isAdminViewer) return null;

    if (!options?.silent) setRemarkSaving(true);
    try {
      const saveBody: {
        classId: number;
        studentId: number;
        teacherRemark: string;
        headmasterRemark?: string;
        signatures: ReturnType<typeof buildArchiveSignaturesPayload>;
      } = {
        classId: Number(selectedClassId),
        studentId: targetStudentId,
        teacherRemark: serializedTeacherRemark,
        signatures: buildArchiveSignaturesPayload(),
      };
      if (isHeadmasterUser) {
        saveBody.headmasterRemark = headmasterValue;
      }

      const res = await apiService.post<{ teacherRemark?: string; headmasterRemark?: string }>(
        '/grades/term-report-remarks',
        saveBody
      );

      const updatedTeacherRemarks: Record<number, string> = {
        ...normalizeTeacherRemarks(termReport.teacherRemarks),
        [targetStudentId]: res.teacherRemark ?? serializedTeacherRemark,
      };

      if (!options?.skipBulk && promotedOverrides[targetStudentId] === undefined && classPromotedTo) {
        const bulkStudents = termReport.students.filter(
          (s) => s.studentId !== targetStudentId && promotedOverrides[s.studentId] === undefined
        );
        for (const s of bulkStudents) {
          const existing = parseTeacherRemarkDetails(updatedTeacherRemarks[s.studentId] || '');
          const att = resolveAttendanceForStudent(s.studentId, existing, termReport);
          const bulkRemark = JSON.stringify({
            ...existing,
            promotedTo: classPromotedTo,
            reopeningDate: classReopeningDate || existing.reopeningDate,
            attendance: existing.attendance || att.attendance,
            attendanceOutOf: existing.attendanceOutOf || att.attendanceOutOf,
          });
          await apiService.post('/grades/term-report-remarks', {
            classId: Number(selectedClassId),
            studentId: s.studentId,
            teacherRemark: bulkRemark,
            signatures: buildArchiveSignaturesPayload(),
          });
          updatedTeacherRemarks[s.studentId] = bulkRemark;
        }
      }

      const nextReport: TermReport = {
        ...termReport,
        teacherRemarks: updatedTeacherRemarks,
        ...(isHeadmasterUser
          ? {
              headmasterRemarks: {
                ...(termReport.headmasterRemarks || {}),
                [targetStudentId]: res.headmasterRemark ?? headmasterValue,
              },
            }
          : {}),
      };

      const studentIds = nextReport.students.map((s) => s.studentId);
      const promotedState = derivePromotedToState(nextReport.teacherRemarks || {}, studentIds);
      setClassPromotedTo(promotedState.classPromotedTo);
      setPromotedOverrides(promotedState.promotedOverrides);
      setTermReport(nextReport);

      if (targetStudentId === selectedReportStudentId) {
        applyStudentReportFields(targetStudentId, nextReport, promotedState);
      }

      setRemarksDirty(false);
      if (!options?.silent) {
        toast({ title: 'Saved', description: 'Report card details saved.' });
      }
      return normalizeTeacherRemarks(nextReport.teacherRemarks);
    } catch (e: any) {
      if (!options?.silent) {
        toast({ title: 'Error saving remarks', description: e?.message, variant: 'destructive' });
      } else {
        toast({ title: 'Auto-save failed', description: e?.message, variant: 'destructive' });
      }
      return null;
    } finally {
      if (!options?.silent) setRemarkSaving(false);
    }
  }, [
    selectedClassId, termReport, isHeadmasterGradesMode, isHeadmasterUser, isAdminViewer,
    teacherRemarkDraft, conductDraft, attitudeDraft, interestDraft,
    attendanceDraft, attendanceOutOfDraft, classPromotedTo, promotedOverrides,
    reopeningDateDraft, headmasterRemarkDraft, promotedToDraft, selectedReportStudentId,
    classReopeningDate,
    mergeFreshRemarksForStudent, applyStudentReportFields, buildArchiveSignaturesPayload,
  ]);

  const saveAllStudentsRemarksBeforeRelease = useCallback(async () => {
    if (!selectedClassId || !termReport) return;
    if (selectedReportStudentId) {
      await saveReportRemarksForStudent(selectedReportStudentId, { silent: true, skipBulk: true });
    }
    if (isHeadmasterGradesMode || isAdminViewer) return;

    for (const s of termReport.students) {
      if (s.studentId === selectedReportStudentId) continue;
      const existing = parseTeacherRemarkDetails(termReport.teacherRemarks?.[s.studentId] || '');
      const promotedTo = promotedOverrides[s.studentId] ?? classPromotedTo ?? existing.promotedTo;
      const att = resolveAttendanceForStudent(s.studentId, existing, termReport);
      const serialized = JSON.stringify({
        text: existing.text,
        conduct: existing.conduct,
        attitude: existing.attitude,
        interest: existing.interest,
        attendance: existing.attendance || att.attendance,
        attendanceOutOf: existing.attendanceOutOf || att.attendanceOutOf,
        promotedTo,
        reopeningDate: classReopeningDate || existing.reopeningDate,
      });
      if (serialized === (termReport.teacherRemarks?.[s.studentId] || '')) continue;
      await apiService.post('/grades/term-report-remarks', {
        classId: Number(selectedClassId),
        studentId: s.studentId,
        teacherRemark: serialized,
        signatures: buildArchiveSignaturesPayload(),
      });
    }
  }, [
    selectedClassId, termReport, selectedReportStudentId, isHeadmasterGradesMode, isAdminViewer,
    saveReportRemarksForStudent, promotedOverrides, classPromotedTo, classReopeningDate, reopeningDateDraft, buildArchiveSignaturesPayload,
  ]);

  const flushPendingRemarksSave = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!selectedReportStudentId || !termReport || isAdminViewer || !remarksDirty) return true;
    setAutoSaveStatus('saving');
    const result = await saveReportRemarksForStudent(selectedReportStudentId, { silent: true, skipBulk: true });
    if (result !== null) {
      setAutoSaveStatus('saved');
      return true;
    }
    setAutoSaveStatus('error');
    return false;
  }, [selectedReportStudentId, termReport, isAdminViewer, remarksDirty, saveReportRemarksForStudent]);

  const runWithUnsavedGuard = useCallback((action: () => void | Promise<void>) => {
    if (activeTab !== 'report' || isAdminViewer || !remarksDirty || !selectedReportStudentId) {
      void action();
      return;
    }
    pendingNavActionRef.current = action;
    setUnsavedDialogOpen(true);
  }, [activeTab, isAdminViewer, remarksDirty, selectedReportStudentId]);

  const handleUnsavedSaveAndContinue = async () => {
    const action = pendingNavActionRef.current;
    pendingNavActionRef.current = null;
    setUnsavedDialogOpen(false);
    const ok = await flushPendingRemarksSave();
    if (!ok) {
      toast({ title: 'Save failed', description: 'Your report card changes could not be saved.', variant: 'destructive' });
      return;
    }
    if (action) await action();
  };

  const handleUnsavedDiscard = async () => {
    const action = pendingNavActionRef.current;
    pendingNavActionRef.current = null;
    setUnsavedDialogOpen(false);
    setRemarksDirty(false);
    if (action) await action();
  };

  useEffect(() => {
    if (
      activeTab !== 'report' ||
      !selectedReportStudentId ||
      !termReport ||
      isAdminViewer ||
      !remarksDirty ||
      remarksHydratedStudentId !== selectedReportStudentId
    ) {
      return;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      void saveReportRemarksForStudent(selectedReportStudentId, { silent: true, skipBulk: true }).then((result) => {
        setAutoSaveStatus(result !== null ? 'saved' : 'error');
      });
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    activeTab, selectedReportStudentId, termReport, isAdminViewer, remarksDirty, remarksHydratedStudentId,
    teacherRemarkDraft, headmasterRemarkDraft, conductDraft, attitudeDraft, interestDraft,
    attendanceDraft, attendanceOutOfDraft, promotedToDraft, reopeningDateDraft,
    saveReportRemarksForStudent,
  ]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeTab !== 'report' || isAdminViewer || !remarksDirty || !selectedReportStudentId) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [activeTab, isAdminViewer, remarksDirty, selectedReportStudentId]);

  const handleClassChange = (classId: string) => {
    if (classId === selectedClassId) return;
    runWithUnsavedGuard(() => {
      setSelectedClassId(classId);
      setTermReport(null);
      setSelectedReportStudentId(null);
      setRemarksHydratedStudentId(null);
      setRemarksDirty(false);
      setAutoSaveStatus('idle');
      setActiveTab('grades');
    });
  };

  const loadReportInternal = async () => {
    setActiveTab('report');
    setReportLoading(true);
    try {
      const data = await apiService.get<TermReport>(`/grades/term-report?classId=${selectedClassId}`);
      data.teacherRemarks = normalizeTeacherRemarks(data.teacherRemarks);
      const firstStudentId = data.students?.[0]?.studentId ?? null;
      const studentIds = (data.students || []).map((s) => s.studentId);
      const promotedState = derivePromotedToState(data.teacherRemarks || {}, studentIds);
      const reopeningState = deriveReopeningDateState(data.teacherRemarks || {}, studentIds);
      setClassPromotedTo(promotedState.classPromotedTo);
      setPromotedOverrides(promotedState.promotedOverrides);
      setClassReopeningDate(reopeningState.classReopeningDate);
      const keepStudentId =
        selectedReportStudentId &&
        data.students.some((s) => s.studentId === selectedReportStudentId)
          ? selectedReportStudentId
          : firstStudentId;
      setSelectedReportStudentId(keepStudentId);
      let reportWithFresh = data;
      if (keepStudentId) {
        reportWithFresh = await mergeFreshRemarksForStudent(keepStudentId, data);
        applyStudentReportFields(keepStudentId, reportWithFresh, promotedState);
      } else {
        setTeacherRemarkDraft('');
        setHeadmasterRemarkDraft('');
        setRemarksHydratedStudentId(null);
        setRemarksDirty(false);
      }
      setTermReport(reportWithFresh);
      if (data.reportSignatures?.classTeacherSig) {
        setClassTeacherSig(data.reportSignatures.classTeacherSig);
      }
      if (data.reportSignatures?.headTeacherSig) {
        setHeadTeacherSig(data.reportSignatures.headTeacherSig);
      }
      setAutoSaveStatus('idle');
    } catch (e: any) {
      toast({ title: 'Failed to load report', description: e?.message, variant: 'destructive' });
    } finally { setReportLoading(false); }
  };

  const handleLoadReport = async () => {
    if (activeTab === 'report' && remarksDirty && selectedReportStudentId && !isAdminViewer) {
      const ok = await flushPendingRemarksSave();
      if (!ok) return;
    }
    await loadReportInternal();
  };

  const handleToggleRelease = () => {
    if (!selectedClassId || !termReport) return;
    if (termReport.isReleased) {
      setShowReleaseConfirm(true);
      return;
    }
    if (!termReport.isReleased && !releaseReadiness.ok && !canAdminControlRelease) {
      releaseAttentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    setShowReleaseConfirm(true);
  };

  const switchToReportStudent = async (studentId: number) => {
    setSelectedReportStudentId(studentId);
    setRemarksHydratedStudentId(null);
    if (!termReport) return;
    const studentIds = termReport.students.map((s) => s.studentId);
    const withFresh = await mergeFreshRemarksForStudent(studentId, termReport);
    const promotedState = derivePromotedToState(withFresh.teacherRemarks || {}, studentIds);
    const reopeningState = deriveReopeningDateState(withFresh.teacherRemarks || {}, studentIds);
    setClassPromotedTo(promotedState.classPromotedTo);
    setPromotedOverrides(promotedState.promotedOverrides);
    setClassReopeningDate(reopeningState.classReopeningDate);
    setTermReport(withFresh);
    applyStudentReportFields(studentId, withFresh, promotedState);
    setAutoSaveStatus('idle');
  };

  const handleSelectReportStudent = (studentId: number) => {
    if (studentId === selectedReportStudentId) return;
    runWithUnsavedGuard(() => switchToReportStudent(studentId));
  };

  const saveReportRemarks = async () => {
    if (!selectedReportStudentId) return;
    await saveReportRemarksForStudent(selectedReportStudentId, { skipBulk: true });
  };

  const downloadTermReportPdf = () => {
    if (!termReport || !selectedReportStudentId) return;
    const student = termReport.students.find((s) => s.studentId === selectedReportStudentId);
    if (!student) return;

    // Build performance rows from subject scores
    const performanceRows = (termReport.subjects || []).map((subj: string) => {
      const score = student.subjectScores?.[subj] || {};
      return {
        subject: subj,
        classScore: score.classScore ?? null,
        examScore: score.examScore ?? null,
        total: score.score ?? 0,
        max: score.maxScore ?? 100,
        percentage: score.score ?? 0,
        grade: score.gradeLabel || String(score.grade || ''),
        remark: score.remark || '',
      };
    });

    downloadTermReportCardPdf({
      schoolName: termReport.schoolName || '',
      className: termReport.className,
      currentTerm: termReport.currentTerm || '',
      currentYear: termReport.currentYear || '',
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      position: student.position,
      totalStudents: termReport.students.length,
      grandTotal: student.grandTotal,
      grandMax: student.grandMax,
      percentage: student.percentage,
      performanceRows,
      classScoreWeight: csWeight,
      examWeight: exWeight,
      gradeScale: termReport.gradeBoundaries?.map((b) => ({
        letter: b.gradeLabel,
        minPct: b.minPercent,
        maxPct: b.maxPercent,
        description: b.remark,
      })) || termReport.gradeScale || [],
      teacherRemark: termReport.teacherRemarks?.[selectedReportStudentId] || teacherRemarkDraft,
      headmasterRemark: termReport.headmasterRemarks?.[selectedReportStudentId] || headmasterRemarkDraft,
      headmasterName: termReport.headmasterName || undefined,
      headmasterTitle: termReport.headmasterTitle || undefined,
    });
  };

  const releaseReadiness = useMemo(() => {
    const signatureIssues: string[] = [];
    const studentsNeedingAttention: Array<{ studentId: number; name: string; missing: string[] }> = [];

    if (!termReport) {
      return { ok: false, signatureIssues, studentsNeedingAttention };
    }

    if (!classTeacherSig?.trim()) {
      signatureIssues.push('Class teacher signature');
    }
    if (!headTeacherSig?.trim()) {
      signatureIssues.push('Headmaster signature');
    }

    for (const s of termReport.students) {
      const teacherRaw = (() => {
        if (s.studentId === selectedReportStudentId && canEditClassTeacherReport) {
          return JSON.stringify({
            text: teacherRemarkDraft,
            conduct: conductDraft,
            attitude: attitudeDraft,
            interest: interestDraft,
            attendance: attendanceDraft,
            attendanceOutOf: attendanceOutOfDraft,
            promotedTo: promotedOverrides[s.studentId] ?? classPromotedTo ?? '',
            reopeningDate: reopeningDateDraft,
          });
        }
        const parsed = parseTeacherRemarkDetails(termReport.teacherRemarks?.[s.studentId] || '');
        return JSON.stringify({
          ...parsed,
          promotedTo: promotedOverrides[s.studentId] ?? classPromotedTo ?? parsed.promotedTo,
          reopeningDate: classReopeningDate || parsed.reopeningDate,
        });
      })();
      const headRaw =
        s.studentId === selectedReportStudentId && canEditHeadmasterRemarks
          ? headmasterRemarkDraft
          : (termReport.headmasterRemarks?.[s.studentId] || '');
      const missing = listIncompleteReportFieldsForStudent(teacherRaw, headRaw, s.studentId, termReport);
      if (missing.length > 0) {
        studentsNeedingAttention.push({
          studentId: s.studentId,
          name: `${s.firstName} ${s.lastName}`.trim(),
          missing,
        });
      }
    }

    const ok = signatureIssues.length === 0 && studentsNeedingAttention.length === 0;
    return { ok, signatureIssues, studentsNeedingAttention };
  }, [
    termReport,
    classTeacherSig,
    headTeacherSig,
    selectedReportStudentId,
    canEditClassTeacherReport,
    canEditHeadmasterRemarks,
    teacherRemarkDraft,
    conductDraft,
    attitudeDraft,
    interestDraft,
    attendanceDraft,
    attendanceOutOfDraft,
    reopeningDateDraft,
    headmasterRemarkDraft,
    promotedOverrides,
    classPromotedTo,
    classReopeningDate,
  ]);

  const releaseAttentionRef = useRef<HTMLDivElement>(null);

  const buildTeacherRemarkPayloadForStudent = useCallback((studentId: number) => {
    if (studentId === selectedReportStudentId && canEditClassTeacherReport) {
      return JSON.stringify({
        text: teacherRemarkDraft,
        conduct: conductDraft,
        attitude: attitudeDraft,
        interest: interestDraft,
        attendance: attendanceDraft,
        attendanceOutOf: attendanceOutOfDraft,
        promotedTo: getPromotedToForStudent(studentId),
        reopeningDate: reopeningDateDraft,
      });
    }
    return termReport?.teacherRemarks?.[studentId] || '';
  }, [
    selectedReportStudentId,
    canEditClassTeacherReport,
    teacherRemarkDraft,
    conductDraft,
    attitudeDraft,
    interestDraft,
    attendanceDraft,
    attendanceOutOfDraft,
    reopeningDateDraft,
    getPromotedToForStudent,
    termReport?.teacherRemarks,
  ]);

  const confirmToggleRelease = async () => {
    if (!selectedClassId || !termReport) return;
    const newState = !termReport.isReleased;
    if (newState && !releaseReadiness.ok && !canAdminControlRelease) {
      setShowReleaseConfirm(false);
      return;
    }
    setReleaseLoading(true);
    try {
      await saveAllStudentsRemarksBeforeRelease();
      await apiService.post('/grades/release-report', {
        classId: Number(selectedClassId),
        release: newState,
        signatures: {
          classTeacherSig: classTeacherSig || null,
          headTeacherSig: headTeacherSig || null,
          headmasterTitle: termReport.headmasterTitle || 'Headmaster',
          headmasterName: termReport.headmasterName || null,
        },
      });
      setTermReport(prev => prev ? { ...prev, isReleased: newState } : prev);
      toast({
        title: newState ? 'Report Released' : 'Report Hidden',
        description: newState
          ? 'Parents can now view this term report.'
          : 'Report hidden from parents. Your saved copy remains in Student Records.',
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: 'Could not update release',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReleaseLoading(false);
      setShowReleaseConfirm(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Term Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:4px 8px;text-align:center}
        th{background:#1e293b;color:#fff}
        tr:nth-child(even){background:#f8f9fa}
        .name-col{text-align:left}
        .pos-1{background:#fef9c3}.pos-2{background:#f1f5f9}.pos-3{background:#fff7ed}
        h2,p{text-align:center;margin:4px 0}
        .student-photo-print{display:none!important}
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const handlePrintReportCard = () => {
    if (!termReport || !selectedReportStudentId) return;
    const student = termReport.students.find((s) => s.studentId === selectedReportStudentId);
    if (!student) return;
    const sourceStudent = students.find((st) => Number(st.id) === Number(student.studentId));
    const photoUrl = sourceStudent?.passportPhotoUrl || (student as any).passportPhotoUrl || '';

    const html = buildReportCardPrintHtml({
      schoolName: school?.name || termReport.schoolName || '',
      schoolLogoUrl: school?.logo_url ? resolvePhotoUrl(school.logo_url) : undefined,
      className: termReport.className,
      currentTerm: termReport.currentTerm || '',
      currentYear: termReport.currentYear || '',
      student,
      studentPhotoUrl: photoUrl ? resolvePhotoUrl(photoUrl) : undefined,
      totalStudents: termReport.students.length,
      subjects: termReport.subjects,
      termReportStudents: termReport.students,
      classScoreWeight: csWeight,
      examWeight: exWeight,
      conduct: conductDraft,
      attitude: attitudeDraft,
      interest: interestDraft,
      attendance: attendanceDraft,
      attendanceOutOf: attendanceOutOfDraft,
      promotedTo: getPromotedToForStudent(selectedReportStudentId),
      reopeningDate: reopeningDateDraft,
      teacherRemark: teacherRemarkDraft,
      headmasterRemark: headmasterRemarkDraft,
      headmasterTitle: termReport.headmasterTitle || undefined,
      classTeacherSig: classTeacherSig || undefined,
      headTeacherSig: headTeacherSig || undefined,
    });
    openReportCardPrintWindow(html);
  };


  // ── Render ───────────────────────────────────────────────────────────────────

  const subjectsToDisplay = useMemo(() => {
    if (seesAllClasses) return activeSubjects;
    const allowed = new Set(subjectsForSelectedClass.map((s) => s.name.toLowerCase()));
    return activeSubjects.filter((subj) => allowed.has(subj.toLowerCase()));
  }, [seesAllClasses, activeSubjects, subjectsForSelectedClass]);

  const csWeight = termReport?.classScoreWeight ?? gradeConfig?.gradeConfig.classScoreWeight ?? 50;
  const exWeight = termReport?.examWeight ?? gradeConfig?.gradeConfig.examWeight ?? 50;

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 leading-tight">Grades</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              {isHeadmasterGradesMode
                ? 'Review term reports, add headmaster remarks, and sign report cards'
                : isAdminViewer
                  ? 'View grades (read-only)'
                  : 'Assessments and student grades'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
          {isAdminViewer && !isHeadmasterGradesMode ? (
            <Badge variant="secondary" className="justify-center py-2 flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200">
              <Eye className="w-3 h-3" /> Read Only
            </Badge>
          ) : isHeadmasterGradesMode ? (
            <Badge variant="secondary" className="justify-center py-2 flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200">
              <Trophy className="w-3 h-3" /> Headmaster review
            </Badge>
          ) : (
            <Button
              className="min-h-[48px] w-full sm:w-auto touch-manipulation hidden sm:inline-flex"
              variant="primaryAction"
              onClick={openAddAssessment}
              disabled={!selectedClassId}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Assessment
            </Button>
          )}
          {selectedClassId && (
            <Button variant="outline" className="min-h-[48px] w-full sm:w-auto touch-manipulation" onClick={handleLoadReport}>
              <Trophy className="w-4 h-4 mr-2" /> Term Report
            </Button>
          )}
        </div>
      </div>

      {/* Class selector */}
      <Card>
        <CardContent className="pt-4 px-4 sm:px-6">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={selectedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="h-12 min-h-[48px] text-base sm:text-sm rounded-xl"><SelectValue placeholder="Select a class" /></SelectTrigger>
              <SelectContent>
                {teacherClasses.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedClassId && (
        <>
          {/* Tabs */}
          <div className="flex gap-0 border-b -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto touch-pan-x">
            {[
              { key: 'grades', icon: BookOpen, label: 'Grade Entry' },
              { key: 'report', icon: Trophy, label: 'Term Report' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  if (tab.key === 'report') {
                    void handleLoadReport();
                    return;
                  }
                  runWithUnsavedGuard(() => setActiveTab('grades'));
                }}
                className={`flex items-center gap-1.5 px-4 min-h-[48px] shrink-0 text-sm font-medium border-b-2 transition-colors touch-manipulation ${activeTab === tab.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />{tab.label}
              </button>
            ))}
          </div>

          {!isAdminViewer && activeTab === 'grades' && (
            <div className="sm:hidden sticky top-0 z-20 -mx-4 px-4 py-2 border-b border-slate-200 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm grid grid-cols-2 gap-2">
              {!isBulkEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-sm font-semibold touch-manipulation border-2 border-purple-700 text-purple-900 bg-white hover:bg-purple-50 dark:border-purple-400 dark:text-purple-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={openAddAssessment}
                    disabled={!selectedClassId}
                  >
                    <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                    Add assessment
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-sm font-semibold touch-manipulation border-2 border-indigo-600 text-indigo-900 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-400 dark:text-indigo-100 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-50"
                    onClick={enterBulkEdit}
                    disabled={!selectedAssignmentId || gradeRows.length === 0}
                  >
                    <PencilLine className="w-4 h-4 mr-1.5 shrink-0" />
                    Edit all
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-sm font-semibold touch-manipulation border-2 border-slate-600 text-slate-900 bg-white hover:bg-slate-50 dark:border-slate-400 dark:text-slate-100 dark:bg-slate-900"
                    onClick={cancelBulkEdit}
                    disabled={bulkSaving}
                  >
                    <X className="w-4 h-4 mr-1.5 shrink-0" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primaryAction"
                    className="h-12 text-sm font-semibold touch-manipulation"
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                  >
                    <Save className="w-4 h-4 mr-1.5 shrink-0 text-white" />
                    {bulkSaving ? 'Saving…' : 'Save grades'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── GRADE ENTRY TAB ── */}
          {activeTab === 'grades' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Subjects sidebar */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-widest">Subjects & Assessments</h3>
                {subjectsToDisplay.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-gray-500 text-sm">
                      No assessments yet.{!isAdminViewer && <><br />Click <strong>Add Assessment</strong> above.</>}
                    </CardContent>
                  </Card>
                ) : (
                  subjectsToDisplay.map(subj => (
                    <Card key={subj} className="overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedSubjects(prev => {
                          const next = new Set(prev);
                          next.has(subj) ? next.delete(subj) : next.add(subj);
                          return next;
                        })}
                      >
                        <span className="font-semibold text-gray-800 text-sm">{subj}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{assignmentsBySubject[subj]?.length}</Badge>
                          {expandedSubjects.has(subj) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>
                      {expandedSubjects.has(subj) && (
                        <div className="divide-y">
                          {groupAssignmentsByComponent(
                            assignmentsBySubject[subj] || [],
                            gradeConfig?.components || []
                          ).map((group) => (
                            <div key={group.header}>
                              <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                {group.header}
                              </div>
                              {group.items.map((a) => (
                                <div
                                  key={a.id}
                                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-purple-50 transition-colors ${selectedAssignmentId === String(a.id) ? 'bg-purple-100 border-l-2 border-purple-500' : ''
                                    }`}
                                  onClick={() => setSelectedAssignmentId(String(a.id))}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {a.max_marks ?? a.max_score} marks max
                                    </p>
                                  </div>
                                  {canDeleteAssessment(a.id) && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setDeleteAssignmentTarget(a); }}
                                      className={`ml-2 shrink-0 transition-colors ${
                                        gradedAssignmentIds.has(a.id)
                                          ? 'text-red-300 hover:text-red-600'
                                          : 'text-gray-300 hover:text-red-500'
                                      }`}
                                      title={
                                        gradedAssignmentIds.has(a.id)
                                          ? 'Delete graded assessment (admin)'
                                          : 'Delete assessment'
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Right: Grade entry panel */}
              <div className="lg:col-span-2">
                {!selectedAssignmentId ? (
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center justify-center h-48 text-gray-400">
                      <BookOpen className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">Select an assessment on the left to enter grades</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-base font-semibold">{selectedAssignment?.name}</p>
                          <p className="text-sm font-normal text-gray-500">
                            {selectedAssignment?.subject} ·{' '}
                            {selectedAssignment?.is_exam
                              ? 'End of Term Exam'
                              : selectedAssignment?.component_name || selectedAssignment?.assignment_type}{' '}
                            · Max:{' '}
                            <strong>{selectedAssignment?.max_marks ?? selectedAssignment?.max_score} marks</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-normal text-gray-500">{gradedCount}/{gradeRows.length} graded</span>
                          {movedCount > 0 && (
                            <Badge variant="secondary" className="text-xs text-amber-700 bg-amber-50 border border-amber-200">
                              {movedCount} moved
                            </Badge>
                          )}
                          {/* Desktop / tablet: bulk controls (mobile uses sticky bar to avoid duplicate Save) */}
                          {!isAdminViewer && !isBulkEditing && (
                            <Button size="sm" variant="outline" onClick={enterBulkEdit} className="gap-1.5 hidden sm:inline-flex border-purple-300 text-purple-900 dark:text-purple-100">
                              <PencilLine className="w-3.5 h-3.5" /> Edit All
                            </Button>
                          )}
                          {!isAdminViewer && isBulkEditing && (
                            <div className="hidden sm:flex gap-2">
                              <Button size="sm" variant="outline" onClick={cancelBulkEdit} className="gap-1.5 border-slate-400 text-slate-900 dark:text-slate-100">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </Button>
                              <Button size="sm" variant="primaryAction" onClick={handleBulkSave} disabled={bulkSaving} className="gap-1.5">
                                <Save className="w-3.5 h-3.5" />
                                {bulkSaving ? 'Saving…' : 'Save All'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardTitle>

                      {isBulkEditing && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
                          <PencilLine className="w-3.5 h-3.5 shrink-0" />
                          Enter scores for all students, then click <strong className="mx-1">Save All</strong> to save at once.
                          Leave blank to skip a student.
                        </div>
                      )}
                    </CardHeader>

                    <CardContent>
                      {gradeRows.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No students found for this class</div>
                      ) : (
                        <div className="space-y-2">
                          {gradeRows.length > 0 && (
                            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              <span>Student</span>
                              <span className="text-center w-28">Score</span>
                              <span className="text-center w-20">Current %</span>
                            </div>
                          )}
                          {gradeRows.map((row, idx) => {
                            const maxScore = Number(selectedAssignment?.max_marks ?? selectedAssignment?.max_score) || 100;
                            const score = isBulkEditing
                              ? (bulkScores[row.studentDbId] !== '' && bulkScores[row.studentDbId] !== undefined
                                ? parseFloat(bulkScores[row.studentDbId])
                                : null)
                              : row.score;
                            const pct = score !== null && !isNaN(score) ? Math.round((score / maxScore) * 100) : null;
                            const grade = pct !== null ? getLetterGrade(pct) : null;
                            const histKey = `${row.studentDbId}-${selectedAssignmentId}`;
                            const isHistOpen = expandedHistory.has(histKey);
                            const histItems = historyCache[histKey];
                            const histFetching = historyLoading.has(histKey);
                            const previewPct = studentPreviewPercent.get(row.studentDbId);
                            const bulkVal = bulkScores[row.studentDbId] ?? '';
                            const bulkNum = bulkVal !== '' ? parseFloat(bulkVal) : null;
                            const bulkInvalid =
                              isBulkEditing &&
                              bulkVal !== '' &&
                              (bulkNum === null || Number.isNaN(bulkNum) || bulkNum < 0 || bulkNum > maxScore);

                            return (
                              <div key={row.studentDbId} className="border rounded-lg overflow-hidden">
                                {/* ── Main row ── */}
                                <div
                                  className={`flex items-center gap-3 p-3 transition-colors ${row.hasMoved
                                      ? 'bg-amber-50'
                                      : isBulkEditing
                                        ? 'bg-slate-50'
                                        : 'bg-white'
                                    }`}
                                >
                                  {/* Rank */}
                                  <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-right">{idx + 1}</span>

                                  {/* Student info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-gray-900 text-sm">
                                        {row.firstName} {row.lastName}
                                      </p>
                                      {row.hasMoved && row.currentClassName && (
                                        <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                                          <ArrowRight className="w-3 h-3" />{row.currentClassName}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400">ID: {row.admissionNumber}</p>

                                    {/* Audit log — last editor */}
                                    {!isBulkEditing && row.gradedByName && row.updatedAt && (
                                      <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                        <UserCheck className="w-3 h-3 text-purple-400" />
                                        <span className="text-purple-600 font-medium">{row.gradedByName}</span>
                                        <Clock className="w-3 h-3 ml-1 text-gray-300" />
                                        {relativeTime(row.updatedAt)}
                                      </p>
                                    )}
                                  </div>

                                  {/* Score display / bulk input */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isBulkEditing ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          className={`w-20 h-8 text-sm text-center bulk-score-input ${bulkInvalid ? 'border-red-500 ring-1 ring-red-300' : ''}`}
                                          placeholder="0"
                                          value={bulkVal}
                                          title={bulkInvalid ? `Score must be between 0 and ${maxScore}` : undefined}
                                          onChange={e => setBulkScores(prev => ({ ...prev, [row.studentDbId]: e.target.value }))}
                                          min={0}
                                          max={maxScore}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              const inputs = document.querySelectorAll<HTMLInputElement>('.bulk-score-input');
                                              const current = Array.from(inputs).findIndex(el => el === e.currentTarget);
                                              inputs[current + 1]?.focus();
                                            }
                                          }}
                                        />
                                        <span className="text-xs text-gray-400">/ {maxScore}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-mono text-sm text-gray-700">
                                          {row.score !== null
                                            ? <><strong>{row.score}</strong><span className="text-gray-400"> / {maxScore}</span></>
                                            : <span className="text-gray-300">— / {maxScore}</span>}
                                        </span>
                                        {grade && (
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${grade.color}`}>
                                            {grade.letter}
                                          </span>
                                        )}
                                        {pct !== null && (
                                          <span className="text-xs text-gray-400">{pct}%</span>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {/* Live preview — subject total so far */}
                                  {previewPct != null && (
                                    <div
                                      className="shrink-0 text-center w-20 hidden sm:block"
                                      title="Preview based on scores entered so far for this subject — not final until all assessments are graded"
                                    >
                                      <span className="text-[10px] text-gray-400 block leading-none">Current %</span>
                                      <span className="text-sm font-bold text-purple-700">{previewPct.toFixed(1)}</span>
                                    </div>
                                  )}

                                  {/* History toggle button */}
                                  {!isBulkEditing && (
                                    <button
                                      onClick={() => toggleHistory(row.studentDbId)}
                                      title="Show grade change history"
                                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isHistOpen
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                        }`}
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      {isHistOpen
                                        ? <ChevronDown className="w-3 h-3" />
                                        : <ChevronRight className="w-3 h-3" />}
                                    </button>
                                  )}
                                </div>

                                {/* ── History panel ── */}
                                {isHistOpen && (
                                  <div className="border-t bg-slate-50 px-4 py-3">
                                    {histFetching ? (
                                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 animate-spin" /> Loading history…
                                      </p>
                                    ) : !histItems || histItems.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic">No change history recorded yet.</p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                          <History className="w-3 h-3" /> Grade History ({histItems.length} change{histItems.length !== 1 ? 's' : ''})
                                        </p>
                                        {histItems.map((h, hi) => {
                                          const isFirst = hi === histItems.length - 1;
                                          const scoreUp = h.old_score !== null && h.new_score > h.old_score;
                                          const scoreDown = h.old_score !== null && h.new_score < h.old_score;
                                          return (
                                            <div key={h.id} className="flex items-start gap-2">
                                              {/* Timeline dot */}
                                              <div className="flex flex-col items-center shrink-0">
                                                <div className={`w-2 h-2 rounded-full mt-1 ${hi === 0 ? 'bg-purple-500' : 'bg-gray-300'}`} />
                                                {!isFirst && <div className="w-px h-4 bg-gray-200" />}
                                              </div>
                                              <div className="flex-1 pb-1">
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                  {/* Who */}
                                                  <span className="font-semibold text-gray-700">
                                                    {h.changed_by_name ?? 'Unknown'}
                                                  </span>
                                                  {/* Change arrow */}
                                                  {h.old_score !== null ? (
                                                    <span className="flex items-center gap-1 text-gray-500">
                                                      changed
                                                      <span className="font-mono text-gray-600 bg-gray-100 px-1 rounded">{h.old_score}</span>
                                                      <ArrowRight className="w-3 h-3 text-gray-400" />
                                                      <span className={`font-mono font-bold px-1 rounded ${scoreUp ? 'text-green-700 bg-green-50' : scoreDown ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-100'}`}>
                                                        {h.new_score}
                                                      </span>
                                                      <span className="text-gray-400">/{maxScore}</span>
                                                    </span>
                                                  ) : (
                                                    <span className="flex items-center gap-1 text-gray-500">
                                                      set score to
                                                      <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1 rounded">{h.new_score}</span>
                                                      <span className="text-gray-400">/{maxScore}</span>
                                                    </span>
                                                  )}
                                                  {/* When */}
                                                  <span className="text-gray-400 ml-auto">
                                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                                    {relativeTime(h.changed_at)}
                                                  </span>
                                                </div>
                                                {hi === 0 && (
                                                  <span className="text-[10px] text-purple-500 font-medium">latest</span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ── TERM REPORT TAB ── */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              {reportLoading ? (
                <Card><CardContent className="py-12 text-center text-gray-500">Generating report…</CardContent></Card>
              ) : !termReport || termReport.students.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No grades recorded yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Add assessments and grade students to generate the report.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <span>Term Report — {termReport.className}</span>
                        {termReport.currentTerm && (
                          <span className="text-xs font-normal text-gray-500">
                            {termReport.currentTerm} {termReport.currentYear}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Release status badge */}
                        {termReport.isReleased ? (
                          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Released to Parents
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                            <EyeOff className="w-3.5 h-3.5" />
                            Not Released
                          </div>
                        )}
                        {/* Toggle release (teachers + headmaster; hidden for read-only admins) */}
                        {canReleaseToParents && (
                          <Button
                            size="sm"
                            variant={
                              termReport.isReleased
                                ? 'outline'
                                : (releaseReadiness.ok || canAdminControlRelease)
                                  ? 'default'
                                  : 'secondary'
                            }
                            onClick={handleToggleRelease}
                            disabled={
                              releaseLoading ||
                              (!termReport.isReleased && !releaseReadiness.ok && !canAdminControlRelease)
                            }
                            className={
                              termReport.isReleased
                                ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
                                : (releaseReadiness.ok || canAdminControlRelease)
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200'
                            }
                          >
                            {termReport.isReleased
                              ? <><EyeOff className="w-3.5 h-3.5 mr-1.5" /> Hide from Parents</>
                              : (releaseReadiness.ok || canAdminControlRelease)
                                ? <><Send className="w-3.5 h-3.5 mr-1.5" /> Release to Parents</>
                                : <><AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Complete Reports First</>}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="w-4 h-4 mr-2" /> Print Class Table
                        </Button>
                      </div>
                    </CardTitle>
                    {termReport.isReleased && termReport.releasedByName && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Released by <strong className="ml-0.5">{termReport.releasedByName}</strong>
                        {termReport.releasedAt && (
                          <> · {formatDisplayDateTime(termReport.releasedAt)}</>
                        )}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 space-y-6">
                      {!canEditClassTeacherReport && !isHeadmasterGradesMode && !isAdminViewer && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Only the <strong>main class teacher</strong> can fill report details, sign, and release this report to parents.
                          Subject teachers can view grades but cannot edit the class report card.
                        </div>
                      )}
                      {canAdminControlRelease && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                          As <strong>school admin</strong>, you can release or hide this report for parents even if a teacher or headmaster already released or hid it.
                        </div>
                      )}
                      {canReleaseToParents && !termReport.isReleased && !releaseReadiness.ok && !canAdminControlRelease && (
                        <div
                          ref={releaseAttentionRef}
                          className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-50 p-4 sm:p-5 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                              <AlertTriangle className="h-5 w-5 text-amber-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold text-amber-950">
                                {releaseReadiness.studentsNeedingAttention.length > 0
                                  ? `${releaseReadiness.studentsNeedingAttention.length} student${releaseReadiness.studentsNeedingAttention.length === 1 ? '' : 's'} need attention before release`
                                  : 'Add signatures before release'}
                              </h3>
                              <p className="mt-1 text-xs text-amber-800/90">
                                Complete every field below for each student. Signatures must also be in place. Release stays disabled until everything is done.
                              </p>
                              {releaseReadiness.signatureIssues.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80">Missing signatures</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {releaseReadiness.signatureIssues.map((item) => (
                                      <span
                                        key={item}
                                        className="inline-flex items-center rounded-full border border-amber-200 bg-white/90 px-2.5 py-0.5 text-xs font-medium text-amber-950"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {releaseReadiness.studentsNeedingAttention.length > 0 && (
                                <ul className="mt-3 space-y-2 max-h-[min(42vh,300px)] overflow-y-auto pr-1">
                                  {releaseReadiness.studentsNeedingAttention.map((row) => (
                                    <li
                                      key={row.studentId}
                                      className="rounded-lg border border-amber-100/90 bg-white/95 p-3 shadow-sm"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => void switchToReportStudent(row.studentId)}
                                        className="text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                                      >
                                        {row.name}
                                      </button>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {row.missing.map((field) => (
                                          <span
                                            key={field}
                                            className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950"
                                          >
                                            {field}
                                          </span>
                                        ))}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {canReleaseToParents && !termReport.isReleased && releaseReadiness.ok && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>All students are ready — you can release to parents.</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3 items-end justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex-1 min-w-[200px]">
                          <Label className="text-sm text-slate-700 dark:text-slate-300 font-semibold mb-1.5 block">Select Student for Report Card</Label>
                          <Select value={String(selectedReportStudentId || '')} onValueChange={(value) => handleSelectReportStudent(Number(value))}>
                            <SelectTrigger className="bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 h-10">
                              <SelectValue placeholder="Choose student…" />
                            </SelectTrigger>
                            <SelectContent>
                              {termReport.students.map((student) => (
                                <SelectItem key={student.studentId} value={String(student.studentId)}>
                                  {student.firstName} {student.lastName} — {student.admissionNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={handlePrintReportCard} disabled={!selectedReportStudentId}>
                            <Printer className="w-4 h-4 mr-1.5" /> Print Report Card
                          </Button>
                          <Button size="sm" onClick={saveReportRemarks} disabled={!selectedReportStudentId || remarkSaving || (!canEditClassTeacherReport && !canEditHeadmasterRemarks)}>
                            <Save className="w-4 h-4 mr-1.5" /> {remarkSaving ? 'Saving...' : 'Save Report Details'}
                          </Button>
                          {autoSaveStatus === 'saving' ? (
                            <span className="text-xs text-slate-500">Auto-saving…</span>
                          ) : autoSaveStatus === 'saved' && !remarksDirty ? (
                            <span className="text-xs text-green-600">All changes saved</span>
                          ) : remarksDirty ? (
                            <span className="text-xs text-amber-600">Unsaved changes</span>
                          ) : null}
                        </div>
                      </div>

                      {selectedReportStudentId && (() => {
                        const student = termReport.students.find(s => s.studentId === selectedReportStudentId);
                        if (!student) return null;
                        const bece = calculateBECE(student.subjectScores);
                        const sourceStudent = students.find(st => Number(st.id) === Number(student.studentId));
                        const photoUrl = sourceStudent?.passportPhotoUrl || (student as any).passportPhotoUrl || '';
                        const showSubjectPositionColumn = termReport.subjects.some((subj) => {
                          const sScore = student.subjectScores[subj];
                          return sScore != null && sScore.score != null && !Number.isNaN(Number(sScore.score));
                        });

                        return (
                          <div
                            className="space-y-4 w-full max-w-full"
                            style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}
                          >
                            <StaffReportCardViewport layoutKey={selectedReportStudentId}>
                            <div 
                              id="admin-report-card"
                              ref={reportCardRef} 
                              className="report-wrapper bg-white text-slate-950 p-4 sm:p-6 md:p-8 border-2 border-black rounded shadow-lg max-w-4xl mx-auto space-y-4 [&_*]:box-border [&_img]:max-w-full"
                              style={{
                                fontFamily: "'Times New Roman', Times, serif",
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              {/* Header Layout */}
                              <table className="w-full border-collapse">
                                <tbody>
                                  <tr className="border-none">
                                    {/* School Logo */}
                                    <td className="w-20 align-middle border-none p-0">
                                      <div className="w-20 h-20 border-2 border-black inline-block overflow-hidden bg-slate-100">
                                        {school?.logo_url ? (
                                          <img 
                                            src={resolvePhotoUrl(school.logo_url)} 
                                            alt="School Logo"
                                            className="w-full h-full object-contain p-1"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">LOGO</div>
                                        )}
                                      </div>
                                    </td>
                                    
                                    {/* School Info */}
                                    <td className="text-center align-middle border-none px-4 p-0">
                                      <h1 className="text-2xl font-black uppercase tracking-normal m-0" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                                        {school?.name || termReport.schoolName || 'SIRBUS ROMAN CATHOLIC JHS'}
                                      </h1>
                                    </td>

                                    {/* Student Photo */}
                                    <td className="w-20 align-middle border-none text-right p-0">
                                      <div className="w-20 h-24 border-2 border-black inline-block overflow-hidden bg-slate-100">
                                        {photoUrl ? (
                                          <img 
                                            src={resolvePhotoUrl(photoUrl)} 
                                            alt={`${student.firstName} ${student.lastName}`}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">PHOTO</div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Title Box */}
                              <div className="border-2 border-black py-1 px-8 text-center font-bold tracking-widest text-base uppercase my-2 max-w-xs mx-auto">
                                TERMINAL REPORT SHEET
                              </div>

                              {/* Details Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 mb-4 text-xs">
                                <div className="flex items-center min-w-0">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">NAME:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{student.firstName} {student.lastName}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">BASIC:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{termReport.className}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">ACADEMIC YEAR:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{termReport.currentYear}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">TERM:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{termReport.currentTerm}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">POSITION:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{positionSuffix(student.position)}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">TOTAL MARKS:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{student.grandTotal}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">NO. ON ROLL:</span>
                                  <span className="flex-grow border-b border-black font-extrabold text-sm pl-2">{termReport.students.length}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center">
                                    <span className="font-bold uppercase min-w-[90px] sm:min-w-[130px] shrink-0">REOPENING DATE:</span>
                                    <input 
                                      type="text" 
                                      value={reopeningDateDraft} 
                                      onChange={(e) => handleReopeningDateChange(e.target.value)}
                                      readOnly={!canEditClassTeacherReport}
                                      placeholder="Enter reopening date"
                                      className="flex-grow border-b border-black font-extrabold text-sm pl-2 bg-transparent focus:outline-none uppercase border-none py-0 m-0 no-print"
                                    />
                                    <span className="hidden print:inline flex-grow border-b border-black font-extrabold text-sm pl-2 uppercase">{reopeningDateDraft || '—'}</span>
                                  </div>
                                  {canEditClassTeacherReport && (
                                    <p className="text-[10px] text-slate-500 pl-[90px] sm:pl-[130px] no-print">
                                      {reopeningApplyStatus === 'saving'
                                        ? 'Applying to all students…'
                                        : reopeningApplyStatus === 'saved'
                                          ? 'Applied to all students in this class'
                                          : 'Applies to all students in this class'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Subjects Table */}
                              <table className="staff-report-subjects-table w-full border-collapse mb-4 border-all">
                                <thead>
                                  <tr>
                                    <th className="col-subjects border-2 border-black bg-slate-50 font-bold uppercase">SUBJECTS</th>
                                    <th className="col-class-score border-2 border-black bg-slate-50 font-bold uppercase">Class Score<br/>{csWeight}%</th>
                                    <th className="col-exam-score border-2 border-black bg-slate-50 font-bold uppercase">Exams Score<br/>{exWeight}%</th>
                                    <th className="col-total-score border-2 border-black bg-slate-50 font-bold uppercase">Total Score<br/>100%</th>
                                    <th className="col-grade border-2 border-black bg-slate-50 font-bold uppercase">Grade</th>
                                    {showSubjectPositionColumn ? (
                                      <th className="col-position border-2 border-black bg-slate-50 font-bold uppercase">Position</th>
                                    ) : null}
                                    <th className="border-2 border-black bg-slate-50 font-bold uppercase">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {termReport.subjects.map(subj => {
                                    const sScore = student.subjectScores[subj];
                                    const gradeLabel = sScore?.gradeLabel || (sScore ? getGhanaianGradeInfo(sScore.score).grade : '');
                                    const remark = sScore?.remark || (sScore ? getGhanaianGradeInfo(sScore.score).remark : '—');
                                    const sortedList = [...termReport.students].sort((a,b) => (b.subjectScores[subj]?.score || 0) - (a.subjectScores[subj]?.score || 0));
                                    let subPos = 1;
                                    for (let i = 0; i < sortedList.length; i++) {
                                      if (sortedList[i].studentId === student.studentId) {
                                        break;
                                      }
                                      if (sortedList[i].subjectScores[subj]?.score > (sScore?.score || 0)) {
                                        subPos++;
                                      }
                                    }

                                    return (
                                      <tr key={subj}>
                                        <td className="col-subjects border-2 border-black font-bold uppercase">{subj}</td>
                                        <td className="col-class-score border-2 border-black font-bold">{sScore ? sScore.classScore?.toFixed(1) : '—'}</td>
                                        <td className="col-exam-score border-2 border-black font-bold">{sScore ? sScore.examScore?.toFixed(1) : '—'}</td>
                                        <td className="col-total-score border-2 border-black font-extrabold">{sScore ? sScore.score?.toFixed(1) : '—'}</td>
                                        <td className="col-grade border-2 border-black font-bold">{gradeLabel || '—'}</td>
                                        {showSubjectPositionColumn ? (
                                          <td className="col-position border-2 border-black font-bold">{sScore ? positionSuffix(subPos) : '—'}</td>
                                        ) : null}
                                        <td className="border-2 border-black font-bold uppercase text-left">{remark}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>

                              {/* Remarks Section */}
                              <div className="space-y-3 mb-4">
                                <div className="flex flex-wrap items-center gap-y-2 text-xs">
                                  <span className="font-bold uppercase min-w-[100px]">ATTENDANCE:</span>
                                  <input 
                                    type="text" 
                                    value={attendanceDraft} 
                                    onChange={(e) => { setAttendanceDraft(e.target.value); markRemarksDirty(); }}
                                    placeholder="Present days"
                                    className="border-b border-black font-bold pl-2 bg-transparent focus:outline-none w-16 no-print text-center"
                                  />
                                  <span className="hidden print:inline border-b border-black font-bold pl-2 w-16 text-center">{attendanceDraft || '—'}</span>

                                  <span className="font-bold uppercase mx-2">OUT OF:</span>
                                  <input 
                                    type="text" 
                                    value={attendanceOutOfDraft} 
                                    onChange={(e) => { setAttendanceOutOfDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditClassTeacherReport}
                                    placeholder="Total days"
                                    className="border-b border-black font-bold pl-2 bg-transparent focus:outline-none w-16 no-print text-center"
                                  />
                                  <span className="hidden print:inline border-b border-black font-bold pl-2 w-16 text-center">{attendanceOutOfDraft || '—'}</span>

                                  <span className="font-bold uppercase mx-2">PROMOTED TO:</span>
                                  <input 
                                    type="text" 
                                    value={promotedToDraft} 
                                    onChange={(e) => handlePromotedToChange(e.target.value)}
                                    placeholder="Next class name if promoted"
                                    readOnly={!canEditClassTeacherReport}
                                    className="flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print uppercase"
                                  />
                                  {canEditClassTeacherReport && promotedToDraft && (
                                    <button
                                      type="button"
                                      disabled={applyPromotedLoading}
                                      onClick={() => void handleApplyPromotedToAll()}
                                      className="no-print text-[9px] text-purple-600 hover:underline font-bold uppercase whitespace-nowrap disabled:opacity-50"
                                    >
                                      {applyPromotedLoading ? 'Applying…' : 'Apply to all'}
                                    </button>
                                  )}
                                  <span className="hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">
                                    {getPromotedToForStudent(selectedReportStudentId) || promotedToDraft || '—'}
                                  </span>
                                </div>

                                <div className="flex items-center text-xs">
                                  <span className="font-bold uppercase min-w-[100px]">CONDUCT:</span>
                                  <input 
                                    type="text" 
                                    value={conductDraft} 
                                    onChange={(e) => { setConductDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditClassTeacherReport}
                                    className="flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print uppercase"
                                  />
                                  <span className="hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">{conductDraft || '—'}</span>
                                </div>

                                <div className="flex items-center text-xs">
                                  <span className="font-bold uppercase min-w-[100px]">ATTITUDE:</span>
                                  <input 
                                    type="text" 
                                    value={attitudeDraft} 
                                    onChange={(e) => { setAttitudeDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditClassTeacherReport}
                                    className="flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print uppercase"
                                  />
                                  <span className="hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">{attitudeDraft || '—'}</span>
                                </div>

                                <div className="flex items-center text-xs">
                                  <span className="font-bold uppercase min-w-[100px]">INTEREST:</span>
                                  <input 
                                    type="text" 
                                    value={interestDraft} 
                                    onChange={(e) => { setInterestDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditClassTeacherReport}
                                    className="flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print uppercase"
                                  />
                                  <span className="hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">{interestDraft || '—'}</span>
                                </div>

                                <div className="flex items-start text-xs min-w-0">
                                  <span className="font-bold uppercase min-w-[180px] pt-1 shrink-0">CLASS TEACHER'S REMARKS:</span>
                                  <textarea
                                    value={teacherRemarkDraft} 
                                    onChange={(e) => { setTeacherRemarkDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditClassTeacherReport}
                                    rows={2}
                                    className="staff-report-remarks-field flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print resize-none uppercase min-w-0"
                                  />
                                  <span className="staff-report-remarks-field hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">{teacherRemarkDraft || '—'}</span>
                                </div>

                                <div className="flex items-start text-xs min-w-0">
                                  <span className="font-bold uppercase min-w-[180px] pt-1 shrink-0">HEADMASTER'S REMARKS:</span>
                                  <textarea
                                    value={headmasterRemarkDraft}
                                    onChange={(e) => { setHeadmasterRemarkDraft(e.target.value); markRemarksDirty(); }}
                                    readOnly={!canEditHeadmasterRemarks}
                                    rows={2}
                                    placeholder={canEditHeadmasterRemarks ? 'Enter headmaster remarks for this student…' : 'Headmaster remarks'}
                                    className="staff-report-remarks-field flex-grow border-b border-black font-bold pl-2 bg-transparent focus:outline-none no-print resize-none uppercase min-w-0"
                                  />
                                  <span className="staff-report-remarks-field hidden print:inline flex-grow border-b border-black font-bold pl-2 uppercase">{headmasterRemarkDraft || '—'}</span>
                                </div>
                              </div>

                              {/* Signatures Area */}
                              <div className="grid grid-cols-2 gap-12 mt-12 mb-4 text-center text-xs">
                                <div className="flex flex-col items-center justify-end min-h-[85px]">
                                  {classTeacherSig ? (
                                    <div className="relative group">
                                      <img src={classTeacherSig} alt="Teacher Signature" className="h-12 object-contain" />
                                      {canEditClassTeacherReport && (
                                      <button 
                                        onClick={() => { setClassTeacherSig(''); if (user?.teacherId) { apiService.put(`/teachers/${user.teacherId}/signature`, { signature: null }).catch(() => {}); } }}
                                        className="absolute -top-4 -right-4 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] no-print hover:bg-red-200"
                                      >
                                        ✕
                                      </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-12" />
                                  )}
                                  <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider">
                                    CLASS TEACHER'S SIGNATURE
                                  </div>
                                  {!isHeadmasterGradesMode && canEditClassTeacherReport && (
                                  <button 
                                    onClick={() => { setSigPadType('teacher'); setIsSigPadOpen(true); }}
                                    className="no-print mt-1 text-[9px] text-purple-600 hover:underline font-bold uppercase"
                                  >
                                    {classTeacherSig ? 'Redraw' : 'Draw Sign'}
                                  </button>
                                  )}
                                </div>
                                <div className="flex flex-col items-center justify-end min-h-[85px]">
                                  {headTeacherSig ? (
                                    <div className="relative group">
                                      <img src={headTeacherSig} alt="Head Teacher Signature" className="h-12 object-contain" />
                                      {canDrawHeadmasterSignature && (
                                      <button 
                                        onClick={() => {
                                          setHeadTeacherSig('');
                                          if (user?.role === 'headmaster' && user?.teacherId) {
                                            apiService.put(`/teachers/${user.teacherId}/signature`, { signature: null }).catch(() => {});
                                          } else {
                                            apiService.put('/settings/appointment-letter', { signatureImage: null }).catch(() => {});
                                          }
                                        }}
                                        className="absolute -top-4 -right-4 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] no-print hover:bg-red-200"
                                      >
                                        ✕
                                      </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-12" />
                                  )}
                                  <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider">
                                    {termReport.headmasterTitle || 'HEADMASTER'}'S SIGNATURE
                                  </div>
                                  {canDrawHeadmasterSignature && (
                                  <button 
                                    onClick={() => { setSigPadType('head'); setIsSigPadOpen(true); }}
                                    className="no-print mt-1 text-[9px] text-purple-600 hover:underline font-bold uppercase"
                                  >
                                    {headTeacherSig ? 'Redraw' : 'Draw Sign'}
                                  </button>
                                  )}
                                </div>
                              </div>

                              {/* Grading Scale Legend */}
                              <div className="border-t border-black pt-3 mb-3">
                                <p className="font-extrabold uppercase text-center text-[10px] tracking-wider mb-2">GRADING SCALE</p>
                                <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[9px] font-bold">
                                  <div>Grade A &nbsp; 80 - 100 &nbsp; <span className="italic text-slate-600">Excellent</span></div>
                                  <div>Grade B &nbsp; 70 - 79 &nbsp; <span className="italic text-slate-600">Very Good</span></div>
                                  <div>Grade C &nbsp; 60 - 69 &nbsp; <span className="italic text-slate-600">Good</span></div>
                                  <div>Grade D &nbsp; 45 - 59 &nbsp; <span className="italic text-slate-600">Credit</span></div>
                                  <div>Grade E &nbsp; 35 - 44 &nbsp; <span className="italic text-slate-600">Pass</span></div>
                                  <div>Grade F &nbsp; Below 35 &nbsp; <span className="italic text-slate-600">Fail</span></div>
                                </div>
                              </div>

                              {/* BECE AGGREGATE CALCULATION */}
                              <div className="border-t border-black pt-3">
                                <p className="font-extrabold uppercase text-center text-[10px] tracking-wider mb-2">BECE AGGREGATE CALCULATION</p>
                                <div className="grid grid-cols-2 gap-4 text-[10px]">
                                  <div>
                                    <p className="font-bold text-slate-800 underline mb-1">Core Subjects:</p>
                                    <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>English</span> <span>Grade {bece.cores.english}</span></div>
                                    <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>Science</span> <span>Grade {bece.cores.science}</span></div>
                                    <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>MATHS</span> <span>Grade {bece.cores.maths}</span></div>
                                    <div className="flex justify-between max-w-xs font-semibold mb-0.5"><span>Social</span> <span>Grade {bece.cores.social}</span></div>
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 underline mb-1">Best 2 Electives:</p>
                                    {bece.bestElectives.map((val, idx) => (
                                      <div key={idx} className="flex justify-between max-w-xs font-semibold mb-0.5">
                                        <span>Elective {idx + 1}</span> <span>Grade {val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-center font-extrabold uppercase text-xs mt-3 tracking-wide">
                                  AGGREGATE: <span className="text-sm text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded ml-1 font-mono">{bece.aggregate}</span>
                                </div>
                              </div>

                              <div className="footer-text mt-4 border-t border-slate-200 pt-2 text-[8px] text-center text-slate-500 uppercase tracking-widest">
                                Generated by ScholarNerve
                              </div>

                            </div>
                            </StaffReportCardViewport>
                          </div>
                        );
                      })()}
                    </div>
                    <div ref={printRef}>
                      <h2 style={{ textAlign: 'center' }}>Term Report — {termReport.className}</h2>
                      <p style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>
                        {termReport.subjects.length} subjects · {termReport.students.length} students
                      </p>

                      <div className="overflow-x-auto mt-4">
                        <table className="w-full text-sm border-collapse min-w-max">
                          <thead>
                            <tr className="bg-slate-800 text-white">
                              <th className="border border-slate-600 px-3 py-2 text-left sticky left-0 bg-slate-800 z-10 min-w-[180px]">
                                Student
                              </th>
                              {termReport.subjects.map(subj => (
                                <th key={subj} className="border border-slate-600 px-3 py-2 text-center min-w-[120px]">
                                  <div className="font-semibold text-xs leading-tight">{subj}</div>
                                  <div className="text-[10px] font-normal text-slate-300 mt-0.5">
                                    CS: {csWeight}% | EX: {exWeight}%
                                  </div>
                                </th>
                              ))}
                              <th className="border border-slate-600 px-3 py-2 text-center bg-slate-900 min-w-[90px]">
                                Total<div className="text-xs font-normal text-slate-300">/{termReport.students[0]?.grandMax}</div>
                              </th>
                              <th className="border border-slate-600 px-3 py-2 text-center bg-slate-900 w-14">%</th>
                              <th className="border border-slate-600 px-3 py-2 text-center bg-slate-900 w-14">Pos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {termReport.students.map((s, idx) => {
                              const pct = s.percentage;
                              const grade = getLetterGrade(pct);
                              const sourceStudent = students.find((st) => Number(st.id) === Number(s.studentId));
                              const photoUrl =
                                sourceStudent?.passportPhotoUrl || (s as any).passportPhotoUrl || (s as any).passport_photo_url || '';
                              const rowBg =
                                s.position === 1 ? 'bg-yellow-50' :
                                  s.position === 2 ? 'bg-slate-50' :
                                    s.position === 3 ? 'bg-orange-50' :
                                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                              return (
                                <tr key={s.studentId} className={rowBg}>
                                  <td className={`border border-gray-200 px-3 py-2 sticky left-0 z-10 ${rowBg}`}>
                                    <div className="flex items-center gap-2">
                                      {/* Passport photo */}
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0 text-white text-xs font-bold student-photo-print">
                                        {photoUrl
                                          ? <img src={resolvePhotoUrl(photoUrl)} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" loading="lazy" />
                                          : `${s.firstName[0]}${s.lastName[0]}`}
                                      </div>
                                      {s.position <= 3 && (
                                        <span>{s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : '🥉'}</span>
                                      )}
                                      <div>
                                        <p className="font-semibold text-sm">{s.firstName} {s.lastName}</p>
                                        <p className="text-xs text-gray-500">{s.admissionNumber}</p>
                                        {s.hasMoved && <span className="text-xs text-amber-600">(moved)</span>}
                                      </div>
                                    </div>
                                  </td>
                                  {termReport.subjects.map(subj => {
                                    const ss = s.subjectScores[subj];
                                    const gradeLabel = ss?.gradeLabel || ss?.grade;
                                    const totalPercent = ss?.score;
                                    const classScorePercent = ss?.classScore;
                                    const examPercent = ss?.examScore;
                                    return (
                                      <td key={subj} className="border border-gray-200 px-2 py-2 text-center align-middle">
                                        {ss ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <div className="text-base font-medium font-mono leading-tight">
                                              {totalPercent != null ? Number(totalPercent).toFixed(1) : '—'}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">
                                              CS: {classScorePercent != null ? Number(classScorePercent).toFixed(1) : '—'}
                                              {' '}| EX: {examPercent != null ? Number(examPercent).toFixed(1) : '—'}
                                            </div>
                                            {gradeLabel ? (
                                              <span className="inline-flex text-xs font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 mt-0.5">
                                                {gradeLabel}
                                              </span>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-base">{s.grandTotal}</td>
                                  <td className="border border-gray-200 px-3 py-2 text-center">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${grade.color}`}>{pct}%</span>
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 text-center font-bold text-purple-700">
                                    {positionSuffix(s.position)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Subject breakdown */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {termReport.subjects.map(subj => {
                          const sAssignments = termReport.assignmentsBySubject[subj] || [];
                          return (
                            <div key={subj} className="border rounded-lg p-3 bg-gray-50">
                              <p className="font-semibold text-gray-800 text-sm mb-1">{subj}</p>
                              {sAssignments.map(a => (
                                <div key={a.id} className="flex justify-between text-xs text-gray-600">
                                  <span>{a.name} <span className="text-gray-400">({a.assignment_type})</span></span>
                                  <span className="font-mono">{a.max_score} marks</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs font-bold text-gray-800 border-t mt-1 pt-1">
                                <span>Total</span>
                                <span>{sAssignments.reduce((s, a) => s + parseFloat(String(a.max_score)), 0)} marks</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Add Assessment Dialog ── */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setAddAssessmentTypeError('');
        }}
      >
        <DialogContent className={`${detailDialogContentClass} sm:max-w-md`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select
                value={newAssignment.subject}
                onValueChange={(v) => {
                  setAddAssessmentTypeError('');
                  setNewAssignment((p) => ({ ...p, subject: v }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose subject…" />
                </SelectTrigger>
                <SelectContent>
                  {subjectsForAddAssessment.length > 0 ? (
                    subjectsForAddAssessment.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-3 text-sm text-gray-500 text-center italic">
                      {isSchoolAdmin || isHeadmasterUser
                        ? 'No subjects defined in system'
                        : 'No subjects assigned for this class'}
                    </div>
                  )}
                  {(isSchoolAdmin || isHeadmasterUser) && (
                    <>
                      <div className="border-t my-1" />
                      <SelectItem value="__custom__">+ Other (type below)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {newAssignment.subject === '__custom__' && (
                <Input
                  placeholder="Enter subject name…"
                  value={newAssignment.subjectCustom}
                  onChange={(e) => setNewAssignment((p) => ({ ...p, subjectCustom: e.target.value }))}
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Assessment Name</Label>
              <Input
                placeholder="e.g. Mid-Term Test, End of Term Exam…"
                value={newAssignment.name}
                onChange={e => setNewAssignment(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Type</Label>
                <Select
                  value={newAssignment.assessmentType || undefined}
                  onValueChange={(v) => {
                    setAddAssessmentTypeError('');
                    setNewAssignment((p) => ({ ...p, assessmentType: v }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(gradeConfig?.components || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={EXAM_TYPE_VALUE}>End of Term Exam</SelectItem>
                  </SelectContent>
                </Select>
                {addAssessmentTypeError ? (
                  <p className="text-sm text-red-600 font-medium">{addAssessmentTypeError}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Max Marks</Label>
                <Input
                  type="number" min={1} step={0.5}
                  value={newAssignment.maxScore}
                  onChange={e => setNewAssignment(p => ({ ...p, maxScore: e.target.value }))}
                  placeholder="e.g. 20, 50, 100"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primaryAction"
              onClick={handleAddAssignment}
            >
              Add Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsavedDialogOpen} onOpenChange={(open) => { if (!open) { pendingNavActionRef.current = null; setUnsavedDialogOpen(false); } }}>
        <AlertDialogContent className="rounded-[1rem] border-t-4 border-amber-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Save report card changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for this student&apos;s report card. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => void handleUnsavedDiscard()}>
              Discard
            </Button>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleUnsavedSaveAndContinue(); }}>
              Save &amp; continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <AlertDialogContent className={`rounded-[1rem] border-t-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] ${
          termReport?.isReleased ? 'border-orange-500' : 'border-green-500'
        }`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {termReport?.isReleased ? <EyeOff className="w-5 h-5 text-orange-600" /> : <Send className="w-5 h-5 text-green-600" />}
              {termReport?.isReleased ? 'Hide Results from Parents?' : 'Release Results to Parents?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {termReport?.isReleased
                ? 'Parents will no longer see this report in their portal. Your saved report card stays in Student Records.'
                : canAdminControlRelease && !releaseReadiness.ok
                  ? 'Some report fields may still be incomplete. As school admin you can release anyway — parents will see the report in their portal.'
                  : 'Parents will be able to view this report in their portal.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releaseLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={releaseLoading}
              onClick={(e) => {
                e.preventDefault();
                void confirmToggleRelease();
              }}
              className={termReport?.isReleased
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-green-600 hover:bg-green-700'}
            >
              {releaseLoading
                ? 'Please wait...'
                : termReport?.isReleased
                  ? 'Yes, Hide Results'
                  : 'Yes, Release Results'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SignaturePad
        open={isSigPadOpen}
        onOpenChange={setIsSigPadOpen}
        onSave={saveSignature}
        title={sigPadType === 'teacher' ? 'Draw Class Teacher Signature' : 'Draw Head Teacher Signature'}
      />

      <AlertDialog
        open={!!deleteAssignmentTarget && !gradedAssignmentIds.has(deleteAssignmentTarget.id)}
        onOpenChange={(open) => { if (!open && !deleteAssignmentLoading) setDeleteAssignmentTarget(null); }}
      >
        <AlertDialogContent className="rounded-[1rem] border-t-4 border-red-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssignmentTarget
                ? `Are you sure you want to delete "${deleteAssignmentTarget.name}"? This cannot be undone.`
                : 'Are you sure you want to delete this assessment?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAssignmentLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAssignmentLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteAssignment();
              }}
            >
              {deleteAssignmentLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PasswordConfirmDialog
        open={
          !!deleteAssignmentTarget &&
          gradedAssignmentIds.has(deleteAssignmentTarget.id) &&
          isSchoolAdmin
        }
        onOpenChange={(open) => {
          if (!open && !deleteAssignmentLoading) setDeleteAssignmentTarget(null);
        }}
        destructive
        title="Delete graded assessment?"
        description={
          deleteAssignmentTarget
            ? `This will permanently delete "${deleteAssignmentTarget.name}" and remove all ${deleteTargetGradeCount} recorded grade(s). Enter your administrator password to confirm.`
            : 'Enter your password to confirm deletion.'
        }
        confirmLabel={deleteAssignmentLoading ? 'Deleting…' : 'Delete assessment'}
        onConfirmed={async (password) => {
          await handleDeleteAssignment(password);
        }}
      />

    </div>
  );
};

export default GradesModule;
