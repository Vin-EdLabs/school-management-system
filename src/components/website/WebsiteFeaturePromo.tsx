import React, { useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  Check,
  Copy,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquareOff,
  RefreshCw,
  SearchX,
  Send,
  TrendingDown,
  Users,
  UserRound,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getSchoolWebsitePublicUrl } from '@/utils/schoolWebsiteHost';
import { schoolWebsiteAdminService } from '@/services/schoolWebsiteService';

export const SCHOLARNERVE_WEBSITE_EMAIL = 'scholarnerve@gmail.com';

const FEATURES = [
  {
    icon: Globe,
    title: 'Your own school website',
    description: 'A beautiful, mobile-friendly public site with your logo, colours, and story — live on the web 24/7.',
    tone: 'from-indigo-500/10 to-indigo-600/5 text-indigo-700 dark:text-indigo-300',
  },
  {
    icon: GraduationCap,
    title: 'Online admissions',
    description: 'Parents apply from anywhere. Upload documents, choose class, and submit — you review everything in one place.',
    tone: 'from-violet-500/10 to-violet-600/5 text-violet-700 dark:text-violet-300',
  },
  {
    icon: Briefcase,
    title: 'Careers & hiring',
    description: 'Teachers and staff apply online with CVs and certificates. Grow your team without paper forms.',
    tone: 'from-emerald-500/10 to-emerald-600/5 text-emerald-700 dark:text-emerald-300',
  },
  {
    icon: CalendarDays,
    title: 'Events & news',
    description: 'Publish open days, sports days, and ceremonies. Upcoming events appear on your homepage automatically.',
    tone: 'from-amber-500/10 to-amber-600/5 text-amber-700 dark:text-amber-300',
  },
  {
    icon: ImageIcon,
    title: 'Photo gallery',
    description: 'Show classrooms, labs, activities, and facilities — help families see what makes your school special.',
    tone: 'from-rose-500/10 to-rose-600/5 text-rose-700 dark:text-rose-300',
  },
  {
    icon: Mail,
    title: 'Contact inbox',
    description: 'Messages from your contact page land in the admin panel with read/unread tracking — never lose an enquiry.',
    tone: 'from-sky-500/10 to-sky-600/5 text-sky-700 dark:text-sky-300',
  },
  {
    icon: UserRound,
    title: 'Leadership board',
    description: 'Showcase proprietors, head teachers, finance officers, administrators, and selected teachers with photos and bios.',
    tone: 'from-teal-500/10 to-teal-600/5 text-teal-700 dark:text-teal-300',
  },
  {
    icon: Award,
    title: 'Alumni spotlight',
    description: 'Celebrate distinguished alumni with photos, graduation years, achievements, and inspiring success stories.',
    tone: 'from-purple-500/10 to-purple-600/5 text-purple-700 dark:text-purple-300',
  },
];

const MISSED = [
  {
    icon: SearchX,
    title: 'Parents cannot find you online',
    description: 'Families search Google before they visit. Without a website, they may choose a school that looks more established.',
  },
  {
    icon: MessageSquareOff,
    title: 'Enquiries slip through the cracks',
    description: 'Phone calls and WhatsApp messages get lost. A contact form captures every lead in one organised inbox.',
  },
  {
    icon: TrendingDown,
    title: 'Manual admissions slow you down',
    description: 'Paper forms, long queues, and repeated data entry — while competitors offer one-click online applications.',
  },
  {
    icon: Users,
    title: 'Harder to attract quality staff',
    description: 'Great teachers look for schools with a professional online presence. No careers page means fewer applicants.',
  },
];

