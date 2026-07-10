import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Calendar, Plus, Edit2, PowerOff, CheckCircle, Archive, ArchiveRestore, Lock } from 'lucide-react';
import { apiService } from '../../services/api';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { useTermStatus } from '../../contexts/TermStatusContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { formatDisplayDate } from '../../utils/dateFormat';
import TermActivationModal from './TermActivationModal';
import ArrearsSyncModal from './ArrearsSyncModal';
import CloseTermModal from './CloseTermModal';
import CloseTermBeforeSwitchModal from './CloseTermBeforeSwitchModal';

interface AcademicTerm {
  id: string;
  term_name: string;
  year: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_archived?: boolean;
  closed_at?: string | null;
  ledger_status?: string | null;
  ledger_term_id?: number | null;
}

interface LedgerTerm {
  id: number;
  name: string;
  is_current: boolean;
  status?: string;
  academic_year_id: number;
  academic_year_name: string;
}

function extractTermOnly(termLabel: string): string {
  return String(termLabel || '')
    .replace(/\s+\d{4}(\/\d{4})?$/, '')
    .trim() || String(termLabel || '').trim();
}

function academicYearMatches(ledgerYear: string, academicYear: string): boolean {
  const norm = (y: string) => String(y || '').trim().replace(/\s+/g, '');
  const a = norm(ledgerYear);
  const b = norm(academicYear);
  if (a === b) return true;
  const slashA = a.match(/^(\d{4})\/(\d{4})$/);
  const slashB = b.match(/^(\d{4})\/(\d{4})$/);
  if (slashA && slashB) return slashA[1] === slashB[1] && slashA[2] === slashB[2];
  const oneA = a.match(/^(\d{4})$/);
  const oneB = b.match(/^(\d{4})$/);
  if (oneA && slashB) return oneA[1] === slashB[1];
  if (slashA && oneB) return slashA[1] === oneB[1];
  if (oneA && oneB) return oneA[1] === oneB[1];
  return false;
}

function buildFullTermLabel(term: Pick<AcademicTerm, 'term_name' | 'year'>): string {
  const year = String(term.year || '').trim();
  const name = String(term.term_name || '').trim();
  return year && !name.includes(year) ? `${name} ${year}`.trim() : name;
}

function findLedgerForAcademicTerm(term: AcademicTerm, list: LedgerTerm[]): LedgerTerm | undefined {
  const termOnly = extractTermOnly(term.term_name);
  const fullLabel = buildFullTermLabel(term);
  const norm = (s: string) => String(s || '').trim().toLowerCase();
  return list.find((lt) => {
    if (!academicYearMatches(lt.academic_year_name, term.year)) return false;
    const composite = `${lt.name} ${lt.academic_year_name}`.trim();
    return (
      norm(lt.name) === norm(term.term_name) ||
      norm(lt.name) === norm(termOnly) ||
      norm(composite) === norm(fullLabel) ||
      norm(composite) === norm(term.term_name)
    );
  });
}

