import React, { useCallback, useEffect, useState } from 'react';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchoolOption {
  id: number;
  name: string;
}

interface SystemError {
  id: number;
  message: string;
  stack: string | null;
  source: string;
  tenant_id: number | null;
  tenant_name?: string | null;
  endpoint: string | null;
  action: string | null;
  severity: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

interface SystemHealth {
  status: 'healthy' | 'minor' | 'critical';
  database: string;
  newErrorsLast24h: number;
  criticalErrorsLast24h: number;
  errorsBySource: Array<{ source: string; count: number }>;
  uptimeSeconds: number;
  memoryMb: number;
}

interface SystemHealthModuleProps {
  schools: SchoolOption[];
}

const statusStyles = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle,
  },
  minor: {
    label: 'Minor Issues',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Critical Failures',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    icon: AlertTriangle,
  },
} as const;

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

const SystemHealthModule: React.FC<SystemHealthModuleProps> = ({ schools }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<SystemError | null>(null);
  const [filters, setFilters] = useState({
    tenantId: '',
    source: '',
    status: 'new',
    severity: '',
    search: '',
    startDate: '',
    endDate: '',
    limit: '200',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.tenantId) params.set('tenantId', filters.tenantId);
      if (filters.source) params.set('source', filters.source);
      if (filters.status) params.set('status', filters.status);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.search) params.set('search', filters.search);
      if (filters.startDate && filters.endDate) {
        params.set('startDate', filters.startDate);
        params.set('endDate', filters.endDate);
      }
      if (filters.limit) params.set('limit', filters.limit);

      const [healthRes, errorsRes] = await Promise.all([
        apiService.get<SystemHealth>('/system/health'),
        apiService.get<SystemError[]>(`/system/errors?${params.toString()}`),
      ]);
      setHealth(healthRes);
      setErrors(errorsRes);
    } catch (error: any) {
      toast({
        title: 'Failed to load system health',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = async (id: number, status: 'resolved' | 'ignored') => {
    try {
      await apiService.patch(`/system/errors/${id}/status`, { status });
      toast({ title: `Error marked as ${status}` });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const healthStatus = health?.status || 'healthy';
  const statusMeta = statusStyles[healthStatus];
  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
            System Health / Errors
          </h3>
          <p className="text-sm text-slate-500 font-medium">
            Monitor frontend, backend, service worker, and PWA issues across all tenants.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="h-10 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest px-6"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading && !health ? (
        <BrandedLoading label="Checking system health…" className="py-20" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={cn('border-slate-200 dark:border-slate-800', statusMeta.bg)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    System Status
                  </p>
                  <h4 className={cn('text-xl font-black font-outfit', statusMeta.color)}>
                    {statusMeta.label}
                  </h4>
                </div>
                <StatusIcon className={cn('w-8 h-8', statusMeta.color)} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    New Errors (24h)
                  </p>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">
                    {health?.newErrorsLast24h ?? 0}
                  </h4>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Critical (24h)
                  </p>
                  <h4 className="text-2xl font-black text-red-500 font-outfit">
                    {health?.criticalErrorsLast24h ?? 0}
                  </h4>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    API / Database
                  </p>
                  <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-outfit uppercase">
                    {health?.database === 'connected' ? 'Connected' : 'Unknown'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Uptime {formatUptime(health?.uptimeSeconds || 0)} · {health?.memoryMb ?? 0} MB
                  </p>
                </div>
                <Server className="w-8 h-8 text-emerald-500" />
              </CardContent>
            </Card>
          </div>

          {health?.status === 'healthy' && errors.length === 0 && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h4 className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-outfit">
                System is healthy
              </h4>
              <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-2">
                No unresolved errors match the current filters.
              </p>
            </Card>
          )}

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">
                Error Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search message, endpoint..."
                className="h-10 rounded-xl"
              />
              <select
                value={filters.tenantId}
                onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value }))}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-white dark:bg-slate-900"
              >
                <option value="">All tenants</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-white dark:bg-slate-900"
              >
                <option value="">All sources</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="service_worker">Service Worker</option>
                <option value="pwa">PWA</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-white dark:bg-slate-900"
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
              <select
                value={filters.severity}
                onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-white dark:bg-slate-900"
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="h-10 rounded-xl"
              />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </CardContent>
          </Card>

          {loading ? (
            <BrandedLoading label="Loading errors…" className="py-12" />
          ) : errors.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800 p-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold text-sm">No errors found for the selected filters.</p>
            </Card>
          ) : (
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((error) => (
                    <TableRow
                      key={error.id}
                      className={cn(
                        error.severity === 'critical' && 'bg-red-500/5',
                        'cursor-pointer'
                      )}
                      onClick={() => setSelectedError(error)}
                    >
                      <TableCell>
                        <Badge
                          variant={error.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="uppercase text-[10px] font-black"
                        >
                          {error.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs uppercase font-bold text-slate-500">
                        {error.source}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">{error.message}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {error.tenant_name || (error.tenant_id ? `Tenant #${error.tenant_id}` : 'System')}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-slate-500">
                        {error.endpoint || error.action || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {error.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(error.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {error.status === 'new' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[10px] uppercase"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(error.id, 'resolved');
                              }}
                            >
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-[10px] uppercase"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(error.id, 'ignored');
                              }}
                            >
                              Ignore
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Message</p>
                <p className="mt-1 font-medium">{selectedError.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source</p>
                  <p>{selectedError.source}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Severity</p>
                  <p>{selectedError.severity}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tenant</p>
                  <p>{selectedError.tenant_name || selectedError.tenant_id || 'System'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                  <p>{selectedError.status}</p>
                </div>
              </div>
              {(selectedError.endpoint || selectedError.action) && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endpoint / Action</p>
                  <p>{selectedError.endpoint || selectedError.action}</p>
                </div>
              )}
              {selectedError.stack && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stack Trace</p>
                  <pre className="mt-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs overflow-x-auto whitespace-pre-wrap">
                    {selectedError.stack}
                  </pre>
                </div>
              )}
              {selectedError.metadata && Object.keys(selectedError.metadata).length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Metadata</p>
                  <pre className="mt-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedError.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemHealthModule;
