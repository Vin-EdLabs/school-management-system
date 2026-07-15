import React, { useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Mail,
  Save,
  Settings2,
  GraduationCap,
  Copy,
  Check,
  RotateCcw,
  Eye,
  FileText,
  Users,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Share2,
  Briefcase,
  Info,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';
import {
  resolveWebsiteImageUrl,
  schoolWebsiteAdminService,
  type WebsiteHighlight,
  type WebsiteHomeContent,
  type WebsiteEvent,
  type WebsiteEventImage,
} from '@/services/schoolWebsiteService';
import { getEffectiveWebsiteSubdomain, getSchoolWebsitePublicUrl } from '@/utils/schoolWebsiteHost';
import { useSchool } from '@/contexts/SchoolContext';
import { resolveLogoUrl } from '@/services/tenantService';
import WebsiteApplicationDetailsDialog, {
  parseWebsiteApplication,
} from './WebsiteApplicationDetailsDialog';
import WebsiteEmploymentDetailsDialog from './WebsiteEmploymentDetailsDialog';
import WebsiteContactMessageDetailsDialog from './WebsiteContactMessageDetailsDialog';
import WebsiteFeaturePromo from './WebsiteFeaturePromo';
import WebsiteAlumniAdminPanel from './WebsiteAlumniAdminPanel';

type Tab = 'overview' | 'homepage' | 'about' | 'admissions' | 'careers' | 'alumni' | 'events' | 'gallery' | 'contact';

const EMPTY_EVENT_DRAFT = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  location: '',
  cover_image_url: '',
  gallery_images: [] as WebsiteEventImage[],
  is_published: true,
};

const GALLERY_CATS = ['classrooms', 'labs', 'events', 'activities', 'facilities'];

const SOCIAL_PLATFORMS: Array<{
  key: string;
  label: string;
  placeholder: string;
  icon: React.ElementType;
}> = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourschool', icon: Facebook },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourschool', icon: Instagram },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourschool', icon: Twitter },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourschool', icon: Youtube },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourschool', icon: Linkedin },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourschool', icon: Share2 },
];

const TAB_LIST_CLASS =
  'flex h-auto w-full flex-wrap gap-1.5 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-2 shadow-inner dark:border-slate-800 dark:bg-slate-900/80';

const TAB_TRIGGER_CLASS =
  'flex flex-1 min-w-[6.75rem] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 transition-all hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md dark:text-slate-400 dark:hover:text-slate-200 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-indigo-300';

const PANEL_CLASS =
  'rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/70';

const PAGE_BG =
  'min-h-full bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08),transparent_50%),linear-gradient(to_bottom,#f8fafc,#ffffff)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),transparent_50%),linear-gradient(to_bottom,#020617,#0f172a)]';

const INNER_TAB_LIST =
  'inline-flex h-auto gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50';

const INNER_TAB_TRIGGER =
  'gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800';

