import React, { useCallback, useEffect, useState } from 'react';
import { fetchAnnouncementReaders } from '../../services/globalAnnouncementsApi';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  alertDialogContentClass,
  alertDialogContentWideClass,
  alertDialogHeaderClass,
  alertDialogBodyClass,
  alertDialogFooterClass,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  formDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  dialogTitleClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Plus, RefreshCw, Trash2, Power, Eye, FileSearch } from 'lucide-react';
import {
  ANNOUNCEMENT_TYPE_OPTIONS,
  createSuperAnnouncement,
  deleteSuperAnnouncement,
  fetchSuperAnnouncements,
  toggleSuperAnnouncement,
  TYPE_BORDER_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
  type AnnouncementFormInput,
  type AnnouncementType,
  type GlobalAnnouncement,
} from '../../services/globalAnnouncementsApi';
import '../announcements/GlobalAnnouncementPopup.css';

interface SchoolOption {
  id: number;
  name: string;
}

const emptyForm = (): AnnouncementFormInput => ({
  title: '',
  body: '',
  type: 'info',
  target: 'all',
  targetTenantIds: [],
  scheduledAt: '',
  expiresAt: '',
  isActive: true,
});

function statusBadgeVariant(status?: string) {
  if (status === 'Active') return 'default';
  if (status === 'Scheduled') return 'secondary';
  if (status === 'Expired') return 'outline';
  return 'destructive';
}

function formatPreviewBody(body: string, sampleSchoolName: string): string {
  return body.replace(/\{\{school_name\}\}/gi, sampleSchoolName);
}

function highlightSchoolName(text: string, schoolName: string): React.ReactNode {
  if (!schoolName || !text.includes(schoolName)) return text;
  const parts = text.split(schoolName);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <span className="school-name-highlight">{schoolName}</span> : null}
    </React.Fragment>
  ));
}

