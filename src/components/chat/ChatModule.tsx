import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowDown,
  Bell,
  BellOff,
  Briefcase,
  Globe,
  Loader2,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pencil,
  Search,
  Send,
  Smile,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import ChatMessageGroup, { groupMessagesForDisplay } from '@/components/chat/ChatMessageGroup';
import MessageDeleteConfirmDialog from '@/components/common/MessageDeleteConfirmDialog';
import {
  type ChatChannel,
  type ChatMessage,
  canPostAnnouncements,
  chatInitials,
  chatService,
  formatChatTime,
  resolveChatImageUrl,
  roleAccentClass,
  roleAvatarClass,
} from '@/services/chatService';
import { toast } from '@/hooks/use-toast';
import { useSyncMobileChatOpen } from '@/contexts/MobileChatShellContext';

function AvatarCircle({
  label,
  role,
  className,
}: {
  label: string | null | undefined;
  role?: string;
  className?: string;
}) {
  const initials = chatInitials(label);
  return (
    <div
      className={cn(
        'h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
        roleAvatarClass(role || 'staff'),
        className
      )}
    >
      {initials || '?'}
    </div>
  );
}

function channelIcon(type: string) {
  switch (type) {
    case 'announcements':
      return Megaphone;
    case 'general':
      return Globe;
    case 'teachers':
      return Users;
    case 'non_teaching':
      return Briefcase;
    default:
      return MessageCircle;
  }
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😊', '🙏', '👏', '✅', '🎉', '📷', '💯'];

function mergeServerMessagesWithInFlight(
  serverMessages: ChatMessage[],
  previous: ChatMessage[],
): ChatMessage[] {
  const inFlight = previous.filter(
    (m) => m.pending || m.failed || (typeof m.id === 'string' && !!m.temp_id),
  );
  if (inFlight.length === 0) return serverMessages;

  const serverIds = new Set(serverMessages.map((m) => String(m.id)));
  const extras = inFlight.filter((m) => {
    if (serverIds.has(String(m.id))) return false;
    if (m.pending) {
      const duplicate = serverMessages.some((s) => {
        if (!s.is_mine) return false;
        const timeClose =
          Math.abs(new Date(s.created_at).getTime() - new Date(m.created_at).getTime()) < 120_000;
        if (m.message && s.message === m.message && timeClose) return true;
        if (m.image_url && s.image_url === m.image_url && timeClose) return true;
        return false;
      });
      if (duplicate) return false;
    }
    if (m.failed) {
      const duplicate = serverMessages.some((s) => {
        if (!s.is_mine) return false;
        const timeClose =
          Math.abs(new Date(s.created_at).getTime() - new Date(m.created_at).getTime()) < 120_000;
        if (m.message && s.message === m.message && timeClose) return true;
        if (m.image_url && s.image_url === m.image_url && timeClose) return true;
        return false;
      });
      if (duplicate) return false;
    }
    return true;
  });

  return [...serverMessages, ...extras].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function asDeletedMessage(msg: ChatMessage): ChatMessage {
  return {
    ...msg,
    is_deleted: true,
    message: null,
    image_url: null,
    image_thumbnail_url: null,
    local_image_preview: null,
    pending: false,
  };
}

function applyPendingDeletes(messages: ChatMessage[], pendingDeletes: Set<number>): ChatMessage[] {
  if (pendingDeletes.size === 0) return messages;
  return messages.map((m) => {
    const id = Number(m.id);
    return Number.isFinite(id) && pendingDeletes.has(id) ? asDeletedMessage(m) : m;
  });
}

function messagesAreEqual(a: ChatMessage[], b: ChatMessage[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (String(left.id) !== String(right.id)) return false;
    if (left.is_deleted !== right.is_deleted) return false;
    if (left.message !== right.message) return false;
    if (left.pending !== right.pending) return false;
    if (left.failed !== right.failed) return false;
    if (left.image_url !== right.image_url) return false;
    if (left.image_thumbnail_url !== right.image_thumbnail_url) return false;
  }
  return true;
}

function channelsFingerprint(channels: ChatChannel[], totalUnread: number): string {
  return JSON.stringify({
    totalUnread,
    channels: channels.map((c) => ({
      id: c.id,
      unread: c.unread_count,
      at: c.last_message?.created_at || null,
      preview: c.last_message?.message || null,
    })),
  });
}

const CHAT_BACKGROUND_SYNC_MS = 3000;

function normalizeIncomingMessage(msg: ChatMessage): ChatMessage {
  return {
    ...msg,
    channel_id: Number(msg.channel_id),
    created_at: msg.created_at || new Date().toISOString(),
    is_deleted: msg.is_deleted ?? false,
    is_mine: msg.is_mine ?? false,
    sender: msg.sender
      ? {
          ...msg.sender,
          name: msg.sender.name || 'Staff',
          role: msg.sender.role || 'staff',
        }
      : msg.sender,
  };
}

const ChatModule: React.FC = () => {
  const { user, token } = useAuth();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [typingUsers, setTypingUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [showNewPill, setShowNewPill] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [desktopPickerOpen, setDesktopPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffList, setStaffList] = useState<Array<{ id: number; name: string; role: string; avatar_initials: string }>>([]);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string; image_url?: string; image_thumbnail_url?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [channelStats, setChannelStats] = useState<{ member_count: number; online_count: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const desktopPickerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const pendingRetryRef = useRef<Map<string, () => void>>(new Map());
  const pendingSendFallbackRef = useRef<
    Map<
      string,
      {
        channelId: number;
        message?: string;
        image_url?: string;
        image_thumbnail_url?: string;
      }
    >
  >(new Map());
  const pendingDeletesRef = useRef<Set<number>>(new Set());
  const activeChannelRef = useRef<ChatChannel | null>(null);
  const channelsFingerprintRef = useRef('');
  activeChannelRef.current = activeChannel;

  useSyncMobileChatOpen(mobileView === 'chat' && !!activeChannel);

  /** Phone chat always uses dark styling regardless of app theme. */
  useEffect(() => {
    const el = chatRootRef.current;
    if (!el) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => {
      if (mq.matches) el.classList.add('dark');
      else el.classList.remove('dark');
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const requestDeleteMessage = useCallback((msg: ChatMessage) => {
    if (!msg.is_mine || msg.pending || msg.is_deleted) return;
    setSelectedMessageId(null);
    setDeleteTarget(msg);
  }, []);

  const toggleSelectMessage = useCallback((msg: ChatMessage) => {
    if (!msg.is_mine || msg.pending || msg.is_deleted) return;
    setSelectedMessageId((prev) => (prev === msg.id ? null : msg.id));
  }, []);

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    setChannelsError(null);
    try {
      const data = await chatService.listChannels();
      const nextChannels = data.channels || [];
      const nextUnread = data.total_unread || 0;
      setChannels(nextChannels);
      setTotalUnread(nextUnread);
      channelsFingerprintRef.current = channelsFingerprint(nextChannels, nextUnread);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load channels';
      setChannelsError(message);
      toast({ title: 'Could not load channels', description: message, variant: 'destructive' });
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const refreshChannelsQuiet = useCallback(async () => {
    try {
      const data = await chatService.listChannels();
      const nextChannels = data.channels || [];
      const nextUnread = data.total_unread || 0;
      const fingerprint = channelsFingerprint(nextChannels, nextUnread);
      if (fingerprint === channelsFingerprintRef.current) return;
      channelsFingerprintRef.current = fingerprint;
      setChannels(nextChannels);
      setTotalUnread(nextUnread);
    } catch {
      // Background refresh — ignore errors so chat stays usable offline.
    }
  }, []);

  const syncMessagesQuiet = useCallback(async (channelId: number) => {
    try {
      const data = await chatService.listMessages(channelId);
      let shouldScroll = false;
      setMessages((prev) => {
        const merged = applyPendingDeletes(
          mergeServerMessagesWithInFlight(data.messages, prev),
          pendingDeletesRef.current,
        );
        if (messagesAreEqual(merged, prev)) return prev;
        shouldScroll = merged.length > prev.length && nearBottomRef.current;
        return merged;
      });
      if (shouldScroll) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
        });
      }
    } catch {
      // Silent background sync — never show loaders or toasts.
    }
  }, []);

  const syncMessagesQuietRef = useRef(syncMessagesQuiet);
  syncMessagesQuietRef.current = syncMessagesQuiet;
  const refreshChannelsQuietRef = useRef(refreshChannelsQuiet);
  refreshChannelsQuietRef.current = refreshChannelsQuiet;

  const loadMessages = useCallback(async (channelId: number, beforeId?: number) => {
    if (beforeId) setLoadingOlder(true);
    else setLoadingMessages(true);
    try {
      const data = await chatService.listMessages(channelId, beforeId);
      if (beforeId) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.messages.length >= 30);
      } else {
        setMessages((prev) =>
          applyPendingDeletes(
            mergeServerMessagesWithInFlight(data.messages, prev),
            pendingDeletesRef.current,
          ),
        );
        setHasMore(data.messages.length >= 30);
      }
    } catch {
      toast({ title: 'Could not load messages', variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
    }
  }, []);

  const chatSocket = useChatSocket(token, {
    onNewMessage: (rawMsg) => {
      const msg = normalizeIncomingMessage(rawMsg);
      const channelId = Number(msg.channel_id);
      const currentActive = activeChannelRef.current;
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? {
                ...c,
                last_message: {
                  sender_name: msg.sender?.name || 'Staff',
                  sender_id: msg.sender?.id ?? null,
                  message: msg.message,
                  image_url: msg.image_url,
                  created_at: msg.created_at,
                  is_platform: msg.sender?.role === 'platform',
                },
                unread_count: currentActive?.id === channelId ? 0 : c.unread_count + (msg.is_mine ? 0 : 1),
              }
            : c
        )
      );
      if (currentActive?.id === channelId) {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
          if (msg.is_mine) {
            const pendingIdx =
              msg.temp_id != null
                ? prev.findIndex((m) => m.temp_id === msg.temp_id)
                : prev.findIndex((m) => m.pending && m.temp_id);
            if (pendingIdx >= 0) {
              if (msg.temp_id) pendingSendFallbackRef.current.delete(msg.temp_id);
              return prev.map((m, i) =>
                i === pendingIdx ? { ...msg, pending: false, failed: false } : m,
              );
            }
          }
          const next = [...prev, msg];
          if (nearBottomRef.current) {
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
          } else if (!msg.is_mine) {
            setShowNewPill(true);
          }
          return next;
        });
      } else if (!msg.is_mine) {
        setTotalUnread((n) => n + 1);
      }
    },
    onMessageDeleted: ({ message_id, channel_id }) => {
      pendingDeletesRef.current.delete(message_id);
      if (activeChannelRef.current?.id === channel_id) {
        setMessages((prev) =>
          prev.map((m) => (String(m.id) === String(message_id) ? asDeletedMessage(m) : m)),
        );
      }
    },
    onMessageAck: ({ temp_id, real_id }) => {
      pendingSendFallbackRef.current.delete(temp_id);
      setMessages((prev) =>
        prev.map((m) =>
          m.temp_id === temp_id ? { ...m, id: real_id, pending: false, failed: false } : m
        )
      );
    },
    onSendError: ({ temp_id }) => {
      if (!temp_id) return;
      const fallback = pendingSendFallbackRef.current.get(temp_id);
      if (fallback) {
        void (async () => {
          try {
            const saved = await chatService.sendMessage(fallback.channelId, {
              message: fallback.message,
              image_url: fallback.image_url,
              image_thumbnail_url: fallback.image_thumbnail_url,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.temp_id === temp_id ? { ...saved, pending: false, failed: false, temp_id } : m,
              ),
            );
            pendingSendFallbackRef.current.delete(temp_id);
            pendingRetryRef.current.delete(temp_id);
            void refreshChannelsQuietRef.current();
          } catch {
            setMessages((prev) =>
              prev.map((m) => (m.temp_id === temp_id ? { ...m, pending: false, failed: true } : m)),
            );
          }
        })();
        return;
      }
      setMessages((prev) => prev.map((m) => (m.temp_id === temp_id ? { ...m, pending: false, failed: true } : m)));
    },
    onTyping: ({ channel_id, name, user_id }) => {
      if (activeChannelRef.current?.id !== channel_id) return;
      if (user_id === user?.id) return;
      setTypingUsers((prev) =>
        prev.some((t) => t.id === user_id) ? prev : [...prev, { id: user_id, name }]
      );
    },
    onStoppedTyping: ({ channel_id, user_id }) => {
      if (activeChannelRef.current?.id !== channel_id) return;
      setTypingUsers((prev) => prev.filter((t) => t.id !== user_id));
    },
    onConnect: () => {
      const ch = activeChannelRef.current;
      if (ch) void syncMessagesQuietRef.current(ch.id);
      void refreshChannelsQuietRef.current();
    },
    onUnreadChanged: () => {
      void refreshChannelsQuietRef.current();
      window.dispatchEvent(new Event('comms-badges-refresh'));
    },
  });

  const chatSocketRef = useRef(chatSocket);
  chatSocketRef.current = chatSocket;

  const confirmDeleteMessage = useCallback(async (msg: ChatMessage) => {
    const numericId = Number(msg.id);
    if (!Number.isFinite(numericId)) {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(msg.id) && m.temp_id !== msg.temp_id),
      );
      setDeleteTarget(null);
      return;
    }

    pendingDeletesRef.current.add(numericId);
    setMessages((prev) => prev.map((m) => (Number(m.id) === numericId ? asDeletedMessage(m) : m)));
    setDeleteTarget(null);
    setSelectedMessageId(null);

    try {
      chatSocketRef.current.deleteMessage(numericId);
      await chatService.deleteMessage(numericId);
      pendingDeletesRef.current.delete(numericId);
      void refreshChannelsQuietRef.current();
    } catch {
      pendingDeletesRef.current.delete(numericId);
      const ch = activeChannelRef.current;
      if (ch) void syncMessagesQuietRef.current(ch.id);
      toast({ title: 'Could not delete message', variant: 'destructive' });
    }
  }, []);

  useEffect(() => {
    chatSocket.setActiveChannelId(activeChannel?.id ?? null);
  }, [activeChannel?.id, chatSocket]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  // Silent background sync while chat is open — no spinners, no page shake.
  useEffect(() => {
    const tick = () => {
      void refreshChannelsQuietRef.current();
      const ch = activeChannelRef.current;
      if (ch) {
        void syncMessagesQuietRef.current(ch.id);
      }
    };

    const intervalId = window.setInterval(tick, CHAT_BACKGROUND_SYNC_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeChannel?.id]);

  useEffect(() => {
    if (loadingChannels || channels.length === 0) return;
    let channelId: number | null = null;
    try {
      const raw = sessionStorage.getItem('chat-open-channel');
      if (raw) {
        sessionStorage.removeItem('chat-open-channel');
        channelId = Number(raw);
      }
    } catch {
      /* ignore */
    }
    if (!channelId || !Number.isFinite(channelId)) return;
    const ch = channels.find((c) => c.id === channelId);
    if (ch && activeChannel?.id !== channelId) {
      void openChannel(ch);
    }
  }, [loadingChannels, channels, activeChannel?.id]);

  useEffect(() => {
    if (!mobilePickerOpen && !desktopPickerOpen) return;
    void chatService.listStaff(staffSearch).then((r) => setStaffList(r.items || []));
  }, [mobilePickerOpen, desktopPickerOpen, staffSearch]);

  const closeDesktopPicker = useCallback(() => {
    setDesktopPickerOpen(false);
    setPickerAnchor(null);
    setStaffSearch('');
  }, []);

  const updatePickerAnchor = useCallback(() => {
    const el = desktopPickerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 320;
    setPickerAnchor({
      top: rect.bottom + 8,
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      width,
    });
  }, []);

  useEffect(() => {
    if (!desktopPickerOpen) return;
    updatePickerAnchor();
    const onLayout = () => updatePickerAnchor();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [desktopPickerOpen, updatePickerAnchor]);

  const resizeCompose = useCallback(() => {
    const el = composeRef.current;
    if (!el) return;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    el.style.height = 'auto';
    const maxHeight = isMobile ? 96 : 112;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeCompose();
  }, [draft, resizeCompose]);

  const openChannel = async (ch: ChatChannel) => {
    pendingDeletesRef.current.clear();
    setMobileView('chat');
    setTypingUsers([]);
    setShowNewPill(false);
    setSelectedMessageId(null);
    setChannelStats(null);
    chatSocket.joinChannel(ch.id);
    const priorUnread = ch.unread_count || 0;
    chatSocket.markRead(ch.id);
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, unread_count: 0 } : c)));
    if (priorUnread > 0) {
      setTotalUnread((prev) => Math.max(0, prev - priorUnread));
    }
    window.dispatchEvent(new Event('comms-badges-refresh'));
    try {
      const [channelData, stats] = await Promise.all([
        chatService.listChannels(),
        chatService.getChannelStats(ch.id).catch(() => null),
      ]);
      const resolved = channelData.channels.find((c) => c.id === ch.id) || ch;
      setActiveChannel(resolved);
      setChannels(channelData.channels || []);
      setTotalUnread(channelData.total_unread || 0);
      channelsFingerprintRef.current = channelsFingerprint(
        channelData.channels || [],
        channelData.total_unread || 0,
      );
      if (stats) setChannelStats(stats);
    } catch {
      setActiveChannel(ch);
    }
    await loadMessages(ch.id);
    window.dispatchEvent(new Event('comms-badges-refresh'));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
  };

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = channels.filter((c) => c.channel_type !== 'non_teaching');
    if (!q) return visible;
    return visible.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.last_message?.message || '').toLowerCase().includes(q)
    );
  }, [channels, search]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (el.scrollTop < 80 && hasMore && !loadingOlder && activeChannel) {
      const firstId = messages.find((m) => typeof m.id === 'number')?.id as number | undefined;
      if (firstId) void loadMessages(activeChannel.id, firstId);
    }
  };

  const sendCurrent = async () => {
    if (!activeChannel) return;
    const text = draft.trim();
    if (!text && !pendingImage?.image_url) return;

    const tempId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      temp_id: tempId,
      channel_id: activeChannel.id,
      message: text || null,
      image_url: pendingImage?.image_url || null,
      image_thumbnail_url: pendingImage?.image_thumbnail_url || null,
      local_image_preview: pendingImage?.preview || null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_mine: true,
      pending: true,
      sender: {
        id: user?.id ?? null,
        name: user?.fullName || user?.username || 'You',
        role: user?.role || 'staff',
      },
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setPendingImage(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight }));

    const payload = {
      channel_id: activeChannel.id,
      message: text || undefined,
      image_url: optimistic.image_url || undefined,
      image_thumbnail_url: optimistic.image_thumbnail_url || undefined,
      temp_id: tempId,
    };

    pendingSendFallbackRef.current.set(tempId, {
      channelId: activeChannel.id,
      message: text || undefined,
      image_url: optimistic.image_url || undefined,
      image_thumbnail_url: optimistic.image_thumbnail_url || undefined,
    });

    const deliverMessage = async () => {
      const sentViaSocket = await chatSocket.sendMessageOrWait(payload, 2500);
      if (sentViaSocket) return;

      try {
        const saved = await chatService.sendMessage(activeChannel.id, {
          message: text || undefined,
          image_url: optimistic.image_url || undefined,
          image_thumbnail_url: optimistic.image_thumbnail_url || undefined,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.temp_id === tempId ? { ...saved, pending: false, failed: false, temp_id: tempId } : m,
          ),
        );
        pendingSendFallbackRef.current.delete(tempId);
        pendingRetryRef.current.delete(tempId);
        void refreshChannelsQuiet();
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.temp_id === tempId ? { ...m, pending: false, failed: true } : m)),
        );
      }
    };

    const retry = () => {
      setMessages((prev) => prev.map((m) => (m.temp_id === tempId ? { ...m, pending: true, failed: false } : m)));
      void deliverMessage();
    };
    pendingRetryRef.current.set(tempId, retry);
    void deliverMessage();
    chatSocket.typingStop(activeChannel.id);
  };

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const preview = URL.createObjectURL(file);
      const uploaded = await chatService.uploadImage(file);
      setPendingImage({ file, preview, ...uploaded });
    } catch {
      toast({ title: 'Image upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const startDm = async (targetUserId: number) => {
    try {
      const dm = await chatService.startDm(targetUserId);
      setMobilePickerOpen(false);
      closeDesktopPicker();
      const data = await chatService.listChannels();
      setChannels(data.channels || []);
      const ch =
        data.channels.find((c) => c.id === dm.channel_id) ||
        ({
          id: dm.channel_id,
          name: staffList.find((s) => s.id === targetUserId)?.name || 'Direct Message',
          channel_type: 'dm' as const,
          unread_count: 0,
        } as ChatChannel);
      await openChannel(ch);
    } catch {
      toast({ title: 'Could not start conversation', variant: 'destructive' });
    }
  };

  const canPost =
    activeChannel?.channel_type !== 'announcements' ||
    canPostAnnouncements(user?.role || '');

  const toggleMute = async () => {
    if (!activeChannel) return;
    const next = !activeChannel.notifications_muted;
    try {
      await chatService.setChannelMuted(activeChannel.id, next);
      setActiveChannel({ ...activeChannel, notifications_muted: next });
      setChannels((prev) =>
        prev.map((c) => (c.id === activeChannel.id ? { ...c, notifications_muted: next } : c))
      );
      toast({
        title: next ? 'Notifications muted' : 'Notifications unmuted',
        description: next
          ? `You will not get push alerts for ${activeChannel.name}.`
          : `Push alerts are on for ${activeChannel.name}.`,
      });
    } catch {
      toast({ title: 'Could not update mute setting', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!activeChannel) return;
    const refreshStats = () => {
      void chatService.getChannelStats(activeChannel.id).then(setChannelStats).catch(() => undefined);
    };
    refreshStats();
    const id = window.setInterval(refreshStats, 30000);
    return () => window.clearInterval(id);
  }, [activeChannel?.id]);

  const groupedMessages = useMemo(() => groupMessagesForDisplay(messages), [messages]);

  const headerSubtitle = useMemo(() => {
    if (!activeChannel) return '';
    if (activeChannel.channel_type === 'dm') {
      const role = activeChannel.dm_peer?.role?.replace(/-/g, ' ') || 'Staff';
      const online = channelStats?.online_count && channelStats.online_count > 0;
      return online ? `${role} · Active now` : `${role} · Direct message`;
    }
    const members = channelStats?.member_count ?? 0;
    if (members > 0) {
      return `${members} member${members === 1 ? '' : 's'}`;
    }
    return activeChannel.channel_type.replace(/_/g, ' ');
  }, [activeChannel, channelStats]);

  return (
    <div
      ref={chatRootRef}
      className="relative flex h-full min-h-0 flex-1 flex-col px-2 pb-2 pt-1 max-lg:px-0 max-lg:pb-0 max-lg:pt-0 max-lg:bg-slate-950 md:px-6 md:pb-4"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm max-lg:rounded-none max-lg:border-0 max-lg:shadow-none lg:grid lg:grid-cols-[min(340px,32%),1fr]">
        {/* Channel list */}
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-visible border-r border-border/60 bg-slate-50/90 dark:bg-slate-900/60',
            mobileView === 'chat' ? 'hidden lg:flex' : 'flex h-full'
          )}
        >
          <div className="relative z-30 shrink-0 px-4 pt-4 pb-3 flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <Badge className="rounded-full bg-violet-600 hover:bg-violet-600 px-2">{totalUnread}</Badge>
            )}
            <div ref={desktopPickerRef} className="relative ml-auto hidden lg:block">
              <Button
                variant="ghost"
                size="icon"
                className={cn('rounded-full', desktopPickerOpen && 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300')}
                onClick={() => {
                  if (desktopPickerOpen) {
                    closeDesktopPicker();
                    return;
                  }
                  updatePickerAnchor();
                  setDesktopPickerOpen(true);
                }}
                aria-label="New message"
                aria-expanded={desktopPickerOpen}
              >
                <Pencil className="h-5 w-5" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto rounded-full lg:ml-0" onClick={() => setShowSearch((s) => !s)}>
              <Search className="h-5 w-5" />
            </Button>
          </div>
          {showSearch && (
            <div className="px-4 pb-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search channels…"
                className="rounded-xl bg-background dark:bg-slate-950/50"
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loadingChannels ? (
              <div className="p-8 flex justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : channelsError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-destructive">{channelsError}</p>
                <Button variant="outline" className="rounded-xl" onClick={() => void loadChannels()}>
                  Try again
                </Button>
              </div>
            ) : filteredChannels.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No channels yet.</p>
            ) : (
              filteredChannels.map((ch) => {
                const Icon = channelIcon(ch.channel_type);
                const lm = ch.last_message;
                const preview = lm?.image_url ? '📷 Photo' : lm?.message || 'No messages yet';
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => void openChannel(ch)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-border/50 transition-colors active:bg-violet-50/80 hover:bg-violet-50/50 dark:active:bg-violet-950/30 dark:hover:bg-violet-950/20',
                      activeChannel?.id === ch.id && 'bg-violet-50/70 dark:bg-violet-950/25'
                    )}
                  >
                    {ch.channel_type === 'dm' ? (
                      <AvatarCircle label={ch.dm_peer?.name || ch.name} role={ch.dm_peer?.role} />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate text-foreground">
                          {ch.name}
                        </p>
                        {lm?.created_at && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatChatTime(lm.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {lm?.is_platform && <Sparkles className="h-3 w-3 text-violet-500 dark:text-violet-300 shrink-0" />}
                        <p
                          className={cn(
                            'text-sm truncate',
                            lm?.is_platform
                              ? 'text-violet-600 dark:text-violet-300'
                              : 'text-muted-foreground',
                            ch.unread_count > 0 && 'font-medium text-foreground'
                          )}
                        >
                          {lm?.sender_name ? `${lm.sender_name}: ` : ''}
                          {preview}
                        </p>
                      </div>
                    </div>
                    {ch.unread_count > 0 && (
                      <Badge className="rounded-full bg-violet-600 hover:bg-violet-600 min-w-[22px] justify-center">
                        {ch.unread_count}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat view */}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
            mobileView === 'list' ? 'hidden lg:flex' : 'flex h-full flex-1'
          )}
        >
          {!activeChannel ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
              <div className="text-center space-y-3 max-w-sm">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <p className="font-medium text-foreground">Select a conversation</p>
                <p className="text-sm">Pick a channel from the list or tap the compose button to message a colleague.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="sticky top-0 z-20 shrink-0 flex items-center gap-3 px-3 md:px-4 py-3 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-border shadow-sm pt-[max(0.75rem,env(safe-area-inset-top))] max-lg:pt-[env(safe-area-inset-top)]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden rounded-full shrink-0"
                  onClick={() => setMobileView('list')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {activeChannel.channel_type === 'dm' ? (
                  <AvatarCircle
                    label={activeChannel.dm_peer?.name || activeChannel.name}
                    role={activeChannel.dm_peer?.role}
                    className="h-12 w-12 text-base"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center shrink-0">
                    {React.createElement(channelIcon(activeChannel.channel_type), { className: 'h-5 w-5' })}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base md:text-lg truncate text-foreground">{activeChannel.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    {activeChannel.channel_type === 'dm' && channelStats?.online_count ? (
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                    ) : null}
                    {headerSubtitle}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() => void toggleMute()}
                  aria-label={activeChannel.notifications_muted ? 'Unmute chat' : 'Mute chat'}
                  title={activeChannel.notifications_muted ? 'Unmute notifications' : 'Mute notifications'}
                >
                  {activeChannel.notifications_muted ? (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Bell className="h-5 w-5 text-violet-600" />
                  )}
                </Button>
              </header>

              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  onClick={(e) => {
                    if (!(e.target as Element).closest('[data-chat-message]')) {
                      setSelectedMessageId(null);
                    }
                  }}
                  className="h-full overflow-y-auto overscroll-contain py-4 px-2 md:px-4"
                >
                  <div className="mx-auto w-full max-w-3xl space-y-3">
                  {loadingOlder && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {loadingMessages && messages.length === 0 ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center mb-4">
                        <MessageCircle className="h-7 w-7" />
                      </div>
                      <p className="font-semibold text-foreground">Send your first message</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        {activeChannel.channel_type === 'dm'
                          ? 'Say hello to start this direct conversation.'
                          : `Be the first to post in ${activeChannel.name}.`}
                      </p>
                    </div>
                  ) : (
                    <>
                      {loadingMessages && (
                        <div className="flex justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {groupedMessages.map((group) => (
                      <div key={group.date}>
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] px-3 py-1 rounded-full bg-muted/80 text-muted-foreground border border-border/50">
                            {group.date}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {group.senderGroups.map((senderGroup) => (
                            <ChatMessageGroup
                              key={senderGroup.key + String(senderGroup.messages[0]?.id)}
                              group={senderGroup}
                              selectedMessageId={selectedMessageId}
                              onSelectMessage={toggleSelectMessage}
                              onDeleteRequest={requestDeleteMessage}
                              onImageClick={(url) => setLightbox(resolveChatImageUrl(url) || url)}
                              onRetry={(msg) => msg.temp_id && pendingRetryRef.current.get(msg.temp_id)?.()}
                            />
                          ))}
                        </div>
                      </div>
                      ))}
                    </>
                  )}
                  {typingUsers.length > 0 && (
                    <p className="text-xs text-muted-foreground px-2 animate-in fade-in">
                      {typingUsers.length === 1
                        ? `${typingUsers[0].name} is typing…`
                        : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing…`}
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce [animation-delay:120ms]">●</span>
                        <span className="animate-bounce [animation-delay:240ms]">●</span>
                      </span>
                    </p>
                  )}
                  </div>
                </div>
                {showNewPill && (
                  <button
                    type="button"
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 text-white text-sm px-4 py-2 shadow-lg flex items-center gap-1"
                    onClick={() => {
                      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                      setShowNewPill(false);
                    }}
                  >
                    New message <ArrowDown className="h-4 w-4" />
                  </button>
                )}
              </div>

              {canPost ? (
                <div className="sticky bottom-0 z-20 shrink-0 bg-background/98 dark:bg-slate-900/98 border-t border-border px-3 md:px-4 py-2.5 max-lg:py-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="mx-auto w-full max-w-3xl">
                  {pendingImage && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <img src={pendingImage.preview} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-violet-200 dark:ring-violet-800" />
                      <Button variant="ghost" size="icon" className="h-9 w-9 max-lg:h-10 max-lg:w-10" onClick={() => setPendingImage(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div
                    className={cn(
                      'relative flex min-h-11 max-lg:min-h-[52px] items-end gap-1 max-lg:gap-1.5 border border-border bg-muted/50 dark:bg-slate-800/80 pl-1.5 max-lg:pl-2 pr-1 max-lg:pr-1.5 shadow-sm transition-[border-radius,padding] duration-150',
                      draft.trim().length > 0 || draft.includes('\n')
                        ? 'rounded-2xl py-1.5 max-lg:py-2'
                        : 'rounded-full py-0'
                    )}
                  >
                    <label className="flex h-9 w-9 max-lg:h-10 max-lg:w-10 shrink-0 items-center justify-center rounded-full hover:bg-background/80 dark:hover:bg-slate-700/80 cursor-pointer transition-colors">
                      <Paperclip className="h-4 w-4 max-lg:h-5 max-lg:w-5 text-muted-foreground" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void pickImage(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <div className="relative flex min-h-9 max-lg:min-h-10 flex-1 min-w-0 items-end">
                      {emojiOpen && (
                        <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-1 rounded-2xl border border-border bg-popover p-2 shadow-lg max-w-[240px] z-30">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="h-9 w-9 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 text-lg"
                              onClick={() => {
                                setDraft((d) => d + emoji);
                                setEmojiOpen(false);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <Textarea
                        ref={composeRef}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (activeChannel) chatSocket.typingStart(activeChannel.id);
                          requestAnimationFrame(resizeCompose);
                        }}
                        onBlur={() => activeChannel && chatSocket.typingStop(activeChannel.id)}
                        onFocus={(e) => {
                          e.target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                          requestAnimationFrame(resizeCompose);
                        }}
                        placeholder="Message…"
                        rows={1}
                        className="min-h-9 max-lg:min-h-10 !min-h-0 max-h-28 max-lg:max-h-24 resize-none rounded-xl border-0 bg-transparent text-[15px] max-lg:text-base leading-5 max-lg:leading-6 py-1.5 max-lg:py-2 shadow-none focus-visible:ring-0 px-1.5 max-lg:px-2 dark:!min-h-0 overflow-y-auto"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-9 w-9 max-lg:h-10 max-lg:w-10 shrink-0 text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400"
                      onClick={() => setEmojiOpen((o) => !o)}
                      aria-label="Insert emoji"
                    >
                      <Smile className="h-4 w-4 max-lg:h-5 max-lg:w-5" />
                    </Button>
                    <Button
                      size="icon"
                      className="rounded-full h-9 w-9 max-lg:h-10 max-lg:w-10 bg-violet-600 hover:bg-violet-700 shrink-0 shadow-sm shadow-violet-600/20"
                      disabled={(!draft.trim() && !pendingImage?.image_url) || uploading}
                      onClick={() => void sendCurrent()}
                      aria-label="Send message"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 max-lg:h-5 max-lg:w-5 animate-spin" /> : <Send className="h-4 w-4 max-lg:h-[18px] max-lg:w-[18px]" />}
                    </Button>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="shrink-0 px-4 py-3 text-sm text-muted-foreground text-center bg-muted/40 dark:bg-slate-900/50 border-t border-border">
                  📢 Only admins can post in Announcements
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {mobileView === 'list' && (
        <button
          type="button"
          onClick={() => setMobilePickerOpen(true)}
          className="fixed bottom-6 right-4 lg:hidden h-14 w-14 rounded-full bg-violet-600 text-white shadow-[0_8px_24px_rgba(124,58,237,0.45)] flex items-center justify-center z-20 active:scale-95 transition-transform"
          aria-label="New message"
        >
          <Pencil className="h-6 w-6" />
        </button>
      )}

      <Drawer
        open={mobilePickerOpen}
        onOpenChange={(open) => {
          setMobilePickerOpen(open);
          if (!open) setStaffSearch('');
        }}
      >
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>New message</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3">
            <Input
              autoFocus
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Search staff…"
              className="rounded-xl"
            />
            <div className="max-h-[50dvh] overflow-y-auto space-y-1">
              {staffList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void startDm(s.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 text-left"
                >
                  <AvatarCircle label={s.name} role={s.role} />
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{(s.role || 'staff').replace(/-/g, ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {desktopPickerOpen &&
        pickerAnchor &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[200] cursor-default bg-transparent"
              aria-label="Close new message menu"
              onClick={closeDesktopPicker}
            />
            <div
              className="fixed z-[201] flex max-h-[min(380px,calc(100dvh-24px))] flex-col rounded-xl border border-border bg-popover p-3 shadow-xl animate-in fade-in-0 zoom-in-95"
              style={{ top: pickerAnchor.top, left: pickerAnchor.left, width: pickerAnchor.width }}
              role="dialog"
              aria-label="New message"
            >
              <p className="mb-2 shrink-0 px-1 text-sm font-semibold text-foreground">New message</p>
              <Input
                autoFocus
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff…"
                className="shrink-0 rounded-lg"
              />
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {staffList.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">No staff found</p>
                ) : (
                  staffList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void startDm(s.id)}
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30"
                    >
                      <AvatarCircle label={s.name} role={s.role} className="h-9 w-9 text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{s.name}</p>
                        <p className="truncate text-xs capitalize text-muted-foreground">{(s.role || 'staff').replace(/-/g, ' ')}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
          <button type="button" className="absolute top-4 right-4 text-white p-2" onClick={() => setLightbox(null)}>
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      <MessageDeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void confirmDeleteMessage(deleteTarget);
        }}
      />
    </div>
  );
};

export default ChatModule;
