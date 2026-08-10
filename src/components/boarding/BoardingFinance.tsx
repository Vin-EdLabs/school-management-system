import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { boardingService, type BoardingFinanceResponse } from '@/services/boardingService';

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(2)}`;
}

export const BoardingFinance: React.FC = () => {
  const [data, setData] = useState<BoardingFinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await boardingService.getBoardingFinance());
    } catch (e) {
      toast({ title: 'Failed to load finance', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boarding Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fee collection overview for all boarders this term.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Expected', value: formatGhs(summary.total_expected), icon: DollarSign },
            { label: 'Collected', value: formatGhs(summary.total_collected), icon: DollarSign },
            { label: 'Outstanding', value: formatGhs(summary.total_outstanding), icon: DollarSign },
            { label: 'Boarders', value: String(summary.boarder_count), icon: DollarSign },
          ].map((s) => (
            <Card key={s.label} className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Dorm</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.boarders || []).map((b) => (
                <TableRow key={b.student_id}>
                  <TableCell className="font-medium">{b.first_name} {b.last_name}</TableCell>
                  <TableCell>{b.class_name || '—'}</TableCell>
                  <TableCell>{b.dorm_name || '—'}</TableCell>
                  <TableCell>{formatGhs(b.boarding_fee)}</TableCell>
                  <TableCell>{formatGhs(b.amount_paid)}</TableCell>
                  <TableCell>{formatGhs(b.outstanding)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{b.payment_status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BoardingFinance;