function WebsiteLoadingScreen({ logoUrl, schoolName }: { logoUrl: string | null; schoolName?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-6 p-12">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
        <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-contain p-2" />
          ) : (
            <Globe className="h-9 w-9 text-indigo-500" />
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Loading website manager</p>
        {schoolName && <p className="mt-1 text-xs text-muted-foreground">{schoolName}</p>}
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(PANEL_CLASS, 'overflow-hidden')}>
      <div className="relative border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 px-6 py-5 dark:border-slate-800 dark:from-slate-900/80 dark:to-indigo-950/20">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-500 to-indigo-300" />
        <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  glowClass,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  glowClass: string;
  iconClass: string;
}) {
  return (
    <div className={cn(PANEL_CLASS, 'relative overflow-hidden p-5')}>
      <div className={cn('absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-50 blur-2xl', glowClass)} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SaveBar({ saving, label, onClick }: { saving: boolean; label: string; onClick: () => void }) {
  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <Button
        disabled={saving}
        className="h-11 gap-2 rounded-xl bg-indigo-600 px-6 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
        onClick={onClick}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}

function SettingToggleRow({
  icon: Icon,
  title,
  description,
  detail,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  detail?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-200/80 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-indigo-900/50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          {badge ? (
            <Badge variant="secondary" className="rounded-full text-[10px] font-semibold uppercase tracking-wide">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {detail ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">{detail}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-1 shrink-0" />
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  badge,
  accentClass,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  accentClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        PANEL_CLASS,
        'group flex w-full items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accentClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
          {badge ? (
            <Badge className="h-5 rounded-full bg-amber-100 px-2 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
    </button>
  );
}

function ImageUploadField({
  label,
  description,
  value,
  accept = 'image/jpeg,image/png,image/webp,image/*',
  previewClassName = 'max-h-72 w-full object-contain',
  contain = false,
  onUpload,
}: {
  label: string;
  description?: string;
  value?: string | null;
  accept?: string;
  previewClassName?: string;
  contain?: boolean;
  onUpload: (file: File) => void | Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const url = value ? resolveWebsiteImageUrl(String(value)) : null;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      {url ? (
        <div className="group relative mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
          <img
            src={url}
            alt=""
            className={cn(
              previewClassName,
              contain && 'object-contain p-3',
            )}
          />
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Replace image'}
            </span>
            <input type="file" className="hidden" accept={accept} disabled={uploading} onChange={(e) => void handleChange(e)} />
          </label>
        </div>
      ) : (
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:border-indigo-600">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          ) : (
            <ImageIcon className="h-8 w-8 text-slate-400" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {uploading ? 'Uploading…' : 'Click to upload an image'}
          </span>
          <input type="file" className="hidden" accept={accept} disabled={uploading} onChange={(e) => void handleChange(e)} />
        </label>
      )}
    </div>
  );
}

function appStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    under_review: 'bg-blue-100 text-blue-800',
    accepted: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-muted text-muted-foreground';
}

export default function WebsiteManagementModule() {
  const { school } = useSchool();
  const portalLogo = resolveLogoUrl(school?.logo_url ?? null);
  const [tab, setTab] = useState<Tab>('overview');
  const [admissionSubTab, setAdmissionSubTab] = useState<'settings' | 'applications'>('applications');
  const [careersSubTab, setCareersSubTab] = useState<'settings' | 'applications'>('applications');
  const [contactSubTab, setContactSubTab] = useState<'settings' | 'messages'>('messages');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [about, setAbout] = useState<Record<string, unknown>>({});
  const [admission, setAdmission] = useState<Record<string, unknown>>({});
  const [careers, setCareers] = useState<Record<string, unknown>>({});
  const [contact, setContact] = useState<Record<string, unknown>>({});
  const [contactMessages, setContactMessages] = useState<Array<Record<string, unknown>>>([]);
  const [applications, setApplications] = useState<Array<Record<string, unknown>>>([]);
  const [gallery, setGallery] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<WebsiteEvent[]>([]);
  const [employmentApps, setEmploymentApps] = useState<Array<Record<string, unknown>>>([]);
  const [transcriptRequests, setTranscriptRequests] = useState<Array<Record<string, unknown>>>([]);
  const [testimonialSubmissions, setTestimonialSubmissions] = useState<Array<Record<string, unknown>>>([]);
  const [selectedEmployment, setSelectedEmployment] = useState<Record<string, unknown> | null>(null);
  const [employmentStatusSaving, setEmploymentStatusSaving] = useState(false);
  const [selectedContactMessage, setSelectedContactMessage] = useState<Record<string, unknown> | null>(null);
  const [contactMarkReadSaving, setContactMarkReadSaving] = useState(false);
  const [eventDraft, setEventDraft] = useState({ ...EMPTY_EVENT_DRAFT });
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [selectedApp, setSelectedApp] = useState<Record<string, unknown> | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const slug = String(overview.slug || '');
  const publicSubdomain = getEffectiveWebsiteSubdomain(
    slug,
    overview.public_subdomain as string | null | undefined
  );
  const liveUrl = slug ? getSchoolWebsitePublicUrl(publicSubdomain) : '';
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const pendingEmployment = employmentApps.filter((a) => a.status === 'pending').length;
  const unreadAlumni =
    transcriptRequests.filter((r) => !r.is_read).length +
    testimonialSubmissions.filter((t) => !t.is_read).length;
  const unreadMessages = contactMessages.filter((m) => !m.is_read).length;

  const homeContent = (overview.home_content as WebsiteHomeContent) || {};
  const setHomeContent = (patch: Partial<WebsiteHomeContent>) => {
    setOverview({ ...overview, home_content: { ...homeContent, ...patch } });
  };

  const coreValuesText = Array.isArray(about.core_values)
    ? (about.core_values as string[]).join('\n')
    : '';

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('website-management-tab');
      if (stored === 'alumni' || stored === 'admissions' || stored === 'careers' || stored === 'contact') {
        setTab(stored);
        sessionStorage.removeItem('website-management-tab');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const ov = await schoolWebsiteAdminService.getOverview();
      setOverview(ov);

      if (!ov.is_enabled) {
        setLoading(false);
        return;
      }

      const [ab, ad, cr, ct, msgs, apps, gal, evs, emp, tr, te] = await Promise.all([
        schoolWebsiteAdminService.getAbout(),
        schoolWebsiteAdminService.getAdmissionConfig(),
        schoolWebsiteAdminService.getCareersConfig(),
        schoolWebsiteAdminService.getContact(),
        schoolWebsiteAdminService.listContactMessages(),
        schoolWebsiteAdminService.listApplications(),
        schoolWebsiteAdminService.listGallery(),
        schoolWebsiteAdminService.listEvents(),
        schoolWebsiteAdminService.listEmploymentApplications(),
        schoolWebsiteAdminService.listTranscriptRequests(),
        schoolWebsiteAdminService.listTestimonialSubmissions(),
      ]);
      setAbout(ab);
      setAdmission(ad);
      setCareers(cr);
      setContact(ct);
      setContactMessages(msgs.items || []);
      setApplications(apps.items || []);
      setGallery(gal.items || []);
      setEvents(evs.items || []);
      setEmploymentApps(emp.items || []);
      setTranscriptRequests(tr.items || []);
      setTestimonialSubmissions(te.items || []);
    } catch (e) {
      toast({
        title: 'Could not load website data',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openContactMessage = (msg: Record<string, unknown>) => {
    setSelectedContactMessage(msg);
  };

  const markContactMessageRead = async (msg: Record<string, unknown>) => {
    const id = Number(msg.id);
    if (!Number.isFinite(id)) return;
    setContactMarkReadSaving(true);
    try {
      await schoolWebsiteAdminService.markContactMessageRead(id);
      setContactMessages((prev) =>
        prev.map((item) => (Number(item.id) === id ? { ...item, is_read: true } : item))
      );
      setSelectedContactMessage((prev) =>
        prev && Number(prev.id) === id ? { ...prev, is_read: true } : prev
      );
      toast({ title: 'Message marked as read' });
    } catch (e) {
      toast({
        title: 'Could not mark as read',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setContactMarkReadSaving(false);
    }
  };

  const markAllContactMessagesRead = async () => {
    if (unreadMessages === 0) return;
    setContactMarkReadSaving(true);
    try {
      await schoolWebsiteAdminService.markContactMessagesRead();
      setContactMessages((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setSelectedContactMessage((prev) => (prev ? { ...prev, is_read: true } : prev));
      toast({ title: 'All messages marked as read' });
    } catch (e) {
      toast({
        title: 'Could not mark messages as read',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setContactMarkReadSaving(false);
    }
  };

  const saveSettings = async (body: Record<string, unknown>, msg = 'Saved & published') => {
    setSaving(true);
    try {
      const updated = await schoolWebsiteAdminService.updateSettings(body);
      setOverview(updated);
      toast({ title: msg });
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (
    file: File,
    field:
      | 'banner_image_url'
      | 'welcome_image_url'
      | 'welcome_image_secondary_url'
      | 'logo_url'
      | 'director_photo_url'
      | 'history_image_url'
      | 'overview_image_url'
  ) => {
    const { url } = await schoolWebsiteAdminService.uploadImage(file);
    if (field === 'director_photo_url') {
      setAbout((a) => ({ ...a, director_photo_url: url }));
      toast({ title: 'Director photo uploaded' });
    } else if (field === 'history_image_url') {
      setAbout((a) => ({ ...a, history_image_url: url }));
      toast({ title: 'History image uploaded' });
    } else if (field === 'overview_image_url') {
      setAbout((a) => ({ ...a, overview_image_url: url }));
      toast({ title: 'Overview image uploaded' });
    } else if (field === 'logo_url') {
      await saveSettings({ logo_url: url }, 'Logo uploaded');
    } else if (field === 'welcome_image_secondary_url') {
      await saveSettings({ welcome_image_secondary_url: url }, 'Secondary welcome image uploaded');
    } else {
      await saveSettings({ [field]: url }, 'Image uploaded');
    }
  };

  const highlights = (overview.highlights as WebsiteHighlight[]) || [];
  const socialLinks = (overview.social_links as Record<string, string>) || {};

  const setSocialLink = (key: string, url: string) => {
    setOverview({ ...overview, social_links: { ...socialLinks, [key]: url } });
  };

  const resetEventDraft = () => {
    setEventDraft({ ...EMPTY_EVENT_DRAFT, gallery_images: [] });
    setEditingEventId(null);
  };

  const startEditEvent = (event: WebsiteEvent) => {
    setEditingEventId(event.id);
    setEventDraft({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      event_time: event.event_time || '',
      location: event.location || '',
      cover_image_url: event.cover_image_url || '',
      gallery_images: event.gallery_images || [],
      is_published: true,
    });
  };

  const saveEvent = async () => {
    if (!eventDraft.title.trim() || !eventDraft.event_date) {
      toast({ title: 'Title and date are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: eventDraft.title.trim(),
        description: eventDraft.description || null,
        event_date: eventDraft.event_date,
        event_time: eventDraft.event_time || null,
        location: eventDraft.location || null,
        cover_image_url: eventDraft.cover_image_url || null,
        gallery_images: eventDraft.gallery_images,
        is_published: eventDraft.is_published,
      };
      if (editingEventId) {
        await schoolWebsiteAdminService.updateEvent(editingEventId, body);
        toast({ title: 'Event updated' });
      } else {
        await schoolWebsiteAdminService.createEvent(body);
        toast({ title: 'Event published' });
      }
      resetEventDraft();
      const refreshed = await schoolWebsiteAdminService.listEvents();
      setEvents(refreshed.items || []);
    } catch (e) {
      toast({ title: 'Could not save event', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (id: number) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await schoolWebsiteAdminService.deleteEvent(id);
      toast({ title: 'Event deleted' });
      if (editingEventId === id) resetEventDraft();
      const refreshed = await schoolWebsiteAdminService.listEvents();
      setEvents(refreshed.items || []);
    } catch {
      toast({ title: 'Could not delete event', variant: 'destructive' });
    }
  };

  const addEventGalleryImage = async (file: File) => {
    try {
      const { url } = await schoolWebsiteAdminService.uploadImage(file);
      setEventDraft((d) => ({
        ...d,
        gallery_images: [...d.gallery_images, { url }],
      }));
      toast({ title: 'Event photo added' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const openApplication = async (id: number) => {
    try {
      const full = await schoolWebsiteAdminService.getApplication(id);
      setSelectedApp(full);
    } catch (e) {
      toast({ title: 'Could not load application', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <WebsiteLoadingScreen
        logoUrl={portalLogo || resolveWebsiteImageUrl(String(overview.logo_url || ''))}
        schoolName={school?.name || String(overview.school_name || '')}
      />
    );
  }

  if (!overview.is_enabled) {
    return (
      <WebsiteFeaturePromo
        schoolName={String(school?.name || overview.school_name || 'Your school')}
        logoUrl={portalLogo}
        subdomain={publicSubdomain}
        onRefresh={() => void loadAll()}
      />
    );
  }

  return (
    <div className={cn(PAGE_BG, 'animate-in fade-in duration-500')}>
      {/* Header */}
      <div className="border-b border-indigo-100/80 bg-white/80 backdrop-blur-md dark:border-indigo-950/50 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-7">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 shadow-lg shadow-indigo-100/50 dark:border-indigo-900/50 dark:from-slate-900 dark:to-indigo-950/40 dark:shadow-none">
              {(portalLogo || overview.logo_url) ? (
                <img
                  src={portalLogo || resolveWebsiteImageUrl(String(overview.logo_url)) || ''}
                  alt=""
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Globe className="h-8 w-8 text-indigo-600" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
                  Website Management
                </h1>
                <Badge
                  className={cn(
                    'rounded-full border-0 font-semibold',
                    overview.is_published
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {overview.is_published ? 'Live' : 'Draft'}
                </Badge>
              </div>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                Manage your public school website, applications, and messages.
                {pendingCount > 0 && (
                  <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
                    · {pendingCount} pending application{pendingCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-10 gap-2 rounded-xl" onClick={() => void loadAll()} disabled={loading}>
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
            {liveUrl && (
              <Button className="h-10 gap-2 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700" onClick={() => window.open(liveUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" />
                Preview site
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-0">
        <TabsList className={TAB_LIST_CLASS}>
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'homepage', label: 'Homepage', icon: Settings2 },
            { id: 'about', label: 'About', icon: Globe },
            { id: 'admissions', label: 'Admissions', icon: GraduationCap, badge: pendingCount },
            { id: 'careers', label: 'Careers', icon: Briefcase, badge: pendingEmployment || undefined },
            { id: 'alumni', label: 'Alumni', icon: ScrollText, badge: unreadAlumni || undefined },
            { id: 'events', label: 'Events', icon: CalendarDays, badge: events.length || undefined },
            { id: 'gallery', label: 'Gallery', icon: ImageIcon },
            { id: 'contact', label: 'Contact', icon: Mail, badge: unreadMessages || undefined },
          ].map(({ id, label, icon: Icon, badge }) => (
            <TabsTrigger key={id} value={id} className={TAB_TRIGGER_CLASS}>
              <Icon className="h-4 w-4" />
              {label}
              {badge ? (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] rounded-full px-1.5 text-[10px] tabular-nums">
                  {badge}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className={cn(PANEL_CLASS, 'overflow-hidden border-indigo-200/60 dark:border-indigo-900/40')}>
            <div className="border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50 via-white to-violet-50/60 px-6 py-5 dark:border-indigo-950/50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-violet-950/20">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Website feature activated</h3>
                    <Badge className="rounded-full border-0 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                      ScholarNerve enabled
                    </Badge>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Your school&apos;s website module is turned on by the ScholarNerve team. You control day-to-day content,
                    publishing, and admissions from here. To disable the entire website feature, contact ScholarNerve support.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  You manage
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Homepage content, gallery, events, contact details, admissions settings, and whether the site is live for visitors.
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  <Info className="h-3.5 w-3.5" />
                  ScholarNerve manages
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Turning the website module on or off for your school, public subdomain ({publicSubdomain || 'your-school'}.edu…), and platform hosting.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Website status"
              value={overview.is_published ? 'Published' : 'Draft'}
              hint={overview.is_published ? 'Live for visitors' : 'Not visible publicly'}
              icon={Globe}
              glowClass="bg-emerald-300/50"
              iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            />
            <StatCard
              label="Gallery images"
              value={String(overview.gallery_count || 0)}
              hint="Uploaded photos"
              icon={ImageIcon}
              glowClass="bg-indigo-300/50"
              iconClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
            />
            <StatCard
              label="Applications"
              value={String(applications.length)}
              hint={`${pendingCount} pending review`}
              icon={GraduationCap}
              glowClass="bg-violet-300/50"
              iconClass="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
            />
            <StatCard
              label="Unread messages"
              value={String(unreadMessages)}
              hint="Contact form inbox"
              icon={Mail}
              glowClass="bg-sky-300/50"
              iconClass="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <QuickActionCard
              title="Admission applications"
              description="Review online forms, accept applicants, and send them to pending admissions."
              icon={GraduationCap}
              badge={pendingCount || undefined}
              accentClass="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
              onClick={() => {
                setTab('admissions');
                setAdmissionSubTab('applications');
              }}
            />
            <QuickActionCard
              title="Contact messages"
              description="Read and respond to enquiries submitted through your public contact page."
              icon={Mail}
              badge={unreadMessages || undefined}
              accentClass="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              onClick={() => {
                setTab('contact');
                setContactSubTab('messages');
              }}
            />
            <QuickActionCard
              title="Preview public site"
              description="Open your live website in a new tab to see what families see."
              icon={ExternalLink}
              accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              onClick={() => liveUrl && window.open(liveUrl, '_blank')}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={cn(PANEL_CLASS, 'overflow-hidden')}>
              <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white px-6 py-5 dark:border-slate-800 dark:from-emerald-950/20 dark:to-slate-900">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Visibility & admissions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  These settings are under your control and take effect immediately when saved.
                </p>
              </div>
              <div className="space-y-3 p-6">
                <SettingToggleRow
                  icon={Eye}
                  title="Publish website"
                  badge={overview.is_published ? 'Live' : 'Draft'}
                  description="When on, families can visit your public site at your school URL. When off, visitors see a coming-soon page — your content stays saved."
                  detail="Use this when you are ready to go live after updating homepage, about, and contact details."
                  checked={!!overview.is_published}
                  onCheckedChange={(v) => void saveSettings({ is_published: v }, v ? 'Website published' : 'Website unpublished')}
                />
                <SettingToggleRow
                  icon={GraduationCap}
                  title="Accept online applications"
                  description="Shows the admissions form on your public site so families can apply. Turn off to hide the form without unpublishing the whole website."
                  detail="Accepted applications are sent to Students → Pending Admissions for final enrollment approval."
                  checked={admission.applications_open !== false}
                  onCheckedChange={(v) => {
                    setAdmission({ ...admission, applications_open: v });
                    void (async () => {
                      try {
                        const saved = await schoolWebsiteAdminService.saveAdmissionConfig({
                          ...admission,
                          applications_open: v,
                        });
                        setAdmission(saved);
                        toast({ title: v ? 'Online applications opened' : 'Online applications closed' });
                      } catch {
                        toast({ title: 'Could not update admissions setting', variant: 'destructive' });
                      }
                    })();
                  }}
                />
                <SettingToggleRow
                  icon={Briefcase}
                  title="Accept career applications"
                  description="Shows the employment form on your public Careers page. Turn off to hide the form while keeping the page visible."
                  detail="Teachers and staff can still read requirements; only the application form is hidden when closed."
                  checked={careers.applications_open !== false}
                  onCheckedChange={(v) => {
                    setCareers({ ...careers, applications_open: v });
                    void (async () => {
                      try {
                        const saved = await schoolWebsiteAdminService.saveCareersConfig({
                          ...careers,
                          applications_open: v,
                        });
                        setCareers(saved);
                        toast({ title: v ? 'Career applications opened' : 'Career applications closed' });
                      } catch {
                        toast({ title: 'Could not update careers setting', variant: 'destructive' });
                      }
                    })();
                  }}
                />
              </div>
            </div>

            <div className={cn(PANEL_CLASS, 'overflow-hidden')}>
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-6 py-5 dark:border-slate-800 dark:from-indigo-950/20 dark:to-slate-900">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Public URL</h3>
                <p className="mt-1 text-sm text-muted-foreground">Share this link on flyers, social media, and with parents.</p>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                    {liveUrl || '—'}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    onClick={() => {
                      if (!liveUrl) return;
                      void navigator.clipboard.writeText(liveUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your subdomain is managed by ScholarNerve. Contact support if you need it changed.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="homepage" className="mt-6 max-w-3xl space-y-5">
          <FormSection title="Branding" description="Logo and accent colour for your public site.">
            <div className="grid gap-5 sm:grid-cols-2">
              <ImageUploadField
                label="School logo"
                value={overview.logo_url as string | undefined}
                previewClassName="mx-auto h-28 w-28 rounded-2xl object-contain p-2"
                contain
                onUpload={(f) => uploadImage(f, 'logo_url')}
              />
              <div>
                <Label>Accent colour</Label>
                <Input type="color" className="mt-1.5 h-11 w-full cursor-pointer" value={String(overview.accent_color || '#2563eb')} onChange={(e) => setOverview({ ...overview, accent_color: e.target.value })} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Hero & banner" description="First impression on your homepage — keep the hero design you like.">
            <ImageUploadField
              label="Banner image"
              description="Wide hero background — recommended 1600×900 or larger."
              value={overview.banner_image_url as string | undefined}
              previewClassName="aspect-[21/9] max-h-52 w-full object-cover"
              onUpload={(f) => uploadImage(f, 'banner_image_url')}
            />
            <div>
              <Label>Enrolment pill label</Label>
              <Input className="mt-1.5" placeholder="e.g. Enrolment Open 2026/27" value={String(homeContent.enrolment_label || '')} onChange={(e) => setHomeContent({ enrolment_label: e.target.value })} />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={String(overview.tagline || '')} onChange={(e) => setOverview({ ...overview, tagline: e.target.value })} className="mt-1.5" />
            </div>
          </FormSection>

          <FormSection title="Welcome section">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Welcome heading</Label>
                <Input className="mt-1.5" placeholder="A place where every child thrives" value={String(homeContent.welcome_heading || '')} onChange={(e) => setHomeContent({ welcome_heading: e.target.value })} />
              </div>
              <div>
                <Label>Gold-underlined word</Label>
                <Input className="mt-1.5" placeholder="thrives" value={String(homeContent.welcome_heading_accent || '')} onChange={(e) => setHomeContent({ welcome_heading_accent: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Welcome text (HTML allowed)</Label>
              <Textarea rows={6} className="mt-1.5" value={String(overview.welcome_text || '')} onChange={(e) => setOverview({ ...overview, welcome_text: e.target.value })} />
            </div>
            <div>
              <Label>“Read more” link text</Label>
              <Input className="mt-1.5" placeholder="Read our story" value={String(homeContent.welcome_link_text || '')} onChange={(e) => setHomeContent({ welcome_link_text: e.target.value })} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <ImageUploadField
                label="Main welcome image"
                value={overview.welcome_image_url as string | undefined}
                previewClassName="max-h-80 w-full object-contain"
                contain
                onUpload={(f) => uploadImage(f, 'welcome_image_url')}
              />
              <ImageUploadField
                label="Overlapping secondary image"
                value={overview.welcome_image_secondary_url as string | undefined}
                previewClassName="max-h-64 w-full object-contain"
                contain
                onUpload={(f) => uploadImage(f, 'welcome_image_secondary_url')}
              />
            </div>
          </FormSection>

          <FormSection title="School stats" description="Only filled stats appear on the public site. Leave blank to hide.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Founded year</Label>
                <Input type="number" className="mt-1.5" value={String((overview.stats as Record<string, unknown>)?.founded_year ?? '')} onChange={(e) => setOverview({ ...overview, stats: { ...(overview.stats as object), founded_year: e.target.value ? Number(e.target.value) : null } })} />
              </div>
              <div>
                <Label>Student count</Label>
                <Input type="number" className="mt-1.5" value={String((overview.stats as Record<string, unknown>)?.student_count ?? '')} onChange={(e) => setOverview({ ...overview, stats: { ...(overview.stats as object), student_count: e.target.value ? Number(e.target.value) : null } })} />
              </div>
              <div>
                <Label>Programs / classes count</Label>
                <Input type="number" className="mt-1.5" value={String((overview.stats as Record<string, unknown>)?.programs_count ?? '')} onChange={(e) => setOverview({ ...overview, stats: { ...(overview.stats as object), programs_count: e.target.value ? Number(e.target.value) : null } })} />
              </div>
              <div>
                <Label>Pass rate</Label>
                <Input className="mt-1.5" placeholder="e.g. 98%" value={String((overview.stats as Record<string, unknown>)?.pass_rate ?? '')} onChange={(e) => setOverview({ ...overview, stats: { ...(overview.stats as object), pass_rate: e.target.value || null } })} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Highlights" description="Up to 4 reasons families choose your school.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Section eyebrow</Label>
                <Input className="mt-1.5" placeholder="Why choose us" value={String(homeContent.highlights_eyebrow || '')} onChange={(e) => setHomeContent({ highlights_eyebrow: e.target.value })} />
              </div>
              <div>
                <Label>Section title</Label>
                <Input className="mt-1.5" placeholder="The pillars of our school" value={String(homeContent.highlights_title || '')} onChange={(e) => setHomeContent({ highlights_title: e.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              {highlights.map((h, i) => (
                <div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-3">
                  <Input placeholder="Icon (emoji)" value={h.icon} onChange={(e) => { const next = [...highlights]; next[i] = { ...next[i], icon: e.target.value }; setOverview({ ...overview, highlights: next }); }} />
                  <Input placeholder="Title" value={h.title} onChange={(e) => { const next = [...highlights]; next[i] = { ...next[i], title: e.target.value }; setOverview({ ...overview, highlights: next }); }} />
                  <Input placeholder="Description" value={h.description} onChange={(e) => { const next = [...highlights]; next[i] = { ...next[i], description: e.target.value }; setOverview({ ...overview, highlights: next }); }} />
                </div>
              ))}
              {highlights.length < 4 && (
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOverview({ ...overview, highlights: [...highlights, { icon: '★', title: '', description: '' }] })}>
                  Add highlight
                </Button>
              )}
            </div>
          </FormSection>

          <FormSection title="Call-to-action card" description="Compact card at the bottom of the homepage — not a full-width banner.">
            <div>
              <Label>Heading</Label>
              <Input className="mt-1.5" placeholder="Ready to apply?" value={String(homeContent.cta_title || '')} onChange={(e) => setHomeContent({ cta_title: e.target.value })} />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input className="mt-1.5" placeholder="Join our community of learners." value={String(homeContent.cta_subtitle || '')} onChange={(e) => setHomeContent({ cta_subtitle: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Button text</Label>
                <Input className="mt-1.5" placeholder="Begin Application" value={String(homeContent.cta_button_text || '')} onChange={(e) => setHomeContent({ cta_button_text: e.target.value })} />
              </div>
              <div>
                <Label>Card background colour</Label>
                <Input
                  type="color"
                  className="mt-1.5 h-11 w-full cursor-pointer"
                  value={String(homeContent.cta_bg_color || overview.accent_color || '#2563eb')}
                  onChange={(e) => setHomeContent({ cta_bg_color: e.target.value })}
                />
              </div>
            </div>
          </FormSection>

          <SaveBar
            saving={saving}
            label="Save & publish homepage"
            onClick={() =>
              void saveSettings({
                tagline: overview.tagline,
                welcome_text: overview.welcome_text,
                highlights: overview.highlights,
                stats: overview.stats,
                home_content: homeContent,
                accent_color: overview.accent_color,
                is_published: true,
              })
            }
          />
        </TabsContent>

        <TabsContent value="about" className="mt-6 max-w-3xl space-y-5">
          <FormSection title="School story">
            <div><Label>History (HTML allowed)</Label><Textarea rows={4} className="mt-1.5" value={String(about.history || '')} onChange={(e) => setAbout({ ...about, history: e.target.value })} /></div>
            <ImageUploadField
              label="History section image"
              description="Shown beside your school history on the About page."
              value={about.history_image_url as string | undefined}
              previewClassName="max-h-80 w-full object-contain"
              contain
              onUpload={(f) => uploadImage(f, 'history_image_url')}
            />
            <div><Label>Institution overview (HTML allowed)</Label><Textarea rows={4} className="mt-1.5" value={String(about.institution_overview || '')} onChange={(e) => setAbout({ ...about, institution_overview: e.target.value })} /></div>
            <ImageUploadField
              label="Overview section image"
              description="Shown beside your institution overview on the About page."
              value={about.overview_image_url as string | undefined}
              previewClassName="max-h-80 w-full object-contain"
              contain
              onUpload={(f) => uploadImage(f, 'overview_image_url')}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Vision</Label><Textarea rows={3} className="mt-1.5" value={String(about.vision || '')} onChange={(e) => setAbout({ ...about, vision: e.target.value })} /></div>
              <div><Label>Mission</Label><Textarea rows={3} className="mt-1.5" value={String(about.mission || '')} onChange={(e) => setAbout({ ...about, mission: e.target.value })} /></div>
            </div>
            <div>
              <Label>Core values (one per line)</Label>
              <Textarea
                rows={4}
                className="mt-1.5"
                value={coreValuesText}
                onChange={(e) =>
                  setAbout({
                    ...about,
                    core_values: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          </FormSection>
          <FormSection title="Director / Head of School" description="Photo, quote, name and title shown on the About page.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Director name</Label><Input className="mt-1.5" placeholder="e.g. Mrs. Jane Doe" value={String(about.director_name || '')} onChange={(e) => setAbout({ ...about, director_name: e.target.value })} /></div>
              <div><Label>Director title</Label><Input className="mt-1.5" placeholder="e.g. Head of School" value={String(about.director_title || '')} onChange={(e) => setAbout({ ...about, director_title: e.target.value })} /></div>
            </div>
            <div><Label>Message (HTML allowed)</Label><Textarea rows={5} className="mt-1.5" value={String(about.director_message || '')} onChange={(e) => setAbout({ ...about, director_message: e.target.value })} /></div>
            <ImageUploadField
              label="Director photo"
              description="Portrait photo for the Head of School section."
              value={about.director_photo_url as string | undefined}
              previewClassName="mx-auto aspect-[4/5] max-h-56 w-full max-w-[200px] object-cover"
              onUpload={(f) => uploadImage(f, 'director_photo_url')}
            />
          </FormSection>
          <SaveBar
            saving={saving}
            label="Save & publish about page"
            onClick={async () => {
              setSaving(true);
              try {
                const saved = await schoolWebsiteAdminService.saveAbout(about);
                setAbout(saved);
                toast({ title: 'About page published' });
              } finally {
                setSaving(false);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="admissions" className="mt-6 space-y-5">
          <Tabs value={admissionSubTab} onValueChange={(v) => setAdmissionSubTab(v as 'settings' | 'applications')}>
            <TabsList className={INNER_TAB_LIST}>
              <TabsTrigger value="applications" className={INNER_TAB_TRIGGER}>
                <Users className="h-4 w-4" /> Applications
                {pendingCount > 0 && <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="settings" className={INNER_TAB_TRIGGER}>
                <FileText className="h-4 w-4" /> Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-5 max-w-3xl space-y-5">
              <FormSection title="Admission settings" description="Control when families can apply online. Class options on the public form are loaded automatically from your Classes module.">
                <div><Label>Requirements (HTML)</Label><Textarea rows={5} className="mt-1.5" value={String(admission.requirements || '')} onChange={(e) => setAdmission({ ...admission, requirements: e.target.value })} /></div>
                <SettingToggleRow
                  icon={GraduationCap}
                  title="Accept online applications"
                  description="When enabled, the admissions form appears on your public website. Families can submit applications with documents and photos."
                  detail="When you accept an application, the student is added to Pending Admissions for final class assignment and enrollment."
                  checked={admission.applications_open !== false}
                  onCheckedChange={(v) => setAdmission({ ...admission, applications_open: v })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Open date</Label>
                    <Input type="date" className="mt-1.5" value={String(admission.open_date || '').slice(0, 10)} onChange={(e) => setAdmission({ ...admission, open_date: e.target.value })} />
                    <p className="mt-1.5 text-xs text-muted-foreground">Applications are blocked before this date.</p>
                  </div>
                  <div>
                    <Label>Close date</Label>
                    <Input type="date" className="mt-1.5" value={String(admission.close_date || '').slice(0, 10)} onChange={(e) => setAdmission({ ...admission, close_date: e.target.value })} />
                    <p className="mt-1.5 text-xs text-muted-foreground">Applications close automatically after this date.</p>
                  </div>
                </div>
              </FormSection>
              <SaveBar
                saving={saving}
                label="Save admission settings"
                onClick={async () => {
                  setSaving(true);
                  try {
                    const saved = await schoolWebsiteAdminService.saveAdmissionConfig(admission);
                    setAdmission(saved);
                    toast({ title: 'Admission settings saved' });
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="applications" className="mt-5">
              <div className={cn(PANEL_CLASS, 'overflow-hidden')}>
                <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <GraduationCap className="h-4 w-4 text-indigo-600" />
                    Online applications
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submissions from your public admissions form.
                  </p>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Guardian</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                              No applications yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          applications.map((app) => {
                            const parsed = parseWebsiteApplication(app);
                            return (
                              <TableRow key={String(app.id)}>
                                <TableCell className="font-medium">{parsed.applicantName}</TableCell>
                                <TableCell>{parsed.classAssigned}</TableCell>
                                <TableCell>
                                  <div className="text-sm">{parsed.guardianName}</div>
                                  <div className="text-xs text-muted-foreground">{parsed.guardianContact}</div>
                                </TableCell>
                                <TableCell>{app.submitted_at ? formatDisplayDate(String(app.submitted_at)) : '—'}</TableCell>
                                <TableCell>
                                  <Badge className={cn('font-medium capitalize', appStatusBadge(String(app.status)))}>
                                    {String(app.status).replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => void openApplication(Number(app.id))}>
                                    <Eye className="h-3.5 w-3.5" /> View
                                  </Button>
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
        </TabsContent>

        <TabsContent value="careers" className="mt-6 space-y-5">
          <Tabs value={careersSubTab} onValueChange={(v) => setCareersSubTab(v as 'settings' | 'applications')}>
            <TabsList className={INNER_TAB_LIST}>
              <TabsTrigger value="applications" className={INNER_TAB_TRIGGER}>
                <Users className="h-4 w-4" /> Applications
                {pendingEmployment > 0 && (
                  <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                    {pendingEmployment}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className={INNER_TAB_TRIGGER}>
                <FileText className="h-4 w-4" /> Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-5 max-w-3xl space-y-5">
              <FormSection
                title="Careers page settings"
                description="Control whether teachers and staff can submit employment applications from your public website."
              >
                <SettingToggleRow
                  icon={Briefcase}
                  title="Accept career applications"
                  description="When enabled, visitors can fill in the employment form on your Careers page. When disabled, they see a friendly closed message instead of the form."
                  checked={careers.applications_open !== false}
                  onCheckedChange={(v) => setCareers({ ...careers, applications_open: v })}
                />
                <div>
                  <Label>Intro text (HTML, optional)</Label>
                  <Textarea
                    rows={4}
                    className="mt-1.5"
                    placeholder="Brief welcome message shown above the careers form…"
                    value={String(careers.intro_text || '')}
                    onChange={(e) => setCareers({ ...careers, intro_text: e.target.value })}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Shown on the public Careers page. Still visible when applications are closed.
                  </p>
                </div>
              </FormSection>
              <SaveBar
                saving={saving}
                label="Save careers settings"
                onClick={async () => {
                  setSaving(true);
                  try {
                    const saved = await schoolWebsiteAdminService.saveCareersConfig(careers);
                    setCareers(saved);
                    toast({ title: 'Careers settings saved' });
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="applications" className="mt-5 max-w-5xl">
          <div className={cn(PANEL_CLASS, 'overflow-hidden')}>
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h3 className="text-sm font-bold">Employment applications</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Teachers and staff apply from the public Careers page on your school website.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employmentApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        No employment applications yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employmentApps.map((app) => (
                      <TableRow key={String(app.id)}>
                        <TableCell className="font-medium">{String(app.full_name || '')}</TableCell>
                        <TableCell>{String(app.position_applied || '—')}</TableCell>
                        <TableCell>
                          <div className="text-sm">{String(app.email || '')}</div>
                          {app.phone ? <div className="text-xs text-muted-foreground">{String(app.phone)}</div> : null}
                        </TableCell>
                        <TableCell>{app.submitted_at ? formatDisplayDate(String(app.submitted_at)) : '—'}</TableCell>
                        <TableCell>
                          <Badge className="font-medium capitalize">{String(app.status || 'pending').replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => setSelectedEmployment(app)}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="alumni" className="mt-6 max-w-5xl space-y-5">
          <WebsiteAlumniAdminPanel
            transcriptRequests={transcriptRequests}
            testimonials={testimonialSubmissions}
            onRefresh={loadAll}
          />
        </TabsContent>

        <TabsContent value="events" className="mt-6 max-w-3xl space-y-5">
          <FormSection
            title={editingEventId ? 'Edit event' : 'Add event'}
            description="Published upcoming events appear automatically on your homepage and Events page."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Event title</Label>
                <Input className="mt-1.5" value={eventDraft.title} onChange={(e) => setEventDraft({ ...eventDraft, title: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" className="mt-1.5" value={eventDraft.event_date} onChange={(e) => setEventDraft({ ...eventDraft, event_date: e.target.value })} />
              </div>
              <div>
                <Label>Time (optional)</Label>
                <Input type="time" className="mt-1.5" value={eventDraft.event_time} onChange={(e) => setEventDraft({ ...eventDraft, event_time: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Location (optional)</Label>
                <Input className="mt-1.5" placeholder="School hall, sports field…" value={eventDraft.location} onChange={(e) => setEventDraft({ ...eventDraft, location: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} className="mt-1.5" value={eventDraft.description} onChange={(e) => setEventDraft({ ...eventDraft, description: e.target.value })} />
            </div>
            <ImageUploadField
              label="Cover image"
              description="Main photo shown on the Events page and homepage."
              value={eventDraft.cover_image_url || null}
              previewClassName="max-h-72 w-full object-contain"
              contain
              onUpload={async (file) => {
                const { url } = await schoolWebsiteAdminService.uploadImage(file);
                setEventDraft({ ...eventDraft, cover_image_url: url });
                toast({ title: 'Cover image uploaded' });
              }}
            />
            <div>
              <Label>Additional event photos</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1.5"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addEventGalleryImage(f);
                  e.target.value = '';
                }}
              />
              {eventDraft.gallery_images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
                  {eventDraft.gallery_images.map((img, i) => {
                    const src = resolveWebsiteImageUrl(img.url);
                    return (
                      <div key={i} className="group relative overflow-hidden rounded-xl border">
                        {src && <img src={src} alt="" className="aspect-square w-full object-cover" />}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute right-1 top-1 h-7 w-7 p-0 opacity-0 transition group-hover:opacity-100"
                          onClick={() =>
                            setEventDraft({
                              ...eventDraft,
                              gallery_images: eventDraft.gallery_images.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700" disabled={saving} onClick={() => void saveEvent()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingEventId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingEventId ? 'Update event' : 'Publish event'}
              </Button>
              {editingEventId && (
                <Button type="button" variant="outline" className="rounded-xl" onClick={resetEventDraft}>
                  Cancel edit
                </Button>
              )}
            </div>
          </FormSection>

          <FormSection title="All events" description={`${events.length} event${events.length !== 1 ? 's' : ''} on your public site.`}>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet. Add your first event above.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const cover = resolveWebsiteImageUrl(event.cover_image_url);
                  const upcoming = new Date(`${event.event_date}T00:00:00`) >= new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <div key={event.id} className="flex gap-4 rounded-xl border p-3">
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {cover ? (
                          <img src={cover} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <CalendarDays className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{event.title}</p>
                          <Badge variant="secondary" className={upcoming ? 'bg-emerald-100 text-emerald-800' : ''}>
                            {upcoming ? 'Upcoming' : 'Past'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDisplayDate(event.event_date)}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => startEditEvent(event)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg text-red-600" onClick={() => void removeEvent(event.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>
        </TabsContent>

        <TabsContent value="gallery" className="mt-6 space-y-5">
          <div className={PANEL_CLASS}>
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h3 className="text-sm font-bold">Upload images</h3>
              <p className="mt-1 text-xs text-muted-foreground">Choose a category, then select a photo.</p>
            </div>
            <div className="flex flex-wrap gap-2 p-6">
              {GALLERY_CATS.map((cat) => (
                <label key={cat} className="cursor-pointer">
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void schoolWebsiteAdminService.uploadGalleryImage(f, cat).then(() => loadAll());
                    e.target.value = '';
                  }} />
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold capitalize shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900">+ {cat}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {gallery.map((g) => {
              const url = resolveWebsiteImageUrl(String(g.url));
              return (
                <div key={String(g.id)} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800">
                  {url && <img src={url} alt="" className="aspect-square w-full object-cover" />}
                  <Button size="sm" variant="destructive" className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 rounded-lg" onClick={() => void schoolWebsiteAdminService.deleteGalleryImage(Number(g.id)).then(loadAll)}>
                    Delete
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-6 space-y-5">
          <Tabs value={contactSubTab} onValueChange={(v) => setContactSubTab(v as 'settings' | 'messages')}>
            <TabsList className={INNER_TAB_LIST}>
              <TabsTrigger value="messages" className={INNER_TAB_TRIGGER}>
                <Mail className="h-4 w-4" /> Messages
                {unreadMessages > 0 && <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">{unreadMessages}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="settings" className={INNER_TAB_TRIGGER}>
                <Settings2 className="h-4 w-4" /> Page settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="mt-5">
              <div className={cn(PANEL_CLASS, 'overflow-hidden')}>
                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Contact form submissions</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Messages sent from your public contact page. Click View to read the full message.
                    </p>
                  </div>
                  {unreadMessages > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg shrink-0"
                      disabled={contactMarkReadSaving}
                      onClick={() => void markAllContactMessagesRead()}
                    >
                      Mark all as read ({unreadMessages})
                    </Button>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>From</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Received</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactMessages.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                              No messages yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          contactMessages.map((msg) => {
                            const isRead = Boolean(msg.is_read);
                            const preview = String(msg.message || '');
                            return (
                              <TableRow
                                key={String(msg.id)}
                                className={cn(!isRead && 'bg-sky-50/60 dark:bg-sky-950/20')}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {!isRead ? (
                                      <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
                                    ) : null}
                                    {String(msg.name)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{String(msg.phone || '—')}</TableCell>
                                <TableCell>{String(msg.email || '—')}</TableCell>
                                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                  {preview || '—'}
                                </TableCell>
                                <TableCell>{msg.created_at ? formatDisplayDate(String(msg.created_at)) : '—'}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      'font-medium',
                                      isRead ? 'bg-slate-100 text-slate-700' : 'bg-sky-100 text-sky-800'
                                    )}
                                  >
                                    {isRead ? 'Read' : 'New'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {!isRead ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-lg"
                                        disabled={contactMarkReadSaving}
                                        onClick={() => void markContactMessageRead(msg)}
                                      >
                                        Mark read
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1.5"
                                      onClick={() => openContactMessage(msg)}
                                    >
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

            <TabsContent value="settings" className="mt-5 max-w-3xl space-y-5">
              <FormSection title="Contact details" description="Shown on your public contact page and footer.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Primary phone</Label><Input className="mt-1.5" value={String(contact.primary_phone || '')} onChange={(e) => setContact({ ...contact, primary_phone: e.target.value })} /></div>
                  <div><Label>Secondary phone</Label><Input className="mt-1.5" value={String(contact.secondary_phone || '')} onChange={(e) => setContact({ ...contact, secondary_phone: e.target.value })} /></div>
                </div>
                <div><Label>Email</Label><Input className="mt-1.5" value={String(contact.email || '')} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                <div><Label>Address</Label><Textarea rows={2} className="mt-1.5" value={String(contact.address || '')} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></div>
                <div><Label>Google Maps embed URL</Label><Input className="mt-1.5" value={String(contact.map_embed_url || '')} onChange={(e) => setContact({ ...contact, map_embed_url: e.target.value })} /></div>
                <div><Label>Working hours</Label><Input className="mt-1.5" value={String(contact.working_hours || '')} onChange={(e) => setContact({ ...contact, working_hours: e.target.value })} /></div>
              </FormSection>

              <FormSection
                title="Follow us — social media"
                description="Add profile links for the footer. Icons appear automatically when a URL is saved."
              >
                <div className="space-y-4">
                  {SOCIAL_PLATFORMS.map(({ key, label, placeholder, icon: Icon }) => (
                    <div key={key}>
                      <Label className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        {label}
                      </Label>
                      <Input
                        className="mt-1.5"
                        type="url"
                        placeholder={placeholder}
                        value={String(socialLinks[key] || '')}
                        onChange={(e) => setSocialLink(key, e.target.value.trim())}
                      />
                    </div>
                  ))}
                </div>
              </FormSection>

              <SaveBar
                saving={saving}
                label="Save & publish contact"
                onClick={async () => {
                  setSaving(true);
                  try {
                    const saved = await schoolWebsiteAdminService.saveContact(contact);
                    setContact(saved);
                    const cleanedSocials = Object.fromEntries(
                      Object.entries(socialLinks).filter(([, url]) => String(url || '').trim())
                    );
                    const updated = await schoolWebsiteAdminService.updateSettings({ social_links: cleanedSocials });
                    setOverview(updated);
                    toast({ title: 'Contact & social links published' });
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <WebsiteApplicationDetailsDialog
        application={selectedApp}
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        saving={statusSaving}
        onStatusChange={async (status) => {
          if (!selectedApp) return;
          setStatusSaving(true);
          try {
            await schoolWebsiteAdminService.updateApplicationStatus(Number(selectedApp.id), status);
            toast({
              title: status === 'accepted' ? 'Application accepted' : 'Application updated',
              description:
                status === 'accepted'
                  ? 'The student was added to Pending Admissions under the student list. You can approve enrollment there.'
                  : undefined,
            });
            setSelectedApp(null);
            await loadAll();
          } finally {
            setStatusSaving(false);
          }
        }}
      />

      <WebsiteEmploymentDetailsDialog
        application={selectedEmployment}
        open={!!selectedEmployment}
        onClose={() => setSelectedEmployment(null)}
        saving={employmentStatusSaving}
        onStatusChange={async (status) => {
          if (!selectedEmployment) return;
          setEmploymentStatusSaving(true);
          try {
            await schoolWebsiteAdminService.updateEmploymentStatus(Number(selectedEmployment.id), status);
            toast({ title: 'Employment application updated' });
            setSelectedEmployment(null);
            await loadAll();
          } finally {
            setEmploymentStatusSaving(false);
          }
        }}
      />

      <WebsiteContactMessageDetailsDialog
        message={selectedContactMessage}
        open={!!selectedContactMessage}
        onClose={() => setSelectedContactMessage(null)}
        markingRead={contactMarkReadSaving}
        onMarkRead={async () => {
          if (!selectedContactMessage) return;
          await markContactMessageRead(selectedContactMessage);
        }}
      />
      </div>
    </div>
  );
}
