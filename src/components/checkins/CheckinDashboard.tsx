import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users, Clock, UserCheck, UserX, Search, Filter, Download } from 'lucide-react';
import { checkinService, CheckinStudent, CheckinRecord } from '@/services/checkinService';
import { useSchool } from '@/contexts/SchoolContext';

const CheckinDashboard: React.FC = () => {
  const { classes } = useSchool();
  const [students, setStudents] = useState<CheckinStudent[]>([]);
  const [history, setHistory] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusData, historyData] = await Promise.all([
        checkinService.getStatus(classFilter || undefined),
        checkinService.getHistory({ classId: classFilter || undefined, limit: 50 }),
      ]);
      setStudents(Array.isArray(statusData) ? statusData : []);
      setHistory(historyData?.items || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onCampus = students.filter((s) => s.current_status === 'on_campus');
  const offCampus = students.filter((s) => s.current_status === 'off_campus');
  const noRecord = students.filter((s) => s.current_status === 'no_record');

  const exportCsv = () => {
    const rows = [['Student Name', 'Student ID', 'Class', 'Status', 'Last Action Time'].join(',')];
    for (const s of students) {
      rows.push([
        `${s.first_name} ${s.last_name}`,
        s.student_id,
        s.class_name || '',
        s.current_status === 'on_campus' ? 'On Campus' : s.current_status === 'off_campus' ? 'Left' : 'No Record',
        s.last_action_time ? new Date(s.last_action_time).toLocaleString() : '',
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-status-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" /> Check-in/out Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white"
        >
          <option value="">All Classes</option>
          {(classes || []).map((cls: any) => (
            <option key={cls.id} value={cls.id}>{cls.className || cls.class_name}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <UserCheck className="w-6 h-6 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-black text-green-700">{onCampus.length}</p>
          <p className="text-xs font-medium text-green-600">On Campus</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <UserX className="w-6 h-6 mx-auto text-slate-500 mb-1" />
          <p className="text-2xl font-black text-slate-600">{offCampus.length}</p>
          <p className="text-xs font-medium text-slate-500">Left School</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <Clock className="w-6 h-6 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-black text-amber-600">{noRecord.length}</p>
          <p className="text-xs font-medium text-amber-500">No Record Today</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'status' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Current Status
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Today's Activity
        </button>
      </div>

      {/* Status list */}
      {activeTab === 'status' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {students.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No opted-in students found</p>
              </div>
            ) : (
              students.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      s.current_status === 'on_campus'
                        ? 'bg-green-100 text-green-700'
                        : s.current_status === 'off_campus'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-500'
                    }`}>
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500">{s.class_name || 'No class'} · {s.student_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      s.current_status === 'on_campus'
                        ? 'text-green-700 bg-green-100'
                        : s.current_status === 'off_campus'
                          ? 'text-slate-500 bg-slate-100'
                          : 'text-amber-600 bg-amber-50'
                    }`}>
                      {s.current_status === 'on_campus' && <UserCheck className="w-3 h-3" />}
                      {s.current_status === 'off_campus' && <UserX className="w-3 h-3" />}
                      {s.current_status === 'no_record' && <Clock className="w-3 h-3" />}
                      {s.current_status === 'on_campus' ? 'On Campus' : s.current_status === 'off_campus' ? 'Left' : 'No record'}
                    </span>
                    {s.last_action_time && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(s.last_action_time).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Activity log */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No check-in activity today</p>
              </div>
            ) : (
              history.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      r.action === 'check_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.action === 'check_in' ? '↓' : '↑'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-slate-500">{r.class_name || ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.action === 'check_in' ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'
                    }`}>
                      {r.action === 'check_in' ? 'Check-in' : 'Check-out'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(r.action_time).toLocaleString()}
                      {r.performed_by_type === 'staff' && ' · by staff'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default CheckinDashboard;
