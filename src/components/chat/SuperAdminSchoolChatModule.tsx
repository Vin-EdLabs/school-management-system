import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, Globe, Loader2, MessageSquare, Paperclip, Search, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import ChatMessageBubble from '@/components/chat/ChatMessageBubble';
import {
  type ChatMessage,
  type SuperAdminSchoolChat,
  chatService,
  formatChatTime,
  formatDateSeparator,
  resolveChatImageUrl,
} from '@/services/chatService';
import { resolveLogoUrl } from '@/services/tenantService';
import { toast } from '@/hooks/use-toast';

const SuperAdminSchoolChatModule: React.FC = () => {
  const { token } = useAuth();
  const [schools, setSchools] = useState<SuperAdminSchoolChat[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SuperAdminSchoolChat | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<{
    preview: string;
    image_url?: string;
    image_thumbnail_url?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Array<{ id: number; name: string }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSchools = useCallback(async () => {
    setLoadingSchools(true);
    try {
      const data = await chatService.listSuperAdminSchools();
      setSchools(data.schools || []);
    } catch {
      toast({ title: 'Could not load schools', variant: 'destructive' });
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  const loadMessages = useCallback(async (tenantId: number, beforeId?: number) => {
    if (beforeId) setLoadingOlder(true);
    else setLoadingMessages(true);
    try {
      const data = await chatService.listSuperAdminSchoolMessages(tenantId, beforeId);
      if (beforeId) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.messages.length >= 30);
      } else {
        setMessages(data.messages);
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
    onNewMessage: (msg) => {
      if (!selected?.channel_id || msg.channel_id !== selected.channel_id) {
        void loadSchools();
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
        return [...prev, msg];
      });
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
      void loadSchools();
    },
    onTyping: ({ channel_id, name, user_id }) => {
      if (selected?.channel_id !== channel_id) return;
      setTypingUsers((prev) =>
        prev.some((t) => t.id === user_id) ? prev : [...prev, { id: user_id, name }]
      );
    },
    onStoppedTyping: ({ channel_id, user_id }) => {
      if (selected?.channel_id !== channel_id) return;
      setTypingUsers((prev) => prev.filter((t) => t.id !== user_id));
    },
  });

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  const openSchool = async (school: SuperAdminSchoolChat) => {
    setSelected(school);
    setMobileView('chat');
    setTypingUsers([]);
    if (school.channel_id) chatSocket.joinChannel(school.channel_id);
    await loadMessages(school.tenant_id);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight }));
  };

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.tenant_name.toLowerCase().includes(q));
  }, [schools, search]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; items: ChatMessage[] }> = [];
    for (const m of messages) {
      const date = formatDateSeparator(m.created_at);
      const last = groups[groups.length - 1];
      if (last?.date === date) last.items.push(m);
      else groups.push({ date, items: [m] });
    }
    return groups;
  }, [messages]);

  const pickImage = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    try {
      const preview = URL.createObjectURL(file);
      const uploaded = await chatService.superAdminUploadImage(selected.tenant_id, file);
      setPendingImage({ preview, ...uploaded });
    } catch {
      toast({ title: 'Image upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text && !pendingImage?.image_url) return;

    const tempId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      temp_id: tempId,
      channel_id: selected.channel_id || 0,
      message: text || null,
      image_url: pendingImage?.image_url || null,
      image_thumbnail_url: pendingImage?.image_thumbnail_url || null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_mine: true,
      pending: true,
      sender: { id: null, name: 'ScholarNerve Team', role: 'platform' },
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setPendingImage(null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight }));

    try {
      const created = await chatService.superAdminPostToSchool(selected.tenant_id, {
        message: text || undefined,
        image_url: optimistic.image_url || undefined,
        image_thumbnail_url: optimistic.image_thumbnail_url || undefined,
      });
      setMessages((prev) =>
        prev.map((m) => (m.temp_id === tempId ? { ...created, pending: false } : m))
      );
      void loadSchools();
    } catch {
      setMessages((prev) => prev.map((m) => (m.temp_id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast({ title: 'Send failed', variant: 'destructive' });
    }
  };

  const totalUnread = schools.reduce((s, sc) => s + sc.unread_count, 0);

  return (
    <div className="flex h-[calc(100dvh-120px)] min-h-[420px] flex-col gap-0 overflow-hidden px-4 pb-4 pt-2 md:flex-row md:gap-0 md:px-6">
      <Card
        className={cn(
          'flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:mr-3 md:w-[320px] lg:w-[340px] md:rounded-r-none md:border-r-0',
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="shrink-0 space-y-3 border-b border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">General Chat</h3>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">All schools</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {totalUnread > 0 ? `${totalUnread} new` : 'All read'}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search schools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 border-border bg-background pl-9 rounded-xl"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {loadingSchools ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Loading</p>
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="px-4 py-16 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-9 w-9 opacity-40" />
                <p className="text-sm font-medium">No schools match</p>
              </div>
            ) : (
              filteredSchools.map((school) => {
                const lm = school.last_message;
                const preview = lm?.image_url ? '📷 Photo' : lm?.message || 'No messages yet';
                return (
                  <button
                    key={school.tenant_id}
                    type="button"
                    onClick={() => void openSchool(school)}
                    className={cn(
                      'flex w-full gap-3 rounded-xl border p-3 text-left transition-all',
                      selected?.tenant_id === school.tenant_id
                        ? 'border-emerald-500/40 bg-emerald-500/10 shadow-md'
                        : 'border-transparent hover:border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      {school.logo_url ? (
                        <img src={resolveLogoUrl(school.logo_url)!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Building2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-foreground">{school.tenant_name}</span>
                        {lm?.created_at && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatChatTime(lm.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lm?.is_platform && <Sparkles className="inline h-3 w-3 text-violet-600 mr-0.5" />}
                        {lm?.sender_name ? `${lm.sender_name}: ` : ''}
                        {preview}
                      </p>
                    </div>
                    {school.unread_count > 0 && selected?.tenant_id !== school.tenant_id && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {school.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm md:rounded-l-none md:border-l-0',
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        )}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
              <Globe className="h-8 w-8 opacity-50" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Select a school</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Read and reply in each school&apos;s General channel as ScholarNerve Team.
              </p>
            </div>
          </div>
        ) : (
            <>
            <header className="sticky top-0 z-20 shrink-0 flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-full shrink-0"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {selected.logo_url ? (
                  <img src={resolveLogoUrl(selected.logo_url)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{selected.tenant_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> General · Staff channel
                </p>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4 px-3 md:px-4 bg-gradient-to-b from-[#eef2f6] to-[#e2e8f0]">
              <div className="mx-auto w-full max-w-3xl space-y-3">
                {loadingOlder && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <p className="font-semibold text-foreground">Start the conversation</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Send the first message to {selected.tenant_name}&apos;s General channel. Staff will see it here.
                    </p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] px-3 py-1 rounded-full bg-black/5 text-muted-foreground">
                          {group.date}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((msg) => (
                          <ChatMessageBubble
                            key={String(msg.id)}
                            msg={msg}
                            onImageClick={(url) => setLightbox(resolveChatImageUrl(url) || url)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
                {typingUsers.length > 0 && (
                  <p className="text-xs text-muted-foreground px-2">
                    {typingUsers[0].name} is typing…
                  </p>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background px-3 md:px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto w-full max-w-3xl">
                {pendingImage && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <img src={pendingImage.preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <Button variant="ghost" size="icon" onClick={() => setPendingImage(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="shrink-0 p-2 rounded-full hover:bg-muted cursor-pointer">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
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
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) => {
                      e.target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    }}
                    placeholder="Message as ScholarNerve Team…"
                    rows={1}
                    className="min-h-[44px] max-h-[120px] resize-none rounded-2xl bg-muted/50 border-0 text-[15px]"
                  />
                  <Button
                    size="icon"
                    className="rounded-full h-11 w-11 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                    disabled={(!draft.trim() && !pendingImage?.image_url) || uploading}
                    onClick={() => void sendMessage()}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowLeft className="h-5 w-5 rotate-90" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

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
    </div>
  );
};

export default SuperAdminSchoolChatModule;
