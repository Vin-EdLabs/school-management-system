import React, { useRef } from 'react';
import { Check, CheckCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ChatMessage,
  formatChatTime,
  isPlatformMessage,
  resolveChatImageUrl,
  roleAccentClass,
} from '@/services/chatService';

type Props = {
  msg: ChatMessage;
  onLongPress?: () => void;
  onImageClick?: (url: string) => void;
  onRetry?: () => void;
};

export default function ChatMessageBubble({ msg, onLongPress, onImageClick, onRetry }: Props) {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bindLongPress = (mine: boolean) =>
    mine && onLongPress
      ? {
          onTouchStart: () => {
            longPressRef.current = setTimeout(() => onLongPress(), 500);
          },
          onTouchEnd: () => {
            if (longPressRef.current) clearTimeout(longPressRef.current);
          },
          onTouchMove: () => {
            if (longPressRef.current) clearTimeout(longPressRef.current);
          },
        }
      : {};

  const isPlatform = isPlatformMessage(msg);

  if (msg.is_deleted) {
    return (
      <p className="text-center text-sm italic text-muted-foreground py-1 animate-in fade-in duration-150">
        This message was deleted
      </p>
    );
  }

  if (isPlatform) {
    const tailClass = msg.is_mine ? 'rounded-br-[6px] rounded-bl-[22px]' : 'rounded-bl-[6px] rounded-br-[22px]';
    return (
      <div
        className={cn(
          'flex flex-col max-w-[min(300px,80%)] animate-in slide-in-from-bottom-2 fade-in duration-150',
          msg.is_mine ? 'ml-auto items-end' : 'mr-auto items-start'
        )}
      >
        <div
          className={cn(
            'rounded-[22px] px-3.5 py-2.5 text-white shadow-lg ring-1 ring-white/15',
            'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-indigo-500/25',
            tailClass
          )}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-100/95 mb-1">
            <Sparkles className="h-3 w-3 shrink-0" />
            ScholarNerve Team
          </div>
          {msg.image_thumbnail_url && (
            <button
              type="button"
              className="block w-full mb-1.5"
              onClick={() => onImageClick?.(msg.image_url || msg.image_thumbnail_url!)}
            >
              <img
                src={resolveChatImageUrl(msg.image_thumbnail_url)!}
                alt=""
                className="rounded-2xl max-h-[180px] w-full object-cover ring-1 ring-white/20"
                loading="lazy"
              />
            </button>
          )}
          {msg.message && (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground mt-0.5 px-1">{formatChatTime(msg.created_at)}</span>
      </div>
    );
  }

  const mine = msg.is_mine;
  const thumb = resolveChatImageUrl(msg.image_thumbnail_url || msg.image_url);

  return (
    <div
      className={cn(
        'flex flex-col max-w-[min(340px,85%)] animate-in slide-in-from-bottom-2 fade-in duration-150',
        mine ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
      onContextMenu={(e) => {
        if (mine) {
          e.preventDefault();
          onLongPress?.();
        }
      }}
      {...bindLongPress(mine)}
    >
      {!mine && msg.sender?.name && (
        <span className={cn('text-xs font-semibold mb-1 px-1', roleAccentClass(msg.sender.role))}>
          {msg.sender.name}
        </span>
      )}
      <div
        className={cn(
          'px-3.5 py-2.5 shadow-sm',
          mine
            ? 'bg-violet-600 text-white rounded-[18px] rounded-br-[4px]'
            : 'bg-white text-foreground rounded-[18px] rounded-bl-[4px] border border-black/5'
        )}
      >
        {thumb && (
          <button
            type="button"
            className="block w-full mb-1.5"
            onClick={() => onImageClick?.(msg.image_url || msg.image_thumbnail_url!)}
          >
            <img src={thumb} alt="" className="rounded-xl max-h-[200px] w-full object-cover" loading="lazy" />
          </button>
        )}
        {msg.message && (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
        )}
      </div>
      <div className={cn('flex items-center gap-1 mt-0.5 px-1', mine ? 'flex-row-reverse' : '')}>
        <span className={cn('text-[11px]', mine ? 'text-violet-600/80' : 'text-muted-foreground')}>
          {formatChatTime(msg.created_at)}
        </span>
        {mine && (
          <span className="text-muted-foreground">
            {msg.failed ? (
              <button type="button" className="text-red-500 text-[11px] underline" onClick={onRetry}>
                Retry
              </button>
            ) : msg.pending ? (
              <Check className="h-3.5 w-3.5 opacity-50" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 opacity-70" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}
