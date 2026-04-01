import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ImagePlus } from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SupportMessage {
  id: number;
  tenant_name: string | null;
  sender_username: string;
  sender_role: string;
  message: string;
  image_url: string | null;
  is_from_superadmin: boolean;
  created_at: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const serverOrigin = apiBase.replace(/\/api\/?$/, '') || 'http://localhost:3001';

// School user: is_from_superadmin=false = MY message (right), true = their message (left)
const isMyMessage = (m: SupportMessage) => !m.is_from_superadmin;

const SupportChatModule = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const list = await apiService.get<SupportMessage[]>('/support-chat?limit=200');
      setMessages(Array.isArray(list) ? list : []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const tempId = -Date.now();
    const optimisticMsg: SupportMessage = {
      id: tempId,
      tenant_name: null,
      sender_username: user?.username || 'You',
      sender_role: '',
      message: text,
      image_url: null,
      is_from_superadmin: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    try {
      await apiService.post('/support-chat', { message: text });
      fetchMessages();
    } catch {
      setMessages((prev) => prev.filter((p) => p.id !== tempId));
      toast({ title: 'Failed to send', description: 'Please try again', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${apiBase}/support-chat/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        fetchMessages();
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

  const getSenderLabel = (m: SupportMessage) => {
    if (isMyMessage(m)) return user?.username || 'You';
    return 'TECHNERVE Support';
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col h-[700px]">
        {/* Chat header */}
        <div className="h-14 shrink-0 border-b border-slate-200 flex items-center gap-3 px-5 bg-slate-50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">TECHNERVE Support</h2>
            <p className="text-xs text-slate-500">Chat with our support team</p>
          </div>
        </div>

        {/* Messages - WhatsApp style with sender names */}
        <ScrollArea className="flex-1 p-4 bg-[#e5ddd5]">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-500">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Start a conversation with support.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const isMe = isMyMessage(m);
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <span className={`text-xs font-medium text-slate-600 mb-1 ${isMe ? 'text-right self-end' : 'text-left'}`}>
                        {getSenderLabel(m)}
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-3 bg-slate-100 border-t border-slate-200 shrink-0">
          <div className="flex items-end gap-2">
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
      </div>
    </div>
  );
};

export default SupportChatModule;
