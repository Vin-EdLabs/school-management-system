import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiService } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';
import {
  Bell,
  CalendarClock,
  ClipboardList,
  ListTodo,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PersonalTodo = {
  id: number;
  tenant_id: number | null;
  user_id: number;
  content: string;
  is_completed: boolean;
  reminder_at: string | null;
  reminder_sent: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type ReminderPopup = {
  id: number;
  content: string;
  reminder_at?: string | null;
};

const TODO_ROLES = new Set(['administrator', 'finance', 'teacher', 'staff', 'super-admin']);

export function canUsePersonalTodos(role: string | null | undefined): boolean {
  return TODO_ROLES.has(String(role || '').toLowerCase());
}

const TODO_EXAMPLES = [
  'Prepare Term 3 report cards',
  'Follow up on outstanding fee payments',
  'Schedule PTA meeting for Friday',
  'Review transport registrations',
  'Update student admission records',
];

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatReminderLabel(reminderAt: string | null): string {
  if (!reminderAt) return '';
  const d = new Date(reminderAt);
  const now = new Date();
  if (d < now) return 'Overdue';
  if (isSameCalendarDay(d, now)) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameCalendarDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatReminderPreview(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function groupTodos(todos: PersonalTodo[]) {
  const now = new Date();
  const endToday = endOfDay(now);
  const active = todos.filter((t) => !t.is_completed);
  const completed = todos.filter((t) => t.is_completed);

  const today: PersonalTodo[] = [];
  const upcoming: PersonalTodo[] = [];
  const noReminder: PersonalTodo[] = [];

  for (const todo of active) {
    if (!todo.reminder_at) {
      noReminder.push(todo);
      continue;
    }
    const reminder = new Date(todo.reminder_at);
    if (reminder <= endToday) {
      today.push(todo);
    } else {
      upcoming.push(todo);
    }
  }

  return { today, upcoming, noReminder, completed };
}

/** Pending tasks due today (same grouping as the "Today" section). */
export function countTodayPendingTodos(todos: PersonalTodo[]): number {
  return groupTodos(todos).today.length;
}

const ACTIVE_REMINDERS_KEY = 'personal-todo-active-reminders';

function loadStoredReminders(): ReminderPopup[] {
  try {
    const raw = sessionStorage.getItem(ACTIVE_REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReminderPopup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredReminders(reminders: ReminderPopup[]) {
  try {
    sessionStorage.setItem(ACTIVE_REMINDERS_KEY, JSON.stringify(reminders));
  } catch {
    /* ignore quota errors */
  }
}

function TodoReminderStack({
  anchorRef,
  reminders,
  onDismiss,
  onView,
  onMarkDone,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  reminders: ReminderPopup[];
  onDismiss: (id: number) => void;
  onView: (id: number) => void;
  onMarkDone: (id: number) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 12,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, reminders.length]);

  if (!pos || reminders.length === 0) return null;

  return createPortal(
    <div
      className="fixed z-[200] flex w-[min(100vw-2rem,22rem)] -translate-x-1/2 flex-col gap-2"
      style={{ top: pos.top, left: pos.left }}
    >
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-3 duration-500"
          role="alert"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400/80 bg-white shadow-[0_16px_48px_rgba(16,185,129,0.25)] dark:bg-slate-950 dark:border-emerald-500/60">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 animate-pulse" />
            <div className="p-4 pt-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300/50 animate-pulse dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Reminder
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground leading-snug">{reminder.content}</p>
                  {reminder.reminder_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatReminderPreview(reminder.reminder_at)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(reminder.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  aria-label="Dismiss reminder"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primaryAction"
                  className="flex-1 rounded-xl"
                  onClick={() => onMarkDone(reminder.id)}
                >
                  Mark done
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => onView(reminder.id)}>
                  View
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}

function TodoSection({
  title,
  items,
  onToggle,
  onDelete,
  deletingIds,
}: {
  title: string;
  items: PersonalTodo[];
  onToggle: (todo: PersonalTodo) => void;
  onDelete: (id: number) => void;
  deletingIds: Set<number>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 dark:text-emerald-300/80 px-1">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((todo) => {
          const overdue =
            !!todo.reminder_at && new Date(todo.reminder_at) < new Date() && !todo.is_completed;
          return (
            <div
              key={todo.id}
              className={cn(
                'group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/60',
                deletingIds.has(todo.id) && 'opacity-0 scale-95 max-h-0 py-0 overflow-hidden',
                todo.is_completed && 'opacity-60'
              )}
            >
              <Checkbox
                checked={todo.is_completed}
                onCheckedChange={() => onToggle(todo)}
                className="mt-1 border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm text-slate-800 dark:text-slate-100 leading-relaxed',
                    todo.is_completed && 'line-through text-slate-500'
                  )}
                >
                  {todo.content}
                </p>
                {todo.reminder_at && !todo.is_completed && (
                  <p
                    className={cn(
                      'mt-1 flex items-center gap-1.5 text-xs font-medium',
                      overdue ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700/80 dark:text-emerald-400/80'
                    )}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {formatReminderLabel(todo.reminder_at)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete(todo.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PersonalTodosWidget: React.FC = () => {
  const { socket } = useSocket();
  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [reminderDraft, setReminderDraft] = useState('');
  const [showReminder, setShowReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [activeReminders, setActiveReminders] = useState<ReminderPopup[]>(() => loadStoredReminders());
  const [loginBlink, setLoginBlink] = useState(false);
  const loginBlinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 180)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft, adjustTextareaHeight]);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiService.get<PersonalTodo[]>('/todos');
      setTodos(Array.isArray(list) ? list : []);
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (open) void loadTodos();
  }, [open, loadTodos]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('personal-todos-open', onOpen);
    return () => window.removeEventListener('personal-todos-open', onOpen);
  }, []);

  useEffect(() => {
    saveStoredReminders(activeReminders);
  }, [activeReminders]);

  const addActiveReminder = useCallback((payload: ReminderPopup) => {
    setActiveReminders((prev) => {
      if (prev.some((r) => r.id === payload.id)) return prev;
      return [...prev, payload];
    });
  }, []);

  const dismissActiveReminder = useCallback((id: number) => {
    setActiveReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const todayPendingCount = useMemo(() => countTodayPendingTodos(todos), [todos]);
  const reminderPreview = useMemo(() => formatReminderPreview(reminderDraft), [reminderDraft]);

  const startLoginBlink = useCallback(() => {
    if (todayPendingCount <= 0) return;
    setLoginBlink(true);
    if (loginBlinkTimerRef.current) clearTimeout(loginBlinkTimerRef.current);
    loginBlinkTimerRef.current = setTimeout(() => {
      setLoginBlink(false);
      loginBlinkTimerRef.current = null;
    }, 4000);
  }, [todayPendingCount]);

  useEffect(() => {
    return () => {
      if (loginBlinkTimerRef.current) clearTimeout(loginBlinkTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onLogin = () => startLoginBlink();
    window.addEventListener('userLogin', onLogin);
    return () => window.removeEventListener('userLogin', onLogin);
  }, [startLoginBlink]);

  useEffect(() => {
    if (loading || todayPendingCount <= 0) return;
    try {
      if (sessionStorage.getItem('personal-todos-login-blink') !== '1') return;
      sessionStorage.removeItem('personal-todos-login-blink');
    } catch {
      return;
    }
    startLoginBlink();
  }, [loading, todayPendingCount, startLoginBlink]);

  useEffect(() => {
    if (!socket) return;
    const onReminder = (payload: ReminderPopup) => {
      addActiveReminder(payload);
      void loadTodos();
    };
    socket.on('todo-reminder', onReminder);
    return () => {
      socket.off('todo-reminder', onReminder);
    };
  }, [socket, loadTodos, addActiveReminder]);

  useEffect(() => {
    if (todos.length === 0) return;
    const fired = todos.filter(
      (t) =>
        !t.is_completed &&
        t.reminder_at &&
        t.reminder_sent &&
        new Date(t.reminder_at).getTime() <= Date.now()
    );
    if (fired.length === 0) return;
    setActiveReminders((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const added = fired
        .filter((t) => !ids.has(t.id))
        .map((t) => ({ id: t.id, content: t.content, reminder_at: t.reminder_at }));
      return added.length > 0 ? [...prev, ...added] : prev;
    });
  }, [todos]);

  const groups = useMemo(() => groupTodos(todos), [todos]);

  const addTodo = async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    const tempId = -Date.now();
    const optimistic: PersonalTodo = {
      id: tempId,
      tenant_id: null,
      user_id: 0,
      content,
      is_completed: false,
      reminder_at: reminderDraft ? new Date(reminderDraft).toISOString() : null,
      reminder_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTodos((prev) => [optimistic, ...prev]);
    setDraft('');
    setReminderDraft('');
    setShowReminder(false);
    if (textareaRef.current) textareaRef.current.style.height = '56px';
    try {
      const created = await apiService.post<PersonalTodo>('/todos', {
        content,
        reminder_at: optimistic.reminder_at,
      });
      setTodos((prev) => prev.map((t) => (t.id === tempId ? created : t)));
    } catch (e: unknown) {
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
      toast.error(e instanceof Error ? e.message : 'Could not add task');
    } finally {
      setSaving(false);
    }
  };

  const toggleTodo = async (todo: PersonalTodo) => {
    const next = !todo.is_completed;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_completed: next } : t)));
    if (next) dismissActiveReminder(todo.id);
    try {
      const updated = await apiService.put<PersonalTodo>(`/todos/${todo.id}`, { is_completed: next });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_completed: !next } : t)));
      toast.error('Could not update task');
    }
  };

  const markReminderDone = async (id: number) => {
    dismissActiveReminder(id);
    const todo = todos.find((t) => t.id === id);
    if (!todo || todo.is_completed) return;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: true } : t)));
    try {
      const updated = await apiService.put<PersonalTodo>(`/todos/${id}`, { is_completed: true });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: false } : t)));
      toast.error('Could not mark task as done');
    }
  };

  const deleteTodo = async (id: number) => {
    dismissActiveReminder(id);
    setDeletingIds((prev) => new Set(prev).add(id));
    window.setTimeout(async () => {
      try {
        await apiService.delete(`/todos/${id}`);
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } catch {
        toast.error('Could not delete task');
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 220);
  };

  const hasAny = todos.length > 0;

  return (
    <div ref={anchorRef} className="relative flex flex-col items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'relative h-11 gap-2 rounded-2xl px-3 sm:px-4 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/50 touch-manipulation transition-all duration-300',
              open &&
                'bg-emerald-50 text-emerald-800 shadow-[0_0_0_2px_rgba(16,185,129,0.5),0_0_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/60 ring-offset-2 ring-offset-background dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/50',
              loginBlink && !open && 'animate-pulse ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background'
            )}
            title="My to-dos"
          >
            {open && (
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-emerald-400/40 animate-ping" />
            )}
            <ListTodo className={cn('h-5 w-5 shrink-0', open && 'text-emerald-700 dark:text-emerald-400')} />
            <span className="hidden sm:inline text-sm font-semibold">My to-dos</span>
            {todayPendingCount > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm',
                  loginBlink && 'animate-pulse ring-2 ring-amber-300 ring-offset-1 ring-offset-background'
                )}
              >
                {todayPendingCount > 9 ? '9+' : todayPendingCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          sideOffset={14}
          className={cn(
            'w-[min(100vw-1rem,36rem)] p-0 overflow-hidden rounded-[1.125rem] border border-emerald-200/70',
            'shadow-[0_24px_64px_rgba(0,0,0,0.18)] border-t-[5px] border-t-emerald-500 bg-white dark:bg-slate-950',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-3',
            'duration-300'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-border/70 px-4 py-2.5 bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-950">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-tight">My to-dos</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Personal tasks only you can see — set a reminder and we&apos;ll nudge you when it&apos;s due.
                </p>
                <div className="mt-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Examples:</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/75 leading-snug">
                    {TODO_EXAMPLES.map((example) => (
                      <span key={example} className="truncate" title={example}>
                        • {example}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-border/70 px-4 py-4 space-y-3 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void addTodo();
                  }
                }}
                placeholder="Add a new task… (Enter to save, Shift+Enter for new line)"
                rows={2}
                className="min-h-[56px] max-h-[180px] resize-none text-base leading-relaxed rounded-xl border-slate-200 dark:border-slate-700 py-3"
              />
              <Button
                type="button"
                size="icon"
                variant="primaryAction"
                className="h-12 w-12 shrink-0 rounded-xl"
                onClick={() => void addTodo()}
                disabled={!draft.trim() || saving}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="rounded-xl border border-emerald-200/60 bg-white p-3 dark:border-emerald-900/40 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowReminder((v) => !v)}
                className={cn(
                  'inline-flex w-full items-center justify-between gap-2 text-sm font-semibold rounded-lg px-1 py-0.5 transition-colors',
                  showReminder ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-emerald-600" />
                  Set reminder (optional)
                </span>
                <span className="text-xs font-medium text-muted-foreground">{showReminder ? 'Hide' : 'Show'}</span>
              </button>

              {showReminder && (
                <div className="mt-3 space-y-2">
                  <input
                    type="datetime-local"
                    value={reminderDraft}
                    onChange={(e) => setReminderDraft(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus-visible:border-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {reminderPreview ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Bell className="h-4 w-4 shrink-0" />
                      <span>Remind me on {reminderPreview}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">Pick a date and time — we&apos;ll remind you at the top of the screen.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[min(62vh,480px)]">
            <div className="p-4 space-y-5">
              {loading && !hasAny ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading tasks…</p>
              ) : !hasAny ? (
                <p className="text-center text-xs text-muted-foreground py-4">No tasks yet — add one above.</p>
              ) : (
                <>
                  <TodoSection title="Today" items={groups.today} onToggle={toggleTodo} onDelete={deleteTodo} deletingIds={deletingIds} />
                  <TodoSection title="Upcoming" items={groups.upcoming} onToggle={toggleTodo} onDelete={deleteTodo} deletingIds={deletingIds} />
                  <TodoSection title="No reminder" items={groups.noReminder} onToggle={toggleTodo} onDelete={deleteTodo} deletingIds={deletingIds} />
                  <TodoSection title="Completed" items={groups.completed} onToggle={toggleTodo} onDelete={deleteTodo} deletingIds={deletingIds} />
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {activeReminders.length > 0 && (
        <TodoReminderStack
          anchorRef={anchorRef}
          reminders={activeReminders}
          onDismiss={dismissActiveReminder}
          onView={() => setOpen(true)}
          onMarkDone={(id) => void markReminderDone(id)}
        />
      )}
    </div>
  );
};

export default PersonalTodosWidget;
