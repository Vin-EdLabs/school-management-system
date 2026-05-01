import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Send, User, Bot, ImagePlus, CheckCheck, Loader2, MessageCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

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
}

const SupportChatWindow: React.FC<SupportChatWindowProps> = ({ tenantId, tenantName, isSuperAdmin = false }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    try {
      const endpoint = isSuperAdmin && tenantId ? `/support-chat?tenantId=${tenantId}` : '/support-chat';
      const data = await apiService.get<Message[]>(endpoint);
      setMessages(data);
      setLoading(false);
      
      // If super-admin, mark as read
      if (isSuperAdmin && tenantId) {
        await apiService.post('/support-chat/mark-read', { tenantId });
      }
    } catch (error) {
      console.error('Failed to fetch support messages:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [tenantId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      // For tenant: match their school
      // For super-admin: match the active tenantId in the window
      if (isSuperAdmin) {
         if (msg.tenant_id === tenantId) {
           setMessages(prev => [...prev, msg]);
           apiService.post('/support-chat/mark-read', { ids: [msg.id] }).catch(() => {});
         }
      } else {
         setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new-support-message', handleNewMessage);
    return () => {
      socket.off('new-support-message', handleNewMessage);
    };
  }, [socket, tenantId, isSuperAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || sending) return;

    setSending(true);
    try {
      const res = await apiService.post<Message>('/support-chat', {
        message: inputValue,
        tenantId: isSuperAdmin ? tenantId : undefined
      });
      setMessages(prev => [...prev, res]);
      setInputValue('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be under 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (isSuperAdmin && tenantId) formData.append('tenantId', tenantId.toString());

      const token = localStorage.getItem('authToken');
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${base}/support-chat/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const res = await response.json();
      setMessages(prev => [...prev, res]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload image', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-slate-500 font-medium">Loading conversation...</p>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col border-0 shadow-none bg-transparent overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                {isSuperAdmin ? (tenantName || 'School Support') : 'SCHOLARNERVE Support'}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500 font-medium">Always Online</span>
              </div>
            </div>
          </div>
          {isSuperAdmin && (
             <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-bold uppercase tracking-widest text-[9px]">
               School ID: {tenantId}
             </Badge>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="py-6 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
              <MessageCircle className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">Support Chat Initialized</p>
              <p className="text-xs text-slate-500 max-w-[240px]">
                {isSuperAdmin 
                  ? `You are chatting with the administrators of ${tenantName}.` 
                  : 'How can we help you today? Our team is ready to assist you.'}
              </p>
            </div>
            <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200 text-slate-400 font-medium">
              End-to-end encrypted
            </Badge>
          </div>

          {messages.map((msg, i) => {
            const isMe = (isSuperAdmin && msg.is_from_superadmin) || (!isSuperAdmin && !msg.is_from_superadmin);
            const showAvatar = i === 0 || messages[i-1].is_from_superadmin !== msg.is_from_superadmin;

            return (
              <div key={msg.id} className={cn("flex w-full gap-3 animate-in fade-in slide-in-from-bottom-2", isMe ? "flex-row-reverse" : "flex-row")}>
                {!isMe && showAvatar && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 mt-1">
                    {msg.is_from_superadmin ? <Bot className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-slate-600" />}
                  </div>
                )}
                {!showAvatar && <div className="w-8 shrink-0" />}

                <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                  {showAvatar && (
                    <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider px-1">
                      {msg.sender_username} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div className={cn(
                    "p-3.5 rounded-2xl shadow-sm border",
                    isMe 
                      ? "bg-indigo-600 border-indigo-500 text-white rounded-tr-none" 
                      : "bg-white border-slate-100 text-slate-800 rounded-tl-none"
                  )}>
                    {msg.image_url ? (
                      <div className="space-y-2">
                        <img src={msg.image_url} alt="Uploaded" className="rounded-xl max-w-full cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.image_url!, '_blank')} />
                        {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                    )}
                  </div>
                  {isMe && i === messages.length - 1 && msg.read_at && (
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <CheckCheck className="w-3 h-3 text-indigo-500" />
                      <span className="text-[9px] font-bold text-indigo-500 uppercase">Read</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-6 bg-white/50 backdrop-blur-sm border-t border-slate-100 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          </Button>

          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="pr-12 h-12 bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-transform active:scale-95 disabled:opacity-50"
                disabled={!inputValue.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </form>
        <p className="mt-3 text-[10px] text-center text-slate-400 font-medium">
          Press Enter to send message. Attachments up to 2MB supported.
        </p>
      </div>
    </Card>
  );
};

export default SupportChatWindow;