const AcademicTermManager = () => {
  const { refresh: refreshActiveTerm } = useActiveTerm();
  const { refresh: refreshTermStatus } = useTermStatus();
  const { user } = useAuth();
  const { refresh: refreshData } = useData();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [ledgerTerms, setLedgerTerms] = useState<LedgerTerm[]>([]);
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activationTerm, setActivationTerm] = useState<AcademicTerm | null>(null);
  const [arrearsSyncOpen, setArrearsSyncOpen] = useState(false);
  const [arrearsSyncTermLabel, setArrearsSyncTermLabel] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [closeTermOpen, setCloseTermOpen] = useState(false);
  const [closeBeforeSwitchOpen, setCloseBeforeSwitchOpen] = useState(false);
  const [pendingActivationTerm, setPendingActivationTerm] = useState<AcademicTerm | null>(null);
  const closingFromSwitchRef = useRef(false);
  const [isArchivingAll, setIsArchivingAll] = useState(false);
  const [newTerm, setNewTerm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: '',
  });

  const loadTerms = async (includeArchived = showArchived) => {
    setLoading(true);
    try {
      const termsEndpoint = includeArchived
        ? '/settings/academic-terms?include_archived=1'
        : '/settings/academic-terms';
      const [academicData, ledgerData] = await Promise.all([
        apiService.get<AcademicTerm[]>(termsEndpoint).catch(() => []),
        apiService.get<LedgerTerm[]>('/finance/terms').catch(() => [])
      ]);
      const list = Array.isArray(academicData) ? academicData : [];
      setTerms(list.map((t: any) => ({
        id: t.id.toString(),
        term_name: t.term_name,
        year: t.year,
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        is_active: t.is_active,
        is_archived: !!t.is_archived,
        closed_at: t.closed_at || null,
        ledger_status: t.ledger_status || null,
        ledger_term_id: t.ledger_term_id != null ? Number(t.ledger_term_id) : null,
      })));
      const ledgerList = Array.isArray(ledgerData) ? ledgerData : [];
      setLedgerTerms(ledgerList.map((t: any) => ({
        id: parseInt(String(t.id), 10),
        name: t.name || '',
        is_current: t.is_current || false,
        status: t.status || 'active',
        academic_year_id: parseInt(String(t.academic_year_id), 10),
        academic_year_name: t.academic_year_name || ''
      })));
    } catch (error) {
      console.error('Error loading terms:', error);
      setTerms([]);
      setLedgerTerms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTerms(showArchived);
  }, [showArchived]);

  const findLedgerForAcademic = (term: AcademicTerm) => findLedgerForAcademicTerm(term, ledgerTerms);

  const isTermClosed = (term: AcademicTerm) => {
    if (term.closed_at) return true;
    if (term.ledger_status === 'closed') return true;
    const ledger = findLedgerForAcademic(term);
    return ledger?.status === 'closed';
  };

  const handleArchiveTerm = async (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    if (!term || term.is_active) return;
    try {
      await apiService.put(`/settings/academic-terms/${termId}`, { is_archived: true });
      toast({
        title: 'Term Archived',
        description: `${term.term_name} ${term.year} is hidden from the list. Records are unchanged.`,
      });
      await loadTerms(showArchived);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive term',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreTerm = async (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    if (!term) return;
    try {
      await apiService.put(`/settings/academic-terms/${termId}`, { is_archived: false });
      toast({
        title: 'Term Restored',
        description: `${term.term_name} ${term.year} is visible again.`,
      });
      await loadTerms(showArchived);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to restore term',
        variant: 'destructive',
      });
    }
  };

  const handleArchiveAllInactive = async () => {
    const inactiveCount = terms.filter((t) => !t.is_active && !t.is_archived).length;
    if (inactiveCount === 0) {
      toast({
        title: 'Nothing to archive',
        description: 'All inactive terms are already archived.',
      });
      return;
    }
    setIsArchivingAll(true);
    try {
      const result = await apiService.post<{ archivedCount?: number; message?: string }>(
        '/settings/academic-terms/archive-all',
        {}
      );
      toast({
        title: 'Terms Archived',
        description: result.message || `${result.archivedCount ?? inactiveCount} term(s) hidden from the list.`,
      });
      await loadTerms(showArchived);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive terms',
        variant: 'destructive',
      });
    } finally {
      setIsArchivingAll(false);
    }
  };

  const handleAddTerm = async () => {
    if (!newTerm.name || !newTerm.year || !newTerm.startDate || !newTerm.endDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const cleanName = newTerm.name.replace(new RegExp(`\\s+${newTerm.year}$`), '').trim();

    try {
      await apiService.post('/settings/academic-terms', {
        term_name: cleanName,
        year: newTerm.year,
        start_date: newTerm.startDate,
        end_date: newTerm.endDate,
        is_active: false
      });

      toast({
        title: "Term Added",
        description: `${newTerm.name} ${newTerm.year} has been added successfully`,
      });

      setNewTerm({ name: '', year: new Date().getFullYear().toString(), startDate: '', endDate: '' });
      setIsAddingTerm(false);
      await loadTerms();
      await refreshActiveTerm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add term",
        variant: "destructive"
      });
    }
  };

  const handleSetActiveTerm = (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    if (!term || term.is_active) return;

    if (isTermClosed(term)) {
      toast({
        title: 'Term is closed',
        description: 'Closed terms cannot be re-activated. They are permanently locked.',
        variant: 'destructive',
      });
      return;
    }

    const currentActive = terms.find((t) => t.is_active);
    if (currentActive && currentActive.id !== termId) {
      const activeLedger = findLedgerForAcademic(currentActive);
      if (activeLedger && activeLedger.status !== 'closed') {
        setPendingActivationTerm(term);
        setCloseBeforeSwitchOpen(true);
        return;
      }
    }

    setActivationTerm(term);
  };

  const skipArrearsSyncRef = useRef(false);

  const termsRef = useRef(terms);
  const ledgerTermsRef = useRef(ledgerTerms);
  const activationTermRef = useRef(activationTerm);
  termsRef.current = terms;
  ledgerTermsRef.current = ledgerTerms;
  activationTermRef.current = activationTerm;

  const performTermActivation = useCallback(async () => {
    const termToActivate = activationTermRef.current;
    if (!termToActivate) return;

    const termId = termToActivate.id;
    const previousActive = termsRef.current.find((t) => t.is_active);

    const findLedgerTerm = (academicTerm: AcademicTerm, list: LedgerTerm[]) =>
      findLedgerForAcademicTerm(academicTerm, list);

    let workingLedgerTerms = [...ledgerTermsRef.current];
    let prevLedgerTerm = previousActive ? findLedgerTerm(previousActive, workingLedgerTerms) : null;
    let newLedgerTerm = findLedgerTerm(termToActivate, workingLedgerTerms);

    const ensureLedgerTerm = async (academicTerm: AcademicTerm): Promise<LedgerTerm> => {
      const fullTermName = buildFullTermLabel(academicTerm);
      const row = await apiService.post<{
        id: number;
        name: string;
        is_current?: boolean;
        status?: string;
        academic_year_id: number;
        academic_year_name: string;
      }>('/finance/ensure-ledger-term', {
        year: academicTerm.year,
        term: fullTermName,
      });

      const mapped: LedgerTerm = {
        id: parseInt(String(row.id), 10),
        name: row.name || '',
        is_current: row.is_current || false,
        status: row.status,
        academic_year_id: parseInt(String(row.academic_year_id), 10),
        academic_year_name: row.academic_year_name || '',
      };

      const idx = workingLedgerTerms.findIndex((t) => t.id === mapped.id);
      if (idx >= 0) workingLedgerTerms[idx] = mapped;
      else workingLedgerTerms.push(mapped);
      return mapped;
    };

    if (!newLedgerTerm) {
      newLedgerTerm = await ensureLedgerTerm(termToActivate);
    }

    if (previousActive && !prevLedgerTerm) {
      try {
        prevLedgerTerm = await ensureLedgerTerm(previousActive);
      } catch (err) {
        console.warn('[TermSwitch] Could not resolve previous ledger term:', err);
      }
    }

    if (!newLedgerTerm) {
      throw new Error(
        `Ledger term for "${termToActivate.term_name} ${termToActivate.year}" could not be resolved. ` +
          `Please ensure a corresponding term exists in the Finance section.`
      );
    }

    if (prevLedgerTerm && prevLedgerTerm.id === newLedgerTerm.id) {
      throw new Error(`Cannot switch to the same term (ID: ${newLedgerTerm.id}).`);
    }

    const prevIsClosed = prevLedgerTerm?.status === 'closed';
    if (prevLedgerTerm && prevIsClosed && prevLedgerTerm.id !== newLedgerTerm.id) {
      await apiService.post('/finance/switch-term', {
        currentTermId: prevLedgerTerm.id,
        newTermId: newLedgerTerm.id,
      });
      skipArrearsSyncRef.current = true;
    } else {
      skipArrearsSyncRef.current = false;
    }

    await apiService.put(`/settings/academic-terms/${termId}`, {
      is_active: true,
    });

    const finalTermName = buildFullTermLabel(termToActivate);

    await apiService.put('/settings', {
      current_term: finalTermName,
      current_year: termToActivate.year,
      skip_auto_post: true,
    });
  }, []);

  const handleActivationSuccess = async () => {
    const label = `${activationTerm?.term_name || ''} ${activationTerm?.year || ''}`.trim();
    setActivationTerm(null);

    if (skipArrearsSyncRef.current) {
      skipArrearsSyncRef.current = false;
      toast({
        title: 'Active Term Changed',
        description: `${label || 'The new term'} is now active. Balances were carried forward during the term switch.`,
      });
      await loadTerms();
      await Promise.all([refreshActiveTerm(), refreshData()]);
      return;
    }

    setArrearsSyncTermLabel(label);
    setArrearsSyncOpen(true);
  };

  const handleArrearsSyncComplete = async () => {
    toast({
      title: 'Active Term Changed',
      description: `${arrearsSyncTermLabel || 'The new term'} is now active. Previous arrears and new term fees have been refreshed.`,
    });
    setArrearsSyncOpen(false);
    await loadTerms();
    await Promise.all([refreshActiveTerm(), refreshData()]);
  };

  const handleMarkInactive = async (termId: string) => {
    const termToDeactivate = terms.find(t => t.id === termId);
    if (!termToDeactivate) return;
    if (isTermClosed(termToDeactivate)) {
      toast({
        title: 'Term is closed',
        description: 'This term is already permanently closed.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await apiService.put(`/settings/academic-terms/${termId}`, {
        is_active: false
      });
      toast({
        title: "Term Marked Inactive",
        description: `${termToDeactivate.term_name} ${termToDeactivate.year} is inactive. Use Close Term to lock finance records permanently.`,
      });
      await loadTerms();
      await refreshActiveTerm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update term",
        variant: "destructive"
      });
    }
  };

  const handleUpdateTerm = async (termId: string, updatedData: Partial<AcademicTerm>) => {
    try {
      const cleanName = updatedData.term_name?.replace(new RegExp(`\\s+${updatedData.year}$`), '').trim();

      await apiService.put(`/settings/academic-terms/${termId}`, {
        term_name: cleanName || updatedData.term_name,
        year: updatedData.year,
        start_date: updatedData.start_date,
        end_date: updatedData.end_date
      });

      toast({
        title: "Term Updated",
        description: "Academic term has been updated successfully",
      });

      setEditingTerm(null);
      await loadTerms();
      await refreshActiveTerm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update term",
        variant: "destructive"
      });
    }
  };

  const canCloseTerm =
    user?.role === 'super-admin' || (user?.role === 'administrator' && user?.isPrimaryAdmin);

  const activeTerm = terms.find((t) => t.is_active);
  const visibleTerms = showArchived ? terms : terms.filter((t) => !t.is_archived || t.is_active);
  const archivableCount = terms.filter((t) => !t.is_active && !t.is_archived).length;

  return (
    <>
      <TermActivationModal
        open={!!activationTerm}
        termName={activationTerm?.term_name || ''}
        academicYear={activationTerm?.year || ''}
        onActivate={performTermActivation}
        onClose={() => setActivationTerm(null)}
        onSuccess={handleActivationSuccess}
      />
      <ArrearsSyncModal
        open={arrearsSyncOpen}
        termLabel={arrearsSyncTermLabel}
        onClose={() => setArrearsSyncOpen(false)}
        onComplete={() => void handleArrearsSyncComplete()}
      />
      {activeTerm ? (
        <CloseTermModal
          open={closeTermOpen}
          onOpenChange={setCloseTermOpen}
          academicTermId={activeTerm.id}
          onClosed={async ({ closedTermLabel, nextTermLabel }) => {
            const pending = pendingActivationTerm;
            setPendingActivationTerm(null);

            toast({
              title: 'Term closed',
              description: nextTermLabel
                ? `${closedTermLabel} has been closed. Carry-forward entries created for ${nextTermLabel}.`
                : `${closedTermLabel} has been closed.`,
            });
            await loadTerms(showArchived);
            await refreshActiveTerm();
            await refreshTermStatus();
            await refreshData();

            if (pending) {
              const refreshed = await apiService
                .get<AcademicTerm[]>('/settings/academic-terms')
                .catch(() => []);
              const list = Array.isArray(refreshed) ? refreshed : [];
              const pendingRow = list.find((t: any) => String(t.id) === pending.id);
              if (pendingRow?.is_active) {
                toast({
                  title: 'Term activated',
                  description: `${pending.term_name} ${pending.year} is now active.`,
                });
              } else if (nextTermLabel) {
                toast({
                  title: 'Next term activated',
                  description: `${nextTermLabel} is now active. Close it before switching to ${pending.term_name} ${pending.year}.`,
                });
              }
            }
          }}
        />
      ) : null}
      {activeTerm && pendingActivationTerm ? (
        <CloseTermBeforeSwitchModal
          open={closeBeforeSwitchOpen}
          onOpenChange={(open) => {
            setCloseBeforeSwitchOpen(open);
            if (!open && !closingFromSwitchRef.current) setPendingActivationTerm(null);
            if (!open) closingFromSwitchRef.current = false;
          }}
          onCancel={() => {
            setCloseBeforeSwitchOpen(false);
            setPendingActivationTerm(null);
          }}
          currentTermLabel={`${activeTerm.term_name} ${activeTerm.year}`}
          targetTermLabel={`${pendingActivationTerm.term_name} ${pendingActivationTerm.year}`}
          canCloseTerm={canCloseTerm}
          onCloseCurrentTerm={() => {
            closingFromSwitchRef.current = true;
            setCloseBeforeSwitchOpen(false);
            setCloseTermOpen(true);
          }}
        />
      ) : null}
      <Card className="shadow-sm overflow-hidden">
      <CardHeader className="px-4 py-3 border-b bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 text-base">
              <Calendar className="w-4 h-4" />
              <span>Academic Terms</span>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Create terms, close the current term to switch, or archive old terms to hide them from this list.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {archivableCount > 0 && !showArchived && (
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                disabled={isArchivingAll}
                onClick={() => void handleArchiveAllInactive()}
              >
                <Archive className="w-4 h-4 mr-2" />
                {isArchivingAll ? 'Archiving…' : `Archive all (${archivableCount})`}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            {!isAddingTerm && (
              <Button onClick={() => setIsAddingTerm(true)} size="sm" variant="primaryAction" className="h-9">
                <Plus className="w-4 h-4 mr-2" />
                Add Term
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {activeTerm && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Current Active Term</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{activeTerm.term_name} {activeTerm.year}</p>
                {activeTerm.start_date && activeTerm.end_date && (
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDate(activeTerm.start_date)} - {formatDisplayDate(activeTerm.end_date)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
                {canCloseTerm ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 readonly-allowed"
              data-readonly-allow="view"
              onClick={() => setCloseTermOpen(true)}
            >
                    <Lock className="w-3 h-3 mr-1" />
                    Close Term
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {isAddingTerm && (
          <div className="p-4 border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/60 rounded-xl space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Add New Academic Term</h3>
              <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Create the term first. You can activate it after review.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="termName">Term Name</Label>
                <Input
                  id="termName"
                  className="h-9"
                  value={newTerm.name}
                  onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })}
                  placeholder="e.g., Term 1, First Semester"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="termYear">Academic Year</Label>
                <Input
                  id="termYear"
                  className="h-9"
                  value={newTerm.year}
                  onChange={(e) => setNewTerm({ ...newTerm, year: e.target.value })}
                  placeholder="e.g., 2024"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  className="h-9"
                  value={newTerm.startDate}
                  onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  className="h-9"
                  value={newTerm.endDate}
                  onChange={(e) => setNewTerm({ ...newTerm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" variant="primaryAction" onClick={handleAddTerm}>Add Term</Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingTerm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {showArchived ? 'All Terms (including archived)' : 'Visible Terms'}
            </h3>
            {!showArchived && archivableCount > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {archivableCount} inactive term{archivableCount === 1 ? '' : 's'} can be archived
              </p>
            ) : null}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-3">Loading...</p>
          ) : visibleTerms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {showArchived ? 'No terms found.' : 'No visible terms. Add a term or show archived.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {visibleTerms.map((term) => (
                <div key={term.id} className={`p-3 border rounded-xl transition-colors ${term.is_active ? 'border-emerald-500/30 bg-emerald-500/10' : term.is_archived ? 'border-muted bg-muted/30 opacity-80' : 'border-border bg-card hover:bg-muted/20'}`}>
                  {editingTerm === term.id ? (
                    <EditTermForm
                      term={term}
                      onSave={(data) => handleUpdateTerm(term.id, data)}
                      onCancel={() => setEditingTerm(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium truncate">{term.term_name} {term.year}</h4>
                          {term.is_active && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded">Active</span>
                          )}
                          {!term.is_active && !isTermClosed(term) && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">Inactive</span>
                          )}
                          {term.is_archived && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-600 dark:text-slate-300 rounded">Archived</span>
                          )}
                          {isTermClosed(term) && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-200 rounded inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Closed
                            </span>
                          )}
                        </div>
                        {term.start_date && term.end_date && (
                          <p className="text-xs text-muted-foreground">
                            {formatDisplayDate(term.start_date)} - {formatDisplayDate(term.end_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                        {!term.is_active && !term.is_archived && !isTermClosed(term) && !activeTerm && (
                          <Button size="sm" variant="primaryAction" className="h-8 px-2" onClick={() => handleSetActiveTerm(term.id)}>
                            Set Active
                          </Button>
                        )}
                        {!term.is_active && !term.is_archived && !isTermClosed(term) && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-slate-600"
                            title="Archive term"
                            onClick={() => void handleArchiveTerm(term.id)}
                          >
                            <Archive className="w-3 h-3" />
                          </Button>
                        )}
                        {term.is_archived && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => void handleRestoreTerm(term.id)}
                          >
                            <ArchiveRestore className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                        )}
                        {!term.is_archived && !isTermClosed(term) && (
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingTerm(term.id)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                        {term.is_active && !isTermClosed(term) && (
                          <Button size="icon" variant="outline" onClick={() => handleMarkInactive(term.id)} className="h-8 w-8 text-amber-600 hover:text-amber-700" title="Mark inactive (does not close finance)">
                            <PowerOff className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
};

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${className || ''}`}>{children}</span>
);

const EditTermForm: React.FC<{
  term: AcademicTerm;
  onSave: (data: Partial<AcademicTerm>) => void;
  onCancel: () => void;
}> = ({ term, onSave, onCancel }) => {
  const [editData, setEditData] = useState({
    term_name: term.term_name,
    year: term.year,
    start_date: term.start_date,
    end_date: term.end_date
  });

  const handleSave = () => {
    if (!editData.term_name || !editData.year || !editData.start_date || !editData.end_date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    onSave(editData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Term Name</Label>
          <Input
            value={editData.term_name}
            onChange={(e) => setEditData({ ...editData, term_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Academic Year</Label>
          <Input
            value={editData.year}
            onChange={(e) => setEditData({ ...editData, year: e.target.value })}
          />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={editData.start_date}
            onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label>End Date</Label>
          <Input
            type="date"
            value={editData.end_date}
            onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <Button size="sm" variant="primaryAction" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default AcademicTermManager;
