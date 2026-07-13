import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useTeacherNotifications, type TeacherNotifItem } from '../../contexts/TeacherNotificationContext';
import { useSocket } from '../../contexts/SocketContext';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import { cn } from '@/lib/utils';
import { Bell, Bot, User, Clock, Moon, Sun, Crown, MoreVertical, ClipboardList, BookOpen } from 'lucide-react';
import { isHeadmasterRole } from '../../utils/headmasterPortal';
import { useTheme } from '../../contexts/ThemeContext';
import PwaInstallButton from '../common/PwaInstallButton';
import PersonalTodosWidget, { canUsePersonalTodos } from '../todos/PersonalTodosPanel';
import { ModuleUserGuideDialog } from '../common/ModuleUserGuideDialog';
import { fetchUnreadBudgetAlerts, markBudgetAlertRead } from '../../services/termBudgetApi';
import { getShortGreetingName } from '../../utils/displayName';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
  activeModule: string;
  setActiveModule: (id: string) => void;
}

const NOTIF_PANEL_CLASS =
  'fixed z-[200] left-3 right-3 sm:left-auto sm:right-6 sm:w-[min(100vw-2rem,26rem)] max-w-[26rem] sm:ml-auto sm:mr-0 rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200 origin-top';

const NOTIF_LIST_SCROLL_CLASS =
  'max-h-[min(calc(100dvh-8rem),30rem)] overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]';

