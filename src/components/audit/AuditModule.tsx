import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  DetailField,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Search,
  Shield,
  Wallet,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReceiptCorrectionsSection from './ReceiptCorrectionsSection';

type ServerAuditRow = {
  id: number;
  created_at: string;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  entity_label?: string | null;
  module?: string | null;
  status?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  user_role?: string | null;
  username?: string | null;
  user_full_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

type ListResponse = {
  items: ServerAuditRow[];
  total: number;
  limit: number;
  offset: number;
};

type SummaryResponse = {
  logs_today?: number;
  failed_logins_today?: number;
  failed_actions_today?: number;
  finance_actions_today?: number;
  delete_actions_today?: number;
  active_users_today?: number;
};

const PAGE_SIZE = 50;

function badgeForAction(action: string, status?: string | null) {
  const a = (action || '').toUpperCase();
  const st = (status || 'success').toLowerCase();
  if (st === 'failed' || a.includes('FAILED') || a.includes('BLOCK')) {
    return 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200';
  }
  if (a.includes('DELETE') || a.includes('REMOVE')) {
    return 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300';
  }
  if (a.includes('LOGIN') && !a.includes('FAILED')) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100';
  }
  if (a.includes('PASSWORD') || a.includes('WARNING')) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100';
  }
  if (a.includes('PAYMENT') || a.includes('FEE') || a.includes('SALARY') || a.includes('EXPENSE')) {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
  }
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('CHANGE')) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100';
  }
  return 'border-border bg-muted/50 text-foreground';
}

