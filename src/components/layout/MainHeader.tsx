import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useTeacherNotifications } from '../../contexts/TeacherNotificationContext';
import { resolveLogoUrl } from '../../services/tenantService';
import { Bell, Bot, User, Clock, Calendar, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import PwaInstallButton from '../common/PwaInstallButton';
import { ModuleUserGuideDialog } from '../common/ModuleUserGuideDialog';
import { formatDisplayDate } from '../../utils/dateFormat';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
  activeModule: string;
  setActiveModule: (id: string) => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick, activeModule, setActiveModule }) => {
  const { user } = useAuth();
  const { school } = useSchool();
  const { items, unreadCount, markRead, markAllRead } = useTeacherNotifications();
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const pwaLogo = resolveLogoUrl(school?.logo_url ?? null);
  const showStaffNotifications = user?.role === 'teacher' || user?.role === 'staff';
  const displayName = user?.fullName?.trim() || user?.username || '';

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

  const formatDate = (date: Date) => {
    return formatDisplayDate(date);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex items-center justify-between w-full h-full gap-2 sm:gap-4 md:gap-6 min-w-0">
      {/* Welcome Section */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#146C43] to-[#22C55E] flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 dark:from-blue-500 dark:to-indigo-600 dark:shadow-sm">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
            {getGreeting()}, <span className="text-emerald-700 dark:text-indigo-400">{displayName}</span>
          </h1>
          <div className="flex items-center gap-2">
             <span className="px-2 py-0.5 bg-emerald-50 dark:bg-indigo-950/50 text-[10px] font-bold text-emerald-700 dark:text-indigo-400 uppercase tracking-wider rounded border border-emerald-100/70 dark:border-indigo-900 shadow-sm">
              {user?.role?.replace('-', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section: Time and Actions */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-3">
          <div className="px-3 py-2 bg-white/85 dark:bg-slate-900/50 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatDate(currentTime)}</span>
          </div>
          <div className="px-3 py-2 bg-white/85 dark:bg-slate-900/50 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 shadow-sm">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-indigo-400" />
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300 w-[90px] text-center">
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
          {showStaffNotifications && (
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 shrink-0 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50 touch-manipulation"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-1.5rem,22rem)] p-0" align="end" sideOffset={8}>
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">Notifications</p>
                  {items.length > 0 && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      onClick={() => markAllRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <ScrollArea className="max-h-[min(50vh,260px)]">
                  {items.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground">No notifications yet.</p>
                  ) : (
                    <div className="space-y-1 p-2">
                      {items.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markRead(n.id);
                          }}
                          className={`w-full rounded-lg border p-2.5 text-left transition-colors touch-manipulation ${
                            n.read
                              ? 'border-border bg-card hover:bg-muted/50'
                              : 'border-indigo-200/80 bg-indigo-50/60 hover:bg-indigo-100/70 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">{n.title}</p>
                          <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString()}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
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
  );
};

export default MainHeader;

