import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '../../contexts/SocketContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import {
  Send,
  User,
  Headphones,
  ImagePlus,
  CheckCheck,
  Loader2,
  MessageCircle,
  ArrowLeft,
  X,
  Sparkles,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MessageDeleteConfirmDialog from '@/components/common/MessageDeleteConfirmDialog';

interface Message {
  id: number;
  tenant_id: number | null;
  user_id: number | null;
  sender_role: string;
  sender_username: string;
  message: string;
  image_url: string | null;
  is_from_superadmin: boolean;
  read_at: string | null;
  created_at: string;
}

interface SupportChatWindowProps {
  tenantId?: number | null;
  tenantName?: string;
  isSuperAdmin?: boolean;
  onBack?: () => void;
  onReadStateChange?: () => void;
}

function apiOrigin(): string {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  return base.replace(/\/api\/?$/, '');
}

export function resolveSupportImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = apiOrigin();
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Resize & re-encode to stay under server upload limits. GIFs skip re-encoding to preserve animation. */
async function compressImageFile(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Not an image');
  const maxBytes = 6 * 1024 * 1024;
  if (file.size <= maxBytes && file.type === 'image/gif') return file;

  if (file.type === 'image/gif') {
    if (file.size > maxBytes) {
      throw new Error('GIF must be under 6MB. Try a shorter clip or convert to JPEG.');
    }
    return file;
  }

  const compressOnce = (q: number) =>
    new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Could not compress image'));
          },
          'image/jpeg',
          q
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image'));
      };
      img.src = objectUrl;
    });

  let blob = await compressOnce(quality);
  let q = quality;
  while (blob.size > maxBytes && q > 0.45) {
    q -= 0.1;
    blob = await compressOnce(q);
  }
  if (blob.size > maxBytes) {
    throw new Error('Image is too large after compression. Try a smaller photo.');
  }
  return blob;
}

