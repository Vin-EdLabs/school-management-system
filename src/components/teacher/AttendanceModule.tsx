import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  ClipboardCheck, Calendar, Users, Save, Eye,
  History, CheckCircle, XCircle, Search, UserCheck,
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';

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
}

// undefined = not yet marked, true = present, false = absent
type AttendanceStatus = Record<string, boolean | undefined>;

const AttendanceModule = () => {
  const { schoolId } = useSchool();
  const { students, classes } = useData();
  const { user } = useAuth();
  const isAdminViewer = user?.role === 'administrator' || user?.role === 'super-admin';

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceStatus>({});
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

  const allClassesAsTeacherClass = useMemo<TeacherClass[]>(() => {
    return classes.map(c => {
      const count = students.filter(s =>
        s.classAssigned === c.className || (s.classAssignedId && String(s.classAssignedId) === String(c.id))
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
        return cls && (s.classAssigned === cls.class_name || (s.classAssignedId && String(s.classAssignedId) === selectedClassId));
      })
    : [];

  // Fetch attendance for class + date. No default: undefined = not marked
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      try {
        const list = await apiService.get<any[]>(`/attendance?classId=${selectedClassId}&date=${selectedDate}`);
        const map: AttendanceStatus = {};
        (list || []).forEach((a: any) => {
          map[String(a.student_db_id)] = Boolean(a.present);
        });
        setAttendance(map);
      } catch {
        setAttendance({});
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

  const handleSaveAttendance = async () => {
    if (!selectedClassId) {
      toast({ title: 'Please select a class', variant: 'destructive' });
      return;
    }
    if (classStudents.length === 0) {
      toast({ title: 'No students in class', variant: 'destructive' });
      return;
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
      return;
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
      // Refresh history
      const data = await apiService.get<AttendanceHistoryEntry[]>(`/attendance/history?classId=${selectedClassId}`);
      setHistory(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save attendance', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-500">{isAdminViewer ? 'No classes have been created yet.' : "You don't have any classes assigned yet. Please contact the administrator."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Attendance</h1>
            <p className="text-gray-600">
              {isAdminViewer ? 'View attendance records across all classes (read-only)' : 'Take and manage student attendance'}
            </p>
          </div>
        </div>
        {isAdminViewer && (
          <Badge variant="secondary" className="flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200">
            <Eye className="w-3 h-3" /> Read Only
          </Badge>
        )}
      </div>

      {/* Class selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setTrackerStudentId(''); setTrackerRecords([]); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {teacherClasses.map((cls) => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {cls.class_name} ({cls.student_count} students)
                  </SelectItem>
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
              { key: 'take', icon: ClipboardCheck, label: isAdminViewer ? 'View Attendance' : 'Take Attendance' },
              { key: 'history', icon: History, label: 'Attendance History', badge: history.length > 0 ? history.length : undefined },
              { key: 'tracker', icon: UserCheck, label: 'Student Tracker' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Summary bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{totalStudents} students total</span>
                      </div>
                      {markedStudents.length > 0 && (
                        <>
                          <span className="flex items-center gap-1 text-sm text-green-700 font-medium">
                            <CheckCircle className="w-4 h-4" /> {presentCount} present
                          </span>
                          <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                            <XCircle className="w-4 h-4" /> {absentCount} absent
                          </span>
                          <span className="text-sm text-gray-400">{totalStudents - markedStudents.length} not marked</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-base">
                      Student Attendance
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </span>
                    {!isAdminViewer && (
                      <Button onClick={handleSaveAttendance} disabled={saving} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving…' : 'Save Attendance'}
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
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
                      <p className="text-gray-500">No students are assigned to this class yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {classStudents.map((student) => {
                        const status = attendance[student.id]; // undefined | true | false
                        return (
                          <div
                            key={student.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              status === true
                                ? 'bg-green-50 border-green-200'
                                : status === false
                                ? 'bg-red-50 border-red-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                status === true ? 'bg-green-500' : status === false ? 'bg-red-400' : 'bg-gray-400'
                              }`}>
                                {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-gray-500">ID: {student.studentId}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isAdminViewer ? (
                                <Badge
                                  variant={status === false ? 'destructive' : status === true ? 'default' : 'outline'}
                                  className={status === true ? 'bg-green-600' : ''}
                                >
                                  {status === true ? 'Present' : status === false ? 'Absent' : 'Not recorded'}
                                </Badge>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleAttendanceChange(student.id, true)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                      status === true
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-700'
                                    }`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Present
                                  </button>
                                  <button
                                    onClick={() => handleAttendanceChange(student.id, false)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                      status === false
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-red-400 hover:text-red-600'
                                    }`}
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Absent
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
                      const formatted = new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                      });
                      return (
                        <div
                          key={entry.date}
                          className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => { setSelectedDate(entry.date); setActiveTab('take'); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{formatted}</p>
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
                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${trackerStudentId === s.id ? 'bg-green-50' : ''}`}
                            onClick={() => { handleTrackStudent(s.id); setTrackerSearch(''); }}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {s.firstName.charAt(0)}{s.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-gray-500">ID: {s.studentId} · {s.classAssigned}</p>
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
                      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {trackedStudent.firstName.charAt(0)}{trackedStudent.lastName.charAt(0)}
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
                            const formatted = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                            });
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
    </div>
  );
};

export default AttendanceModule;
