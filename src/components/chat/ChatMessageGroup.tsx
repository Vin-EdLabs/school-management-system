import React, { useRef } from 'react';
import { Check, CheckCheck, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ChatMessage,
  formatChatTime,
  formatDateSeparator,
  isPlatformMessage,
  resolveChatImageUrl,
  roleAccentClass,
  roleAvatarClass,
} from '@/services/chatService';

export type MessageSenderGroup = {
  key: string;
  isMine: boolean;
  isPlatform: boolean;
  sender?: ChatMessage['sender'];
  messages: ChatMessage[];
};

export function clusterMessagesBySender(messages: ChatMessage[]): MessageSenderGroup[] {
  const groups: MessageSenderGroup[] = [];
  for (const m of messages) {
    if (m.is_deleted) {
      groups.push({
        key: `deleted-${m.id}`,
        isMine: false,
        isPlatform: false,
        messages: [m],
      });
      continue;
    }
    const platform = isPlatformMessage(m);
    const key = platform ? 'platform' : m.is_mine ? 'mine' : `user-${m.sender?.id ?? 'unknown'}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key && !last.messages.some((x) => x.is_deleted)) {
      last.messages.push(m);
    } else {
      groups.push({
        key,
        isMine: m.is_mine,
        isPlatform: platform,
        sender: m.sender,
        messages: [m],
      });
    }
  }
  return groups;
}

export function groupMessagesForDisplay(messages: ChatMessage[]) {
  const result: Array<{ date: string; senderGroups: MessageSenderGroup[] }> = [];
  let bucket: { date: string; items: ChatMessage[] } | null = null;

  for (const m of messages) {
    const date = formatDateSeparator(m.created_at);
    if (!bucket || bucket.date !== date) {
      if (bucket) {
        result.push({ date: bucket.date, senderGroups: clusterMessagesBySender(bucket.items) });
      }
      bucket = { date, items: [m] };
    } else {
      bucket.items.push(m);
    }
  }
  if (bucket) {
    result.push({ date: bucket.date, senderGroups: clusterMessagesBySender(bucket.items) });
  }
  return result;
}

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function bubblePosition(index: number, total: number): 'single' | 'first' | 'middle' | 'last' {
  if (total === 1) return 'single';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
}

function bubbleRadius(
  mine: boolean,
  platform: boolean,
  position: 'single' | 'first' | 'middle' | 'last'
): string {
  const tailMine = position === 'single' || position === 'last';
  const tailTheirs = position === 'single' || position === 'last';

  if (mine) {
    return cn(
      'rounded-[18px]',
      tailMine ? 'rounded-br-[5px]' : 'rounded-br-[18px]',
      position === 'first' || position === 'single' ? 'rounded-tr-[18px]' : 'rounded-tr-[8px]',
      position === 'last' || position === 'single' ? 'rounded-bl-[18px]' : 'rounded-bl-[8px]'
    );
  }

  if (platform) {
    return cn(
      'rounded-[18px]',
      tailTheirs ? 'rounded-bl-[5px]' : 'rounded-bl-[18px]',
      position === 'first' || position === 'single' ? 'rounded-tl-[18px]' : 'rounded-tl-[8px]',
      position === 'last' || position === 'single' ? 'rounded-br-[18px]' : 'rounded-br-[8px]'
    );
  }

  return cn(
    'rounded-[18px]',
    tailTheirs ? 'rounded-bl-[5px]' : 'rounded-bl-[18px]',
    position === 'first' || position === 'single' ? 'rounded-tl-[18px]' : 'rounded-tl-[8px]',
    position === 'last' || position === 'single' ? 'rounded-br-[18px]' : 'rounded-br-[8px]'
  );
}

type GroupProps = {
  group: MessageSenderGroup;
  selectedMessageId?: string | number | null;
  onSelectMessage?: (msg: ChatMessage) => void;
  onDeleteRequest?: (msg: ChatMessage) => void;
  onImageClick?: (url: string) => void;
  onRetry?: (msg: ChatMessage) => void;
};

export default function ChatMessageGroup({
  group,
  selectedMessageId,
  onSelectMessage,
  onDeleteRequest,
  onImageClick,
  onRetry,
}: GroupProps) {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canDelete = (msg: ChatMessage) =>
    msg.is_mine && !msg.pending && !msg.is_deleted && !msg.failed;

  const isSelected = (msg: ChatMessage) => selectedMessageId === msg.id;

  const handleDelete = (msg: ChatMessage) => {
    if (canDelete(msg)) onDeleteRequest?.(msg);
  };

  const handleSelect = (msg: ChatMessage) => {
    if (canDelete(msg)) onSelectMessage?.(msg);
  };

  if (group.messages.length === 1 && group.messages[0].is_deleted) {
    return (
      <p className="text-center text-sm italic text-muted-foreground py-1 animate-in fade-in duration-150">
        This message was deleted
      </p>
    );
  }

  const { isMine, isPlatform, sender, messages } = group;
  const lastMsg = messages[messages.length - 1];
  const displayName = isPlatform ? 'ScholarNerve Team' : sender?.name || 'Staff';
  const initials = avatarInitials(displayName);

  const bindLongPress = (msg: ChatMessage) =>
    canDelete(msg) && onSelectMessage
      ? {
          onTouchStart: () => {
            longPressRef.current = setTimeout(() => handleSelect(msg), 400);
          },
          onTouchEnd: () => {
            if (longPressRef.current) clearTimeout(longPressRef.current);
          },
          onTouchMove: () => {
            if (longPressRef.current) clearTimeout(longPressRef.current);
          },
        }
      : {};

  return (
    <div
      className={cn(
        'flex gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-150',
        isMine ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {!isMine && (
        <div
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
            isPlatform ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : roleAvatarClass(sender?.role || 'staff')
          )}
        >
          {isPlatform ? <Sparkles className="h-4 w-4" /> : initials || '?'}
        </div>
      )}

      <div className={cn('flex flex-col min-w-0 max-w-[min(340px,85%)]', isMine ? 'items-end' : 'items-start')}>
        {!isMine && (
          <span
            className={cn(
              'text-xs font-semibold mb-1 px-0.5',
              isPlatform ? 'text-violet-700 dark:text-violet-300 max-lg:text-violet-300' : roleAccentClass(sender?.role || 'staff')
            )}
          >
            {displayName}
          </span>
        )}

        <div className={cn('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
          {messages.map((msg, index) => {
            if (msg.is_deleted) return null;
            const position = bubblePosition(index, messages.length);
            const thumb =
              resolveChatImageUrl(msg.image_thumbnail_url || msg.image_url) ||
              msg.local_image_preview ||
              null;

            return (
              <div
                key={String(msg.id)}
                data-chat-message=""
                className={cn('max-w-full', isMine ? 'self-end' : 'self-start')}
                {...bindLongPress(msg)}
              >
                <div
                  role={canDelete(msg) ? 'button' : undefined}
                  tabIndex={canDelete(msg) ? 0 : undefined}
                  onClick={(e) => {
                    if (!canDelete(msg)) return;
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a')) return;
                    e.stopPropagation();
                    handleSelect(msg);
                  }}
                  onKeyDown={(e) => {
                    if (canDelete(msg) && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSelect(msg);
                    }
                  }}
                  className={cn(
                    'px-3.5 py-2 shadow-sm transition-all',
                    bubbleRadius(isMine, isPlatform, position),
                    isMine
                      ? cn(
                          'bg-violet-600 text-white shadow-violet-600/20 dark:bg-violet-500 dark:shadow-violet-900/30 cursor-pointer active:opacity-90',
                          isSelected(msg) && 'ring-2 ring-white/70 ring-offset-1 ring-offset-violet-600 dark:ring-offset-violet-500'
                        )
                      : isPlatform
                        ? 'bg-violet-50 text-violet-950 border border-violet-200/80 shadow-violet-100/50 dark:bg-violet-950/35 dark:text-violet-100 dark:border-violet-800/50'
                        : 'bg-card text-foreground border border-border/80 dark:bg-slate-800/90 dark:border-slate-700/80'
                  )}
                >
                  {thumb && (
                    <button
                      type="button"
                      className="block w-full mb-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick?.(msg.image_url || msg.image_thumbnail_url!);
                      }}
                    >
                      <img
                        src={thumb}
                        alt=""
                        className={cn(
                          'max-h-[200px] w-full object-cover',
                          isMine ? 'rounded-xl ring-1 ring-white/20' : 'rounded-xl'
                        )}
                        loading="lazy"
                      />
                    </button>
                  )}
                  {msg.message && (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                  )}
                </div>
                {isMine && isSelected(msg) && canDelete(msg) && onDeleteRequest && (
                  <div
                    data-chat-message=""
                    className="mt-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(msg);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete message
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMessage?.(msg);
                      }}
                      className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={cn('flex flex-wrap items-center gap-2 mt-1 px-0.5', isMine ? 'flex-row-reverse justify-start' : '')}>
          <span className={cn('text-[11px]', isMine ? 'text-violet-600/80 dark:text-violet-400/80' : 'text-muted-foreground')}>
            {formatChatTime(lastMsg.created_at)}
          </span>
          {isMine && (
            <span className="text-muted-foreground">
              {lastMsg.failed ? (
                <button
                  type="button"
                  className="text-red-500 text-[11px] underline"
                  onClick={() => onRetry?.(lastMsg)}
                >
                  Retry
                </button>
              ) : lastMsg.pending ? (
                <Check className="h-3.5 w-3.5 opacity-50" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 opacity-70 text-violet-500 dark:text-violet-400" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
