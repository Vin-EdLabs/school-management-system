import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, GraduationCap, LogOut, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import '../partners/partners.css';
import './parentPortal.css';

export type ParentPortalTab = {
  key: string;
  icon: React.ReactNode;
  label: string;
};

export type ParentAppNotification = {
  id: string;
  serverId?: number;
  title: string;
  message: string;
  at: string;
  read: boolean;
};

function formatNotifTime(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ParentPortalBackground({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <div className="snp-portal-bg" aria-hidden>
      {logoUrl ? <img src={logoUrl} alt="" className="snp-portal-bg-logo opacity-[0.06]" /> : null}
    </div>
  );
}

export function ParentNotificationsPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  notifications: ParentAppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onSelect: (n: ParentAppNotification) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <button type="button" className="snp-notif-backdrop" aria-label="Close notifications" onClick={onClose} />
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
              {unreadCount > 0 ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{unreadCount} unread</p>
              ) : null}
            </div>
          </div>
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-[min(70dvh,24rem)] overflow-y-auto overscroll-contain px-2 py-2">
          {notifications.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(n)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]',
                      n.read
                        ? 'border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40'
                        : 'border-emerald-200 bg-emerald-50/90 shadow-sm ring-1 ring-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:ring-emerald-900/40'
                    )}
                  >
                    <p className={cn('text-sm leading-snug', n.read ? 'font-medium text-slate-700 dark:text-slate-200' : 'font-bold text-slate-900 dark:text-white')}>
                      {n.title}
                    </p>
                    <p className={cn('mt-0.5 line-clamp-3 text-xs leading-relaxed', n.read ? 'text-slate-500' : 'text-slate-700 dark:text-slate-300')}>
                      {n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatNotifTime(n.at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export function ParentPortalTopChrome({ children }: { children: React.ReactNode }) {
  return <div className="snp-parent-top-chrome">{children}</div>;
}

export function ParentPortalHeader({
  greeting,
  subtitle,
  logoUrl,
  onSwitcher,
  canSwitch,
  notifOpen,
  onNotifToggle,
  unreadCount,
  onLogout,
  bellRef,
}: {
  greeting: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  onSwitcher?: () => void;
  canSwitch: boolean;
  notifOpen: boolean;
  onNotifToggle: () => void;
  unreadCount: number;
  onLogout: () => void;
  bellRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  return (
    <header className="snp-app-header snp-parent-app-header">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6">
        <button
          type="button"
          onClick={onSwitcher}
          className={cn('snp-header-brand min-w-0 flex-1 text-left', !canSwitch && 'cursor-default')}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 p-1 shadow-sm ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="snp-header-title truncate text-base font-black tracking-tight">{greeting}</p>
              {subtitle ? <p className="snp-header-sub truncate">{subtitle}</p> : null}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="snp-header-btn"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            ref={bellRef}
            type="button"
            className="snp-header-btn snp-bell-btn relative"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onClick={onNotifToggle}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? <span className="snp-m-bell-dot" /> : null}
          </button>
          <button type="button" className="snp-header-btn" aria-label="Log out" onClick={onLogout}>
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function ParentPortalDesktopNav({
  tabs,
  activeTab,
  onTabChange,
  deskUnread,
}: {
  tabs: ParentPortalTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  deskUnread: number;
}) {
  return (
    <nav className="snp-parent-desktop-nav">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-3 pt-1 sm:px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm',
              activeTab === t.key
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                : 'bg-white/70 text-slate-600 hover:bg-white dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:border dark:border-slate-700/50'
            )}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.key === 'desk' && deskUnread > 0 ? (
              <span className="min-h-4 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                {deskUnread > 9 ? '9+' : deskUnread}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function ParentPortalMobileNav({
  tabs,
  activeTab,
  onTabChange,
  deskUnread,
}: {
  tabs: ParentPortalTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  deskUnread: number;
}) {
  return (
    <div className="snp-bottom-shell sm:hidden">
      <nav className="snp-bottom-nav snp-parent-bottom-nav" aria-label="Parent navigation">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={cn('snp-nav-tab relative', activeTab === t.key && 'active')}
            onClick={() => onTabChange(t.key)}
          >
            <span className="relative inline-flex">
              {t.icon}
              {t.key === 'desk' && deskUnread > 0 ? (
                <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white ring-2 ring-white">
                  {deskUnread > 9 ? '9' : deskUnread}
                </span>
              ) : null}
            </span>
            <span className="snp-nav-label">{t.key === 'desk' ? 'Desk' : t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
