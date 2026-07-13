import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useImpersonationOptional } from '../../contexts/ImpersonationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { Eye, Loader2, Search, UserRoundSearch, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type SearchRow = {
  kind: 'staff' | 'parent';
  userId?: number;
  studentId?: number;
  label: string;
  sublabel: string;
  role: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const BecomeUserPanel: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useAuth();
  const { schoolId, school } = useSchool();
  const impersonation = useImpersonationOptional();
  const loading = impersonation?.loading ?? false;
  const startAutoImpersonation = impersonation?.startAutoImpersonation;
  const startStaffImpersonation = impersonation?.startStaffImpersonation;
  const startParentImpersonation = impersonation?.startParentImpersonation;

  const [identifier, setIdentifier] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(schoolId ? String(schoolId) : '');
  const [schools, setSchools] = useState<Array<{ id: number; name: string; slug?: string }>>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  const isSuper = user?.role === 'super-admin';
  const showSchoolPicker = isSuper && !schoolId;

  useEffect(() => {
    if (!open) return;
    if (schoolId) {
      setSelectedTenantId(String(schoolId));
      return;
    }
    if (!showSchoolPicker) return;

    setSchoolsLoading(true);
    setSchoolsError(null);
    apiService
      .get<Array<{ id: number; name: string; slug?: string }>>('/schools')
      .then((list) => {
        const rows = (Array.isArray(list) ? list : [])
          .filter((s) => s?.id)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setSchools(rows);
        if (rows.length === 0) {
          setSchoolsError('No schools found.');
        } else if (!selectedTenantId) {
          setSelectedTenantId(String(rows[0].id));
        }
      })
      .catch((err: unknown) => {
        setSchools([]);
        setSchoolsError(err instanceof Error ? err.message : 'Could not load schools');
        toast({
          title: 'Could not load schools',
          description: err instanceof Error ? err.message : 'Try again',
          variant: 'destructive',
        });
      })
      .finally(() => setSchoolsLoading(false));
  }, [open, showSchoolPicker, schoolId]);

  const tenantId = parseInt(selectedTenantId || String(schoolId || ''), 10);

  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q || !tenantId || Number.isNaN(tenantId)) return;
    setSearching(true);
    try {
      const res = await apiService.get<{ items: SearchRow[] }>(
        `/auth/impersonate/targets?tenantId=${tenantId}&q=${encodeURIComponent(q)}`
      );
      setSearchResults(res.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQ, tenantId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchQ.trim().length >= 2) void runSearch();
      else setSearchResults([]);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchQ, runSearch]);

  const handleSubmitId = async () => {
    const id = identifier.trim();
    if (!id) return;
    if (!tenantId || Number.isNaN(tenantId)) {
      toast({ title: 'Select a school first', variant: 'destructive' });
      return;
    }
    if (!startAutoImpersonation) return;
    try {
      onClose();
      await startAutoImpersonation(id, tenantId);
    } catch (e: unknown) {
      toast({
        title: 'Could not become user',
        description: e instanceof Error ? e.message : 'Try another ID',
        variant: 'destructive',
      });
    }
  };

  const handlePick = async (row: SearchRow) => {
    if (!tenantId || Number.isNaN(tenantId)) return;
    if (!startStaffImpersonation || !startParentImpersonation) return;
    try {
      onClose();
      if (row.kind === 'parent' && row.studentId) {
        await startParentImpersonation({ studentId: row.studentId, tenantId });
      } else if (row.userId) {
        await startStaffImpersonation({ targetUserId: row.userId, tenantId });
      }
    } catch (e: unknown) {
      toast({
        title: 'Could not become user',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setIdentifier('');
      setSearchQ('');
      setSearchResults([]);
      setSchoolsError(null);
      if (!schoolId) setSelectedTenantId('');
    }
  }, [open, schoolId]);

  if (!open || !impersonation) return null;

  const panel = (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <UserRoundSearch className="h-5 w-5 text-amber-500" />
              Become a User
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              View the system exactly as another user — no password required.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showSchoolPicker && (
          <div className="mb-4 space-y-1.5">
            <Label className="text-xs">School</Label>
            {schoolsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : schoolsError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {schoolsError}
              </p>
            ) : (
              <Select
                modal={false}
                value={selectedTenantId || undefined}
                onValueChange={setSelectedTenantId}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select school…" />
                </SelectTrigger>
                <SelectContent className="z-[10060] max-h-64" position="popper">
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {!showSchoolPicker && school && (
          <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            School: <span className="font-medium text-foreground">{school.name}</span>
          </p>
        )}

        {isSuper && !tenantId && !schoolsLoading && (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">Select a school above to search or enter an ID.</p>
        )}

        {isSuper ? (
          <>
            <div className="mb-3 space-y-1.5">
              <Label className="text-xs">Search user or student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Name, username, staff ID, student ID…"
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {searching ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                </div>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {searchQ.trim().length >= 2 ? 'No matches' : 'Type at least 2 characters to search'}
                </p>
              ) : (
                searchResults.map((row) => (
                  <button
                    key={`${row.kind}-${row.userId ?? row.studentId}`}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => void handlePick(row)}
                    disabled={loading}
                  >
                    <Eye className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.sublabel} · {row.role}
                        {row.kind === 'parent' ? ' (parent portal)' : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs">{isSuper ? 'Or enter ID directly' : 'Teacher ID or Student ID'}</Label>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. TCH001 or 20260045"
            className="h-10"
            onKeyDown={(e) => e.key === 'Enter' && void handleSubmitId()}
          />
          <p className="text-[10px] text-muted-foreground">
            Staff IDs open their dashboard. Student IDs open the parent portal (account created if needed).
          </p>
        </div>

        <Button
          type="button"
          className="mt-4 h-10 w-full bg-amber-500 text-white hover:bg-amber-600"
          disabled={loading || !identifier.trim() || !tenantId || Number.isNaN(tenantId)}
          onClick={() => void handleSubmitId()}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          View as user
        </Button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
};

export default BecomeUserPanel;
