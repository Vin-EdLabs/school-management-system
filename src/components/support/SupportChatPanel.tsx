import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ImagePlus, X } from 'lucide-react';
import { apiService } from '../../services/api';

interface SupportMessage {
  id: number;
  tenant_id: number | null;
  tenant_name: string | null;
  sender_username: string;
  sender_role: string;
  message: string;
  image_url: string | null;
  is_from_superadmin: boolean;
  created_at: string;
}

interface SupportChatPanelProps {
  isSuperAdmin: boolean;
  onClose?: () => void;
  compact?: boolean;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const serverOrigin = apiBase.replace(/\/api\/?$/, '') || 'http://localhost:3001';

const SupportChatPanel: React.FC<SupportChatPanelProps> = ({ isSuperAdmin, onClose, compact }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const list = await apiService.get<SupportMessage[]>('/support-chat?limit=100');
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
    try {
      await apiService.post('/support-chat', { message: text });
      setInput('');
      fetchMessages();
    } catch {
      // silently fail
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
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`flex flex-col ${compact ? 'h-[400px]' : 'h-[500px]'} bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold">{isSuperAdmin ? 'Support Inbox' : 'Support Chat'}</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-slate-400">Loading...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No messages yet.</p>
            <p className="text-sm mt-1">{isSuperAdmin ? 'Messages from schools will appear here.' : 'Start a conversation with support.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.is_from_superadmin ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.is_from_superadmin
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}
                >
                  {!m.is_from_superadmin && (
                    <p className="text-xs font-medium text-indigo-600 mb-1">
                      {m.tenant_name || 'School'} • {m.sender_username}
                    </p>
                  )}
                  {m.image_url && (
                    <a href={`${serverOrigin}${m.image_url}`} target="_blank" rel="noopener noreferrer" className="block mb-2">
                      <img src={`${serverOrigin}${m.image_url}`} alt="Attached" className="max-w-full max-h-48 rounded-lg object-cover" />
                    </a>
                  )}
                  {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                  <p className={`text-[10px] mt-1 ${m.is_from_superadmin ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>
      <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <ImagePlus className="w-4 h-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={sending}
        />
        <Button type="submit" size="icon" className="shrink-0 bg-indigo-600 hover:bg-indigo-700" disabled={sending || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};

export default SupportChatPanel;
