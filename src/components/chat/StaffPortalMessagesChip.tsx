import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSocket } from '@/contexts/SocketContext';
import { chatService, type ChatChannel } from '@/services/chatService';

type Props = {
  onNavigate: (module: string) => void;
  variant?: 'dark-hero' | 'light';
  className?: string;
};

export default function StaffPortalMessagesChip({ onNavigate, variant = 'light', className }: Props) {
  const { socket } = useSocket();
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [latestUnreadChat, setLatestUnreadChat] = useState<ChatChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await chatService.listChannels();
      setMessagesUnread(Number(data.total_unread ?? 0));
      const channels = (data.channels || []).filter((c) => c.channel_type !== 'non_teaching');
      const unreadFirst = channels
        .filter((c) => c.unread_count > 0)
        .sort((a, b) => {
          const ta = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
          const tb = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
          return tb - ta;
        });
      setLatestUnreadChat(unreadFirst[0] ?? null);
    } catch {
      setMessagesUnread(0);
      setLatestUnreadChat(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (evt: { entity?: string }) => {
      const e = String(evt?.entity || '');
      if (e === 'chat' || e === 'staff-notification') void refresh();
    };
    socket.on('tenant-data-changed', onUpdate);
    return () => {
      socket.off('tenant-data-changed', onUpdate);
    };
  }, [socket, refresh]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener('comms-badges-refresh', onRefresh);
    return () => window.removeEventListener('comms-badges-refresh', onRefresh);
  }, [refresh]);

  const hasUnread = messagesUnread > 0;
  const preview = useMemo(() => {
    if (!hasUnread || !latestUnreadChat?.last_message) return null;
    const lm = latestUnreadChat.last_message;
    const body = lm.image_url ? '📷 Photo' : lm.message?.trim() || 'New message';
    return `${latestUnreadChat.name}: ${body}`;
  }, [hasUnread, latestUnreadChat]);

  const isDarkHero = variant === 'dark-hero';

  return (
    <button
      type="button"
      onClick={() => onNavigate('messages')}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left shadow-sm transition-all active:scale-[0.99]',
        isDarkHero
          ? cn(
              'bg-white hover:bg-emerald-50/40',
              hasUnread
                ? 'ring-2 ring-emerald-400/70 ring-offset-1 ring-offset-emerald-950/40'
                : 'ring-1 ring-emerald-200/60'
            )
          : cn(
              'border border-border/80 bg-card hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20',
              hasUnread
                ? 'ring-2 ring-emerald-500/50 dark:ring-emerald-400/40'
                : 'ring-1 ring-emerald-200/50 dark:ring-emerald-900/40'
            ),
        className
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          hasUnread
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        )}
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-semibold',
              isDarkHero ? 'text-slate-800' : 'text-foreground'
            )}
          >
            Messages
          </span>
          {hasUnread && (
            <Badge className="h-4 min-w-[16px] rounded-full border-0 bg-emerald-600 px-1 text-[9px] font-bold leading-none text-white hover:bg-emerald-600">
              {messagesUnread > 99 ? '99+' : messagesUnread}
            </Badge>
          )}
        </div>
        {preview && (
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{preview}</p>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-600/70 group-hover:text-emerald-700 dark:text-emerald-400" />
    </button>
  );
}
