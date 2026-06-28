import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, FileDown, GraduationCap, Loader2, ScrollText, Printer } from 'lucide-react';
import {
  AcademicTranscript,
  buildArchivedReportCardHtml,
  formatArchiveDate,
  openArchivedReportCardPrint,
  ReportCardArchiveRow,
} from './reportCardArchiveUtils';
import { openReportCardPrintWindow } from '../reports/buildReportCardPrintHtml';

type Props = {
  studentId: number;
  studentName?: string;
};

export function StudentReportCardHistory({ studentId, studentName }: Props) {
  const [archives, setArchives] = useState<ReportCardArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [previewById, setPreviewById] = useState<Record<number, string>>({});
  const [transcript, setTranscript] = useState<AcademicTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get<{ archives: ReportCardArchiveRow[] }>(
        `/records/students/${studentId}/report-card-archive`
      );
      setArchives(res.archives || []);
    } catch (e: any) {
      toast({ title: 'Could not load report card history', description: e?.message, variant: 'destructive' });
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const loadPreview = async (archiveId: number) => {
    if (previewById[archiveId]) return previewById[archiveId];
    const res = await apiService.get<{ archive: ReportCardArchiveRow & { snapshot_json?: unknown } }>(
      `/records/report-card-archive/${archiveId}`
    );
    const html = buildArchivedReportCardHtml(res.archive);
    if (!html) throw new Error('Archive snapshot is missing or invalid.');
    setPreviewById((prev) => ({ ...prev, [archiveId]: html }));
    return html;
  };

  const togglePreview = async (archiveId: number) => {
    if (expandedId === archiveId) {
      setExpandedId(null);
      return;
    }
    setBusyId(archiveId);
    try {
      await loadPreview(archiveId);
      setExpandedId(archiveId);
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (archiveId: number) => {
    setBusyId(archiveId);
    try {
      const res = await apiService.get<{ archive: ReportCardArchiveRow & { snapshot_json?: unknown } }>(
        `/records/report-card-archive/${archiveId}`
      );
      const ok = openArchivedReportCardPrint(res.archive);
      if (!ok) {
        toast({ title: 'Cannot open report', description: 'Archive snapshot is missing or invalid.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleViewTranscript = async () => {
    if (showTranscript && transcript) {
      setShowTranscript(true);
      return;
    }
    setTranscriptLoading(true);
    try {
      const data = await apiService.get<AcademicTranscript>(
        `/records/students/${studentId}/academic-transcript`
      );
      setTranscript(data);
      setShowTranscript(true);
    } catch (e: any) {
      toast({ title: 'Could not load transcript', description: e?.message, variant: 'destructive' });
    } finally {
      setTranscriptLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report card history…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 records-no-print">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Report Card History</h3>
          {studentName ? <p className="text-sm text-slate-500">{studentName}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleViewTranscript()} disabled={transcriptLoading}>
          {transcriptLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ScrollText className="h-4 w-4 mr-1" />
          )}
          View Transcript
        </Button>
      </div>

      <Card className="records-print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5" /> Saved Report Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {archives.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No saved report cards for this student yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Last Saved</TableHead>
                  <TableHead className="text-right records-no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archives.map((row) => {
                  const isExpanded = expandedId === row.id;
                  const previewHtml = previewById[row.id];
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow className={isExpanded ? 'bg-slate-50' : undefined}>
                        <TableCell className="records-no-print">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-200"
                            onClick={() => void togglePreview(row.id)}
                            aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                          >
                            {busyId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{row.academic_year}</TableCell>
                        <TableCell>{row.term}</TableCell>
                        <TableCell>{row.class_name || '—'}</TableCell>
                        <TableCell>{row.position ?? '—'}</TableCell>
                        <TableCell>{row.percentage != null ? `${row.percentage}%` : '—'}</TableCell>
                        <TableCell>
                          <div className="text-sm">{formatArchiveDate(row.released_at)}</div>
                          {row.released_by_name ? (
                            <div className="text-xs text-slate-500">by {row.released_by_name}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right records-no-print">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => void handleDownload(row.id)}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && previewHtml ? (
                        <TableRow>
                          <TableCell colSpan={8} className="p-0 border-b-4 border-green-500">
                            <div className="bg-white border-x border-b border-slate-200 records-no-print">
                              <div className="flex justify-end gap-2 p-2 border-b border-slate-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openReportCardPrintWindow(previewHtml)}
                                >
                                  <Printer className="h-4 w-4 mr-1" /> Print
                                </Button>
                              </div>
                              <div
                                className="overflow-x-auto p-2 max-h-[70vh] overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showTranscript && transcript ? (
        <Card className="records-print-card" id="student-academic-transcript">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" /> Academic Transcript
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {transcript.terms.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No transcript data available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Class</TableHead>
                    {transcript.subjectColumns.map((subj) => (
                      <TableHead key={subj} className="text-center whitespace-nowrap">{subj}</TableHead>
                    ))}
                    <TableHead className="text-center">Overall %</TableHead>
                    <TableHead className="text-center">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transcript.terms.map((term) => {
                    const scoreBySubject = Object.fromEntries(
                      term.subjects.map((s) => [s.subject, s.score])
                    );
                    return (
                      <TableRow key={term.archiveId}>
                        <TableCell className="font-medium">{term.academicYear}</TableCell>
                        <TableCell>{term.term}</TableCell>
                        <TableCell>{term.className || '—'}</TableCell>
                        {transcript.subjectColumns.map((subj) => (
                          <TableCell key={subj} className="text-center">
                            {scoreBySubject[subj] != null ? scoreBySubject[subj] : '—'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold">
                          {term.percentage != null ? `${term.percentage}%` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {term.position != null ? (
                            <Badge variant="secondary">{term.position}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
