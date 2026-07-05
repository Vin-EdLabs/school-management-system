import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  ClipboardCheck, Calendar, Users, Save, Eye,
  History, CheckCircle, XCircle, Search, UserCheck, School
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { isActiveEnrolledStudent } from '../students/studentRegistryUtils';
import { useSchool } from '../../contexts/SchoolContext';
import { formatDisplayDate } from '../../utils/dateFormat';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

interface AttendanceHistoryEntry {
  date: string;
  total: number;
  present_count: number;
  absent_count: number;
}

interface StudentAttendanceRecord {
  date: string;
  present: boolean;
  class_name: string;
  class_id: number;
}

interface TeacherClass {
  id: number;
  class_name: string;
  student_count: string;
  level?: string | null;
  stream?: string | null;
}

interface AttendanceResponse {
  student_db_id: number;
  present: number | boolean;
  date: string;
}

// undefined = not yet marked, true = present, false = absent
type AttendanceStatus = Record<string, boolean | undefined>;

const resolvePhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (/^https?:\/\//i.test(photoUrl) || photoUrl.startsWith('data:')) return photoUrl;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${origin}${normalized}`;
};

const AttendanceModule = ({ schoolWideReadOnly = false }: { schoolWideReadOnly?: boolean }) => {
  const { schoolId } = useSchool();
  const { students, classes } = useData();
  const { user } = useAuth();
  const isAdminViewer =
    schoolWideReadOnly || user?.role === 'administrator' || user?.role === 'super-admin';

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceStatus>({});
  const [savedAttendance, setSavedAttendance] = useState<AttendanceStatus>({});
  const savedAttendanceRef = useRef<AttendanceStatus>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'take' | 'history' | 'tracker'>('take');

  // Student tracker state
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerStudentId, setTrackerStudentId] = useState('');
  const [trackerRecords, setTrackerRecords] = useState<StudentAttendanceRecord[]>([]);
  const [trackerLoading, setTrackerLoading] = useState(false);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  const studentInClass = (s: { classAssigned?: string; classAssignedId?: number | string | null; enrollmentStatus?: string }, cls: TeacherClass) =>
    isActiveEnrolledStudent(s) &&
    (s.classAssigned === cls.class_name || (s.classAssignedId && String(s.classAssignedId) === String(cls.id)));

  const allClassesAsTeacherClass = useMemo<TeacherClass[]>(() => {
    return classes.map(c => {
      const count = students.filter(s =>
        isActiveEnrolledStudent(s) &&
        (s.classAssigned === c.className || (s.classAssignedId && String(s.classAssignedId) === String(c.id)))
      ).length;
      return { id: Number(c.id), class_name: c.className, student_count: String(count) };
    });
  }, [classes, students]);

  useEffect(() => {
    if (isAdminViewer) {
      setTeacherClasses(allClassesAsTeacherClass);
      if (allClassesAsTeacherClass.length && !selectedClassId) {
        setSelectedClassId(String(allClassesAsTeacherClass[0].id));
      }
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const list = await apiService.get<TeacherClass[]>('/teachers/me/classes');
        setTeacherClasses(Array.isArray(list) ? list : []);
        if (list?.length && !selectedClassId) setSelectedClassId(String(list[0].id));
      } catch {
        setTeacherClasses([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId, isAdminViewer, allClassesAsTeacherClass]);

  const classStudents = selectedClassId
    ? students.filter(s => {
        const cls = teacherClasses.find(c => String(c.id) === selectedClassId);
        return cls ? studentInClass(s, cls) : false;
      })
    : [];

  // Fetch attendance for class + date. No default: undefined = not marked
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      try {
        const list = await apiService.get<AttendanceResponse[]>(`/attendance?classId=${selectedClassId}&date=${selectedDate}`);
        const map: AttendanceStatus = {};
        (list || []).forEach((a) => {
          map[String(a.student_db_id)] = Boolean(a.present);
        });
        setAttendance(map);
        setSavedAttendance(map);
        savedAttendanceRef.current = map;
      } catch {
        setAttendance({});
        setSavedAttendance({});
        savedAttendanceRef.current = {};
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchAttendance();
  }, [selectedClassId, selectedDate]);

  // Fetch history dates whenever class changes
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const data = await apiService.get<AttendanceHistoryEntry[]>(`/attendance/history?classId=${selectedClassId}`);
        setHistory(Array.isArray(data) ? data : []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [selectedClassId]);

  const handleAttendanceChange = (studentId: string, present: boolean) => {
    setAttendance(prev => ({ ...prev, [studentId]: present }));
  };

  const handleSaveAttendance = async (): Promise<boolean> => {
    if (!selectedClassId) {
      toast({ title: 'Please select a class', variant: 'destructive' });
      return false;
    }
    if (classStudents.length === 0) {
      toast({ title: 'No students in class', variant: 'destructive' });
      return false;
    }
    // Only send explicitly marked students (undefined = not marked, skip those)
    const records = classStudents
      .filter(s => attendance[s.id] !== undefined)
      .map(s => ({
        studentId: parseInt(s.id, 10),
        present: attendance[s.id] as boolean,
      }));

    if (records.length === 0) {
      toast({ title: 'No attendance marked', description: 'Please mark at least one student as present or absent.', variant: 'destructive' });
      return false;
    }

    setSaving(true);
    try {
      await apiService.post('/attendance', {
        classId: parseInt(selectedClassId, 10),
        date: selectedDate,
        records,
      });
      const presentCnt = records.filter(r => r.present).length;
      toast({
        title: 'Attendance Saved',
        description: `${presentCnt} present, ${records.length - presentCnt} absent — ${selectedDate}`,
      });
      setSavedAttendance({ ...attendance });
      savedAttendanceRef.current = { ...attendance };
      // Refresh history
      const data = await apiService.get<AttendanceHistoryEntry[]>(`/attendance/history?classId=${selectedClassId}`);
      setHistory(Array.isArray(data) ? data : []);
      return true;
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save attendance', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const attendanceDirty = useMemo(() => {
    return JSON.stringify(attendance) !== JSON.stringify(savedAttendance);
  }, [attendance, savedAttendance]);

  const { runWithGuard, UnsavedChangesDialog } = useUnsavedChangesGuard({
    isDirty: !isAdminViewer && !schoolWideReadOnly && activeTab === 'take' && attendanceDirty,
    onSave: handleSaveAttendance,
    onDiscard: () => {
      setAttendance({ ...savedAttendanceRef.current });
    },
    message: 'You have unsaved attendance marks. Save before leaving, or discard your changes.',
  });

  const handleClassChange = (classId: string) => {
    runWithGuard(() => {
      setSelectedClassId(classId);
      setTrackerStudentId('');
      setTrackerRecords([]);
      setAttendance({});
      setSavedAttendance({});
      savedAttendanceRef.current = {};
    });
  };

  const handleDateChange = (date: string) => {
    runWithGuard(() => setSelectedDate(date));
  };

  const handleTabChange = (tab: 'take' | 'history' | 'tracker') => {
    runWithGuard(() => setActiveTab(tab));
  };

  // Student tracker: search ALL students in the school (not just current class)
  // This ensures students who moved classes can still be found and their full history shown
  const trackerResults = useMemo(() => {
    if (!trackerSearch.trim()) return [];
    const q = trackerSearch.toLowerCase();
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q)
    ).slice(0, 15); // cap results to 15
  }, [trackerSearch, students]);

  const handleTrackStudent = async (studentId: string) => {
    setTrackerStudentId(studentId);
    setTrackerLoading(true);
    try {
      // No classId filter — fetch ALL attendance records for this student across
      // every class they have ever been in. Records are stored per class_id so
      // moving a student never overwrites or deletes past data.
      const data = await apiService.get<StudentAttendanceRecord[]>(
        `/attendance/student?studentId=${studentId}`
      );
      setTrackerRecords(Array.isArray(data) ? data : []);
    } catch {
      setTrackerRecords([]);
    } finally {
      setTrackerLoading(false);
    }
  };

  const trackedStudent = trackerStudentId ? students.find(s => s.id === trackerStudentId) : null;
  const trackerPresent = trackerRecords.filter(r => r.present).length;
  const trackerAbsent = trackerRecords.filter(r => !r.present).length;
  const trackerPct = trackerRecords.length > 0 ? Math.round((trackerPresent / trackerRecords.length) * 100) : 0;

  // Summary counts (only explicitly marked students)
  const markedStudents = classStudents.filter(s => attendance[s.id] !== undefined);
  const presentCount = markedStudents.filter(s => attendance[s.id] === true).length;
  const absentCount = markedStudents.filter(s => attendance[s.id] === false).length;
  const totalStudents = classStudents.length;

  if (teacherClasses.length === 0 && !loading) {
    return (
      <div className="px-4 py-5 sm:p-6 max-w-7xl mx-auto w-full">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Classes Found</h3>
            <p className="text-muted-foreground">{isAdminViewer ? 'No classes have been created yet.' : "You don't have any classes assigned yet. Please contact the administrator."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-background px-4 py-5 sm:p-6 space-y-5 sm:space-y-8 max-w-7xl mx-auto w-full">
      {/* Header Section */}
      <div className="text-center sm:text-center space-y-3 sm:space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-2 sm:mb-4 shadow-lg shadow-emerald-500/10">
          <ClipboardCheck className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent px-1">
            Student Attendance
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl mx-auto px-1">
            {isAdminViewer ? 'View and track attendance across all classes' : 'Mark attendance quickly — optimized for your phone'}
          </p>
        </div>
        {isAdminViewer && (
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4" /> Administrative View (Read-Only)
            </Badge>
          </div>
        )}
      </div>

      {/* Class Selector Card */}
      <Card className="border-border shadow-2xl bg-card/90 backdrop-blur-md rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-emerald-500/10 transition-all duration-500">
        <CardContent className="p-4 sm:p-8">
          <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center shrink-0">
               <School className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 space-y-2 w-full text-center md:text-left">
              <Label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Select class</Label>
              <Select value={selectedClassId} onValueChange={handleClassChange}>
                <SelectTrigger className="h-12 sm:h-14 min-h-[48px] rounded-2xl border-2 border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-800 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/20 transition-all text-base sm:text-lg font-semibold">
                  <SelectValue placeholder="Which class are you marking?" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-border shadow-2xl">
                  {teacherClasses.map((cls) => (
                    <SelectItem key={cls.id} value={String(cls.id)} className="h-12 rounded-xl mx-2 my-1">
                      {cls.class_name} ({cls.student_count} registered students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClassId && (
        <>
          {/* Tabs */}
          <div className="flex gap-0 border-b -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto touch-pan-x">
            {[
              { key: 'take', icon: ClipboardCheck, label: isAdminViewer ? 'View' : 'Take' },
              { key: 'history', icon: History, label: 'History', badge: history.length > 0 ? history.length : undefined },
              { key: 'tracker', icon: UserCheck, label: 'Tracker' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key as 'take' | 'history' | 'tracker')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 min-h-[48px] shrink-0 text-sm font-medium border-b-2 transition-colors whitespace-nowrap touch-manipulation ${
                  activeTab === tab.key
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && (
                  <Badge variant="secondary" className="text-xs ml-1">{tab.badge}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* ── TAKE ATTENDANCE TAB ── */}
          {activeTab === 'take' && (
            <>
            {!isAdminViewer && (
              <div className="sm:hidden sticky top-0 z-20 -mx-4 px-4 py-2 border-b border-slate-200 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm">
                <Button
                  type="button"
                  variant="primaryAction"
                  className="w-full h-12 text-base font-semibold touch-manipulation disabled:opacity-60"
                  onClick={handleSaveAttendance}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2 shrink-0 text-white" />
                  {saving ? 'Saving…' : 'Save attendance'}
                </Button>
              </div>
            )}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="flex h-12 min-h-[48px] w-full rounded-xl border border-input bg-background px-3 py-2 text-base sm:text-sm touch-manipulation"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Summary bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{totalStudents} students total</span>
                      </div>
                      {markedStudents.length > 0 && (
                        <>
                          <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 font-medium">
                            <CheckCircle className="w-4 h-4" /> {presentCount} present
                          </span>
                          <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 font-medium">
                            <XCircle className="w-4 h-4" /> {absentCount} absent
                          </span>
                          <span className="text-sm text-muted-foreground">{totalStudents - markedStudents.length} not marked</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <span className="text-base leading-snug min-w-0">
                      <span className="block sm:inline">Student attendance</span>
                      <span className="block sm:inline sm:ml-2 text-sm font-normal text-muted-foreground">
                        <span>— {formatDisplayDate(selectedDate)}</span>
                      </span>
                    </span>
                    {!isAdminViewer && (
                      <Button onClick={handleSaveAttendance} disabled={saving} size="sm" variant="primaryAction" className="hidden sm:inline-flex shrink-0 touch-manipulation">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading…</div>
                  ) : classStudents.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Students Found</h3>
                      <p className="text-muted-foreground">No students are assigned to this class yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {classStudents.map((student) => {
                        const status = attendance[student.id]; // undefined | true | false
                        return (
                          <div
                            key={student.id}
                            className={`flex flex-col gap-3 p-3 sm:p-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border transition-colors touch-manipulation ${
                              status === true
                                ? 'bg-green-50 border-green-200'
                                : status === false
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-card border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold ${
                                status === true ? 'bg-green-500' : status === false ? 'bg-red-400' : 'bg-gray-400'
                              }`}>
                                {student.passportPhotoUrl ? (
                                  <img
                                    src={resolvePhotoUrl(student.passportPhotoUrl)}
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <>{student.firstName.charAt(0)}{student.lastName.charAt(0)}</>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
                              </div>
                            </div>

                            <div className="flex items-stretch sm:items-center gap-2 w-full sm:w-auto sm:shrink-0">
                              {isAdminViewer ? (
                                <Badge
                                  variant={status === false ? 'destructive' : status === true ? 'default' : 'outline'}
                                  className={`justify-center py-2 ${status === true ? 'bg-green-600' : ''}`}
                                >
                                  {status === true ? 'Present' : status === false ? 'Absent' : 'Not recorded'}
                                </Badge>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAttendanceChange(student.id, true)}
                                    className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-medium border transition-colors touch-manipulation active:scale-[0.98] ${
                                      status === true
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-background text-muted-foreground border-input hover:border-green-400 dark:hover:border-green-800 hover:text-green-700 dark:hover:text-green-400'
                                    }`}
                                  >
                                    <CheckCircle className="w-4 h-4 shrink-0" /> Present
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAttendanceChange(student.id, false)}
                                    className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-medium border transition-colors touch-manipulation active:scale-[0.98] ${
                                      status === false
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-background text-muted-foreground border-input hover:border-red-400 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400'
                                    }`}
                                  >
                                    <XCircle className="w-4 h-4 shrink-0" /> Absent
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-5 h-5" /> Attendance History
                  <span className="text-sm font-normal text-gray-500 ml-1">— last 60 sessions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No attendance records yet for this class.</p>
                    {!isAdminViewer && (
                      <p className="text-sm text-gray-400 mt-1">Go to "Take Attendance" to start recording.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((entry) => {
                      const pct = Number(entry.total) > 0
                        ? Math.round((Number(entry.present_count) / Number(entry.total)) * 100)
                        : 0;
                      const formatted = formatDisplayDate(entry.date);
                      return (
                        <div
                          key={entry.date}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => runWithGuard(() => { setSelectedDate(entry.date); setActiveTab('take'); })}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{formatted}</p>
                              <div className="flex items-center gap-3 mt-0.5 text-xs">
                                <span className="flex items-center gap-1 text-green-700">
                                  <CheckCircle className="w-3 h-3" /> {entry.present_count} present
                                </span>
                                <span className="flex items-center gap-1 text-red-500">
                                  <XCircle className="w-3 h-3" /> {entry.absent_count} absent
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={pct >= 90 ? 'default' : pct >= 75 ? 'secondary' : 'destructive'}>
                              {pct}%
                            </Badge>
                            <span className="text-xs text-gray-400">View →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── STUDENT TRACKER TAB ── */}
          {activeTab === 'tracker' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserCheck className="w-5 h-5" /> Student Attendance Tracker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search any student by name or ID (all classes)…"
                      value={trackerSearch}
                      onChange={e => setTrackerSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {trackerSearch.trim() && (
                    <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                      {trackerResults.length === 0 ? (
                        <p className="text-sm text-gray-500 p-3">No students found.</p>
                      ) : (
                        trackerResults.map(s => (
                          <button
                            key={s.id}
                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted transition-colors ${trackerStudentId === s.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                            onClick={() => { handleTrackStudent(s.id); setTrackerSearch(''); }}
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {s.passportPhotoUrl ? (
                                <img
                                  src={resolvePhotoUrl(s.passportPhotoUrl)}
                                  alt={`${s.firstName} ${s.lastName}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <>{s.firstName.charAt(0)}{s.lastName.charAt(0)}</>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-muted-foreground">ID: {s.studentId} · {s.classAssigned}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tracked student results */}
              {trackedStudent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {trackedStudent.passportPhotoUrl ? (
                          <img
                            src={resolvePhotoUrl(trackedStudent.passportPhotoUrl)}
                            alt={`${trackedStudent.firstName} ${trackedStudent.lastName}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <>{trackedStudent.firstName.charAt(0)}{trackedStudent.lastName.charAt(0)}</>
                        )}
                      </div>
                      <div>
                        <p>{trackedStudent.firstName} {trackedStudent.lastName}</p>
                        <p className="text-sm font-normal text-gray-500">ID: {trackedStudent.studentId} · {trackedStudent.classAssigned}</p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {trackerLoading ? (
                      <div className="text-center py-6 text-gray-500">Loading records…</div>
                    ) : trackerRecords.length === 0 ? (
                      <div className="text-center py-6">
                        <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No attendance records found for this student.</p>
                      </div>
                    ) : (
                      <>
                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-700">{trackerPresent}</p>
                            <p className="text-xs text-green-600 mt-0.5">Days Present</p>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-red-600">{trackerAbsent}</p>
                            <p className="text-xs text-red-500 mt-0.5">Days Absent</p>
                          </div>
                          <div className={`rounded-lg p-3 text-center border ${trackerPct >= 90 ? 'bg-emerald-50 border-emerald-100' : trackerPct >= 75 ? 'bg-yellow-50 border-yellow-100' : 'bg-orange-50 border-orange-100'}`}>
                            <p className={`text-2xl font-bold ${trackerPct >= 90 ? 'text-emerald-700' : trackerPct >= 75 ? 'text-yellow-700' : 'text-orange-700'}`}>{trackerPct}%</p>
                            <p className={`text-xs mt-0.5 ${trackerPct >= 90 ? 'text-emerald-600' : trackerPct >= 75 ? 'text-yellow-600' : 'text-orange-600'}`}>Attendance Rate</p>
                          </div>
                        </div>

                        {/* Full record list — class label shows which class the record belongs to,
                            so records from previous classes remain visible and clearly labelled */}
                        <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                          {trackerRecords.map((r, idx) => {
                            const formatted = formatDisplayDate(r.date);
                            return (
                              <div key={`${r.date}-${r.class_id}-${idx}`} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span className="text-sm text-gray-800">{formatted}</span>
                                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                                    {r.class_name}
                                  </span>
                                </div>
                                <Badge
                                  variant={r.present ? 'default' : 'destructive'}
                                  className={`shrink-0 ${r.present ? 'bg-green-600' : ''}`}
                                >
                                  {r.present ? 'Present' : 'Absent'}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {!trackedStudent && !trackerSearch && (
                <div className="text-center py-12 text-gray-400">
                  <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Search for any student to view their full attendance history</p>
                  <p className="text-xs mt-1 opacity-70">Records are kept even after a student moves to a different class</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {UnsavedChangesDialog}
    </div>
  );
};

export default AttendanceModule;
