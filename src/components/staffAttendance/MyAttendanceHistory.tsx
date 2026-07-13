import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatAttendanceDate,
  formatAttendanceTime,
  formatDuration,
  staffAttendanceService,
  type StaffAttendanceRecord,
} from '@/services/staffAttendanceService';
import { toast } from '@/hooks/use-toast';

const MyAttendanceHistory: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StaffAttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await staffAttendanceService.getMyHistory({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        limit,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      toast({
        title: 'Could not load history',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Staff Clock History</h1>
        <p className="text-sm text-slate-500 mt-1">Your personal staff attendance history.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          </div>
          <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-slate-500 flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No attendance records found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check-in</th>
                  <th className="px-4 py-3 font-medium">Check-out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.is_late
                        ? 'bg-amber-50/80 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/40'
                        : 'border-t border-slate-100 dark:border-slate-800'
                    }
                  >
                    <td className="px-4 py-3">{formatAttendanceDate(row.date)}</td>
                    <td className="px-4 py-3">{formatAttendanceTime(row.check_in_time)}</td>
                    <td className="px-4 py-3">{formatAttendanceTime(row.check_out_time)}</td>
                    <td className="px-4 py-3">{formatDuration(row.check_in_time, row.check_out_time)}</td>
                    <td className="px-4 py-3">
                      {row.is_late ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">Late</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700">On time</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate" title={row.late_reason || ''}>
                      {row.late_reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {pages} ({total} records)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendanceHistory;