const SupportChatWindow: React.FC<SupportChatWindowProps> = ({ tenantId, tenantName, isSuperAdmin = false, onBack, onReadStateChange }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const applyReadReceipts = useCallback(
    (readBy: 'super-admin' | 'school', ids?: number[]) => {
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => {
          const isOutgoing = isSuperAdmin ? m.is_from_superadmin : !m.is_from_superadmin;
          if (!isOutgoing || m.read_at) return m;
          if (readBy === 'school' && isSuperAdmin && m.is_from_superadmin) {
            if (ids?.length && !ids.includes(m.id)) return m;
            return { ...m, read_at: now };
          }
          if (readBy === 'super-admin' && !isSuperAdmin && !m.is_from_superadmin) {
            if (ids?.length && !ids.includes(m.id)) return m;
            return { ...m, read_at: now };
          }
          return m;
        })
      );
    },
    [isSuperAdmin]
  );

  const markThreadRead = useCallback(async () => {
    try {
      if (isSuperAdmin && tenantId) {
        await apiService.post('/support-chat/mark-read', { tenantId }, { skipTenant: true, skipTenantHeaders: true });
      } else if (!isSuperAdmin) {
        await apiService.post('/support-chat/mark-read-by-school', {}, { skipTenant: true });
      }
      onReadStateChange?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('comms-badges-refresh'));
      }
    } catch (error) {
      console.error('Support mark-read failed:', error);
    }
  }, [isSuperAdmin, tenantId, onReadStateChange]);

  const fetchMessages = useCallback(async () => {
    try {
      const endpoint = isSuperAdmin && tenantId ? `/support-chat?tenantId=${tenantId}` : '/support-chat';
      const data = await apiService.get<Message[]>(endpoint, {
        skipTenant: isSuperAdmin,
      });
      setMessages(data);
      setLoading(false);
      await markThreadRead();
    } catch (error) {
      console.error('Failed to fetch support messages:', error);
      setLoading(false);
    }
  }, [isSuperAdmin, tenantId, markThreadRead]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void markThreadRead();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markThreadRead]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (isSuperAdmin) {
        if (msg.tenant_id === tenantId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          void markThreadRead();
        }
      } else {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.is_from_superadmin) {
          void markThreadRead();
        }
      }
    };

    socket.on('new-support-message', handleNewMessage);

    const handleDeleted = (payload: { id?: number; tenantId?: number | null }) => {
      const id = Number(payload?.id);
      if (!id) return;
      if (isSuperAdmin && tenantId != null && payload.tenantId != null && payload.tenantId !== tenantId) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };
    socket.on('support-message-deleted', handleDeleted);

    const handleRead = (payload: { tenantId?: number | null; readBy?: string; messageIds?: number[] }) => {
      const tid = payload?.tenantId != null ? Number(payload.tenantId) : null;
      if (isSuperAdmin && tid != null && tenantId != null && tid !== tenantId) return;
      const readBy = payload?.readBy === 'school' || payload?.readBy === 'super-admin' ? payload.readBy : null;
      if (!readBy) return;
      applyReadReceipts(readBy, payload.messageIds);
      onReadStateChange?.();
    };
    socket.on('support-chat-read', handleRead);

    return () => {
      socket.off('new-support-message', handleNewMessage);
      socket.off('support-message-deleted', handleDeleted);
      socket.off('support-chat-read', handleRead);
    };
  }, [socket, tenantId, isSuperAdmin, applyReadReceipts, onReadStateChange, markThreadRead]);

  useEffect(() => {
    setTimeout(scrollToBottom, 80);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const clearPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image (JPEG, PNG, GIF, or WebP).', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please use an image under 25MB. It will be compressed before sending.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    clearPending();
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pendingFile) {
      await handleSendWithImage();
      return;
    }
    if (!inputValue.trim() || sending) return;

    setSending(true);
    try {
      const res = await apiService.post<Message>('/support-chat', {
        message: inputValue.trim(),
        tenantId: isSuperAdmin ? tenantId : undefined,
      });
      setMessages((prev) => {
        if (prev.find((m) => m.id === res.id)) return prev;
        return [...prev, res];
      });
      setInputValue('');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: 'Could not send', description: err.message || 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSendWithImage = async () => {
    if (!pendingFile || uploading) return;
    setUploading(true);
    try {
      const blob = await compressImageFile(pendingFile);
      const extFromType =
        blob.type === 'image/png' ? '.png' : blob.type === 'image/gif' ? '.gif' : blob.type === 'image/webp' ? '.webp' : '.jpg';
      const base = pendingFile.name.replace(/\.[^.]+$/, '') || 'image';
      const file = new File([blob], base + extFromType, { type: blob.type || 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', file);
      if (inputValue.trim()) formData.append('message', inputValue.trim());
      if (isSuperAdmin && tenantId != null) formData.append('tenantId', String(tenantId));

      const res = await apiService.postForm<Message>('/support-chat/upload-image', formData);
      setMessages((prev) => {
        if (prev.find((m) => m.id === res.id)) return prev;
        return [...prev, res];
      });
      setInputValue('');
      clearPending();
      toast({ title: 'Photo sent', description: 'Your image was delivered to the thread.' });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: 'Upload failed', description: err.message || 'Could not send image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await apiService.delete(`/support-chat/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: 'Could not delete', description: err.message || 'Failed to delete message', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/20">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-sm font-medium text-muted-foreground">Loading conversation…</p>
      </div>
    );
  }

  const supportTitle = isSuperAdmin ? tenantName || 'School' : 'ScholarNerve';
  const supportSubtitle = isSuperAdmin ? 'School administrators' : 'Support team';

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <MessageDeleteConfirmDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        onConfirm={() => {
          if (pendingDeleteId != null) void handleDeleteMessage(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        kind="message"
      />
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <div className="flex min-h-full w-full items-center justify-center">
          <button
            type="button"
            className="absolute right-6 top-6 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightbox}
            alt="Full size"
            className="my-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
          </div>
        </div>
      )}

      {/* Header — Parent Desk style */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {onBack && (
              <Button type="button" variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onBack} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">{supportTitle}</h2>
                <Badge variant="secondary" className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex">
                  Live
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {supportSubtitle} ·{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Here to help</span>
              </p>
            </div>
          </div>
          {isSuperAdmin && tenantId != null && (
            <Badge variant="outline" className="hidden shrink-0 font-mono text-[10px] sm:flex">
              #{tenantId}
            </Badge>
          )}
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/[0.06] via-transparent to-transparent px-4 py-6 md:px-6">
          {/* Welcome card */}
          <div className="mx-auto mb-8 max-w-lg rounded-2xl border border-border/80 bg-card/90 p-5 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Support desk</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {isSuperAdmin ? `Thread with ${tenantName || 'this school'}` : 'Message the ScholarNerve team'}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {isSuperAdmin
                ? 'Replies appear for the school’s admins in real time. You can attach screenshots or documents as images.'
                : 'Describe your question or attach a screenshot. A specialist will respond as soon as possible — same experience as Parent Desk.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Encrypted in transit
            </div>
          </div>

          <div className="mx-auto max-w-3xl space-y-4 pb-4">
            {messages.map((msg, i) => {
              const isMe = (isSuperAdmin && msg.is_from_superadmin) || (!isSuperAdmin && !msg.is_from_superadmin);
              const isSupport = isSuperAdmin ? msg.is_from_superadmin : !msg.is_from_superadmin;
              const showMeta = i === 0 || messages[i - 1].is_from_superadmin !== msg.is_from_superadmin;
              const imgSrc = resolveSupportImageUrl(msg.image_url);

              return (
                <div
                  key={msg.id}
                  className={cn('flex w-full gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200', isMe ? 'justify-end' : 'justify-start')}
                >
                  {!isMe && showMeta && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                      {isSupport ? <Headphones className="h-4 w-4 text-purple-600" /> : <User className="h-4 w-4" />}
                    </div>
                  )}
                  {!isMe && !showMeta && <div className="w-9 shrink-0" />}

                  <div className={cn('flex max-w-[min(92%,28rem)] flex-col gap-1', isMe ? 'items-end' : 'items-start')}>
                    {showMeta && (
                      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {msg.sender_username} · {new Date(msg.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-sm shadow-md transition-shadow hover:shadow-lg relative group',
                        isMe
                          ? 'rounded-tr-md border-purple-500/20 bg-gradient-to-br from-purple-600 to-indigo-700 text-white'
                          : 'rounded-tl-md border-border bg-card text-foreground'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(msg.id)}
                        className={cn(
                          'absolute top-2 right-2 rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100',
                          isMe ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
                        )}
                        title="Delete message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {imgSrc && (
                        <button
                          type="button"
                          className={cn(
                            'group/img relative mb-2 block w-full overflow-hidden rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-400',
                            isMe ? 'border-white/20 bg-black/10' : 'border-border bg-muted/40'
                          )}
                          onClick={() => setLightbox(imgSrc)}
                        >
                          <img
                            src={imgSrc}
                            alt="Attachment"
                            className="max-h-64 w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.02]"
                            loading="lazy"
                          />
                          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/img:opacity-100">
                            Tap to expand
                          </span>
                        </button>
                      )}
                      {msg.message ? (
                        <p className={cn('whitespace-pre-wrap leading-relaxed', isMe ? 'text-white/95' : 'text-foreground')}>{msg.message}</p>
                      ) : null}
                      <div className={cn(
                        "mt-2 flex items-center justify-end gap-1 text-[10px] font-mono",
                        isMe ? 'text-white/70' : 'text-muted-foreground/60'
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          msg.read_at ? (
                            <span className="inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide text-white/80">
                              <CheckCheck className="h-3 w-3" />
                              Read
                            </span>
                          ) : (
                            <CheckCheck className="h-3 w-3 opacity-50" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Composer — Parent Desk style */}
      <footer className="shrink-0 border-t border-border bg-card/90 p-4 backdrop-blur-md md:p-5">
        <div className="mx-auto max-w-3xl space-y-3">
          {pendingPreview && pendingFile && (
            <div className="flex animate-in slide-in-from-bottom-2 items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-500/10 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                <img src={pendingPreview} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{pendingFile.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(pendingFile.size / 1024).toFixed(0)} KB · will be optimized before send
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={clearPending}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSendText} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                }}
                rows={1}
                placeholder={pendingFile ? 'Add a caption (optional)…' : 'Type your message…'}
                disabled={sending || uploading}
                className="min-h-[48px] w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-24 text-sm text-foreground shadow-inner placeholder:text-muted-foreground/60 focus:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePickFile} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-purple-500/10 hover:text-purple-600"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending}
                  aria-label="Attach image"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {pendingFile ? (
                <Button
                  type="button"
                  onClick={() => void handleSendWithImage()}
                  disabled={uploading}
                  className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-indigo-700"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  Send photo
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || sending}
                  className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-indigo-700"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </form>
          <p className="text-center text-[10px] font-medium text-muted-foreground">
            Images: JPEG, PNG, GIF, WebP · optimized automatically ·{' '}
            <span className="hidden sm:inline">Shift+Enter for new line · </span>
            Enter to send text
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SupportChatWindow;
