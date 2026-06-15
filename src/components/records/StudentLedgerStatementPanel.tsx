import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTermStatus } from '../../contexts/TermStatusContext';
import { Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  fetchStudentLedgerStatement,
  type StudentLedgerStatementResponse,
} from '../../services/studentBalance';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import html2pdf from 'html2pdf.js';

function money(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

type Props = {
  studentDbId: number;
  /** Optional header overrides when embedded in profile view */
  studentName?: string;
  studentCode?: string;
  className?: string;
};

export function StudentLedgerStatementPanel({
  studentDbId,
  studentName,
  studentCode,
  className,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string>('all');
  const [data, setData] = useState<StudentLedgerStatementResponse | null>(null);
  const { ledgerTerms } = useTermStatus();

  const loadStatement = useCallback(async (termId: string) => {
    setLoading(true);
    try {
      const opts =
        termId === 'all'
          ? { allTerms: true }
          : termId === 'active'
            ? { currentTermOnly: true }
            : { termId: parseInt(termId, 10) };
      const res = await fetchStudentLedgerStatement(studentDbId, opts);
      setData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load statement';
      toast({ title: 'Could not load statement', description: message, variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentDbId]);

  useEffect(() => {
    void loadStatement(selectedTermId);
  }, [loadStatement, selectedTermId]);

  const handleDownloadPdf = async () => {
    if (!previewRef.current || !data) return;
    setDownloading(true);
    const safeName = (studentName || data.student.fullName).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const safeId = (studentCode || data.student.studentId).replace(/[^\w-]/g, '');
    const filename = `Student_Statement_${safeName}_${safeId}_${new Date().toISOString().split('T')[0]}.pdf`;
    try {
      await html2pdf()
        .set({
          margin: [12, 12, 14, 12],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(previewRef.current)
        .save();
      toast({ title: 'Download started', description: 'Student statement PDF is downloading.' });
    } catch {
      toast({ title: 'Download failed', description: 'Could not generate PDF.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const displayName = studentName || data?.student.fullName || '—';
  const displayId = studentCode || data?.student.studentId || '—';
  const displayClass = className || data?.student.className || '—';
  const termLabel = data?.termLabel || 'Current term';
  const viewingClosed =
    selectedTermId !== 'all' &&
    selectedTermId !== 'active' &&
    ledgerTerms.find((t) => String(t.id) === selectedTermId)?.status === 'closed';

  return (
    <div className="space-y-4">
      {viewingClosed ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">🔒 {termLabel} is closed</span> — This term is read-only. No edits are permitted.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 records-no-print">
        <Select value={selectedTermId} onValueChange={setSelectedTermId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms (full history)</SelectItem>
            <SelectItem value="active">Current term only</SelectItem>
            {data?.availableTerms.map((t) => {
              const closed = ledgerTerms.find((lt) => lt.id === t.termId)?.status === 'closed';
              return (
                <SelectItem key={t.termId} value={String(t.termId)}>
                  {closed ? '🔒 ' : ''}{t.label}{closed ? ' (Closed)' : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDownloadPdf()}
          disabled={!data || loading || downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          Download PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading statement…
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">No ledger statement available.</CardContent>
        </Card>
      ) : (
        <div ref={previewRef} className="student-ledger-statement-preview space-y-4 bg-white p-4 rounded-lg">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Student Financial Statement</h2>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-slate-700">
              <p><span className="font-medium">Student:</span> {displayName}</p>
              <p><span className="font-medium">ID:</span> {displayId}</p>
              <p><span className="font-medium">Class:</span> {displayClass}</p>
              <p><span className="font-medium">Term:</span> {termLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Charged</p>
              <p className="text-lg font-bold text-slate-900">{money(data.summary.totalCharged)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Total Paid</p>
              <p className="text-lg font-bold text-emerald-700">{money(data.summary.totalPaid)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-800">Outstanding</p>
              <p className="text-lg font-bold text-amber-800">{money(Math.max(0, data.summary.outstanding))}</p>
            </div>
          </div>

          <Card className="records-print-card shadow-none border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Statement Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right text-red-600">Debit</TableHead>
                    <TableHead className="text-right text-emerald-600">Credit</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                        No ledger entries for this term.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{formatDisplayDate(entry.date)}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right text-red-600 tabular-nums">
                          {entry.debit > 0 ? money(entry.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 tabular-nums">
                          {entry.credit > 0 ? money(entry.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(entry.runningBalance)}
                        </TableCell>
                        <TableCell>
                          {entry.receiptNumber && entry.paymentId ? (
                            <button
                              type="button"
                              className="text-blue-600 hover:underline text-sm font-medium records-no-print"
                              onClick={() =>
                                toast({
                                  title: `Receipt ${entry.receiptNumber}`,
                                  description: entry.paymentMethod
                                    ? `Payment via ${entry.paymentMethod}`
                                    : 'Ledger payment entry',
                                })
                              }
                            >
                              {entry.receiptNumber}
                            </button>
                          ) : entry.receiptNumber ? (
                            <span className="text-sm text-slate-600">{entry.receiptNumber}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.termSummary && data.termSummary.length > 0 ? (
            <Card className="records-print-card shadow-none border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Term-by-Term Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Fee Billed</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.termSummary.map((row) => (
                      <TableRow key={row.termId}>
                        <TableCell className="font-medium">{row.termLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.feeBilled)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">{money(row.amountPaid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.outstanding)}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-700">
                          {row.credit > 0 ? money(row.credit) : '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-semibold uppercase ${
                              row.status === 'Owing'
                                ? 'text-red-600'
                                : row.status === 'Credit'
                                  ? 'text-blue-600'
                                  : row.status === 'NotSet'
                                    ? 'text-slate-500'
                                    : 'text-emerald-600'
                            }`}
                          >
                            {row.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-xs text-slate-500 text-center pt-2">
            Generated {new Date().toLocaleString()} — sourced from student ledger only.
          </p>
        </div>
      )}
    </div>
  );
}

export default StudentLedgerStatementPanel;
