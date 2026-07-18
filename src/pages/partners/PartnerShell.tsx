import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell, Building2, Home, LayoutGrid, LogOut, Moon, Plus, Sun, User, Wallet, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { usePartnerNotifications, useInvalidatePartnerQueries, type PartnerNotification } from './usePartnerQueries';
import { usePartnerSession } from '@/pages/partners/partnerSession';
import { PartnerSkeletonBlock } from './PartnerLoading';
import ReferSchoolModal from './ReferSchoolModal';
import PartnerLogo from './PartnerLogo';
import { PartnerPushPrompt } from './usePartnerPush';
import PartnerWelcomeSetup from './PartnerWelcomeSetup';
import { usePartnerTab } from './usePartnerTab';
import type { PartnerLead } from '@/services/partnerApi';
import './partners.css';

const A2HS_DISMISS_KEY = 'snPartnerA2hsDismissed';

type TabId = 'dashboard' | 'schools' | 'commissions' | 'more';

function detectMobilePlatform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function AddToHomeScreenBanner() {
  const [visible, setVisible] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const platform = detectMobilePlatform();

  useEffect(() => {
    if (isStandalonePwa()) return;
    if (localStorage.getItem(A2HS_DISMISS_KEY) === '1') return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(A2HS_DISMISS_KEY, '1');
    setVisible(false);
    setHowOpen(false);
  };

  const instructions =
    platform === 'ios'
      ? 'Tap Share → scroll down → Add to Home Screen'
      : platform === 'android'
        ? 'Tap Menu (⋮) → Add to Home Screen'
        : 'Use your browser menu to install this app.';

  return (
    <>
      <div className="snp-a2hs-banner snp-fade-up">
        <span className="text-lg" aria-hidden>📱</span>
        <span className="snp-a2hs-text">Add to your home screen</span>
        <button type="button" className="snp-a2hs-how" onClick={() => setHowOpen(true)}>How?</button>
        <button type="button" className="snp-a2hs-dismiss" aria-label="Dismiss" onClick={dismiss}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <Sheet open={howOpen} onOpenChange={setHowOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t bg-white dark:bg-slate-900">
          <SheetHeader>
            <SheetTitle className="text-left">Add to Home Screen</SheetTitle>
          </SheetHeader>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{instructions}</p>
          <Button className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700" onClick={dismiss}>Got it</Button>
        </SheetContent>
      </Sheet>
    </>
  );
}

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Strip login CTAs from in-app notifications — partners are already signed in. */
function sanitizeNotificationBody(body: string): string {
  return body
    .replace(/\s*Log\s*in to [^.]+\./gi, '.')
    .replace(/\s*Login to [^.]+\./gi, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/\s+\./g, '.')
    .trim();
}

function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { markNotificationRead, markNotificationsRead } = usePartnerSession();
  const { data: items = [], isLoading: loading } = usePartnerNotifications(open);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const patchRead = (id: number) => {
    queryClient.setQueryData<PartnerNotification[]>(['partner', 'notifications'], (old) =>
      (old || []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  };

  const patchAllRead = () => {
    const now = new Date().toISOString();
    queryClient.setQueryData<PartnerNotification[]>(['partner', 'notifications'], (old) =>
      (old || []).map((n) => ({ ...n, read_at: n.read_at || now })),
    );
  };

  const handleMarkRead = (n: PartnerNotification) => {
    if (n.read_at) return;
    patchRead(n.id);
    markNotificationRead(n.id, Math.max(0, unreadCount - 1));
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    markNotificationsRead();
    patchAllRead();
  };

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="snp-notif-backdrop"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        className="snp-notif-dropdown snp-notif-dropdown--open"
        role="dialog"
        aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="snp-notif-dropdown-accent" aria-hidden />
        <div className="flex items-center justify-between gap-2 border-b border-emerald-100/80 bg-white/95 px-4 py-3 dark:border-emerald-900/30 dark:bg-slate-900/98">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h2>
              {unreadCount > 0 ? (
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{unreadCount} unread</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                Mark all read
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="snp-header-btn !h-8 !w-8" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[min(50dvh,360px)] overflow-y-auto bg-white/95 px-2 py-2 dark:bg-slate-900/98">
          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <PartnerSkeletonBlock key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">No notifications yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => {
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'snp-notif-item rounded-xl border px-3 py-2.5 transition',
                      unread ? 'snp-notif-item--unread' : 'snp-notif-item--read',
                      unread
                        ? 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/25'
                        : 'border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40',
                    )}
                  >
                    <p className={cn('snp-notif-item-title text-[13px] leading-snug', unread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200')}>
                      {n.title}
                    </p>
                    <p className="snp-notif-item-body mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-200">
                      {sanitizeNotificationBody(n.body)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="snp-notif-item-meta text-[10px] font-medium text-slate-400 dark:text-slate-400">{formatNotifTime(n.created_at)}</span>
                      {unread ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n)}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700"
                        >
                          Mark as read
                        </button>
                      ) : (
                        <span className="snp-notif-item-meta text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Read</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function ProfileMenu({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { partner, logout } = usePartnerSession();
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="snp-profile-menu absolute right-0 top-[calc(100%+8px)] z-[70] w-52 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
          {partner.firstName} {partner.lastName}
        </p>
        <p className="truncate text-xs text-slate-400">{partner.partnerId || partner.email}</p>
      </div>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => { onNavigate('/profile'); onClose(); }}
      >
        <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> My Profile
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => { toggleTheme(); }}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-slate-800 dark:hover:bg-red-950/30"
        onClick={() => { onClose(); logout(); }}
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

export function PartnerShellHeader({ onReferOpen }: { onReferOpen?: () => void }) {
  const navigate = useNavigate();
  const { partner, stats } = usePartnerSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasUnread = (stats?.unreadNotifications ?? 0) > 0;
  const initials = `${partner.firstName[0] || ''}${partner.lastName[0] || ''}`.toUpperCase();

  return (
    <>
      <header className="snp-app-header sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6">
          <div className="snp-header-brand min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 p-1 shadow-sm ring-1 ring-emerald-100 backdrop-blur-sm dark:bg-emerald-950/50 dark:ring-emerald-900">
                <PartnerLogo variant="compact" className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="snp-header-title truncate">ScholarNerve Partners</p>
                <p className="snp-header-sub truncate">
                  {partner.partnerId ? partner.partnerId : 'Partner Network'}
                </p>
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-1 sm:gap-2">
            {onReferOpen ? (
              <button
                type="button"
                onClick={onReferOpen}
                className="snp-header-refer hidden items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 md:inline-flex"
              >
                <Plus strokeWidth={3} className="h-4 w-4" />
                Refer School
              </button>
            ) : null}
            <div className="relative">
              <button
                type="button"
                className="snp-header-btn snp-bell-btn relative"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => { setMenuOpen(false); setNotifOpen((v) => !v); }}
              >
                <Bell className="h-5 w-5" />
                {hasUnread ? <span className="snp-m-bell-dot" /> : null}
              </button>
            </div>
            <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            <button
              type="button"
              className="snp-header-avatar"
              aria-label="Account menu"
              onClick={() => { setNotifOpen(false); setMenuOpen((v) => !v); }}
            >
              {partner.profilePhotoUrl ? (
                <img src={partner.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </button>
            <ProfileMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              onNavigate={(p) => navigate(p)}
            />
          </div>
        </div>
      </header>
    </>
  );
}

export function PartnerBottomNav({
  activeTab,
  onTabChange,
  onReferOpen,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onReferOpen: () => void;
}) {
  return (
    <div className="snp-bottom-shell md:hidden">
      <AddToHomeScreenBanner />
      <nav className="snp-bottom-nav" aria-label="Partner navigation">
        <button type="button" className={cn('snp-nav-tab', activeTab === 'dashboard' && 'active')} onClick={() => onTabChange('dashboard')}>
          <Home strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <span className="snp-nav-label">Home</span>
        </button>
        <button type="button" className={cn('snp-nav-tab', activeTab === 'schools' && 'active')} onClick={() => onTabChange('schools')}>
          <Building2 strokeWidth={activeTab === 'schools' ? 2.5 : 2} />
          <span className="snp-nav-label">Schools</span>
        </button>
        <div className="snp-nav-fab-slot">
          <button type="button" className="snp-nav-fab" aria-label="Refer School" onClick={onReferOpen}>
            <Plus strokeWidth={3.2} className="h-7 w-7" />
          </button>
        </div>
        <button type="button" className={cn('snp-nav-tab', activeTab === 'commissions' && 'active')} onClick={() => onTabChange('commissions')}>
          <Wallet strokeWidth={activeTab === 'commissions' ? 2.5 : 2} />
          <span className="snp-nav-label">Earnings</span>
        </button>
        <button type="button" className={cn('snp-nav-tab', activeTab === 'more' && 'active')} onClick={() => onTabChange('more')}>
          <LayoutGrid strokeWidth={activeTab === 'more' ? 2.5 : 2} />
          <span className="snp-nav-label">More</span>
        </button>
      </nav>
    </div>
  );
}

export function PartnerDesktopNav({
  activeTab,
  onTabChange,
  onReferOpen,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  onReferOpen?: () => void;
}) {
  const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'schools', label: 'Schools', icon: Building2 },
    { id: 'commissions', label: 'Earnings', icon: Wallet },
    { id: 'more', label: 'More', icon: LayoutGrid },
  ];
  return (
    <nav className="hidden md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 pb-3 pt-1">
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                activeTab === id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                  : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {onReferOpen ? (
          <button
            type="button"
            onClick={onReferOpen}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/25 hover:from-emerald-800 hover:to-teal-700"
          >
            <Plus strokeWidth={3} className="h-5 w-5" />
            Refer School
          </button>
        ) : null}
      </div>
    </nav>
  );
}

export function PartnerShell({
  children,
  referOpen,
  onReferOpenChange,
}: {
  children: React.ReactNode;
  referOpen: boolean;
  onReferOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const activeTab = usePartnerTab();
  const { refresh } = usePartnerSession();
  const { prependLead, invalidateLeads } = useInvalidatePartnerQueries();

  const handleReferSubmitted = (lead: PartnerLead) => {
    prependLead(lead);
    void invalidateLeads();
    void refresh();
  };

  const handleTab = (tab: TabId) => {
    const routes: Record<TabId, string> = {
      dashboard: '/dashboard',
      schools: '/schools',
      commissions: '/commissions',
      more: '/more',
    };
    navigate(routes[tab]);
  };

  return (
    <div className="sn-partner-portal snp-mobile-active snp-portal-shell flex min-h-screen flex-col dark:bg-slate-950">
      <div className="snp-portal-bg" aria-hidden>
        <img src="/partners/scholarnerve-partner-emblem.png" alt="" className="snp-portal-bg-logo" />
      </div>
      <div className="snp-portal-content flex min-h-screen flex-col">
        <PartnerShellHeader onReferOpen={() => onReferOpenChange(true)} />
        <PartnerPushPrompt />
        <PartnerWelcomeSetup />
        <PartnerDesktopNav activeTab={activeTab} onTabChange={handleTab} onReferOpen={() => onReferOpenChange(true)} />
        <div className="mx-auto w-full max-w-5xl flex-1 px-0 pb-36 md:pb-10">{children}</div>
        <PartnerBottomNav activeTab={activeTab} onTabChange={handleTab} onReferOpen={() => onReferOpenChange(true)} />
        <ReferSchoolModal
          open={referOpen}
          onClose={() => onReferOpenChange(false)}
          onSubmitted={handleReferSubmitted}
        />
      </div>
    </div>
  );
}
