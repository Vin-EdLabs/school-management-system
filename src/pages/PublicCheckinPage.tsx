import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { checkinService, LookupResult } from '@/services/checkinService';
import { detectTenantSlugFromHost } from '@/utils/tenantHost';

const PublicCheckinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const action = (searchParams.get('action') || 'check_in') as 'check_in' | 'check_out';
  const urlSlug = searchParams.get('slug') || '';
  const [admissionNumber, setAdmissionNumber] = useState(() => {
    try { return localStorage.getItem('last_checkin_id') || ''; } catch { return ''; }
  });
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [switching, setSwitching] = useState(false);

  const schoolName = (() => {
    const slug = urlSlug || detectTenantSlugFromHost() || '';
    if (!slug) return 'School';
    return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
  })() + ' School';

  // Store slug so lookup/process use the correct X-Tenant-Slug
  useEffect(() => {
    const slug = urlSlug || detectTenantSlugFromHost() || '';
    if (slug) {
      try { localStorage.setItem('checkin_tenant_slug', slug); } catch {}
    }
  }, [urlSlug]);

  const doLookup = useCallback(async () => {
    if (!admissionNumber.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setLookup(null);
    setSelectedStudentId(null);
    try {
      const data = await checkinService.lookupStudent(admissionNumber.trim());
      setLookup(data);
      // If only one student (no siblings), select it immediately
      if (data.siblings.length === 0) {
        setSelectedStudentId(data.student.id);
      }
    } catch (err: any) {
      setError(err.message || 'Student not found');
    } finally {
      setLoading(false);
    }
  }, [admissionNumber]);

  useEffect(() => {
    if (admissionNumber.trim()) {
      doLookup();
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedStudentId) return;
    setProcessing(true);
    setError('');
    try {
      const result = await checkinService.publicProcessCheckin(action, admissionNumber.trim());
      setSuccess(result.message);
      try { localStorage.setItem('last_checkin_id', admissionNumber.trim()); } catch {}
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setProcessing(false);
    }
  };

  const allStudents = lookup
    ? [lookup.student, ...lookup.siblings]
    : [];
  const selectedStudent = allStudents.find((s) => s.id === selectedStudentId);

  const isAlreadyDone = (() => {
    if (!selectedStudent || !lookup) return false;
    const last = selectedStudent.lastAction;
    if (action === 'check_in') return last === 'check_in';
    return last === 'check_out';
  })();

  const checkinDisabledOnStudent = selectedStudent && !selectedStudent.isCheckinEnabled;

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-emerald-800">Success!</h2>
          <p className="text-emerald-700">{success}</p>
          <p className="text-xs text-slate-400">{new Date().toLocaleTimeString()}</p>
          <button
            type="button"
            onClick={() => { setSuccess(''); setLookup(null); setSelectedStudentId(null); setAdmissionNumber(''); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Record another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-start justify-center p-4 pt-12 md:pt-24">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${
            action === 'check_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {action === 'check_in' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            {action === 'check_in' ? 'Drop-off' : 'Pick-up'}
          </div>
          <h1 className="text-lg font-bold text-slate-800">{schoolName}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {action === 'check_in'
              ? 'Scanning in your child for the day'
              : 'Signing out your child for pickup'}
          </p>
        </div>

        {/* Switch action link */}
        <button
          type="button"
          onClick={() => setSwitching(!switching)}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mb-4"
        >
          {switching
            ? `Keep ${action === 'check_in' ? 'Drop-off' : 'Pick-up'}`
            : `Wrong QR? Switch to ${action === 'check_in' ? 'Pick-up' : 'Drop-off'} instead`}
        </button>

        {switching && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">Tap the correct one:</p>
            <div className="flex gap-2">
              <a
                href={`?action=check_in`}
                className="flex-1 text-center px-3 py-2 rounded-lg bg-green-100 text-green-700 font-semibold hover:bg-green-200"
              >Drop-off</a>
              <a
                href={`?action=check_out`}
                className="flex-1 text-center px-3 py-2 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200"
              >Pick-up</a>
            </div>
          </div>
        )}

        {/* Student ID Input */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student ID / Admission Number</label>
            <input
              type="text"
              value={admissionNumber}
              onChange={(e) => { setAdmissionNumber(e.target.value); setLookup(null); setError(''); }}
              placeholder="e.g. STU-001"
              className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>

          <button
            type="button"
            onClick={doLookup}
            disabled={loading || !admissionNumber.trim()}
            className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Look up'}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Student found */}
          {lookup && !error && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {allStudents.length > 1 ? 'Select your child' : 'Student'}
              </p>

              {allStudents.length > 1 ? (
                <div className="space-y-2">
                  {allStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedStudentId === s.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-800">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-slate-500">{lookup.student.className}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-base font-bold text-slate-800">{lookup.student.firstName} {lookup.student.lastName}</p>
                  <p className="text-sm text-slate-500">{lookup.student.className}</p>
                  {lookup.student.lastActionTime && (
                    <p className="text-xs text-slate-400 mt-1">
                      Last: {lookup.student.lastAction === 'check_in' ? 'Checked in' : 'Checked out'} at {new Date(lookup.student.lastActionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}

              {checkinDisabledOnStudent && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Check-in is not enabled for {selectedStudent.firstName}. Please use the Parent Portal app to enable it, or ask the school to enable it.
                  </p>
                </div>
              )}

              {isAlreadyDone && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {action === 'check_in'
                      ? `${selectedStudent?.firstName} is already checked in today.`
                      : `${selectedStudent?.firstName} is not currently checked in.`}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedStudentId || processing || isAlreadyDone || !!checkinDisabledOnStudent}
                className={`w-full rounded-xl text-white py-3 text-sm font-bold transition-colors disabled:opacity-50 ${
                  action === 'check_in' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {processing ? (
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  `Confirm ${action === 'check_in' ? 'Drop-off' : 'Pick-up'}`
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6">
          School Safety — Student Check-in
        </p>
      </div>
    </div>
  );
};

export default PublicCheckinPage;
