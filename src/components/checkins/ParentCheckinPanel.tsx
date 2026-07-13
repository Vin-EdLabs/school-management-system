import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, UserCheck, UserX, Clock, Smartphone, ToggleLeft, ToggleRight } from 'lucide-react';
import { checkinService, CheckinStudent } from '@/services/checkinService';
import { toast } from '@/hooks/use-toast';

interface ParentCheckinPanelProps {
  token: string;
  tenantId: number;
  /** Compact layout for the parent portal home overview card */
  embedded?: boolean;
}

const ParentCheckinPanel: React.FC<ParentCheckinPanelProps> = ({ token, tenantId, embedded = false }) => {
  const [students, setStudents] = useState<CheckinStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await checkinService.getMyStatus(token);
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const enabledStudents = students.filter((s) => s.is_checkin_enabled);

  const isOnCampus = (student: CheckinStudent) => {
    return student.last_action === 'check_in';
  };

  const handleCheckin = async (studentId: number, action: 'check_in' | 'check_out') => {
    setProcessingId(studentId);
    try {
      const result = await checkinService.processParentCheckin(action, [studentId], token);
      toast({
        title: 'Success',
        description: result.message || `${action === 'check_in' ? 'Drop-off' : 'Pick-up'} recorded`,
      });
      await fetchStatus();
    } catch (err: any) {
      toast({
        title: 'Failed',
        description: err.message || 'Could not record check-in/out',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleOptIn = async (studentId: number, current: boolean) => {
    try {
      await checkinService.toggleOptIn(!current, token, studentId);
      toast({
        title: 'Updated',
        description: `Check-in ${!current ? 'enabled' : 'disabled'} for your child`,
      });
      await fetchStatus();
    } catch (err: any) {
      toast({
        title: 'Failed',
        description: err.message || 'Could not update check-in setting',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className={embedded ? 'py-6 animate-in fade-in duration-500' : 'p-4 md:p-6 lg:p-8 animate-in fade-in duration-500'}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  const shellClass = embedded ? 'animate-in fade-in duration-500' : 'p-4 md:p-6 lg:p-8 animate-in fade-in duration-500';

  return (
    <div className={shellClass}>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`flex items-center gap-2 ${embedded ? 'text-base font-black tracking-tight text-slate-950' : 'text-lg font-bold text-gray-800'}`}>
          <Smartphone className={`${embedded ? 'w-5 h-5 text-emerald-600' : 'w-5 h-5 text-violet-600'}`} /> Student Check-in/out
        </h2>
        <button onClick={fetchStatus} className="text-gray-400 hover:text-violet-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {enabledStudents.length === 0 && students.length > 0 && (
        <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">
          <ToggleLeft className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">Check-in is disabled</p>
          <p className="text-xs mt-1">Enable check-in for your child below to get started.</p>
        </div>
      )}

      {students.length === 0 && (
        <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No students found</p>
          <p className="text-xs mt-1">Link a student to your account to use check-in/out.</p>
        </div>
      )}

      {/* Student cards */}
      <div className="space-y-4">
        {students.map((student) => {
          const onCampus = isOnCampus(student);
          const suggestedAction = onCampus ? 'check_out' as const : 'check_in' as const;
          const busy = processingId === student.id;

          return (
            <div key={student.id} className={`rounded-xl p-4 shadow-sm ${embedded ? 'border border-white/80 bg-white/75 backdrop-blur-sm' : 'bg-white border border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-slate-500">{student.class_name || 'No class'} · {student.student_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    onCampus
                      ? 'text-green-700 bg-green-100'
                      : student.last_action
                        ? 'text-slate-500 bg-slate-100'
                        : 'text-amber-600 bg-amber-50'
                  }`}>
                    {onCampus && <UserCheck className="w-3 h-3" />}
                    {!onCampus && student.last_action && <UserX className="w-3 h-3" />}
                    {!student.last_action && <Clock className="w-3 h-3" />}
                    {onCampus ? 'On Campus' : student.last_action ? 'Left' : 'No record'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleOptIn(student.id, !!student.is_checkin_enabled)}
                    className={`text-sm font-bold px-3 py-2 rounded-xl transition-colors ${
                      student.is_checkin_enabled
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                    }`}
                    title={student.is_checkin_enabled ? 'Disable check-in' : 'Enable check-in'}
                  >
                    {student.is_checkin_enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>
              </div>

                  {student.last_action_time && (
                <p className="text-[10px] text-slate-400 mb-3">
                  {onCampus ? 'Checked in ' : 'Left '}
                  {new Date(student.last_action_time).toLocaleString()}
                </p>
              )}

              {/* Action buttons — both visible */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckin(student.id, 'check_in')}
                  disabled={busy}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                    suggestedAction === 'check_in'
                      ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {busy && suggestedAction === 'check_in' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <><UserCheck className="w-4 h-4" /> Check In</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckin(student.id, 'check_out')}
                  disabled={busy}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                    suggestedAction === 'check_out'
                      ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {busy && suggestedAction === 'check_out' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <><UserX className="w-4 h-4" /> Check Out</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
};

export default ParentCheckinPanel;
