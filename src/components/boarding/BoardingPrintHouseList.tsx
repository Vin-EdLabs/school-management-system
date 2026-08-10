import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, RefreshCw, BedDouble, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  boardingHeroBadgeEmerald,
  boardingHeroEmerald,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';
import { boardingService, type PrintHouseListData } from '@/services/boardingService';
import { usePrintPreview } from '@/contexts/PrintPreviewContext';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderGenderBlock(
  title: string,
  accent: string,
  dorms: PrintHouseListData['males']['dorms']
) {
  if (!dorms.length) return `<p style="color:#64748b;font-size:12px">No ${title.toLowerCase()} dormitories configured.</p>`;
  return dorms
    .map((dorm) => {
      const rooms = dorm.rooms
        .map((room) => {
          const rows = room.beds
            .map(
              (bed) => `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600">${escapeHtml(String(bed.bed_number))}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(bed.student_name || 'VACANT')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(bed.class_name || '—')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(room.room_name)}</td>
              </tr>`
            )
            .join('');
          return `<div style="margin-bottom:12px"><p style="font-weight:600;margin:0 0 6px;color:#334155">${escapeHtml(dorm.dorm_name)} · ${escapeHtml(room.room_name)}</p>
            <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f8fafc">
            <th style="text-align:left;padding:6px 8px">Bed</th><th style="text-align:left;padding:6px 8px">Student</th>
            <th style="text-align:left;padding:6px 8px">Class</th><th style="text-align:left;padding:6px 8px">Room</th>
            </tr></thead><tbody>${rows}</tbody></table></div>`;
        })
        .join('');
      return `<section style="margin-bottom:20px"><h3 style="font-size:14px;color:${accent};text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid ${accent};padding-bottom:4px;margin:0 0 10px">${escapeHtml(dorm.dorm_name)}</h3>${rooms}</section>`;
    })
    .join('');
}

function buildPrintDocument(data: PrintHouseListData) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Boarding Bed Assignments</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:28px;color:#0f172a;font-size:12px}
      h1{font-size:22px;margin:0;color:#047857} h2{font-size:14px;color:#475569;margin:8px 0 20px;font-weight:500}
      .summary{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0 24px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px}
      .summary span{font-weight:600}.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
      .col h2{font-size:13px;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid}
      .male h2{color:#1d4ed8;border-color:#93c5fd}.female h2{color:#be185d;border-color:#f9a8d4}
      @media print{.cols{grid-template-columns:1fr 1fr}}
    </style></head><body>
    <h1>${escapeHtml(data.school_name)}</h1>
    <h2>Boarding bed assignments — ${escapeHtml(data.term_name)} ${escapeHtml(data.year_name)}</h2>
    <div class="summary">
      <span>Total boarders: ${data.summary.total_boarders}</span>
      <span>Male: ${data.summary.males_count}</span>
      <span>Female: ${data.summary.females_count}</span>
      <span>Beds: ${data.summary.occupied_beds} / ${data.summary.total_beds} occupied</span>
    </div>
    <div class="cols">
      <div class="col male"><h2>Male boarders (${data.males.total})</h2>${renderGenderBlock('Male', '#1d4ed8', data.males.dorms)}</div>
      <div class="col female"><h2>Female boarders (${data.females.total})</h2>${renderGenderBlock('Female', '#be185d', data.females.dorms)}</div>
    </div>
    <p style="margin-top:24px;font-size:10px;color:#94a3b8">Generated ${escapeHtml(new Date(data.generated_at).toLocaleString())}</p>
    </body></html>`;
}

function GenderColumn({
  title,
  total,
  dorms,
  tone,
  headerClass,
}: {
  title: string;
  total: number;
  dorms: PrintHouseListData['males']['dorms'];
  tone: string;
  headerClass: string;
}) {
  return (
    <Card className={cn('rounded-2xl shadow-sm overflow-hidden border-t-4', tone)}>
      <CardHeader className={cn('pb-2 border-b', headerClass)}>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>{title}</span>
          <Badge variant="outline" className="tabular-nums">{total} boarder{total === 1 ? '' : 's'}</Badge>
        </CardTitle>
        <CardDescription>Room and bed assignment list</CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {dorms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No dormitories configured.</p>
        ) : (
          dorms.map((dorm) => (
            <div key={dorm.dorm_id} className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-700">{dorm.dorm_name}</p>
              {dorm.rooms.map((room) => (
                <div key={`${dorm.dorm_id}-${room.room_name}`} className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b text-xs font-semibold flex items-center gap-2">
                    <BedDouble className="h-3.5 w-3.5" />
                    {room.room_name}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="px-3 py-2 font-medium">Bed</th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.beds.map((bed) => (
                        <tr key={`${room.room_name}-${bed.bed_number}`} className="border-b last:border-0">
                          <td className="px-3 py-2 font-semibold tabular-nums">{bed.bed_number}</td>
                          <td className={cn('px-3 py-2', !bed.student_name && 'italic text-muted-foreground')}>
                            {bed.student_name || 'Vacant'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{bed.class_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export const BoardingPrintHouseList: React.FC = () => {
  const [data, setData] = useState<PrintHouseListData | null>(null);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const { openPrintPreview } = usePrintPreview();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await boardingService.getPrintHouseList());
    } catch (e) {
      toast({ title: 'Failed to load bed list', description: (e as Error).message, variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const print = () => {
    if (!data) return;
    openPrintPreview({
      title: 'Boarding Bed Assignments',
      printDocumentHtml: buildPrintDocument(data),
      isFullDocument: true,
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroEmerald}>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={boardingHeroBadgeEmerald}>
              <BedDouble className="h-3.5 w-3.5" />
              Room & bed list
            </div>
            <h1 className={boardingHeroTitle}>Print Bed Assignments</h1>
            <p className={boardingHeroSubtitle}>
              Review male and female boarders by dorm, room, and bed — then print a clean house list.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="primaryAction" size="sm" className="rounded-xl" onClick={print} disabled={loading || !data}>
              <Printer className="h-4 w-4 mr-2" />
              Print list
            </Button>
          </div>
        </div>
      </div>

      {data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total boarders', value: data.summary.total_boarders, icon: Users },
              { label: 'Male', value: data.summary.males_count, tone: 'border-blue-200/80 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800/50' },
              { label: 'Female', value: data.summary.females_count, tone: 'border-pink-200/80 bg-pink-50/80 dark:bg-pink-950/30 dark:border-pink-800/50' },
              { label: 'Beds occupied', value: `${data.summary.occupied_beds}/${data.summary.total_beds}`, tone: 'border-emerald-200/80 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-800/50' },
            ].map((kpi) => (
              <Card key={kpi.label} className={cn(boardingKpiCard, kpi.tone)}>
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div ref={previewRef} className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <GenderColumn
              title="Male boarders"
              total={data.males.total}
              dorms={data.males.dorms}
              tone="border-blue-500"
              headerClass="bg-blue-50/50"
            />
            <GenderColumn
              title="Female boarders"
              total={data.females.total}
              dorms={data.females.dorms}
              tone="border-pink-500"
              headerClass="bg-pink-50/50"
            />
          </div>
        </>
      ) : loading ? (
        <Card className="rounded-2xl"><CardContent className="p-10 text-center text-muted-foreground">Loading bed assignments…</CardContent></Card>
      ) : (
        <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-muted-foreground">Could not load the bed list.</CardContent></Card>
      )}
    </div>
  );
};

export default BoardingPrintHouseList;
