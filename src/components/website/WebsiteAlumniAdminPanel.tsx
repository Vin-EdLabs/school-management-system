import React, { useState } from 'react';
import { Eye, FileText, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';
import { schoolWebsiteAdminService } from '@/services/schoolWebsiteService';
import { toast } from '@/hooks/use-toast';
import WebsiteTranscriptDetailsDialog from './WebsiteTranscriptDetailsDialog';
import WebsiteTestimonialDetailsDialog from './WebsiteTestimonialDetailsDialog';

const PANEL =
  'rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/70';

const INNER_TAB_LIST =
  'inline-flex h-auto gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50';

const INNER_TAB_TRIGGER =
  'gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800';

function docLabel(type: string) {
  if (type === 'bece') return 'BECE Results';
  if (type === 'both') return 'Transcript & BECE';
  if (type === 'testimonial') return 'Testimonial Letter';
  return 'School Transcript';
}

export default function WebsiteAlumniAdminPanel({
  transcriptRequests,
  testimonials,
  onRefresh,
}: {
  transcriptRequests: Array<Record<string, unknown>>;
  testimonials: Array<Record<string, unknown>>;
  onRefresh: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<'transcripts' | 'testimonials'>('transcripts');
  const [selectedTranscript, setSelectedTranscript] = useState<Record<string, unknown> | null>(null);
  const [selectedTestimonial, setSelectedTestimonial] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  const unreadTranscripts = transcriptRequests.filter((r) => !r.is_read).length;
  const unreadTestimonials = testimonials.filter((t) => !t.is_read).length;

  const markTranscriptRead = async (row: Record<string, unknown>) => {
    setSaving(true);
    try {
      await schoolWebsiteAdminService.markTranscriptRequestRead(Number(row.id));
      toast({ title: 'Marked as read' });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const markTestimonialRead = async (row: Record<string, unknown>) => {
    setSaving(true);
    try {
      await schoolWebsiteAdminService.markTestimonialRead(Number(row.id));
      toast({ title: 'Marked as read' });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'transcripts' | 'testimonials')}>
        <TabsList className={INNER_TAB_LIST}>
          <TabsTrigger value="transcripts" className={INNER_TAB_TRIGGER}>
            <FileText className="h-4 w-4" /> Document requests
            {unreadTranscripts > 0 && (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                {unreadTranscripts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="testimonials" className={INNER_TAB_TRIGGER}>
            <MessageSquareQuote className="h-4 w-4" /> Testimonial letters
            {unreadTestimonials > 0 && (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                {unreadTestimonials}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcripts" className="mt-5">
          <div className={cn(PANEL, 'overflow-hidden')}>
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h3 className="text-sm font-bold">Document requests</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Transcripts, BECE results, and testimonial letters submitted from the Alumni &amp; Records page.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transcriptRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No transcript requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transcriptRequests.map((row) => {
                      const isRead = Boolean(row.is_read);
                      return (
                        <TableRow key={String(row.id)} className={cn(!isRead && 'bg-violet-50/50 dark:bg-violet-950/20')}>
                          <TableCell className="font-medium">{String(row.full_name)}</TableCell>
                          <TableCell>{String(row.completion_year)}</TableCell>
                          <TableCell>{String(row.phone)}</TableCell>
                          <TableCell>{docLabel(String(row.document_type || 'transcript'))}</TableCell>
                          <TableCell>
                            <Badge className="capitalize">{String(row.status || 'pending')}</Badge>
                          </TableCell>
                          <TableCell>{row.created_at ? formatDisplayDate(String(row.created_at)) : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!isRead && (
                                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void markTranscriptRead(row)}>
                                  Mark read
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => setSelectedTranscript(row)}>
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="testimonials" className="mt-5">
          <div className={cn(PANEL, 'overflow-hidden')}>
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h3 className="text-sm font-bold">Testimonial letter requests</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Alumni requesting an official testimonial or reference letter from the school.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testimonials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No testimonial letter requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    testimonials.map((row) => {
                      const isRead = Boolean(row.is_read);
                      return (
                        <TableRow key={String(row.id)} className={cn(!isRead && 'bg-amber-50/50 dark:bg-amber-950/20')}>
                          <TableCell className="font-medium">{String(row.full_name)}</TableCell>
                          <TableCell>{String(row.completion_year || '—')}</TableCell>
                          <TableCell>{String(row.phone)}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {String(row.message || '—')}
                          </TableCell>
                          <TableCell>
                            <Badge className="capitalize">
                              {String(row.status || 'pending') === 'approved' ? 'completed' : String(row.status || 'pending')}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.created_at ? formatDisplayDate(String(row.created_at)) : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!isRead && (
                                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void markTestimonialRead(row)}>
                                  Mark read
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => setSelectedTestimonial(row)}>
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WebsiteTranscriptDetailsDialog
        request={selectedTranscript}
        open={!!selectedTranscript}
        onClose={() => setSelectedTranscript(null)}
        saving={saving}
        onMarkRead={async () => {
          if (!selectedTranscript) return;
          await markTranscriptRead(selectedTranscript);
          setSelectedTranscript(null);
        }}
        onStatusChange={async (status) => {
          if (!selectedTranscript) return;
          setSaving(true);
          try {
            await schoolWebsiteAdminService.updateTranscriptRequestStatus(Number(selectedTranscript.id), status);
            toast({ title: 'Request updated' });
            setSelectedTranscript(null);
            await onRefresh();
          } finally {
            setSaving(false);
          }
        }}
      />

      <WebsiteTestimonialDetailsDialog
        submission={selectedTestimonial}
        open={!!selectedTestimonial}
        onClose={() => setSelectedTestimonial(null)}
        saving={saving}
        onMarkRead={async () => {
          if (!selectedTestimonial) return;
          await markTestimonialRead(selectedTestimonial);
          setSelectedTestimonial(null);
        }}
        onStatusChange={async (status) => {
          if (!selectedTestimonial) return;
          setSaving(true);
          try {
            await schoolWebsiteAdminService.updateTestimonialStatus(Number(selectedTestimonial.id), status);
            toast({ title: 'Testimonial letter request updated' });
            setSelectedTestimonial(null);
            await onRefresh();
          } finally {
            setSaving(false);
          }
        }}
      />
    </>
  );
}
