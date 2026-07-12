import React, { useState, useCallback, useEffect } from 'react';
import { Search, UserCheck, UserX, Clock, RefreshCw, Users } from 'lucide-react';
import { checkinService } from '@/services/checkinService';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';

interface TeacherClass {
  id: number;
  class_name: string;
}

const StaffCheckinPanel: React.FC = () => {
  const { students } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<'search' | 'class'>('search');
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [liveStatus, setLiveStatus] = useState<Map<number, { action: string | null; time: string | null }>>(new Map());
  const [statusLoading, setStatusLoading] = useState(false);

  const isTeacher = user?.role === 'teacher' || (user?.role === 'staff' && user?.teacherId);

  useEffect(() => {
    if (!isTeacher) return;
    apiService.get<TeacherClass[]>('/teachers/me/classes').then(setTeacherClasses).catch(() => {});
  }, [isTeacher]);

  const fetchLiveStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await checkinService.getStatus();
      if (Array.isArray(data)) {
        const map = new Map<number, { action: string | null; time: string | null }>();
        data.forEach((s: any) => {
          map.set(Number(s.id), { action: s.last_action, time: s.last_action_time });
        });
        setLiveStatus(map);
      }
    } catch {
      // silent
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'class') {
      fetchLiveStatus();
    }
  }, [tab, fetchLiveStatus]);

  const classStudentIds = new Set<number>();
  const classStudents = (students || []).filter((s: any) => {
    if (teacherClasses.some((tc) => tc.id === Number(s.classAssignedId))) {
      classStudentIds.add(Number(s.id));
      return true;
    }
    return false;
  });

  const groupedByClass = teacherClasses.map((tc) => ({
    ...tc,
    students: classStudents.filter((s: any) => Number(s.classAssignedId) === tc.id),
  })).filter((g) => g.students.length > 0);

  const filtered = (students || []).filter((s: any) => {
    const q = search.toLowerCase();
    return (
      (s.firstName || s.first_name || '').toLowerCase().includes(q) ||
      (s.lastName || s.last_name || '').toLowerCase().includes(q) ||
      (s.studentId || s.student_id || '').toLowerCase().includes(q) ||
      (s.admissionNumber || s.admission_number || '').toLowerCase().includes(q)
    );
  }).slice(0, 10);

  const selectedStudent = selectedId
    ? (students || []).find((s: any) => Number(s.id) === selectedId)
    : null;

  const getStudentStatus = (s: any) => {
    const live = liveStatus.get(Number(s.id));
    if (live) return live;
    return { action: null, time: null };
  };

  const handleCheckin = async (action: 'check_in' | 'check_out') => {
    if (!selectedId) return;
    setProcessing(true);
    try {
      await checkinService.manualCheckin(selectedId, action);
      toast({
        title: 'Success',
        description: `Student ${action === 'check_in' ? 'checked in' : 'checked out'}`,
      });
      setSelectedId(null);
      setSearch('');
      if (tab === 'class') fetchLiveStatus();
    } catch (err: any) {
      toast({
        title: 'Failed',
        description: err.message || 'Could not record check-in/out',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const quickCheckin = async (studentId: number, action: 'check_in' | 'check_out') => {
    setProcessing(true);
    try {
      await checkinService.manualCheckin(studentId, action);
      toast({ title: 'Success', description: `Student ${action === 'check_in' ? 'checked in' : 'checked out'}` });
      fetchLiveStatus();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message || 'Could not record', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-600" /> Staff Check-in/out
        </h2>
        {tab === 'class' && (
          <button onClick={fetchLiveStatus} disabled={statusLoading} className="text-gray-400 hover:text-blue-600 transition-colors">
            <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => { setTab('search'); setSelectedId(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === 'search' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" /> Search
        </button>
        {isTeacher && (
          <button
            type="button"
            onClick={() => { setTab('class'); setSelectedId(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'class' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" /> My Class
          </button>
        )}
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }}
              placeholder="Search student by name or ID..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          {search && !selectedId && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No students found</div>
              ) : (
                filtered.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(Number(s.id))}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">
                      {(s.firstName || s.first_name || '?')[0]}{(s.lastName || s.last_name || '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {s.firstName || s.first_name} {s.lastName || s.last_name}
                      </p>
                      <p className="text-xs text-slate-500">{s.className || s.class_name || 'No class'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── My Class tab ── */}
      {tab === 'class' && (
        <div className="space-y-3">
          {groupedByClass.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No students in your class</p>
            </div>
          ) : (
            groupedByClass.map((group) => (
              <div key={group.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <p className="text-sm font-bold text-slate-700">{group.class_name}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.students.map((s: any) => {
                    const status = getStudentStatus(s);
                    const onCampus = status.action === 'check_in';
                    return (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {(s.firstName || s.first_name || '?')[0]}{(s.lastName || s.last_name || '?')[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {s.firstName || s.first_name} {s.lastName || s.last_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{s.studentId || s.admissionNumber || s.admission_number || ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                            onCampus
                              ? 'text-green-700 bg-green-100'
                              : status.action
                                ? 'text-slate-500 bg-slate-100'
                                : 'text-amber-600 bg-amber-50'
                          }`}>
                            {onCampus ? <UserCheck className="w-3 h-3" /> : status.action ? <UserX className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {onCampus ? 'On' : status.action ? 'Left' : '--'}
                          </span>
                          <button
                            type="button"
                            onClick={() => quickCheckin(Number(s.id), 'check_in')}
                            disabled={processing}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
                          >
                            In
                          </button>
                          <button
                            type="button"
                            onClick={() => quickCheckin(Number(s.id), 'check_out')}
                            disabled={processing}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Out
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected student actions */}
      {selectedStudent && selectedId && tab === 'search' && (
        <div className="bg-white border-2 border-blue-200 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold">
              {(selectedStudent.firstName || selectedStudent.first_name || '?')[0]}
              {(selectedStudent.lastName || selectedStudent.last_name || '?')[0]}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">
                {selectedStudent.firstName || selectedStudent.first_name} {selectedStudent.lastName || selectedStudent.last_name}
              </p>
              <p className="text-sm text-slate-500">
                {selectedStudent.className || selectedStudent.class_name || 'No class'}
                {' · '}
                {selectedStudent.studentId || selectedStudent.student_id || selectedStudent.admissionNumber || selectedStudent.admission_number || ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleCheckin('check_in')}
              disabled={processing}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
            >
              <UserCheck className="w-7 h-7" />
              <span className="text-sm font-bold">Check In</span>
              <span className="text-xs text-green-600">Student arrived</span>
            </button>
            <button
              type="button"
              onClick={() => handleCheckin('check_out')}
              disabled={processing}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
            >
              <UserX className="w-7 h-7" />
              <span className="text-sm font-bold">Check Out</span>
              <span className="text-xs text-blue-600">Student leaving</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedId(null); setSearch(''); }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

export default StaffCheckinPanel;