function BrowserMock({ url, schoolName }: { url: string; schoolName: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-indigo-900/10 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-[10px] text-muted-foreground dark:bg-slate-900">
          {url}
        </div>
      </div>
      <div className="relative bg-gradient-to-br from-[#0c2340] via-[#1a3a5c] to-[#0c2340] p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(201,168,76,0.25),transparent_50%)]" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a84c]">Welcome to</p>
          <h3 className="mt-2 font-serif text-2xl font-bold leading-tight">{schoolName}</h3>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/75">
            A modern public website — admissions, events, gallery, and contact — all managed from ScholarNerve.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold backdrop-blur">Admissions</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold backdrop-blur">Management</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold backdrop-blur">Alumni</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold backdrop-blur">Careers</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800">
        {['Home', 'Gallery', 'Contact'].map((label) => (
          <div key={label} className="bg-white px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivationRequestPanel({
  schoolName,
  variant = 'light',
  onSent,
}: {
  schoolName: string;
  variant?: 'light' | 'dark';
  onSent?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDark = variant === 'dark';

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SCHOLARNERVE_WEBSITE_EMAIL);
      setCopied(true);
      toast({ title: 'Email copied' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy email', variant: 'destructive' });
    }
  };

  const sendRequest = async () => {
    setSending(true);
    try {
      const defaultMsg = `Please enable the School Website feature for ${schoolName}.`;
      await schoolWebsiteAdminService.requestWebsiteEnable(message.trim() || defaultMsg);
      setSent(true);
      onSent?.();
      toast({
        title: 'Request sent to ScholarNerve team',
        description: 'We have received your message and will enable your website soon.',
      });
    } catch (err) {
      toast({
        title: 'Could not send request',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        className={cn(
          'rounded-2xl border p-6 text-center',
          isDark
            ? 'border-white/20 bg-white/10'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
        )}
      >
        <Check className={cn('mx-auto h-10 w-10', isDark ? 'text-emerald-300' : 'text-emerald-600')} />
        <p className={cn('mt-3 text-lg font-bold', isDark ? 'text-white' : 'text-emerald-900 dark:text-emerald-100')}>
          Request sent!
        </p>
        <p className={cn('mt-2 text-sm', isDark ? 'text-indigo-100' : 'text-emerald-800/80 dark:text-emerald-200/80')}>
          The ScholarNerve team has received your message. Use <strong>Check again</strong> after activation.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 md:p-6',
        isDark ? 'border-white/20 bg-white/10' : 'border-indigo-200/80 bg-white shadow-sm dark:border-indigo-900/40 dark:bg-slate-900/60'
      )}
    >
      <p className={cn('text-xs font-bold uppercase tracking-widest', isDark ? 'text-indigo-200' : 'text-indigo-600')}>
        Request activation
      </p>
      <p className={cn('mt-2 text-sm leading-relaxed', isDark ? 'text-indigo-100/90' : 'text-muted-foreground')}>
        Send a message to the ScholarNerve team, or email us at:
      </p>

      <div
        className={cn(
          'mt-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3',
          isDark ? 'border-white/15 bg-black/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'
        )}
      >
        <Mail className={cn('h-4 w-4 shrink-0', isDark ? 'text-indigo-200' : 'text-indigo-600')} />
        <a
          href={`mailto:${SCHOLARNERVE_WEBSITE_EMAIL}?subject=${encodeURIComponent(`Enable School Website — ${schoolName}`)}`}
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-semibold hover:underline',
            isDark ? 'text-white' : 'text-indigo-700 dark:text-indigo-300'
          )}
        >
          {SCHOLARNERVE_WEBSITE_EMAIL}
        </a>
        <Button
          type="button"
          size="sm"
          variant={isDark ? 'secondary' : 'outline'}
          className="h-8 shrink-0 gap-1.5 rounded-lg"
          onClick={() => void copyEmail()}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        <Label className={cn('text-sm', isDark ? 'text-white' : undefined)} htmlFor="website-enable-message">
          Message to ScholarNerve team (optional)
        </Label>
        <Textarea
          id="website-enable-message"
          rows={3}
          className={cn('resize-y', isDark && 'border-white/20 bg-white/5 text-white placeholder:text-white/40')}
          placeholder={`Please enable the School Website feature for ${schoolName}…`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <Button
        type="button"
        size="lg"
        disabled={sending}
        className={cn(
          'mt-4 h-11 w-full gap-2 rounded-xl sm:w-auto',
          isDark ? 'bg-white text-indigo-900 hover:bg-indigo-50' : 'bg-indigo-600 hover:bg-indigo-700'
        )}
        onClick={() => void sendRequest()}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? 'Sending…' : 'Send message to ScholarNerve team'}
      </Button>
    </div>
  );
}

export default function WebsiteFeaturePromo({
  schoolName,
  logoUrl,
  previewUrl: previewUrlProp,
  subdomain,
  onRefresh,
}: {
  schoolName: string;
  logoUrl: string | null;
  previewUrl?: string;
  /** @deprecated use previewUrl */
  subdomain?: string;
  onRefresh?: () => void;
}) {
  const previewUrl =
    previewUrlProp || (subdomain ? getSchoolWebsitePublicUrl(subdomain) : '');

  return (
    <div className="min-h-full animate-in fade-in duration-500">
      <div className="relative overflow-hidden border-b border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white dark:border-indigo-900/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%)]" />
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <Badge className="mb-4 border-0 bg-white/10 text-white hover:bg-white/10">
                Website feature not enabled yet
              </Badge>
              <div className="flex items-start gap-4">
                {logoUrl ? (
                  <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-2 sm:flex">
                    <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  </div>
                ) : null}
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    Give {schoolName} a professional online presence
                  </h1>
                  <p className="mt-4 text-base leading-relaxed text-indigo-100/90">
                    ScholarNerve School Website puts your school on the internet with a branded site, online admissions,
                    careers, events, gallery, and a contact inbox — all managed from this admin panel.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <ActivationRequestPanel schoolName={schoolName} variant="dark" />
              </div>

              {onRefresh ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="mt-4 h-11 gap-2 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={onRefresh}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check again
                </Button>
              ) : null}

              {previewUrl ? (
                <p className="mt-5 text-sm text-indigo-200/80">
                  Your site will live at{' '}
                  <code className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white">{previewUrl}</code>
                </p>
              ) : null}
            </div>
            <div className="w-full max-w-md shrink-0 lg:max-w-sm xl:max-w-md">
              <BrowserMock url={previewUrl || 'yourschool-edu.scholarnerve.com'} schoolName={schoolName} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 md:px-8 md:py-14">
        <section>
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              What you get
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything families and staff expect from a modern school
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One connected system — edit content here, publish instantly, and manage enquiries without leaving ScholarNerve.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, tone }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-800"
              >
                <div
                  className={cn(
                    'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br',
                    tone
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-slate-950 dark:to-orange-950/20">
          <div className="border-b border-amber-200/50 px-6 py-5 dark:border-amber-900/30 md:px-8">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Without a school website
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
              This is what you miss — and what competitors may already have
            </h2>
          </div>
          <div className="grid gap-px bg-amber-200/40 dark:bg-amber-900/20 sm:grid-cols-2">
            {MISSED.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 bg-white/80 p-6 dark:bg-slate-950/60 md:p-7">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <ActivationRequestPanel schoolName={schoolName} variant="light" />
        </section>
      </div>
    </div>
  );
}