const NOTIF_BODY_CLASS =
  'mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere]';

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick, activeModule, setActiveModule }) => {
  const { user } = useAuth();
  const { school } = useSchool();
  const { items, unreadCount, markRead, markAllRead } = useTeacherNotifications();
  const { socket } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const [notifPanelTop, setNotifPanelTop] = useState(76);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTodosOpen, setMobileTodosOpen] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<
    Array<{
      id: string;
      type: 'parent-desk' | 'support-chat' | 'term-budget' | 'lost-card' | 'payment-submissions' | 'complaint';
      title: string;
      body: string;
      unread: number;
      timestamp: number;
      alertId?: number;
      priority?: 'HIGH' | 'NORMAL';
      reportId?: string;
      notificationDbId?: number;
    }>
  >([]);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const pwaLogo = resolveLogoUrl(school?.logo_url ?? null);
  const isHeadmaster = isHeadmasterRole(user?.role);
  const showTeacherBell = user?.role === 'teacher' || user?.role === 'staff';
  const showAdminBell =
    !!user &&
    user.role !== 'super-admin' &&
    (['administrator', 'finance'].includes(user.role || '') || isHeadmaster);
  const showAdminNotifications = showAdminBell;
  const headmasterCombinedUnread = isHeadmaster ? unreadCount + adminUnreadCount : adminUnreadCount;
  const bellUnreadCount = showTeacherBell ? unreadCount : headmasterCombinedUnread;
  const bellItems = useMemo(() => items.filter((n) => n.kind !== 'chat'), [items]);
  const showPersonalTodos = canUsePersonalTodos(user?.role);
  const displayName = user?.fullName?.trim() || user?.username || '';
  const mobileGreetingName = useMemo(
    () => getShortGreetingName(displayName),
    [displayName]
  );

  const openMobilePanel = useCallback((open: () => void) => {
    setMobileMenuOpen(false);
    window.setTimeout(open, 120);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const updatePosition = () => {
      const bell = notifBellRef.current;
      if (!bell) return;
      const rect = bell.getBoundingClientRect();
      setNotifPanelTop(Math.max(12, Math.round(rect.bottom + 8)));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    let removeListeners: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const close = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        if (notifPanelRef.current?.contains(target)) return;
        if (target instanceof Element && target.closest('[data-notif-bell]')) return;
        setNotifOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setNotifOpen(false);
      };
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close, { passive: true });
      document.addEventListener('keydown', onKey);
      removeListeners = () => {
        document.removeEventListener('mousedown', close);
        document.removeEventListener('touchstart', close);
        document.removeEventListener('keydown', onKey);
      };
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removeListeners?.();
    };
  }, [notifOpen]);

  const openStaffNotification = useCallback(
    (n: TeacherNotifItem) => {
      markRead(n.id);
      setNotifOpen(false);
      if (n.kind === 'chat') {
        const match = n.url?.match(/channel=(\d+)/);
        if (match?.[1]) {
          try {
            sessionStorage.setItem('chat-open-channel', match[1]);
          } catch {
            /* ignore */
          }
        }
        setActiveModule('messages');
      }
    },
    [markRead, setActiveModule]
  );

  const renderNotificationPanel = () => {
    if (!notifOpen) return null;

    const panelStyle = { top: `${notifPanelTop}px` } as const;

    let panel: React.ReactNode = null;

    if (showTeacherBell) {
      panel = (
        <div ref={notifPanelRef} className={NOTIF_PANEL_CLASS} style={panelStyle}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 shrink-0 bg-white dark:bg-slate-900 rounded-t-2xl">
            <p className="text-xs font-semibold text-foreground">Notifications</p>
            {bellItems.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className={NOTIF_LIST_SCROLL_CLASS}>
            {bellItems.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No notifications yet.</p>
            ) : (
              <div className="space-y-2 p-2 pb-4">
                {bellItems.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openStaffNotification(n)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors touch-manipulation select-text ${
                      n.read
                        ? 'border-border bg-card hover:bg-muted/50'
                        : 'border-indigo-200/80 bg-indigo-50/60 hover:bg-indigo-100/70 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className={NOTIF_BODY_CLASS}>{n.body}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    } else if (showAdminBell) {
      panel = (
        <div ref={notifPanelRef} className={NOTIF_PANEL_CLASS} style={panelStyle}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 shrink-0 bg-white dark:bg-slate-900 rounded-t-2xl">
            <p className="text-xs font-semibold text-foreground">
              {isHeadmaster ? 'Notifications' : 'School Messages'}
            </p>
            {isHeadmaster && bellItems.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className={NOTIF_LIST_SCROLL_CLASS}>
            {isHeadmaster && bellItems.length > 0 && (
              <div className="space-y-2 border-b border-border p-2 pb-3">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Staff alerts
                </p>
                {bellItems.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openStaffNotification(n)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors touch-manipulation select-text ${
                      n.read
                        ? 'border-border bg-card hover:bg-muted/50'
                        : 'border-indigo-200/80 bg-indigo-50/60 hover:bg-indigo-100/70 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className={NOTIF_BODY_CLASS}>{n.body}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
            {adminNotifications.length === 0 ? (
              !(isHeadmaster && bellItems.length > 0) ? (
                <p className="p-4 text-xs text-muted-foreground">
                  {isHeadmaster ? 'No notifications yet.' : 'No unread school messages.'}
                </p>
              ) : null
            ) : (
              <div className="space-y-2 p-2 pb-4">
                {isHeadmaster && (
                  <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    School messages
                  </p>
                )}
                {adminNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={async () => {
                      await markAdminNotificationRead(
                        notification.type,
                        notification.alertId,
                        notification.notificationDbId
                      );
                      setNotifOpen(false);
                      if (notification.type === 'lost-card') {
                        if (notification.reportId) {
                          try {
                            sessionStorage.setItem('lost-card-report-id', notification.reportId);
                          } catch {
                            /* ignore */
                          }
                        }
                        setActiveModule('lost-cards');
                        return;
                      }
                      if (notification.type === 'complaint') {
                        setActiveModule('complaints');
                        return;
                      }
                      setActiveModule(notification.type === 'term-budget' ? 'term-budget' : notification.type);
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors touch-manipulation select-text',
                      notification.priority === 'HIGH'
                        ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60'
                        : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/70'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {notification.priority === 'HIGH' && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                        <p className={NOTIF_BODY_CLASS}>{notification.body}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!panel) return null;
    return typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
  };

  const renderNotificationBell = (className?: string) => {
    if (!showTeacherBell && !showAdminBell) return null;

    return (
      <Button
        ref={notifBellRef}
        type="button"
        variant="ghost"
        size="icon"
        data-notif-bell
        className={cn(
          'relative h-10 w-10 shrink-0 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 touch-manipulation',
          className
        )}
        title={showAdminBell ? (isHeadmaster ? 'Notifications' : 'School messages') : 'Notifications'}
        aria-expanded={notifOpen}
        onClick={() => setNotifOpen((open) => !open)}
      >
        <Bell className="h-5 w-5" />
        {bellUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {bellUnreadCount > 9 ? '9+' : bellUnreadCount}
          </span>
        )}
      </Button>
    );
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const loadAdminNotifications = useCallback(async () => {
    if (!showAdminNotifications) return;
    try {
      const results: Array<{
        id: string;
        count: number;
        title: string;
        body: string;
        type: 'parent-desk' | 'support-chat' | 'term-budget' | 'lost-card' | 'payment-submissions' | 'complaint';
        priority?: 'HIGH' | 'NORMAL';
        reportId?: string;
        notificationDbId?: number;
        timestamp?: number;
      }> = [];

      const lostRes = await apiService.get<{
        items: Array<{
          id: number;
          title: string;
          message: string;
          priority: string;
          report_id: string;
          created_at: string;
        }>;
      }>('/lost-cards/notifications/unread').catch(() => ({ items: [] }));
      for (const n of lostRes.items || []) {
        results.push({
          id: `lost-card-${n.id}`,
          type: 'lost-card',
          count: 1,
          title: n.title,
          body: n.message,
          priority: n.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
          reportId: n.report_id,
          notificationDbId: n.id,
          timestamp: new Date(n.created_at).getTime(),
        });
      }

      const complaintRes = await apiService.get<{
        items: Array<{
          id: number;
          title: string;
          message: string;
          priority: string;
          link: string;
          created_at: string;
        }>;
      }>('/complaints/notifications/unread').catch(() => ({ items: [] }));
      for (const n of complaintRes.items || []) {
        results.push({
          id: `complaint-${n.id}`,
          type: 'complaint',
          count: 1,
          title: n.title,
          body: n.message,
          priority: n.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
          notificationDbId: n.id,
          timestamp: new Date(n.created_at).getTime(),
        });
      }

      const parentRes = await apiService.get<{ count: number }>('/messages/admin/unread-count');
      const parentCount = Number(parentRes?.count ?? 0);
      if (parentCount > 0) {
        results.push({
          id: 'parent-desk',
          type: 'parent-desk',
          count: parentCount,
          title: 'Parent Desk',
          body: `${parentCount} unread parent message${parentCount === 1 ? '' : 's'}.`,
        });
      }
      const supportRes = await apiService.get<{ count: number }>('/support-chat/unread-count');
      const supportCount = Number(supportRes?.count ?? 0);
      if (supportCount > 0) {
        results.push({
          id: 'support-chat',
          type: 'support-chat',
          count: supportCount,
          title: 'Support Chat',
          body: `${supportCount} unread support message${supportCount === 1 ? '' : 's'}.`,
        });
      }
      const paymentRes = await apiService.get<{ count: number }>('/payment-submissions/pending-count').catch(() => ({ count: 0 }));
      const paymentCount = Number(paymentRes?.count ?? 0);
      if (paymentCount > 0) {
        results.push({
          id: 'payment-submissions',
          type: 'payment-submissions',
          count: paymentCount,
          title: 'Payment Submissions',
          body: `${paymentCount} pending payment proof${paymentCount === 1 ? '' : 's'} awaiting review.`,
        });
      }
      const budgetAlerts = await fetchUnreadBudgetAlerts().catch(() => ({ alerts: [], count: 0 }));
      for (const alert of budgetAlerts.alerts || []) {
        const level = String(alert.alert_level || 'warning');
        results.push({
          id: `budget-alert-${alert.id}`,
          type: 'term-budget',
          count: 1,
          title: `Budget ${level}`,
          body: String(alert.message || alert.category_name || 'Budget alert'),
        });
      }
      results.sort((a, b) => {
        const pa = a.priority === 'HIGH' ? 0 : 1;
        const pb = b.priority === 'HIGH' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      setAdminNotifications(
        results.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          unread: item.count,
          timestamp: item.timestamp || Date.now(),
          alertId: item.type === 'term-budget' ? Number(String(item.id).replace('budget-alert-', '')) : undefined,
          priority: item.priority,
          reportId: item.reportId,
          notificationDbId: item.notificationDbId,
        }))
      );
      setAdminUnreadCount(results.reduce((sum, item) => sum + item.count, 0));
    } catch (error) {
      console.error('Load admin notifications error:', error);
      setAdminNotifications([]);
      setAdminUnreadCount(0);
    }
  }, [showAdminNotifications]);

  const showAdminCommsToast = useCallback((type: 'parent-desk' | 'support-chat', preview?: string) => {
    const body = String(preview || '').trim();
    if (type === 'parent-desk') {
      toast('New parent desk message', {
        description: body || 'A parent sent a new message.',
        duration: 12_000,
        className: 'border-l-4 border-l-sky-500',
      });
      return;
    }
    toast('ScholarNerve Support replied', {
      description: body || 'You have a new support message.',
      duration: 12_000,
      className: 'border-l-4 border-l-sky-500',
    });
  }, []);

  const markAdminNotificationRead = useCallback(async (
    notificationType: 'parent-desk' | 'support-chat' | 'term-budget' | 'lost-card' | 'payment-submissions' | 'complaint',
    alertId?: number,
    notificationDbId?: number
  ) => {
    try {
      if (notificationType === 'term-budget' && alertId) {
        await markBudgetAlertRead(alertId);
      }
      if (notificationType === 'lost-card' && notificationDbId) {
        await apiService.post(`/lost-cards/notifications/${notificationDbId}/read`, {});
      }
      if (notificationType === 'complaint' && notificationDbId) {
        await apiService.post(`/complaints/notifications/${notificationDbId}/read`, {});
      }
      if (notificationType !== 'parent-desk' && notificationType !== 'support-chat') {
        await loadAdminNotifications();
      }
    } catch (error) {
      console.error('Mark admin notification read error:', error);
    }
  }, [loadAdminNotifications]);

  useEffect(() => {
    if (!showAdminNotifications) return;
    void loadAdminNotifications();
  }, [showAdminNotifications, loadAdminNotifications]);

  useEffect(() => {
    if (!notifOpen || !showAdminNotifications) return;
    void loadAdminNotifications();
  }, [notifOpen, showAdminNotifications, loadAdminNotifications]);

  useEffect(() => {
    if (!socket || !showAdminNotifications) return;
    const onTenant = (evt: { entity?: string; tenantId?: number | null }) => {
      const tid = evt.tenantId;
      if (tid != null && user?.tenantId != null && tid !== user.tenantId) return;
      const e = String(evt?.entity || '');
      if (e === 'parent-desk' || e === 'support-chat' || e === 'term-budget' || e === 'lost-card' || e === 'payment-submission' || e === 'complaint' || e === 'chat' || e === 'staff-notification') {
        void loadAdminNotifications();
      }
    };
    const onNew = (event: { type?: string; preview?: string }) => {
      const type = String(event?.type || '');
      if (type === 'parent-desk' || type === 'support-chat' || type === 'lost-card') {
        if (type === 'parent-desk' || type === 'support-chat') {
          showAdminCommsToast(type, event.preview);
        }
        void loadAdminNotifications();
      }
    };
    const onSupportMessage = (msg: Record<string, unknown>) => {
      if (!Boolean(msg.is_from_superadmin)) return;
      const preview = String(msg.message || '').trim();
      showAdminCommsToast('support-chat', preview);
      void loadAdminNotifications();
    };
    const onLostCard = () => {
      void loadAdminNotifications();
    };
    const onComplaint = () => {
      void loadAdminNotifications();
    };
    const onSupportRead = () => {
      void loadAdminNotifications();
    };
    socket.on('tenant-data-changed', onTenant);
    socket.on('new-parent-message', onNew);
    socket.on('new-support-message', onSupportMessage);
    socket.on('support-chat-read', onSupportRead);
    socket.on('lost-card-report', onLostCard);
    socket.on('complaint-filed', onComplaint);
    return () => {
      socket.off('tenant-data-changed', onTenant);
      socket.off('new-parent-message', onNew);
      socket.off('new-support-message', onSupportMessage);
      socket.off('support-chat-read', onSupportRead);
      socket.off('lost-card-report', onLostCard);
      socket.off('complaint-filed', onComplaint);
    };
  }, [socket, showAdminNotifications, loadAdminNotifications, showAdminCommsToast]);

  return (
    <>
    <div className="hidden md:flex relative items-center justify-between w-full h-full gap-2 sm:gap-4 md:gap-6 min-w-0">
      {/* Welcome Section */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 basis-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#146C43] to-[#22C55E] flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 dark:from-blue-500 dark:to-indigo-600 dark:shadow-sm">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
            {getGreeting()}, <span className="text-emerald-700 dark:text-indigo-400">{displayName}</span>
          </h1>
          <div className="flex items-center gap-2">
            {isHeadmaster ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider rounded border border-amber-200/80 dark:border-amber-800 shadow-sm">
                <Crown className="h-3 w-3" />
                Headmaster
              </span>
            ) : (
             <span className="px-2 py-0.5 bg-emerald-50 dark:bg-indigo-950/50 text-[10px] font-bold text-emerald-700 dark:text-indigo-400 uppercase tracking-wider rounded border border-emerald-100/70 dark:border-indigo-900 shadow-sm">
              {user?.role?.replace('-', ' ')}
            </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Personal To-dos */}
      {showPersonalTodos && (
        <div className="hidden md:block absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <PersonalTodosWidget />
        </div>
      )}

      {/* Right Section: Time and Actions */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0 flex-1 basis-0 justify-end ml-auto">
        <div className="hidden sm:flex items-center">
          <div className="px-2 py-1 bg-white/85 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800 flex items-center gap-1.5 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModuleUserGuideDialog activeModule={activeModule} setActiveModule={setActiveModule} />
          <PwaInstallButton
            variant="ghost"
            size="icon"
            logoUrl={pwaLogo}
            className="h-10 w-10 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50"
          />
          {renderNotificationBell()}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {(user?.role === 'finance' || user?.role === 'super-admin') && onAiAssistantClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAiAssistantClick}
              className="shrink-0 bg-gradient-to-r from-blue-50 to-indigo-100 hover:from-blue-100 hover:to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 h-10 px-4 font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Bot className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
              AI Assistant
            </Button>
          )}
        </div>
      </div>
    </div>

    {/* Mobile: greeting + notifications + more menu */}
    <div className="flex md:hidden items-center justify-between w-full min-w-0 gap-2">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate min-w-0 flex-1 leading-snug">
        <span className="text-slate-600 dark:text-slate-400">{getGreeting()},</span>{' '}
        <span className="text-emerald-700 dark:text-indigo-400">{mobileGreetingName}</span>
      </p>
      <div className="flex items-center shrink-0 gap-0.5">
        {renderNotificationBell()}
        <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl touch-manipulation" aria-label="More options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-[100]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground capitalize">
              {isHeadmaster ? 'Headmaster' : user?.role?.replace('-', ' ')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              <Clock className="h-4 w-4 mr-2 shrink-0" />
              {formatTime(currentTime)}
            </DropdownMenuItem>
            {showPersonalTodos && (
              <DropdownMenuItem
                onSelect={() => {
                  setMobileMenuOpen(false);
                  window.setTimeout(() => setMobileTodosOpen(true), 0);
                }}
              >
                <ClipboardList className="h-4 w-4 mr-2 shrink-0" />
                My to-dos
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                openMobilePanel(() => setMobileGuideOpen(true));
              }}
            >
              <BookOpen className="h-4 w-4 mr-2 shrink-0" />
              Page guide
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                toggleTheme();
                setMobileMenuOpen(false);
              }}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 mr-2 shrink-0" /> : <Moon className="h-4 w-4 mr-2 shrink-0" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </DropdownMenuItem>
            {(user?.role === 'finance' || user?.role === 'super-admin') && onAiAssistantClick && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openMobilePanel(() => onAiAssistantClick());
                }}
              >
                <Bot className="h-4 w-4 mr-2 shrink-0" />
                AI Assistant
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    {renderNotificationPanel()}
    {showPersonalTodos && (
      <div className="md:hidden">
        <PersonalTodosWidget
          hideTrigger
          externalOpen={mobileTodosOpen}
          onExternalOpenChange={setMobileTodosOpen}
        />
      </div>
    )}
    <ModuleUserGuideDialog
      activeModule={activeModule}
      setActiveModule={setActiveModule}
      hideTriggers
      externalOpen={mobileGuideOpen}
      onExternalOpenChange={setMobileGuideOpen}
    />
    </>
  );
};

export default MainHeader;

