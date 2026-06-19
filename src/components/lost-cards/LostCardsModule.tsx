import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService } from '@/services/api';

type ReportListItem = {
  id: string;
  reference_code: string;
  bearer_name: string;
  scanned_id: string;
  entity_type: string;
  status: string;
  reported_at: string;
  details_submitted_at: string | null;
  detail_skipped: boolean;
};

type TimelineEvent = {
  icon: string;
  at: string;
  title: string;
  detail?: string;
};

type LostCardsModuleProps = {
  initialReportId?: string | null;
  onClearReportId?: () => void;
};

const LostCardsModule: React.FC<LostCardsModuleProps> = ({ initialReportId, onClearReportId }) => {
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId || null);
  const [detail, setDetail] = useState<{ report: ReportListItem & Record<string, unknown>; timeline: TimelineEvent[] } | null>(null);

  useEffect(() => {
    if (initialReportId) setSelectedId(initialReportId);
  }, [initialReportId]);

  useEffect(() => {
    void apiService
      .get<{ items: ReportListItem[] }>('/lost-cards/reports')
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void apiService
      .get<{ report: ReportListItem & Record<string, unknown>; timeline: TimelineEvent[] }>(`/lost-cards/reports/${selectedId}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedId]);

  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  if (selectedId && detail) {
    const r = detail.report;
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedId(null);
            onClearReportId?.();
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> All reports
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Lost Card Report #{r.reference_code}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {String(r.bearer_name)} · {String(r.scanned_id)} · {String(r.entity_type)}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Timeline</p>
              <div className="space-y-4 border-l-2 border-muted pl-4 ml-2">
                {detail.timeline.map((ev, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium">
                      {ev.icon} {formatDt(ev.at)}
                    </p>
                    <p className="text-sm text-foreground mt-0.5">{ev.title}</p>
                    {ev.detail && (
                      <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-sans">{ev.detail}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground">Status:</span> {String(r.status)}
              </p>
              {r.found_location && (
                <p className="mt-2">
                  <span className="text-muted-foreground">Found location:</span> {String(r.found_location)}
                </p>
              )}
              {r.collection_point && (
                <p className="mt-1">
                  <span className="text-muted-foreground">Collection point:</span> {String(r.collection_point)}
                </p>
              )}
              {r.reporter_phone && (
                <p className="mt-1">
                  <span className="text-muted-foreground">Reporter phone:</span> {String(r.reporter_phone)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Lost Card Reports</h1>
        <p className="text-sm text-muted-foreground">Reports submitted via ID card verification QR codes.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No lost card reports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(row.id)}
                  >
                    <TableCell className="font-mono text-xs">{row.reference_code}</TableCell>
                    <TableCell>{row.bearer_name}</TableCell>
                    <TableCell>{row.scanned_id}</TableCell>
                    <TableCell className="text-xs">{formatDt(row.reported_at)}</TableCell>
                    <TableCell>{row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LostCardsModule;