const GlobalAnnouncementsModule: React.FC<{ schools: SchoolOption[] }> = ({ schools }) => {
  const [items, setItems] = useState<GlobalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AnnouncementFormInput>(emptyForm());
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<GlobalAnnouncement | null>(null);
  const [readersModalId, setReadersModalId] = useState<number | null>(null);
  const [readers, setReaders] = useState<Array<Record<string, unknown>>>([]);
  const [loadingReaders, setLoadingReaders] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSuperAnnouncements();
      setItems(list);
    } catch (e: unknown) {
      toast({
        title: 'Failed to load announcements',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const insertPlaceholder = () => {
    setForm((f) => ({
      ...f,
      body: f.body.includes('{{school_name}}') ? f.body : `${f.body}{{school_name}}`,
    }));
  };

  useEffect(() => {
    if (usePlaceholder && !form.body.includes('{{school_name}}')) {
      insertPlaceholder();
    }
  }, [usePlaceholder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: 'Title and message are required', variant: 'destructive' });
      return;
    }
    if (form.target === 'selected' && form.targetTenantIds.length === 0) {
      toast({ title: 'Select at least one school', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createSuperAnnouncement({
        ...form,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : '',
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : '',
      });
      toast({ title: 'Announcement created' });
      setForm(emptyForm());
      setShowForm(false);
      setUsePlaceholder(false);
      await load();
    } catch (err: unknown) {
      toast({ title: 'Create failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleSuperAnnouncement(id);
      await load();
    } catch (err: unknown) {
      toast({ title: 'Toggle failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteSuperAnnouncement(deleteId);
      toast({ title: 'Announcement deleted' });
      setDeleteId(null);
      await load();
    } catch (err: unknown) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const openReaders = async (id: number) => {
    setReadersModalId(id);
    setLoadingReaders(true);
    try {
      const r = await fetchAnnouncementReaders(id);
      setReaders(r as any[]);
    } catch (err: unknown) {
      toast({ title: 'Failed to load readers', description: (err as Error).message, variant: 'destructive' });
      setReaders([]);
    } finally {
      setLoadingReaders(false);
    }
  };

  const toggleSchool = (id: number) => {
    setForm((f) => ({
      ...f,
      targetTenantIds: f.targetTenantIds.includes(id)
        ? f.targetTenantIds.filter((x) => x !== id)
        : [...f.targetTenantIds, id],
    }));
  };

  const sortedSchools = [...schools].sort((a, b) => a.name.localeCompare(b.name));
  const previewSampleSchool = sortedSchools[0]?.name || 'Your School';

  const renderAnnouncementPreview = (row: GlobalAnnouncement) => {
    const announcementType = (row.type as AnnouncementType) || 'info';
    const borderColor = TYPE_BORDER_COLORS[announcementType] || TYPE_BORDER_COLORS.info;
    const typeLabel = TYPE_LABELS[announcementType] || TYPE_LABELS.info;
    const typeIcon = TYPE_ICONS[announcementType] || TYPE_ICONS.info;
    const displayBody = formatPreviewBody(row.body, previewSampleSchool);
    const sentLabel = new Date(row.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="global-announcement-card mx-auto max-w-lg shadow-lg" style={{ borderTopColor: borderColor }}>
        <div className="global-announcement-card__top">
          <img src="/android-chrome-192x192.png" alt="ScholarNerve" className="global-announcement-card__logo" />
          <div className="global-announcement-card__logo-divider" />
        </div>
        <div className="global-announcement-card__type-row">
          <span className="global-announcement-card__type-icon" aria-hidden>
            {typeIcon}
          </span>
          <span className="global-announcement-card__type-label" style={{ color: borderColor }}>
            {typeLabel}
          </span>
        </div>
        <h2 className="global-announcement-card__title">{row.title}</h2>
        <div className="global-announcement-card__body">
          {highlightSchoolName(displayBody, previewSampleSchool)}
        </div>
        <div className="global-announcement-card__footer-divider" />
        <div className="global-announcement-card__meta">📅 Sent {sentLabel}</div>
        <div className="global-announcement-card__watermark">Powered by ScholarNerve</div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-indigo-500" />
            Global Announcements
          </h3>
          <p className="text-sm text-slate-500 font-medium">
            Send important messages to all schools or selected schools. Administrators and finance staff see a popup on login until they mark it read.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-indigo-200 dark:border-indigo-900/50">
          <CardHeader>
            <CardTitle className="text-lg">Create Announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Scheduled Maintenance Notice"
                  className="mt-1 rounded-xl"
                  maxLength={255}
                />
              </div>
              <div>
                <Label htmlFor="ann-body">Message Body</Label>
                <Textarea
                  id="ann-body"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Hello {{school_name}}, we want to inform you that..."
                  className="mt-1 min-h-[140px] rounded-xl"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="ann-placeholder"
                    checked={usePlaceholder}
                    onCheckedChange={(v) => setUsePlaceholder(!!v)}
                  />
                  <Label htmlFor="ann-placeholder" className="text-sm font-normal cursor-pointer">
                    Use school name placeholder — inserts {'{{school_name}}'} into the message
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnouncementFormInput['type'] }))}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-white dark:bg-slate-900"
                  >
                    {ANNOUNCEMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Target Schools</Label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={form.target === 'all'}
                        onChange={() => setForm((f) => ({ ...f, target: 'all', targetTenantIds: [] }))}
                      />
                      All Schools
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={form.target === 'selected'}
                        onChange={() => setForm((f) => ({ ...f, target: 'selected' }))}
                      />
                      Selected Schools
                    </label>
                  </div>
                </div>
              </div>
              {form.target === 'selected' && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sortedSchools.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.targetTenantIds.includes(s.id)}
                        onCheckedChange={() => toggleSchool(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ann-sched">Schedule (optional)</Label>
                  <Input
                    id="ann-sched"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="ann-exp">Expiry (optional)</Label>
                  <Input
                    id="ann-exp"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Publishing…' : 'Publish Announcement'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <BrandedLoading label="Loading announcements…" className="py-16" />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No announcements yet. Create one to notify schools.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Read</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <TableCell
                    className="max-w-[220px] font-semibold"
                    onClick={() => setPreviewItem(row)}
                  >
                    <button
                      type="button"
                      className="truncate text-left text-emerald-800 hover:underline dark:text-emerald-300"
                      title="Click to preview"
                    >
                      {row.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{row.target_label}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(row.display_status)}>{row.display_status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.read_count ?? 0} of {row.eligible_user_count ?? 0}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setPreviewItem(row)}
                      title="Preview announcement"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggle(row.id);
                      }}
                      title={row.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openReaders(row.id);
                      }}
                      title="View Readers"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(row.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={previewItem != null} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className={formDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Announcement Preview</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <>
              <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
                <p className="text-xs text-slate-500">
                  This is how schools see the announcement.{' '}
                  {previewItem.body.includes('{{school_name}}')
                    ? `Sample school name: ${previewSampleSchool}`
                    : null}
                </p>
                {renderAnnouncementPreview(previewItem)}
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-2">
                  <p><span className="font-semibold text-slate-500">Target:</span> {previewItem.target_label}</p>
                  <p><span className="font-semibold text-slate-500">Status:</span> {previewItem.display_status}</p>
                  <p><span className="font-semibold text-slate-500">Read:</span> {previewItem.read_count ?? 0} of {previewItem.eligible_user_count ?? 0}</p>
                  {previewItem.scheduled_at ? (
                    <p><span className="font-semibold text-slate-500">Scheduled:</span> {new Date(previewItem.scheduled_at).toLocaleString()}</p>
                  ) : null}
                  {previewItem.expires_at ? (
                    <p><span className="font-semibold text-slate-500">Expires:</span> {new Date(previewItem.expires_at).toLocaleString()}</p>
                  ) : null}
                </div>
              </DialogBody>
              <DialogFooter className={detailDialogFooterClass}>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setPreviewItem(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Readers Modal */}
      <AlertDialog open={readersModalId != null} onOpenChange={(o) => !o && setReadersModalId(null)}>
        <AlertDialogContent className={alertDialogContentWideClass}>
          <AlertDialogHeader className={alertDialogHeaderClass}>
            <AlertDialogTitle className={dialogTitleClass}>Readers</AlertDialogTitle>
            <AlertDialogDescription>Users who have marked this announcement as read.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className={alertDialogBodyClass}>
            {loadingReaders ? (
              <BrandedLoading label="Loading readers…" />
            ) : readers.length === 0 ? (
              <p className="text-sm text-slate-500">No readers yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Read At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readers.map((r: any) => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.full_name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.email ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.tenant_id ?? '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.read_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <AlertDialogFooter className={alertDialogFooterClass}>
            <AlertDialogAction onClick={() => setReadersModalId(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className={alertDialogContentClass}>
          <AlertDialogHeader className={alertDialogHeaderClass}>
            <AlertDialogTitle className={dialogTitleClass}>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the announcement and all read records. Users who have not read it will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={alertDialogFooterClass}>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GlobalAnnouncementsModule;
