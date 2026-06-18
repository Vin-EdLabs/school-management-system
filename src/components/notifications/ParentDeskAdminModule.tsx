import React, { useEffect, useMemo, useState, useRef } from 'react';
import { apiService } from '@/services/api';
import { MessageSquare, RefreshCw, Send, CheckCheck, Paperclip, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from '@/utils/dateFormat';

const ParentDeskAdminModule: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [conversation, setConversation] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selected || conversation.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selected, conversation]);

  const load = async () => {
    setLoading(true);
    console.log('[ParentDesk] Loading conversations...');
    try {
      const data = await apiService.get<any[]>('/messages/admin/list');
      console.log('[ParentDesk] Received data:', data);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ParentDesk] Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: number) => {
    const data = await apiService.get<any>(`/messages/admin/${id}`);
    setSelected(data?.message || null);
    setConversation(Array.isArray(data?.replies) ? data.replies : []);
  };

  const filtered = useMemo(() => {
    return messages.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && (statusFilter === 'all' || m.status === statusFilter));
  }, [messages, typeFilter, statusFilter]);

  useEffect(() => { load().catch(() => undefined); }, []);

  return (
    <div className="h-[calc(100dvh-120px)] grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-0 bg-background overflow-hidden border border-border/50 rounded-2xl shadow-sm mx-4">
      {/* Lightbox */}
      {lightbox && (
        <div 
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightbox(null)}
        >
          <div className="flex min-h-full w-full items-center justify-center">
          <button className="absolute top-6 right-6 text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-8 h-8" />
          </button>
          <img 
            src={lightbox} 
            alt="Full view" 
            className="my-auto max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
            onClick={e => e.stopPropagation()}
          />
          </div>
        </div>
      )}
      {/* Sidebar: Message List */}
      <div className="flex flex-col border-r border-border bg-card/30 backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Parent Desk</h3>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Inbox</p>
            </div>
          </div>
          <button 
            onClick={() => load().catch(() => undefined)} 
            className="p-2 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all"
            title="Refresh inbox"
          >
            <RefreshCw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-border grid grid-cols-2 gap-2 bg-muted/20">
          <select 
            className="bg-background border border-border rounded-xl px-2 py-1.5 text-[10px] font-medium text-foreground focus:ring-2 focus:ring-purple-500/20 transition-all outline-none" 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="absence">Absence</option>
            <option value="fee">Financial</option>
            <option value="academic">Academic</option>
            <option value="teacher">Staff Related</option>
            <option value="general">General Inquiry</option>
          </select>
          <select 
            className="bg-background border border-border rounded-xl px-2 py-1.5 text-[10px] font-medium text-foreground focus:ring-2 focus:ring-purple-500/20 transition-all outline-none" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="urgent">Urgent</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-3 opacity-50">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Loading Inbox...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((m) => (
              <button 
                key={m.id} 
                onClick={() => open(Number(m.id)).catch(() => undefined)} 
                className={cn(
                  "w-full text-left rounded-2xl border p-3 transition-all group relative overflow-hidden",
                  selected?.id === m.id 
                    ? "bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5" 
                    : "bg-card border-border/50 hover:border-purple-500/30 hover:bg-muted/50"
                )}
              >
                {selected?.id === m.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                )}
                <div className="flex items-center justify-between mb-1">
                  <p className={cn(
                    "font-bold text-[13px] truncate",
                    selected?.id === m.id ? "text-purple-400" : "text-foreground"
                  )}>
                    {m.subject}
                  </p>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {formatDisplayDate(m.created_at)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2 truncate font-medium">
                  {m.first_name} {m.last_name} · <span className="opacity-70">{m.class_name || 'Unassigned'}</span>
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn(
                    "text-[8px] uppercase font-black px-1.5 py-0",
                    m.status === 'urgent' ? "border-red-500/50 text-red-500 bg-red-500/5" :
                    m.status === 'resolved' ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/5" :
                    "border-border text-muted-foreground bg-muted/30"
                  )}>
                    {String(m.status || 'Pending').replace('_', ' ')}
                  </Badge>
                  {Number(m.unread_parent_replies || 0) > 0 && (
                    <span className="flex items-center justify-center min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full px-1 shadow-lg shadow-red-500/20">
                      {m.unread_parent_replies}
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-40">
              <MessageSquare className="w-10 h-10 mb-4" />
              <p className="text-xs font-bold">No conversations found</p>
              <p className="text-[9px] uppercase mt-2 tracking-widest leading-relaxed">Adjust filters or wait for parents</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Chat View */}
      <div className="flex flex-col bg-background relative overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 relative">
             <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
             <div className="w-16 h-16 rounded-[1.5rem] bg-card border border-border flex items-center justify-center text-muted-foreground mb-4 shadow-xl">
               <MessageSquare className="w-8 h-8 opacity-20" />
             </div>
             <h3 className="text-lg font-bold text-foreground mb-1">Select a Conversation</h3>
             <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">Choose a message from the inbox to view details and reply.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                  {selected.first_name?.[0]}{selected.last_name?.[0]}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm tracking-tight leading-none mb-1">{selected.subject}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {selected.first_name} {selected.last_name} · {selected.class_name || 'No class'} · ID: <span className="font-mono text-purple-400">{selected.admission_number || 'N/A'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => apiService.put(`/messages/admin/${selected.id}/status`, { status: 'urgent' }).then(load)} 
                  variant="outline"
                  className="h-7 text-[9px] font-black uppercase tracking-widest border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg px-2"
                >
                  Urgent
                </Button>
                <Button 
                  onClick={() => apiService.put(`/messages/admin/${selected.id}/status`, { status: 'resolved' }).then(load)} 
                  variant="outline"
                  className="h-7 text-[9px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg px-2"
                >
                  Resolve
                </Button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 pattern-dots">
              {/* Parent Original Message */}
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-1">
                   <p className="text-[9px] font-black text-muted-foreground ml-3 mb-1 uppercase tracking-tighter">Initial Inquiry</p>
                   <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-4 text-sm text-foreground shadow-sm relative group">
                    <p className="leading-relaxed text-xs">{selected.message}</p>
                    {selected.attachment_url && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted/50">
                        <img 
                          src={selected.attachment_url} 
                          alt="Attachment" 
                          className="max-h-60 w-full object-cover hover:scale-105 transition-transform cursor-pointer" 
                          onClick={() => setLightbox(selected.attachment_url)}
                        />
                      </div>
                    )}
                    <div className="mt-2 text-[9px] text-muted-foreground/60 font-mono text-right">
                      {new Date(selected.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Replies */}
              {conversation.map((r) => (
                <div key={r.id} className={cn("flex", r.sender_type === 'school' ? 'justify-end' : 'justify-start')}>
                  <div className="max-w-[85%] space-y-1">
                    <p className={cn(
                      "text-[8px] font-black mb-1 uppercase tracking-tighter mx-3",
                      r.sender_type === 'school' ? "text-purple-400 text-right" : "text-muted-foreground"
                    )}>
                      {r.sender_type === 'school' ? "School Official" : "Parent"}
                    </p>
                    <div className={cn(
                      "rounded-2xl p-4 text-xs shadow-md transition-all hover:shadow-xl",
                      r.sender_type === 'school' 
                        ? "bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-tr-sm border-0" 
                        : "bg-card border border-border text-foreground rounded-tl-sm"
                    )}>
                      <p className="leading-relaxed">{r.reply_text}</p>
                      {r.attachment_url && (
                        <div className={cn(
                          "mt-3 overflow-hidden rounded-xl border",
                          r.sender_type === 'school' ? "border-white/20 bg-white/10" : "border-border bg-muted/50"
                        )}>
                          <img 
                            src={r.attachment_url} 
                            alt="Reply Attachment" 
                            className="max-h-60 w-full object-cover hover:scale-105 transition-transform cursor-pointer" 
                            onClick={() => setLightbox(r.attachment_url)}
                          />
                        </div>
                      )}
                      <div className={cn(
                        "mt-2 text-[9px] flex items-center justify-end gap-1 font-mono",
                        r.sender_type === 'school' ? 'text-white/70' : 'text-muted-foreground/60'
                      )}>
                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {r.sender_type === 'school' && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-border bg-card/50 backdrop-blur-md sticky bottom-0">
              <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                {attachment && (
                  <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl animate-in slide-in-from-bottom-2">
                    <div className="w-10 h-10 rounded-lg bg-card border border-border overflow-hidden">
                      <img src={URL.createObjectURL(attachment)} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-bold text-foreground truncate">{attachment.name}</p>
                      <p className="text-[8px] text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={() => setAttachment(null)} className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <textarea 
                      value={reply} 
                      onChange={(e) => setReply(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const handleSend = async () => {
                            if (!reply.trim() && !attachment) return;
                            const form = new FormData();
                            form.append('reply_text', reply.trim());
                            if (attachment) form.append('attachment', attachment);
                            
                            await apiService.postForm(`/messages/admin/${selected.id}/reply`, form);
                            setReply('');
                            setAttachment(null);
                            await open(Number(selected.id));
                            await load();
                          };
                          handleSend().catch(() => undefined);
                        }
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                      }}
                      rows={1} 
                      className="w-full rounded-xl border border-border bg-background pl-4 pr-12 py-3 text-xs text-foreground focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all resize-none shadow-inner placeholder:text-muted-foreground/50 max-h-[120px]" 
                      placeholder="Draft your response..." 
                    />
                    <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                      <Paperclip className="w-4 h-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!reply.trim() && !attachment) return;
                      const form = new FormData();
                      form.append('reply_text', reply.trim());
                      if (attachment) form.append('attachment', attachment);
                      
                      await apiService.postForm(`/messages/admin/${selected.id}/reply`, form);
                      setReply('');
                      setAttachment(null);
                      await open(Number(selected.id));
                      await load();
                    }}
                    disabled={!reply.trim() && !attachment}
                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 h-10 shadow-lg shadow-purple-600/20 group shrink-0"
                  >
                    <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> 
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground/60 font-medium italic text-center">
                  Parents receive an instant push notification.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParentDeskAdminModule;
