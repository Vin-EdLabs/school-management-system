import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, Loader2, RefreshCw, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PartnerApiError, partnerApi, type PartnerSupportMessage } from '@/services/partnerApi';
import { usePartnerSession } from '@/pages/partners/partnerSession';
import { usePartnerSocket } from './usePartnerSocket';
import { PartnerPage, PortalCard } from './partnerShared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const POLL_MS = 4000;

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString('en-GH', {
    day: sameDay ? undefined : 'numeric',
    month: sameDay ? undefined : 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PartnerSupport() {
  const navigate = useNavigate();
  const { refresh } = usePartnerSession();
  const { socket, connected } = usePartnerSocket();
  const [messages, setMessages] = useState<PartnerSupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (opts?: { silent?: boolean; manual?: boolean }) => {
    const silent = opts?.silent ?? false;
    const manual = opts?.manual ?? false;
    if (manual) setRefreshing(true);
    else if (!silent) setLoading(true);
    try {
      const data = await partnerApi.get<{ messages: PartnerSupportMessage[] }>('/partners/support/messages');
      setMessages(data.messages || []);
      await partnerApi.put('/partners/support/read').catch(() => undefined);
      await refresh();
    } catch (err) {
      if (!silent) {
        setError(err instanceof PartnerApiError ? err.message : 'Could not load messages');
      }
    } finally {
      if (manual) setRefreshing(false);
      else if (!silent) setLoading(false);
    }
  }, [refresh]);

  const appendMessage = useCallback((msg: PartnerSupportMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, load]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: PartnerSupportMessage & { partner_id?: number }) => {
      try {
        appendMessage(msg);
        if (msg.is_from_superadmin) {
          void partnerApi.put('/partners/support/read').catch(() => undefined);
          void refresh();
        }
      } catch (err) {
        console.warn('[partner] Support message handler failed', err);
      }
    };

    try {
      socket.on('new-partner-support-message', onMessage);
    } catch (err) {
      console.warn('[partner] Could not subscribe to support chat', err);
      return;
    }

    return () => {
      try {
        socket.off('new-partner-support-message', onMessage);
      } catch {
        /* ignore */
      }
    };
  }, [socket, appendMessage, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const tempId = -Date.now();
    const optimistic: PartnerSupportMessage = {
      id: tempId,
      sender_role: 'partner',
      sender_username: 'You',
      message: text,
      is_from_superadmin: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setError(null);
    setDraft('');
    appendMessage(optimistic);

    try {
      const data = await partnerApi.post<{ message: PartnerSupportMessage }>(
        '/partners/support/messages',
        { message: text },
      );
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      setError(err instanceof PartnerApiError ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <PartnerPage className="flex min-h-0 flex-col pb-28">
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/more')}
          className="snp-glass-card flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-slate-600 shadow-sm transition hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
          aria-label="Back to More"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Support</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {connected ? 'Live chat · replies appear instantly' : 'Message the ScholarNerve team'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load({ silent: true, manual: true })}
          disabled={refreshing}
          className="snp-glass-card flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/90 text-slate-600 shadow-sm transition hover:text-emerald-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
          aria-label="Refresh messages"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      <PortalCard className="snp-support-shell flex min-h-[420px] flex-1 flex-col overflow-hidden p-0">
        <div className="snp-support-header flex items-center gap-3 border-b border-slate-100/80 px-4 py-3 dark:border-slate-800/80">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">ScholarNerve Support</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {connected ? 'Connected — messages sync in real time' : 'Tap refresh if a reply is slow to appear'}
            </p>
          </div>
        </div>

        <div className="snp-support-thread flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-full min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="snp-support-empty flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/40 px-6 py-10 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Headphones className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">No messages yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Ask about payouts, referrals, training, or your account — we&apos;ll reply here.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const fromSupport = msg.is_from_superadmin;
              const pending = msg.id < 0;
              return (
                <div
                  key={msg.id}
                  className={cn('flex', fromSupport ? 'justify-start' : 'justify-end')}
                >
                  <div
                    className={cn(
                      'snp-support-bubble max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm',
                      fromSupport
                        ? 'snp-support-bubble--in rounded-bl-md border border-slate-200/80 bg-white/90 dark:border-slate-700/80 dark:bg-slate-800/90'
                        : 'snp-support-bubble--out rounded-br-md border border-emerald-200/70 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/40',
                      pending && 'opacity-80',
                    )}
                  >
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {fromSupport ? 'ScholarNerve Support' : 'You'}
                      {pending ? ' · sending…' : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                      {msg.message}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {formatMsgTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={send}
          className="snp-support-compose border-t border-slate-100/80 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70"
        >
          {error ? <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type your message…"
              className="snp-support-input min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500"
            />
            <Button
              type="submit"
              disabled={sending || !draft.trim()}
              className="h-11 shrink-0 rounded-xl bg-emerald-600 px-4 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </PortalCard>
    </PartnerPage>
  );
}
