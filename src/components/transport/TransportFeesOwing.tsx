import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { resolveLogoUrl } from '../../services/tenantService';
import { fetchClassStudentBalances } from '../../services/studentBalance';
import {
  downloadTransportFeesOwingPdf,
  downloadTransportFeesOwingByBusPdf,
  type TransportOwingRow,
} from './buildTransportFeesOwingPdf';
import {
  Bus,
  FileDown,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Users,
  Wallet,
  AlertCircle,
  PartyPopper,
} from 'lucide-react';

interface RiderRecord {
  id: number;
  student_id?: string | null;
  admission_number?: string | null;
  first_name: string;
  last_name: string;
  class_name: string | null;
  route_id: string;
  route_name: string;
  stop_name: string | null;
  vehicle_plate: string | null;
  vehicle_name: string | null;
  driver_name: string | null;
}

interface OwingRider extends TransportOwingRow {
  key: number;
  routeId: string;
  busLabel: string;
  amountOwed: number;
}

const NO_BUS = 'No bus assigned';

const formatMoney = (n: number) =>
  `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const busLabelOf = (r: Pick<RiderRecord, 'vehicle_name' | 'vehicle_plate'>) => {
  const name = (r.vehicle_name || '').trim();
  const plate = (r.vehicle_plate || '').trim();
  if (!name && !plate) return NO_BUS;
  return name && plate ? `${name} (${plate})` : name || plate;
};

export const TransportFeesOwing: React.FC = () => {
  const { school } = useSchool();

  const [riders, setRiders] = useState<RiderRecord[]>([]);
  const [balances, setBalances] = useState<Record<string, { outstanding?: number }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<null | 'all' | 'bus'>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterBus, setFilterBus] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ridersData, balanceData] = await Promise.all([
        apiService.get<RiderRecord[]>('/transport/students'),
        fetchClassStudentBalances(),
      ]);
      setRiders(Array.isArray(ridersData) ? ridersData : []);
      setBalances((balanceData?.balances as Record<string, { outstanding?: number }>) || {});
    } catch (err: any) {
      console.error('Failed to load transport fees owing:', err);
      setLoadError(err?.message || 'Could not load student balances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // One row per bus rider who still owes school fees (largest debt first)
  const owingRiders = useMemo<OwingRider[]>(() => {
    const seen = new Set<number>();
    const rows: OwingRider[] = [];
    for (const r of riders) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const outstanding = Number(balances[String(r.id)]?.outstanding ?? 0);
      if (!Number.isFinite(outstanding) || outstanding <= 0.001) continue;
      rows.push({
        key: r.id,
        routeId: r.route_id,
        busLabel: busLabelOf(r),
        studentNumber: r.student_id || r.admission_number || '',
        studentName: `${r.first_name} ${r.last_name}`.trim(),
        className: r.class_name || '',
        routeName: r.route_name || '',
        stopName: r.stop_name || '',
        amountOwed: outstanding,
        busName: r.vehicle_name || '',
        busPlate: r.vehicle_plate || '',
        driverName: r.driver_name || '',
      });
    }
    return rows.sort((a, b) => b.amountOwed - a.amountOwed || a.studentName.localeCompare(b.studentName));
  }, [riders, balances]);

  const uniqueRiderCount = useMemo(() => new Set(riders.map(r => r.id)).size, [riders]);

  const routeOptions = useMemo(() => {
    const map = new Map<string, string>();
    owingRiders.forEach(r => map.set(r.routeId, r.routeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [owingRiders]);
  const busOptions = useMemo(
    () => [...new Set(owingRiders.map(r => r.busLabel))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [owingRiders]
  );
  const classOptions = useMemo(
    () => [...new Set(owingRiders.map(r => r.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [owingRiders]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return owingRiders.filter(r => {
      if (filterRoute !== 'all' && r.routeId !== filterRoute) return false;
      if (filterBus !== 'all' && r.busLabel !== filterBus) return false;
      if (filterClass !== 'all' && r.className !== filterClass) return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentNumber.toLowerCase().includes(q) ||
        r.stopName.toLowerCase().includes(q)
      );
    });
  }, [owingRiders, searchTerm, filterRoute, filterBus, filterClass]);

  const totalOwed = useMemo(() => filtered.reduce((sum, r) => sum + r.amountOwed, 0), [filtered]);
  const hasFilters = searchTerm.trim() !== '' || filterRoute !== 'all' || filterBus !== 'all' || filterClass !== 'all';

  const scopeLabel = () => {
    const parts: string[] = [];
    parts.push(filterRoute === 'all' ? 'All routes' : routeOptions.find(([id]) => id === filterRoute)?.[1] || 'Selected route');
    parts.push(filterBus === 'all' ? 'All buses' : filterBus);
    parts.push(filterClass === 'all' ? 'All classes' : filterClass);
    if (searchTerm.trim()) parts.push(`Search: "${searchTerm.trim()}"`);
    return parts.join(' · ');
  };

  const handleDownload = async (mode: 'all' | 'bus') => {
    if (filtered.length === 0) {
      toast({ title: 'Nothing to download', description: 'No students match what is on screen.' });
      return;
    }
    setDownloading(mode);
    try {
      const input = {
        schoolName: school?.name ?? 'School',
        logoUrl: resolveLogoUrl(school?.logo_url ?? null),
        filterLabel: scopeLabel(),
        totalRiders: uniqueRiderCount,
        owing: filtered,
      };
      if (mode === 'bus') {
        const buses = await downloadTransportFeesOwingByBusPdf(input);
        toast({
          title: `${buses.length} PDF${buses.length === 1 ? '' : 's'} downloaded`,
          description: `One file per bus: ${buses.join(', ')}. If your browser asks, allow multiple downloads.`,
        });
      } else {
        await downloadTransportFeesOwingPdf(input);
        toast({ title: 'PDF downloaded', description: `${filtered.length} student(s) owing school fees.` });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Download failed',
        description: err?.message || 'Could not generate the PDF.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterRoute('all');
    setFilterBus('all');
    setFilterClass('all');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white">School Fees Owing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Students who ride the school bus and still owe school fees. Review the list, then download it as a PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading || downloading !== null}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleDownload('all')}
            disabled={loading || downloading !== null || filtered.length === 0}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            {downloading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button
            type="button"
            variant="primaryAction"
            size="sm"
            onClick={() => void handleDownload('bus')}
            disabled={loading || downloading !== null || filtered.length === 0}
            className="rounded-xl h-9 text-xs font-semibold gap-2"
          >
            {downloading === 'bus' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bus className="h-4 w-4" />}
            PDF per bus
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Students on the bus</p>
              <p className="text-xl font-semibold text-slate-800 dark:text-white">{loading ? '—' : uniqueRiderCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600"><AlertCircle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {hasFilters ? 'Owing (filtered)' : 'Owing school fees'}
              </p>
              <p className="text-xl font-semibold text-slate-800 dark:text-white">{loading ? '—' : filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-red-500/10 p-2.5 text-red-600"><Wallet className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total owed</p>
              <p className="text-xl font-semibold text-red-600">{loading ? '—' : formatMoney(totalOwed)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/40 p-2.5 backdrop-blur">
        <div className="relative min-w-[200px] flex-1 basis-56">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, student ID or pickup location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-8.5 rounded-xl pl-8.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterBus} onValueChange={setFilterBus}>
            <SelectTrigger className="h-8.5 rounded-xl text-xs w-40"><SelectValue placeholder="All buses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buses</SelectItem>
              {busOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRoute} onValueChange={setFilterRoute}>
            <SelectTrigger className="h-8.5 rounded-xl text-xs w-40"><SelectValue placeholder="All routes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              {routeOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="h-8.5 rounded-xl text-xs w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 rounded-xl text-xs">
            Clear
          </Button>
        )}
      </div>

      {/* List */}
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Could not load the list</p>
              <p className="max-w-md text-xs text-slate-500">{loadError}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadData()} className="rounded-xl gap-2">
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          ) : owingRiders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <PartyPopper className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No student on the bus owes school fees</p>
              <p className="text-xs text-slate-500">
                {uniqueRiderCount === 0
                  ? 'No students are enrolled on school transport yet.'
                  : 'Every student on school transport is fully paid up.'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No students match these filters</p>
              <Button type="button" size="sm" variant="outline" onClick={clearFilters} className="rounded-xl">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Pickup location</TableHead>
                    <TableHead className="text-right">Amount owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-xs text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.studentName}</p>
                        <p className="font-mono text-[11px] text-slate-500">{r.studentNumber || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{r.className || '—'}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{r.busLabel}</p>
                        {r.driverName ? <p className="text-[11px] text-slate-500">Driver: {r.driverName}</p> : null}
                      </TableCell>
                      <TableCell>
                        <p className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          {r.stopName || '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">{r.routeName}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-red-600">
                        {formatMoney(r.amountOwed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransportFeesOwing;
