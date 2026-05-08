import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  BookOpen, Plus, Eye, ArrowRight, Trophy, Printer,
  ChevronDown, ChevronRight, Trash2, PencilLine, Save,
  X, Clock, UserCheck, History, Send, EyeOff, CheckCircle2,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeacherClass { id: number; class_name: string; }

interface Assignment {
  id: number;
  class_id: number;
  subject: string;
  name: string;
  assignment_type: string;
  max_score: number;
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

interface TermReportStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  hasMoved: boolean;
  subjectScores: Record<string, { score: number; maxScore: number }>;
  grandTotal: number;
  grandMax: number;
  percentage: number;
  position: number;
}

interface TermReport {
  students: TermReportStudent[];
  subjects: string[];
  assignments: Assignment[];
  assignmentsBySubject: Record<string, Assignment[]>;
  className: string;
  currentTerm?: string;
  currentYear?: string;
  schoolName?: string;
  isReleased?: boolean;
  releasedAt?: string | null;
  releasedByName?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ── Component ─────────────────────────────────────────────────────────────────

const GradesModule = () => {
  const { schoolId } = useSchool();
  const { students, classes, subjects: globalSubjects } = useData();
  const { user } = useAuth();
  const isAdminViewer = user?.role === 'administrator' || user?.role === 'super-admin';
  const printRef = useRef<HTMLDivElement>(null);

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
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
  const [newAssignment, setNewAssignment] = useState({
    subject: '', subjectCustom: '', name: '', assignmentType: 'Test', maxScore: '100',
  });

  const [activeTab, setActiveTab] = useState<'grades' | 'report'>('grades');
  const [termReport, setTermReport] = useState<TermReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

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

  useEffect(() => {
    if (isAdminViewer) {
      setTeacherClasses(allClassesAsTeacherClass);
      if (allClassesAsTeacherClass.length && !selectedClassId)
        setSelectedClassId(String(allClassesAsTeacherClass[0].id));
      setLoading(false);
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
  }, [schoolId, isAdminViewer, allClassesAsTeacherClass]);

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
    const maxScore = selectedAssignment?.max_score ?? 100;

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
    const subject = newAssignment.subject === '__custom__'
      ? newAssignment.subjectCustom.trim()
      : newAssignment.subject.trim();
    if (!subject || !newAssignment.name.trim()) {
      toast({ title: 'Subject and name are required', variant: 'destructive' });
      return;
    }
    const maxScore = parseFloat(newAssignment.maxScore);
    if (isNaN(maxScore) || maxScore <= 0) {
      toast({ title: 'Max marks must be a positive number', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post('/grades/assignments', {
        classId: parseInt(selectedClassId, 10),
        subject, name: newAssignment.name.trim(),
        assignmentType: newAssignment.assignmentType, maxScore,
      });
      toast({ title: `Assessment added under ${subject}` });
      setNewAssignment({ subject: '', subjectCustom: '', name: '', assignmentType: 'Test', maxScore: '100' });
      setIsAddOpen(false);
      await loadAssignments();
      await loadGrades();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Delete this assessment and all its grades?')) return;
    try {
      await (apiService as any).delete(`/grades/assignments/${id}`);
      toast({ title: 'Assessment deleted' });
      if (selectedAssignmentId === String(id)) setSelectedAssignmentId('');
      await loadAssignments();
      await loadGrades();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
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

  // ── Term report ──────────────────────────────────────────────────────────────

  const handleLoadReport = async () => {
    setActiveTab('report');
    setReportLoading(true);
    try {
      const data = await apiService.get<TermReport>(`/grades/term-report?classId=${selectedClassId}`);
      setTermReport(data);
    } catch (e: any) {
      toast({ title: 'Failed to load report', description: e?.message, variant: 'destructive' });
    } finally { setReportLoading(false); }
  };

  const handleToggleRelease = async () => {
    if (!selectedClassId || !termReport) return;
    setShowReleaseConfirm(true);
  };

  const confirmToggleRelease = async () => {
    if (!selectedClassId || !termReport) return;
    const newState = !termReport.isReleased;
    setReleaseLoading(true);
    try {
      await apiService.post('/grades/release-report', { classId: Number(selectedClassId), release: newState });
      setTermReport(prev => prev ? { ...prev, isReleased: newState } : prev);
      toast({
        title: newState ? 'Report Released' : 'Report Hidden',
        description: newState
          ? 'Parents can now view the term report on the portal.'
          : 'The report has been hidden from the parent portal.',
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
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
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const subjectsToDisplay = activeSubjects;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Grades</h1>
            <p className="text-gray-600">
              {isAdminViewer ? 'View grades across all classes (read-only)' : 'Manage subjects, assessments and student grades'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdminViewer ? (
            <Badge variant="secondary" className="flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200">
              <Eye className="w-3 h-3" /> Read Only
            </Badge>
          ) : (
            <Button onClick={() => setIsAddOpen(true)} disabled={!selectedClassId}>
              <Plus className="w-4 h-4 mr-2" /> Add Assessment
            </Button>
          )}
          {selectedClassId && (
            <Button variant="outline" onClick={handleLoadReport}>
              <Trophy className="w-4 h-4 mr-2" /> Term Report
            </Button>
          )}
        </div>
      </div>

      {/* Class selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
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
          <div className="flex gap-0 border-b">
            {[
              { key: 'grades', icon: BookOpen, label: 'Grade Entry' },
              { key: 'report', icon: Trophy, label: 'Term Report' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => tab.key === 'report' ? handleLoadReport() : setActiveTab('grades')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>

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
                          {(assignmentsBySubject[subj] || []).map(a => (
                            <div
                              key={a.id}
                              className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-purple-50 transition-colors ${selectedAssignmentId === String(a.id) ? 'bg-purple-100 border-l-2 border-purple-500' : ''
                                }`}
                              onClick={() => setSelectedAssignmentId(String(a.id))}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                                <p className="text-xs text-gray-500">{a.assignment_type} · {a.max_score} marks</p>
                              </div>
                              {!isAdminViewer && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteAssignment(a.id); }}
                                  className="ml-2 text-gray-300 hover:text-red-500 shrink-0 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                            {selectedAssignment?.subject} · {selectedAssignment?.assignment_type} · Max:{' '}
                            <strong>{selectedAssignment?.max_score} marks</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-normal text-gray-500">{gradedCount}/{gradeRows.length} graded</span>
                          {movedCount > 0 && (
                            <Badge variant="secondary" className="text-xs text-amber-700 bg-amber-50 border border-amber-200">
                              {movedCount} moved
                            </Badge>
                          )}
                          {/* Bulk edit controls */}
                          {!isAdminViewer && !isBulkEditing && (
                            <Button size="sm" variant="outline" onClick={enterBulkEdit} className="gap-1.5">
                              <PencilLine className="w-3.5 h-3.5" /> Edit All
                            </Button>
                          )}
                          {!isAdminViewer && isBulkEditing && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={cancelBulkEdit} className="gap-1.5">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </Button>
                              <Button size="sm" onClick={handleBulkSave} disabled={bulkSaving} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
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
                          {gradeRows.map((row, idx) => {
                            const maxScore = selectedAssignment?.max_score ?? 100;
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
                                          className="w-20 h-8 text-sm text-center bulk-score-input"
                                          placeholder="—"
                                          value={bulkScores[row.studentDbId] ?? ''}
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
                                        <span className="text-xs text-gray-400">/{maxScore}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-mono text-sm text-gray-700">
                                          {row.score !== null
                                            ? <><strong>{row.score}</strong><span className="text-gray-400">/{maxScore}</span></>
                                            : <span className="text-gray-300">—/{maxScore}</span>}
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
                        {/* Toggle release (hidden for read-only admins) */}
                        {!isAdminViewer && (
                          <Button
                            size="sm"
                            variant={termReport.isReleased ? 'outline' : 'default'}
                            onClick={handleToggleRelease}
                            disabled={releaseLoading}
                            className={termReport.isReleased
                              ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
                              : 'bg-green-600 hover:bg-green-700 text-white'}
                          >
                            {termReport.isReleased
                              ? <><EyeOff className="w-3.5 h-3.5 mr-1.5" /> Hide from Parents</>
                              : <><Send className="w-3.5 h-3.5 mr-1.5" /> Release to Parents</>}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                      </div>
                    </CardTitle>
                    {termReport.isReleased && termReport.releasedByName && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Released by <strong className="ml-0.5">{termReport.releasedByName}</strong>
                        {termReport.releasedAt && (
                          <> · {new Date(termReport.releasedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                        )}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
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
                              {termReport.subjects.map(subj => {
                                const sAssignments = termReport.assignmentsBySubject[subj] || [];
                                const sMax = sAssignments.reduce((s, a) => s + parseFloat(String(a.max_score)), 0);
                                return (
                                  <th key={subj} className="border border-slate-600 px-3 py-2 text-center min-w-[110px]">
                                    <div className="font-semibold text-xs leading-tight">{subj}</div>
                                    <div className="text-xs font-normal text-slate-300">/{sMax} marks</div>
                                  </th>
                                );
                              })}
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
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                        {(s as any).passportPhotoUrl
                                          ? <img src={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3001'}${(s as any).passportPhotoUrl}`} alt="" className="w-full h-full object-cover" />
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
                                    const sPct = ss?.maxScore > 0 ? Math.round((ss.score / ss.maxScore) * 100) : 0;
                                    const sGrade = ss ? getLetterGrade(sPct) : null;
                                    return (
                                      <td key={subj} className="border border-gray-200 px-3 py-2 text-center">
                                        {ss ? (
                                          <>
                                            <div>
                                              <span className="font-mono font-bold">{ss.score}</span>
                                              <span className="text-gray-400 text-xs">/{ss.maxScore}</span>
                                            </div>
                                            {sGrade && (
                                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${sGrade.color}`}>
                                                {sGrade.letter} {sPct}%
                                              </span>
                                            )}
                                          </>
                                        ) : <span className="text-gray-300">—</span>}
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
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={newAssignment.subject} onValueChange={v => setNewAssignment(p => ({ ...p, subject: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose subject…" /></SelectTrigger>
                <SelectContent>
                  {globalSubjects.length > 0 ? (
                    globalSubjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)
                  ) : (
                    <div className="px-2 py-3 text-sm text-gray-500 text-center italic">No subjects defined in system</div>
                  )}
                  <div className="border-t my-1" />
                  <SelectItem value="__custom__">+ Other (type below)</SelectItem>
                </SelectContent>
              </Select>
              {newAssignment.subject === '__custom__' && (
                <Input
                  placeholder="Enter subject name…"
                  value={newAssignment.subjectCustom}
                  onChange={e => setNewAssignment(p => ({ ...p, subjectCustom: e.target.value }))}
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
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newAssignment.assignmentType} onValueChange={v => setNewAssignment(p => ({ ...p, assignmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSESSMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
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

            <Button onClick={handleAddAssignment} className="w-full">Add Assessment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {termReport?.isReleased ? <EyeOff className="w-5 h-5 text-orange-600" /> : <Send className="w-5 h-5 text-green-600" />}
              {termReport?.isReleased ? 'Hide Results from Parents?' : 'Release Results to Parents?'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className={`rounded-xl border p-3 text-sm ${
              termReport?.isReleased
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}>
              {termReport?.isReleased
                ? 'Parents will no longer see this report in their portal until you release it again.'
                : 'Parents will be able to view this report immediately in their portal.'}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReleaseConfirm(false)}
                disabled={releaseLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmToggleRelease}
                disabled={releaseLoading}
                className={termReport?.isReleased
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'}
              >
                {releaseLoading
                  ? 'Please wait...'
                  : termReport?.isReleased
                    ? 'Yes, Hide Results'
                    : 'Yes, Release Results'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GradesModule;
