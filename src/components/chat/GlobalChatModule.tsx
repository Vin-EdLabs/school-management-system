import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Globe, School, User as UserIcon, MessageSquare, Info, Lock, Reply, Trash, CornerDownRight, MessageCircle, Shield, Plus, Search } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { format } from 'date-fns';

interface Message {
  id: number;
  tenant_id: number | null;
  tenant_name: string;
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  content: string;
  channel: string;
  created_at: string;
  reply_to_id?: number;
  parent_content?: string;
  parent_name?: string;
}

interface GlobalChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalChatOverlay: React.FC<GlobalChatOverlayProps> = ({ isOpen, onClose }) => {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState('general');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<'channels' | 'private'>('channels');
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Define channels
  const channels = [
    { id: 'general', label: 'General Exchange' },
    { id: 'teachers', label: 'Faculty Hub', roles: ['teacher', 'administrator', 'super-admin', 'principal'] },
    { id: 'financial', label: 'Finance Channel', roles: ['finance', 'administrator', 'super-admin', 'principal'] },
    { id: 'admin', label: 'Security Node', roles: ['administrator', 'super-admin', 'principal'] },
  ];

  const availableChannels = channels.filter(c => !c.roles || c.roles.includes(user?.role || ''));

  // Logic: Fetch conversations
  useEffect(() => {
    if (isOpen) {
      apiService.get<any[]>('/conversations')
        .then(setConversations)
        .catch(console.error);
    }
  }, [isOpen]);

  // Logic: Fetch messages
  useEffect(() => {
    if (isOpen) {
      const path = viewMode === 'channels' 
        ? `/global-chat?channel=${activeChannel}` 
        : activeConversation ? `/conversations/${activeConversation.id}/messages` : null;

      if (path) {
        setMessages([]);
        apiService.get<any[]>(path)
          .then(res => {
            const formatted = viewMode === 'private' 
              ? res.map(m => ({ ...m, full_name: m.sender_name, channel: 'private' }))
              : res;
            setMessages(formatted);
          })
          .catch(console.error);
      }
    }
  }, [isOpen, activeChannel, viewMode, activeConversation]);

  // Logic: Socket listeners
  useEffect(() => {
    if (socket) {
      const handleMessage = (msg: Message) => {
        if (msg.channel === activeChannel) {
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        }
      };
      socket.on('new-global-message', handleMessage);
      return () => { socket.off('new-global-message', handleMessage); };
    }
  }, [socket, activeChannel]);

