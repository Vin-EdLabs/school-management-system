import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { superAdminWebsiteService, type WebsiteEnableRequest } from '@/services/schoolWebsiteService';
import {
  getEffectiveWebsiteSubdomain,
  getSchoolWebsiteDomainSuffix,
  getSchoolWebsitePublicUrl,
} from '@/utils/schoolWebsiteHost';

type SchoolRow = Record<string, unknown>;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  glowClass,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  iconClass: string;
  glowClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className={cn('absolute -right-3 -top-3 h-20 w-20 rounded-full opacity-20 blur-2xl', glowClass)} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80', iconClass)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function SchoolWebsitesPanel({
  onPendingCountChange,
}: {
  onPendingCountChange?: (count: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [enableRequests, setEnableRequests] = useState<WebsiteEnableRequest[]>([]);
  const [stats, setStats] = useState({ active_sites: 0, pending_applications: 0, pending_enable_requests: 0 });
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [subdomainDrafts, setSubdomainDrafts] = useState<Record<number, string>>({});
  const [savingSubdomain, setSavingSubdomain] = useState<number | null>(null);

  const domainSuffix = getSchoolWebsiteDomainSuffix();

  const load = () => {
    setLoading(true);
    void superAdminWebsiteService
      .list()
      .then((data) => {
        const rows = data.schools || [];
        const requests = data.enable_requests || [];
        setSchools(rows);
        setEnableRequests(requests);
        const nextStats = data.stats || { active_sites: 0, pending_applications: 0, pending_enable_requests: 0 };
        setStats(nextStats);
        onPendingCountChange?.(Number(nextStats.pending_enable_requests ?? requests.length));
        const drafts: Record<number, string> = {};
        rows.forEach((s) => {
          const id = Number(s.tenant_id);
          drafts[id] = String(
            s.public_subdomain ||
              getEffectiveWebsiteSubdomain(String(s.slug || ''), s.public_subdomain as string | null)
          );
        });
        setSubdomainDrafts(drafts);
      })
      .catch(() => toast({ title: 'Failed to load websites', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const pendingByTenant = useMemo(() => {
    const map = new Map<number, WebsiteEnableRequest>();
    enableRequests.forEach((r) => map.set(Number(r.tenant_id), r));
    return map;
  }, [enableRequests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => {
      const name = String(s.tenant_name || '').toLowerCase();
      const slug = String(s.slug || '').toLowerCase();
      const sub = String(s.effective_public_subdomain || s.public_subdomain || slug).toLowerCase();
      return name.includes(q) || slug.includes(q) || sub.includes(q);
    });
  }, [schools, query]);

  const publishedCount = useMemo(() => schools.filter((s) => s.is_published).length, [schools]);

  const toggle = async (tenantId: number, enabled: boolean) => {
    try {
      await superAdminWebsiteService.setEnabled(tenantId, enabled);
      load();
      toast({ title: enabled ? 'Website feature enabled' : 'Website feature disabled' });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const saveSubdomain = async (tenantId: number, tenantSlug: string) => {
    const draft = (subdomainDrafts[tenantId] || '').trim().toLowerCase();
    const currentEffective = getEffectiveWebsiteSubdomain(tenantSlug, schools.find((s) => Number(s.tenant_id) === tenantId)?.public_subdomain as string | null);
    if (draft === currentEffective) return;

    setSavingSubdomain(tenantId);
    try {
      const resetToDefault = !draft || draft === tenantSlug.toLowerCase();
      await superAdminWebsiteService.setSubdomain(tenantId, resetToDefault ? null : draft);
      toast({ title: 'Public domain updated' });
      load();
    } catch (e) {
      toast({
        title: 'Could not update domain',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingSubdomain(null);
    }
  };

  const copyUrl = async (tenantId: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(tenantId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-12">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Loading school websites…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-slate-950 dark:to-teal-950/20 md:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Public school sites
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              School Websites
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enable the premium public website for each school. Sites live at{' '}
              <code className="rounded-md bg-white/80 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-slate-900/80 dark:text-emerald-300">
                school.{domainSuffix}
              </code>{' '}
              — you can customize the <strong>school</strong> part per tenant.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-xs text-muted-foreground backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            <p className="font-semibold text-slate-800 dark:text-slate-100">URL format</p>
            <p className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
              {'{subdomain}.'}{domainSuffix}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Feature enabled"
          value={stats.active_sites}
          hint="Schools with website module on"
          icon={Globe}
          iconClass="text-emerald-600"
          glowClass="bg-emerald-500"
        />
        <StatCard
          label="Published live"
          value={publishedCount}
          hint="Public sites visitors can open"
          icon={Sparkles}
          iconClass="text-violet-600"
          glowClass="bg-violet-500"
        />
        <StatCard
          label="Pending applications"
          value={stats.pending_applications}
          hint="Across all school sites"
          icon={Users}
          iconClass="text-sky-600"
          glowClass="bg-sky-500"
        />
        <StatCard
          label="Activation requests"
          value={stats.pending_enable_requests ?? enableRequests.length}
          hint="Schools asking for the website feature"
          icon={Mail}
          iconClass="text-rose-600"
          glowClass="bg-rose-500"
        />
        <StatCard
          label="Gallery photos"
          value={schools.reduce((sum, s) => sum + Number(s.gallery_count || 0), 0)}
          hint="Total uploaded images"
          icon={ImageIcon}
          iconClass="text-amber-600"
          glowClass="bg-amber-500"
        />
      </div>

      {enableRequests.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/80 via-white to-orange-50/40 shadow-sm dark:border-rose-900/40 dark:from-rose-950/20 dark:via-slate-950 dark:to-orange-950/10">
          <div className="flex flex-col gap-2 border-b border-rose-100 px-5 py-4 dark:border-rose-900/30 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-rose-900 dark:text-rose-100">
                <MessageSquare className="h-4 w-4" />
                Website activation requests
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Messages from schools requesting the ScholarNerve website feature — enable the toggle below each school when ready.
              </p>
            </div>
            <Badge variant="destructive" className="w-fit rounded-full">
              {enableRequests.length} pending
            </Badge>
          </div>
          <div className="divide-y divide-rose-100 dark:divide-rose-900/30">
            {enableRequests.map((req) => (
              <div key={req.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{req.tenant_name}</p>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {new Date(req.created_at).toLocaleString()}
                    </Badge>
                  </div>
                  {req.requested_by_name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      From: <span className="font-medium text-slate-700 dark:text-slate-200">{req.requested_by_name}</span>
                    </p>
                  ) : null}
                  <div className="mt-3 rounded-xl border border-rose-100 bg-white/90 p-4 dark:border-rose-900/30 dark:bg-slate-900/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                      {req.message}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
                  <Button
                    size="sm"
                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void toggle(Number(req.tenant_id), true)}
                  >
                    Enable website
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold">All schools</h3>
            <p className="text-xs text-muted-foreground">{filtered.length} school{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search school or domain…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">No schools match your search.</div>
          ) : (
            filtered.map((s) => {
              const tenantId = Number(s.tenant_id);
              const pendingReq = pendingByTenant.get(tenantId);
              const tenantSlug = String(s.slug || '');
              const effectiveSub = getEffectiveWebsiteSubdomain(
                tenantSlug,
                s.public_subdomain as string | null | undefined
              );
              const url = tenantSlug ? getSchoolWebsitePublicUrl(effectiveSub) : '';
              const draft = subdomainDrafts[tenantId] ?? effectiveSub;
              const customDomain = String(s.public_subdomain || '').trim().length > 0;

              return (
                <div
                  key={String(s.tenant_id)}
                  className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{String(s.tenant_name)}</p>
                      <Badge variant={s.is_published ? 'default' : 'secondary'} className="rounded-full">
                        {s.is_published ? 'Live' : 'Draft'}
                      </Badge>
                      {!s.is_enabled && (
                        <Badge variant="outline" className="rounded-full text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                      {pendingReq && (
                        <Badge variant="destructive" className="rounded-full">
                          Activation requested
                        </Badge>
                      )}
                    </div>
                    {pendingReq ? (
                      <p className="mt-2 line-clamp-2 rounded-lg border border-rose-100 bg-rose-50/80 px-3 py-2 text-xs leading-relaxed text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100">
                        <span className="font-semibold">Message: </span>
                        {pendingReq.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Portal slug: <span className="font-mono">{tenantSlug || '—'}</span>
                      {customDomain && (
                        <span className="ml-2 text-emerald-700 dark:text-emerald-300">· custom domain</span>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{Number(s.pending_applications || 0)} pending apps</span>
                      <span>{Number(s.gallery_count || 0)} photos</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Public domain
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                        <Input
                          value={draft}
                          onChange={(e) =>
                            setSubdomainDrafts((prev) => ({
                              ...prev,
                              [tenantId]: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                            }))
                          }
                          className="h-10 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
                          placeholder="school-name"
                        />
                        <span className="shrink-0 border-l border-slate-200 px-3 py-2 text-xs text-muted-foreground dark:border-slate-700">
                          .{domainSuffix}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 shrink-0 rounded-xl"
                        disabled={savingSubdomain === tenantId}
                        onClick={() => void saveSubdomain(tenantId, tenantSlug)}
                      >
                        {savingSubdomain === tenantId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save domain'
                        )}
                      </Button>
                    </div>
                    {url && (
                      <p className="truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-300">{url}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <span className="text-xs font-medium text-muted-foreground">Feature</span>
                      <Switch
                        checked={!!s.is_enabled}
                        onCheckedChange={(v) => void toggle(tenantId, v)}
                      />
                    </div>
                    {url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 rounded-xl"
                          onClick={() => void copyUrl(tenantId, url)}
                        >
                          {copiedId === tenantId ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open site
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