const AuditModule = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
  const [auditTab, setAuditTab] = useState<'logs' | 'receipt-corrections'>('logs');
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServerAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState('');
  const [detail, setDetail] = useState<ServerAuditRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(offset));
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (moduleFilter !== 'all') p.set('module', moduleFilter);
    if (statusFilter !== 'all') p.set('status', statusFilter);
    if (actionFilter.trim()) p.set('action', actionFilter.trim());
    return p.toString();
  }, [offset, debouncedSearch, moduleFilter, statusFilter, actionFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await apiService.get<SummaryResponse>('/audit/summary');
      setSummary(s);
    } catch {
      setSummary(null);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get<ListResponse>(`/audit?${queryString}`);
      setRows(res.items || []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast({ title: 'Audit', description: e?.message || 'Failed to load logs', variant: 'destructive' });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!socket) return;
    const onEvt = (evt: { entity?: string }) => {
      if (evt?.entity === 'audit-log') {
        void loadList();
        void loadSummary();
      }
    };
    socket.on('tenant-data-changed', onEvt);
    return () => {
      socket.off('tenant-data-changed', onEvt);
    };
  }, [socket, loadList, loadSummary]);

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (moduleFilter !== 'all') p.set('module', moduleFilter);
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (actionFilter.trim()) p.set('action', actionFilter.trim());
      const csv = await apiService.getText(`/audit/export?${p.toString()}`);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export', description: 'Audit CSV downloaded.' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message || 'Could not export', variant: 'destructive' });
    }
  };

  const printView = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const head = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(String(r.created_at))}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(r.user_full_name || r.username || '')}</td><td>${escapeHtml(r.username || '')}</td><td>${escapeHtml(r.module || '')}</td><td>${escapeHtml(r.summary || '')}</td><td>${escapeHtml(r.ip_address || '')}</td></tr>`
      )
      .join('');
    w.document.write(
      `<html><head><title>Audit log</title></head><body><h1>Audit log</h1><table border="1" cellpadding="6"><thead><tr><th>When</th><th>Action</th><th>Full name</th><th>Username</th><th>Module</th><th>Summary</th><th>IP</th></tr></thead><tbody>${head}</tbody></table></body></html>`
    );
    w.document.close();
    w.print();
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const maxOffset = Math.max(0, total - PAGE_SIZE);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Shield className="h-7 w-7 text-primary" />
            Audit trail
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable activity log for {user?.role === 'finance' ? 'finance & security' : 'security, finance, and admin actions'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void loadList()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={printView} disabled={rows.length === 0}>
            <Printer className="h-4 w-4" />
            Print page
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-8 w-8 text-sky-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Logs today</p>
              <p className="text-2xl font-semibold tabular-nums">{summary?.logs_today ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Failed logins today</p>
              <p className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                {summary?.failed_logins_today ?? '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Finance actions today</p>
              <p className="text-2xl font-semibold tabular-nums">{summary?.finance_actions_today ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Failed actions today</p>
              <p className="text-2xl font-semibold tabular-nums">{summary?.failed_actions_today ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-8 w-8 text-violet-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active users today</p>
              <p className="text-2xl font-semibold tabular-nums">{summary?.active_users_today ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Tabs value={auditTab} onValueChange={(v) => setAuditTab(v as 'logs' | 'receipt-corrections')}>
          <TabsList>
            <TabsTrigger value="logs">All logs</TabsTrigger>
            <TabsTrigger value="receipt-corrections">Receipt corrections</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {auditTab === 'receipt-corrections' && isAdmin ? (
        <ReceiptCorrectionsSection />
      ) : (
        <>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search summary, user, details…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <Select
            value={moduleFilter}
            onValueChange={(v) => {
              setModuleFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="general">General / UI</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="md:col-span-4"
            placeholder="Action code (e.g. LOGIN, FEE_PAYMENT)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b bg-muted/30 py-3">
          <CardTitle className="text-base">
            Activity ({total.toLocaleString()} records)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Page {page} / {totalPages} · {PAGE_SIZE} per page
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[min(70vh,640px)] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <TableRow>
                  <TableHead className="w-[160px]">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="min-w-[200px]">Summary</TableHead>
                  <TableHead className="w-[120px] max-w-[120px]">IP</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No audit entries match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => setDetail(r)}
                    >
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-mono text-[11px]', badgeForAction(r.action, r.status))}>
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.user_full_name || r.username || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            r.username && r.user_full_name && r.user_full_name !== r.username ? `@${r.username}` : null,
                            r.user_role || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{r.module || '—'}</TableCell>
                      <TableCell className="max-w-md truncate text-sm" title={r.summary || undefined}>
                        {r.summary || '—'}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-[11px] text-muted-foreground" title={r.ip_address || undefined}>
                        {r.ip_address || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px]',
                            (r.status || 'success') === 'failed'
                              ? 'border-red-500/30 text-red-700 dark:text-red-300'
                              : 'border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          )}
                        >
                          {r.status || 'success'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset <= 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => Math.min(maxOffset, o + PAGE_SIZE))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className={detailDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Audit detail #{detail?.id}</DialogTitle>
            {detail?.summary ? (
              <p className="text-sm text-muted-foreground line-clamp-2">{detail.summary}</p>
            ) : null}
          </DialogHeader>
          {detail && (
            <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="When">
                  {new Date(detail.created_at).toLocaleString()}
                </DetailField>
                <DetailField label="Status">
                  {detail.status || 'success'}
                </DetailField>
                <DetailField label="Actor (full name)" className="sm:col-span-2">
                  {detail.user_full_name || detail.username || '—'}
                </DetailField>
                <DetailField label="Username">
                  <span className="font-mono text-sm">{detail.username || '—'}</span>
                </DetailField>
                <DetailField label="Role (at event)">
                  {detail.user_role || '—'}
                </DetailField>
                <DetailField label="Action" className="sm:col-span-2">
                  <span className="font-mono text-sm">{detail.action}</span>
                </DetailField>
                <DetailField label="Module / subject" className="sm:col-span-2">
                  <span>
                    {detail.module || '—'} · {detail.entity_type ? detail.entity_type.replace(/_/g, ' ') : '—'}
                  </span>
                  <p className="mt-1 font-medium">
                    {detail.entity_label || detail.summary?.split(' — ').slice(1).join(' — ') || '—'}
                  </p>
                </DetailField>
              </div>
              <Separator />
              <DetailField label="Summary">
                {detail.summary || '—'}
              </DetailField>
              <DetailField label="IP address">
                <span className="font-mono text-xs">{detail.ip_address || '—'}</span>
              </DetailField>
              <DetailField label="Device / browser">
                <span className="text-xs font-normal text-muted-foreground">{detail.user_agent || '—'}</span>
              </DetailField>
              <Separator />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                  Details (JSON)
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-[11px] leading-relaxed break-all dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  {JSON.stringify(detail.details ?? {}, null, 2)}
                </pre>
              </div>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
};

export default AuditModule;