  // Logic: Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  // Logic: Mention handling
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    const cursor = e.target.selectionStart;
    const lastAt = val.substring(0, cursor).lastIndexOf('@');
    if (lastAt !== -1 && !val.substring(lastAt, cursor).includes(' ')) {
      setMentionQuery(val.substring(lastAt + 1, cursor));
    } else {
      setMentionQuery(null);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || loading) return;
    const content = newMessage.trim();
    setNewMessage('');
    setReplyingTo(null);
    setLoading(true);
    try {
      if (viewMode === 'channels') {
        await apiService.post('/global-chat', { content, channel: activeChannel, reply_to_id: replyingTo?.id });
      } else if (activeConversation) {
        await apiService.post(`/conversations/${activeConversation.id}/messages`, { content, reply_to_id: replyingTo?.id });
      }
    } catch (e) {
      setNewMessage(content);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-12 animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl h-full max-h-[850px] bg-white shadow-[0_32px_120px_-20px_rgba(0,0,0,0.15)] flex overflow-hidden animate-in slide-in-from-bottom-8 duration-700 md:rounded-[40px] border border-white/20">
        
        {/* Minimal Side Navigation (280px) */}
        <div className="w-[300px] flex flex-col bg-slate-50/50 border-r border-slate-100 shrink-0">
          
          <div className="p-8 pb-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-400">Institutional Exchange</h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white transition-colors text-slate-300 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search federation..."
                className="w-full bg-white border border-slate-100 py-3 pl-11 pr-4 rounded-2xl text-[13px] outline-none transition-all focus:ring-4 focus:ring-blue-50 focus:border-blue-200 placeholder:text-slate-300 font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-10 scrollbar-hide">
            
            {/* Rooms Section */}
            <div className="space-y-1">
              {availableChannels.map(ch => (
                <button 
                  key={ch.id}
                  onClick={() => { setViewMode('channels'); setActiveChannel(ch.id); }}
                  className={`w-full text-left px-5 py-4 rounded-3xl transition-all flex items-center justify-between group ${
                    viewMode === 'channels' && activeChannel === ch.id 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' 
                    : 'hover:bg-white text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span className="text-[13px] font-bold tracking-tight">{ch.label}</span>
                  <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                    viewMode === 'channels' && activeChannel === ch.id ? 'bg-white' : 'bg-slate-200 group-hover:bg-blue-300'
                  }`} />
                </button>
              ))}
            </div>

            {/* Direct Section */}
            <div className="space-y-4">
              <div className="px-5 flex items-center justify-between">
                <span className="text-[9px] font-black tracking-widest uppercase text-slate-300">Connections</span>
                <button className="text-slate-300 hover:text-blue-500 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="space-y-1">
                {conversations.length === 0 ? (
                  <div className="px-5 py-4 text-[11px] text-slate-300 font-medium italic opacity-60">No active sessions</div>
                ) : (
                  conversations.map(conv => (
                    <button 
                      key={conv.id}
                      onClick={() => { setViewMode('private'); setActiveConversation(conv); }}
                      className={`w-full text-left px-5 py-4 rounded-3xl transition-all flex items-center gap-4 ${
                        viewMode === 'private' && activeConversation?.id === conv.id 
                        ? 'bg-white border-2 border-blue-600 text-slate-900 shadow-sm' 
                        : 'hover:bg-white text-slate-500'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-2xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase">
                        {conv.other_full_name.substring(0, 1)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-bold truncate leading-tight tracking-tight">{conv.other_full_name}</span>
                        <span className="text-[10px] text-slate-300 uppercase font-bold tracking-tighter truncate leading-tight mt-0.5">{conv.school_name || 'System'}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Profile Quick Action */}
          <div className="p-8 border-t border-slate-100 bg-white/40 flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center font-black text-[12px] text-blue-600">
               {user?.fullName?.substring(0, 1)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-black text-slate-800 truncate uppercase mt-0.5">{user?.fullName}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* Minimalist Message Workspace */}
        <div className="flex-1 flex flex-col bg-white relative">
          
          <div className="h-[96px] px-12 flex items-center justify-between border-b border-slate-50 bg-white/80 backdrop-blur-sm sticky top-0 z-[110]">
             <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                   {viewMode === 'channels' ? `#${activeChannel}` : activeConversation?.other_full_name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Secured Institutional Node</span>
                </div>
             </div>
             <div className="flex items-center gap-6">
                <Info className="w-4.5 h-4.5 text-slate-200 hover:text-slate-400 cursor-pointer transition-colors" />
             </div>
          </div>

          {/* Feed Workspace */}
          <div 
            ref={scrollRef}
            className="flex-1 p-12 py-8 overflow-y-auto scrollbar-hide space-y-12"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-6 opacity-40">
                <Globe className="w-16 h-16" />
                <p className="text-[11px] font-black uppercase tracking-[0.5em]">Static Transmission Locked</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === user?.id;
                const prev = i > 0 ? messages[i-1] : null;
                const showHeader = !isMe && prev?.user_id !== msg.user_id;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group transition-all`}>
                    {showHeader && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-4 pl-1">
                        {msg.full_name} • <span className="opacity-40">{msg.tenant_name}</span>
                      </span>
                    )}
                    
                    <div className={`relative max-w-[70%] text-[15px] space-y-3`}>
                        {msg.reply_to_id && (
                          <div className={`text-[12px] opacity-40 mb-2 flex items-center gap-2 italic leading-none`}>
                             <CornerDownRight className="w-3 h-3" />
                             <span>In response to {msg.parent_name}</span>
                          </div>
                        )}
                        <p className={`leading-relaxed tracking-tight ${isMe ? 'text-slate-900 border-l-2 border-blue-600 pl-4 py-1' : 'text-slate-600'}`}>
                           {msg.content}
                        </p>
                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">{format(new Date(msg.created_at), 'HH:mm')}</span>
                           <button onClick={() => setReplyingTo(msg)} className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">Reply</button>
                           {viewMode === 'channels' && !isMe && (
                             <button onClick={() => setViewMode('private')} className="text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:underline">Direct</button>
                           )}
                        </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Minimal Form Hub */}
          <div className="p-12 pt-0 bg-white">
            {replyingTo && (
               <div className="mb-6 flex items-center justify-between bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                     <Reply className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[12px] text-slate-400 font-medium truncate italic leading-none">Replying to {replyingTo.full_name}: "{replyingTo.content}"</span>
                  </div>
                  <X className="w-4 h-4 text-slate-300 hover:text-slate-900 cursor-pointer transition-colors" onClick={() => setReplyingTo(null)} />
               </div>
            )}
            
            <div className="relative">
              <textarea 
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                className="w-full bg-slate-50 border border-slate-100 rounded-[32px] px-8 py-6 text-[15px] outline-none transition-all focus:bg-white focus:ring-8 focus:ring-slate-50 focus:border-slate-200 resize-none max-h-48 scrollbar-hide font-medium placeholder:text-slate-300 pr-20"
                placeholder={viewMode === 'channels' ? `Message #${activeChannel}...` : `Send direct message...`}
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || loading}
                className={`absolute right-4 top-4 w-12 h-12 rounded-3xl flex items-center justify-center transition-all ${
                  newMessage.trim() ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-slate-200 text-slate-100'
                }`}
              >
                <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5 rotate-[-5deg]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalChatOverlay;
