import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ImagePlus, Search, GraduationCap } from 'lucide-react';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import { toast } from '@/hooks/use-toast';

interface Conversation {
  tenant_id: number;
  tenant_name: string;
  logo_url: string | null;
  last_message: string | null;
  last_image_url: string | null;
  sender_username: string | null;
  sender_role: string | null;
  is_from_superadmin: boolean | null;
  last_message_at: string | null;
  unread_count: number;
}

interface SupportMessage {
  id: number;
  tenant_id: number | null;
  tenant_name: string | null;
  sender_username: string;
  sender_role: string;
  message: string;
  image_url: string | null;
  is_from_superadmin: boolean;
  read_at: string | null;
  created_at: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const serverOrigin = apiBase.replace(/\/api\/?$/, '') || 'http://localhost:3001';

// Super-admin: is_from_superadmin=true = MY message (right), false = school message (left)
const isMyMessage = (m: SupportMessage) => m.is_from_superadmin;

const SuperAdminSupportChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const list = await apiService.get<Conversation[]>('/support-chat/conversations');
      setConversations(Array.isArray(list) ? list : []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (tenantId: number) => {
    try {
      const list = await apiService.get<SupportMessage[]>(`/support-chat?tenantId=${tenantId}&limit=200`);
      setMessages(Array.isArray(list) ? list : []);
      await apiService.post('/support-chat/mark-read', { tenantId });
      fetchConversations();
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchMessages(selectedTenant.tenant_id);
    } else {
      setMessages([]);
    }
  }, [selectedTenant?.tenant_id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !selectedTenant) return;
    setSending(true);
    const tempId = -Date.now();
    const optimisticMsg: SupportMessage = {
      id: tempId,
      tenant_id: selectedTenant.tenant_id,
      tenant_name: selectedTenant.tenant_name,
      sender_username: 'You',
      sender_role: 'super-admin',
      message: text,
      image_url: null,
      is_from_superadmin: true,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    try {
      await apiService.post('/support-chat', { message: text, tenantId: selectedTenant.tenant_id });
      fetchMessages(selectedTenant.tenant_id);
      fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((p) => p.id !== tempId));
      toast({ title: 'Failed to send', description: 'Please try again', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading || !selectedTenant) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('image', file);
      formData.append('tenantId', String(selectedTenant.tenant_id));
      const res = await fetch(`${apiBase}/support-chat/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        fetchMessages(selectedTenant.tenant_id);
        fetchConversations();
      } else {
        toast({ title: 'Upload failed', description: 'Please try again', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      !searchTerm ||
      c.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lastPreview = (c: Conversation) => {
    if (c.last_image_url) return '📷 Image';
    if (c.last_message) return c.last_message.length > 40 ? c.last_message.slice(0, 40) + '…' : c.last_message;
    return 'No messages yet';
  };

  const formatTime = (d: string | null) =>
    d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="flex flex-1 min-h-[550px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
      {/* Left Sidebar - Schools List */}
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Support / Chat</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search schools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-white"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No schools</div>
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.tenant_id}
                  type="button"
                  onClick={() => setSelectedTenant(c)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTenant?.tenant_id === c.tenant_id
                      ? 'bg-indigo-100 border-l-2 border-indigo-500'
                      : c.unread_count > 0
                      ? 'bg-amber-50/80 hover:bg-amber-50'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.logo_url ? (
                        <img src={resolveLogoUrl(c.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <GraduationCap className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">{c.tenant_name}</span>
                        {c.unread_count > 0 && (
                          <Badge variant="destructive" className="shrink-0 h-5 min-w-[20px] px-1.5 text-xs bg-rose-500">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 capitalize truncate">
                        {c.sender_role || '—'} • {c.sender_username || '—'}
                      </p>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{lastPreview(c)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right - Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTenant ? (
          <>
            {/* Header */}
            <div className="h-16 shrink-0 border-b border-slate-200 flex items-center gap-4 px-4 bg-white">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {selectedTenant.logo_url ? (
                  <img src={resolveLogoUrl(selectedTenant.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-slate-900">{selectedTenant.tenant_name}</h4>
                <p className="text-xs text-slate-500">Support conversation</p>
              </div>
            </div>

            {/* Messages - WhatsApp style */}
            <ScrollArea className="flex-1 p-4 bg-[#f0f2f5]">
              <div className="space-y-2 max-w-2xl mx-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>No messages yet. Start the conversation.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = isMyMessage(m);
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <span className={`text-xs font-medium text-slate-600 mb-1 ${isMe ? 'text-right self-end' : 'text-left'}`}>
                            {isMe ? 'You' : m.sender_username}
                          </span>
                          <div
                            className={`rounded-2xl px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${
                              isMe
                                ? 'bg-[#dcf8c6] text-slate-900 rounded-br-sm'
                                : 'bg-white text-slate-900 rounded-bl-sm border border-slate-100'
                            }`}
                          >
                          {m.image_url && (
                            <a href={`${serverOrigin}${m.image_url}`} target="_blank" rel="noopener noreferrer" className="block mb-2">
                              <img src={`${serverOrigin}${m.image_url}`} alt="Attached" className="max-w-full max-h-48 rounded-lg object-cover" />
                            </a>
                          )}
                          {m.message && <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{m.message}</p>}
                          <div className="flex justify-end items-center gap-1 mt-1">
                            <span className="text-[11px] text-slate-500">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && m.read_at && (
                              <span className="text-[11px] text-slate-500">✓ Read</span>
                            )}
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input - WhatsApp style */}
            <form onSubmit={sendMessage} className="p-3 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-end gap-2 max-w-2xl mx-auto">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <ImagePlus className="w-5 h-5" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message"
                  className="flex-1 min-h-[42px] rounded-full border-slate-200 bg-slate-50 focus:bg-white px-5"
                  disabled={sending}
                />
                <Button type="submit" size="icon" className="shrink-0 rounded-full h-10 w-10 bg-emerald-500 hover:bg-emerald-600 text-white" disabled={sending || !input.trim()}>
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">Select a school to start chatting</p>
              <p className="text-sm mt-1">Choose a school from the list to view and reply to messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminSupportChat;
