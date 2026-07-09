import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';

type School = { id: number; name: string };

type LedgerTerm = {
  id: number;
  name: string;
  status?: string;
  academic_year?: string;
  is_current?: boolean;
};

type ClassRow = { id: number; name: string };

type StudentRow = {
  id: number;
  first_name: string;
  last_name: string;
  admission_number?: string;
};

type WipeResult = {
  success: boolean;
  wiped: {
    scope: string;
    termId: number;
    studentsAffected: number;
    ledgerRowsDeleted: number;
    paymentRowsDeleted: number;
    feeStructureRowsDeleted: number;
    snapshotRowsDeleted: number;
  };
};

type SuperAdminFinanceWipeModuleProps = {
  schools: School[];
};

const SuperAdminFinanceWipeModule: React.FC<SuperAdminFinanceWipeModuleProps> = ({ schools }) => {
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [terms, setTerms] = useState<LedgerTerm[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [scope, setScope] = useState<'school' | 'class' | 'student'>('school');
  const [classId, setClassId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [wiping, setWiping] = useState(false);
  const [lastResult, setLastResult] = useState<WipeResult | null>(null);

  const selectedSchool = schools.find((s) => s.id === tenantId) ?? null;
  const selectedTerm = terms.find((t) => t.id === termId) ?? null;

  const requiredPhrase = useMemo(() => {
    if (!selectedTerm) return '';
    return `WIPE ${String(selectedTerm.name).toUpperCase()}`.trim();
  }, [selectedTerm]);

  const loadTerms = useCallback(async (id: number) => {
    const data = await apiService.get<LedgerTerm[]>(`/super-admin/finance/tenants/${id}/terms`);
    setTerms(Array.isArray(data) ? data : []);
  }, []);

  const loadClasses = useCallback(async (id: number) => {
    const data = await apiService.get<ClassRow[]>(`/super-admin/finance/tenants/${id}/classes`);
    setClasses(Array.isArray(data) ? data : []);
  }, []);

  const searchStudents = useCallback(
    async (id: number, q: string) => {
      const data = await apiService.get<StudentRow[]>(
        `/super-admin/finance/tenants/${id}/students?q=${encodeURIComponent(q)}`
      );
      setStudents(Array.isArray(data) ? data : []);
    },
    []
  );

  useEffect(() => {
    if (!tenantId) return;
    void loadTerms(tenantId);
    void loadClasses(tenantId);
    void searchStudents(tenantId, '');
  }, [tenantId, loadTerms, loadClasses, searchStudents]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tenantId) void searchStudents(tenantId, studentQuery);
    }, 300);
    return () => window.clearTimeout(t);
  }, [studentQuery, tenantId, searchStudents]);

  const handleWipe = async () => {
    if (!tenantId || !termId) return;
    setWiping(true);
    try {
      const result = await apiService.delete<WipeResult>('/super-admin/finance/wipe', {
        tenant_id: tenantId,
        term_id: termId,
        scope,
        student_id: scope === 'student' ? studentId ?? undefined : undefined,
        class_id: scope === 'class' ? classId ?? undefined : undefined,
      });
      setLastResult(result);
      setConfirmOpen(false);
      setConfirmPhrase('');
      toast({
        title: 'Finance wipe completed',
        description: `${result.wiped.ledgerRowsDeleted} ledger row(s) and ${result.wiped.paymentRowsDeleted} payment(s) deleted.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Wipe failed',
        description: err instanceof Error ? err.message : 'Could not complete finance wipe',
        variant: 'destructive',
      });
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            Term Finance Wipe
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Permanently delete payment records, fee bills, and fee structure links for a single term.
            Super admin only. This cannot be undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School (tenant)</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={tenantId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setTenantId(id);
                  setTermId(null);
                  setClassId(null);
                  setStudentId(null);
                }}
              >
                <option value="">Select school…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Term</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={termId ?? ''}
                onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : null)}
                disabled={!tenantId}
              >
                <option value="">Select term…</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.academic_year} ({t.status || 'active'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scope</Label>
            <div className="flex flex-wrap gap-4">
              {(['school', 'class', 'student'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="wipe-scope"
                    checked={scope === s}
                    onChange={() => setScope(s)}
                  />
                  {s === 'school' ? 'Entire school' : s === 'class' ? 'Specific class' : 'Specific student'}
                </label>
              ))}
            </div>
          </div>

          {scope === 'class' && (
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={classId ?? ''}
                onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
                disabled={!tenantId}
              >
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'student' && (
            <div className="space-y-2">
              <Label>Student search</Label>
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Name or admission number"
                disabled={!tenantId}
              />
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={studentId ?? ''}
                onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : null)}
                disabled={!tenantId}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.last_name}, {s.first_name}
                    {s.admission_number ? ` (${s.admission_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="destructive"
            className="gap-2"
            disabled={!tenantId || !termId || (scope === 'class' && !classId) || (scope === 'student' && !studentId)}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Permanently wipe term finance data
          </Button>

          {lastResult ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm space-y-1">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Last wipe summary</p>
              <p>Students affected: {lastResult.wiped.studentsAffected}</p>
              <p>Ledger rows deleted: {lastResult.wiped.ledgerRowsDeleted}</p>
              <p>Payments deleted: {lastResult.wiped.paymentRowsDeleted}</p>
              <p>Fee structures unlinked: {lastResult.wiped.feeStructureRowsDeleted}</p>
              <p className="text-muted-foreground mt-2">
                Assign fee structures again before recording new payments for this term.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-red-300 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Permanent finance wipe
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground">
                <p>
                  You are about to permanently delete all payment records, fee bills, and fee structure
                  assignments for:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>School:</strong> {selectedSchool?.name}
                  </li>
                  <li>
                    <strong>Term:</strong> {selectedTerm?.name} — {selectedTerm?.academic_year}
                  </li>
                  <li>
                    <strong>Scope:</strong>{' '}
                    {scope === 'school' ? 'Entire school' : scope === 'class' ? 'One class' : 'One student'}
                  </li>
                </ul>
                <p className="text-red-600 font-medium">This cannot be undone.</p>
                <div className="space-y-2">
                  <Label>Type &quot;{requiredPhrase}&quot; to confirm</Label>
                  <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={wiping || confirmPhrase.trim() !== requiredPhrase}
              onClick={() => void handleWipe()}
            >
              {wiping ? 'Wiping…' : 'Permanently wipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminFinanceWipeModule;
