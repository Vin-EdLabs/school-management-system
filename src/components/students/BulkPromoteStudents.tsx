import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, GraduationCap, Loader2, Users } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import { useData } from '@/contexts/DataContext';
import { resolveLogoUrl } from '@/services/tenantService';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type ClassStudent = {
  id: number;
  fullName: string;
  studentId: string;
  photoUrl: string | null;
  className: string | null;
  status: string;
  hasOutstandingBalance: boolean;
};

type ClassPayload = {
  class: { id: number; className: string; level: string | null; isFinalClass: boolean };
  students: ClassStudent[];
  suggestedToClassId: number | null;
  classes: Array<{ id: number; className: string; level: string | null; isFinalClass: boolean }>;
};

type BulkPromoteStudentsProps = {
  onViewHistory?: () => void;
  embedded?: boolean;
  initialStudentId?: string | null;
  onConsumeInitialStudentId?: () => void;
};

const BulkPromoteStudents: React.FC<BulkPromoteStudentsProps> = ({
  onViewHistory,
  embedded = false,
  initialStudentId = null,
  onConsumeInitialStudentId,
}) => {
  const { classes, students: registryStudents, refresh } = useData();
  const { currentYear } = useActiveTerm();
  const [fromClassId, setFromClassId] = useState('');
  const [payload, setPayload] = useState<ClassPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toClassId, setToClassId] = useState('');
  const [graduateMode, setGraduateMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const academicYearLabel = useMemo(() => {
    const y = Number(currentYear) || new Date().getFullYear();
    return `${y}/${y + 1}`;
  }, [currentYear]);

  const loadClass = useCallback(async (classId: string) => {
    if (!classId) {
      setPayload(null);
      setSelected(new Set());
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.get<ClassPayload>(`/promotions/class/${classId}/students`);
      setPayload(data);
      if (initialStudentId) {
        const id = Number(initialStudentId);
        setSelected(data.students.some((s) => s.id === id) ? new Set([id]) : new Set());
        onConsumeInitialStudentId?.();
      } else {
        setSelected(new Set(data.students.map((s) => s.id)));
      }
      if (data.class.isFinalClass) {
        setGraduateMode(true);
        setToClassId('GRADUATE');
      } else if (data.suggestedToClassId) {
        setGraduateMode(false);
        setToClassId(String(data.suggestedToClassId));
      } else {
        setGraduateMode(false);
        setToClassId('');
      }
    } catch {
      toast.error('Could not load students for this class');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [initialStudentId, onConsumeInitialStudentId]);

  useEffect(() => {
    void loadClass(fromClassId);
  }, [fromClassId, loadClass]);

  useEffect(() => {
    if (!initialStudentId) return;
    const student = registryStudents.find((s) => s.id === String(initialStudentId));
    if (student?.classAssignedId) {
      setFromClassId(String(student.classAssignedId));
    }
  }, [initialStudentId, registryStudents]);

  const students = payload?.students ?? [];
  const allSelected = students.length > 0 && selected.size === students.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRow = (id: number) => toggleOne(id);

  const selectedStudents = students.filter((s) => selected.has(s.id));
  const fromClassName = payload?.class.className ?? classes.find((c) => c.id === fromClassId)?.className ?? '';
  const toClassName =
    graduateMode || toClassId === 'GRADUATE'
      ? 'Graduate (Alumni)'
      : payload?.classes.find((c) => String(c.id) === toClassId)?.className ?? '';

  const runPromotion = async () => {
    if (!fromClassId || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await apiService.post<{ promotedCount: number; failedIds: string[] }>('/promotions/bulk', {
        studentIds: [...selected],
        fromClassId: Number(fromClassId),
        toClassId: graduateMode || toClassId === 'GRADUATE' ? 'GRADUATE' : Number(toClassId),
        academicYear: academicYearLabel,
      });
      toast.success(
        `${res.promotedCount} student${res.promotedCount === 1 ? '' : 's'} ${
          graduateMode ? 'graduated' : `promoted to ${toClassName}`
        } successfully`
      );
      await refresh(['students', 'classes']);
      setConfirmOpen(false);
      setFromClassId('');
      setPayload(null);
      setSelected(new Set());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Promotion failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: embedded ? undefined : 1100,
        margin: embedded ? undefined : '0 auto',
        padding: embedded ? '0 0 96px' : 32,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: embedded ? 20 : 28, gap: 16 }}>
        <div>
          {!embedded && (
            <h1 style={{ fontSize: 28, fontWeight: 600, color: '#111827', margin: 0 }}>Promote Students</h1>
          )}
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: embedded ? 0 : 6, marginBottom: 0 }}>
            Select students to promote to the next class
          </p>
        </div>
        {onViewHistory ? (
          <button
            type="button"
            onClick={onViewHistory}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            View Promotion History →
          </button>
        ) : null}
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
          Promoting from
        </label>
        <select
          value={fromClassId}
          onChange={(e) => setFromClassId(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 360,
            height: 44,
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            padding: '0 12px',
            fontSize: 14,
            background: '#fff',
          }}
        >
          <option value="">Select class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.className}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
          <Loader2 className="animate-spin mx-auto mb-2" size={28} />
          Loading students…
        </div>
      ) : fromClassId && students.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            border: '1px dashed #d1d5db',
            borderRadius: 16,
            color: '#6b7280',
            background: '#f9fafb',
          }}
        >
          <Users className="mx-auto mb-3 opacity-40" size={40} />
          <p style={{ fontWeight: 600, margin: 0 }}>No students in this class</p>
        </div>
      ) : students.length > 0 ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
              aria-label="Select all students"
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {selected.size} of {students.length} students selected
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ width: 44, padding: 12 }} />
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Photo</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Current Class</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Student ID</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const isSel = selected.has(s.id);
                  const photo = resolveLogoUrl(s.photoUrl);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => toggleRow(s.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSel ? '#eff6ff' : '#fff',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleOne(s.id)} />
                      </td>
                      <td style={{ padding: 12 }}>
                        {photo ? (
                          <img src={photo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: '#e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#6b7280',
                            }}
                          >
                            {s.fullName.slice(0, 1)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 12, fontWeight: 600, color: '#111827' }}>
                        {s.fullName}
                        {s.hasOutstandingBalance ? (
                          <AlertTriangle size={14} className="inline ml-2 text-amber-500" title="Outstanding fee balance" />
                        ) : null}
                      </td>
                      <td style={{ padding: 12, color: '#374151' }}>{s.className ?? '—'}</td>
                      <td style={{ padding: 12, fontFamily: 'monospace', color: '#374151' }}>{s.studentId}</td>
                      <td style={{ padding: 12, color: '#6b7280', textTransform: 'capitalize' }}>{s.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selected.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#fff',
            borderTop: '1px solid #e5e7eb',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
            padding: '16px 24px',
            zIndex: 40,
            animation: 'slideUp 200ms ease',
          }}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{selected.size} students selected</p>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Promote to:</span>
                {payload?.class.isFinalClass ? (
                  <select
                    value={graduateMode ? 'GRADUATE' : toClassId}
                    onChange={(e) => {
                      if (e.target.value === 'GRADUATE') {
                        setGraduateMode(true);
                        setToClassId('GRADUATE');
                      } else {
                        setGraduateMode(false);
                        setToClassId(e.target.value);
                      }
                    }}
                    style={{ height: 40, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 12px', minWidth: 200 }}
                  >
                    <option value="GRADUATE">Graduate (Alumni)</option>
                    {payload.classes
                      .filter((c) => c.id !== payload.class.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.className}
                        </option>
                      ))}
                  </select>
                ) : (
                  <select
                    value={toClassId}
                    onChange={(e) => {
                      setGraduateMode(false);
                      setToClassId(e.target.value);
                    }}
                    style={{ height: 40, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 12px', minWidth: 200 }}
                  >
                    <option value="">Select class…</option>
                    {payload?.classes
                      .filter((c) => c.id !== payload?.class.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.className}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="outline" onClick={() => setSelected(new Set())}>
                Cancel
              </Button>
              <Button
                disabled={!toClassId && !graduateMode}
                onClick={() => setConfirmOpen(true)}
                style={{ background: '#1a3a6b' }}
              >
                Promote {selected.size} Students →
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Promote {selected.size} students?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong>From:</strong> {fromClassName}
            </p>
            <p>
              <strong>To:</strong> {toClassName}
            </p>
            <p>
              <strong>Academic Year:</strong> {academicYearLabel}
            </p>
            <p className="font-medium text-slate-800">These students will be moved:</p>
            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-2">
              {selectedStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                    {s.fullName.slice(0, 1)}
                  </div>
                  <span>{s.fullName}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void runPromotion()} disabled={submitting}>
              {submitting ? 'Promoting…' : 'Confirm Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default BulkPromoteStudents;
