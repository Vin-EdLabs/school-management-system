import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Globe, School, User as UserIcon, MessageSquare, 
  Info, Lock, Reply, Trash, CornerDownRight, MessageCircle, 
  Shield, Plus, Search, Settings, Hash, Bell, LogOut, MoreVertical,
  ChevronDown, Archive, HelpCircle, Edit3, ImageIcon, Smile, AtSign, CheckCheck,
  Paperclip, FileText, Image as ImageIco, Loader2, Mic, StopCircle, 
  Play, Pause, SendHorizontal, Trash2
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Reaction {
  emoji: string;
  count: number;
  me_reacted: boolean;
}

interface Message {
  id: number;
  tenant_id: number | null;
  tenant_name: string;
  user_id: number;
  sender_id?: number;
  username: string;
  full_name: string;
  sender_name?: string;
  role: string;
  content: string;
  channel: string;
  created_at: string;
  reply_to_id?: number;
  parent_content?: string;
  parent_name?: string;
  reactions?: Reaction[];
  media_url?: string;
}

const GlobalChatPage: React.FC = () => {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState('general');
  const [viewMode, setViewMode] = useState<'channels' | 'private'>('channels');
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Search/Filters
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  
  // Mentions
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  // New Chat Search Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const inputEmojis = ['😀', '😂', '😍', '👍', '🙏', '🔥', '👏', '🎉', '💡', '✅'];

  // Channels
  const channels = [
    { id: 'general', label: 'General Exchange' },
    { id: 'teachers', label: 'Staff Room' },
    { id: 'financial', label: 'Financial Hub' },
    { id: 'admin', label: 'Institutional Node' },
  ];

  const availableChannels = channels.filter(c => !c.id.includes('admin') || user?.role === 'super-admin' || user?.role === 'administrator');

  // Filtered lists
  const filteredChannels = availableChannels.filter(c => 
    c.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );
  
  const filteredConversations = conversations.filter(conv => 
    conv.other_full_name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  const displayedMessages = messages.filter(m => 
    (m.content?.toLowerCase() || '').includes(messageSearchQuery.toLowerCase())
  );

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await apiService.get<any[]>('/conversations');
      setConversations(res || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const path = viewMode === 'channels' 
      ? `/global-chat?channel=${activeChannel}` 
      : activeConversation ? `/conversations/${activeConversation.id}/messages` : null;

    if (path) {
      setMessages([]);
      setLoading(true);
      apiService.get<any[]>(path)
        .then(res => {
          const formatted = viewMode === 'private' 
            ? res.map(m => ({ ...m, full_name: m.sender_name, user_id: m.sender_id, channel: 'private' }))
            : res;
          setMessages(formatted || []);
        })
        .finally(() => setLoading(false))
        .catch(console.error);
    }
    
    if (socket && viewMode === 'channels') {
       socket.emit('join-channel', activeChannel);
    }
  }, [activeChannel, viewMode, activeConversation, socket]);

  useEffect(() => {
    if (socket) {
      const handleGlobal = (msg: Message) => {
        if (msg.channel === activeChannel) {
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        }
      };
      const handlePrivate = (msg: any) => {
        if (activeConversation && String(msg.conversation_id) === String(activeConversation.id)) {
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, full_name: msg.sender_name, user_id: msg.sender_id, channel: 'private' }]));
        }
        loadConversations();
      };
      const handleReaction = ({ id, reactions }: { id: any, reactions: Reaction[] }) => {
         setMessages(prev => prev.map(m => String(m.id) === String(id) ? { ...m, reactions } : m));
      };

      socket.on('new-global-message', handleGlobal);
      socket.on('new-private-message', handlePrivate);
      socket.on('message-reacted', handleReaction);
      socket.on('message-deleted', ({ id }) => {
         setMessages(prev => prev.filter(m => String(m.id) !== String(id)));
      });

      return () => { 
        socket.off('new-global-message'); 
        socket.off('new-private-message');
        socket.off('message-reacted');
        socket.off('message-deleted');
      };
    }
  }, [socket, activeChannel, activeConversation]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Audio Logic
  const startRecording = async () => {
     try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
           if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
           const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
           const file = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
           sendMediaMessage(file);
           stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
     } catch (err) {
        console.error('Audio access denied:', err);
     }
  };

  const stopRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
     }
  };

  const cancelRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.onstop = () => {}; // No-op to prevent sending
        setIsRecording(false);
        clearInterval(timerRef.current);
     }
  };

  const sendMediaMessage = async (file: File) => {
    setUploading(true);
    try {
       const url = '/global-chat/upload';
       const res: any = await apiService.uploadFile(url, file, 'media');
       
       if (viewMode === 'channels') {
          await apiService.post('/global-chat', { content: '', channel: activeChannel, media_url: res.media_url });
       } else if (activeConversation) {
          await apiService.post(`/conversations/${activeConversation.id}/messages`, { content: '', media_url: res.media_url });
       }
    } catch (err) {
       console.error(err);
    } finally {
       setUploading(false);
    }
  };

  // Mentions Engine
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    const words = val.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord?.startsWith('@')) {
      const queryStr = lastWord.substring(1);
      setMentionQuery(queryStr);
      setShowMentions(true);
      apiService.get<any[]>(`/global-chat/mentions?query=${queryStr}&channel=${activeChannel}`)
        .then(setMentionSuggestions)
        .catch(console.error);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (mention: any) => {
    const words = newMessage.split(' ');
    words.pop();
    const label = mention.label.replace(/\s+/g, '');
    setNewMessage([...words, `@${label}`].join(' ') + ' ');
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
     setNewMessage(prev => prev + emoji);
     setShowEmojiPicker(false);
     inputRef.current?.focus();
  };

  const renderMessageContent = (content: string) => {
     if (!content) return null;
     let parts = content.split(/(@\w+)/g);
     return parts.map((part, i) => {
        if (part.startsWith('@')) {
           return <span key={i} className="font-semibold text-[#007bfc] cursor-pointer hover:underline">{part}</span>;
        }
        if (messageSearchQuery && part.toLowerCase().includes(messageSearchQuery.toLowerCase())) {
           const subParts = part.split(new RegExp(`(${messageSearchQuery})`, 'gi'));
           return subParts.map((subPart, j) => 
              subPart.toLowerCase() === messageSearchQuery.toLowerCase() 
              ? <mark key={`${i}-${j}`} className="bg-yellow-200 text-slate-900 rounded px-0.5">{subPart}</mark> 
              : subPart
           );
        }
        return part;
     });
  };

  const handleReact = async (msgId: number, emoji: string) => {
    try {
       const url = viewMode === 'channels' 
          ? `/global-chat/${msgId}/react` 
          : `/conversations/${activeConversation.id}/messages/${msgId}/react`;
       
       const updated = await apiService.post<Reaction[]>(url, { emoji });
       setMessages(prev => prev.map(m => String(m.id) === String(msgId) ? { ...m, reactions: updated } : m));
       setOpenReactionPickerId(null);
    } catch (e) {
       console.error(e);
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q) return setSearchResults([]);
    try {
      const res = await apiService.get<any[]>(`/global-chat/mentions?query=${q}`);
      setSearchResults(res.filter(r => r.type === 'user'));
    } catch (e) {
      console.error(e);
    }
  };

  const startPrivateChat = async (targetUserId: number, name: string) => {
    try {
       const convo: any = await apiService.post('/conversations', { targetUserId });
       setActiveConversation({ ...convo, other_full_name: name });
       setViewMode('private');
       setShowSearchModal(false);
       loadConversations();
    } catch (e) {
       console.error(e);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !uploading) || loading) return;
    const content = newMessage.trim();
    const parentId = replyingTo?.id;
    setNewMessage('');
    setReplyingTo(null);
    try {
      if (viewMode === 'channels') {
        await apiService.post('/global-chat', { content, channel: activeChannel, reply_to_id: parentId });
      } else if (activeConversation) {
        await apiService.post(`/conversations/${activeConversation.id}/messages`, { content, reply_to_id: parentId });
      }
    } catch (e) {
      setNewMessage(content);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
       await apiService.delete(`/global-chat/${msgId}`);
       setMessages(prev => prev.filter(m => m.id !== msgId));
       setOpenActionId(null);
    } catch (e) {
       console.error(e);
    }
  };

  const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="h-screen w-full flex bg-[#f0f2f5] overflow-hidden text-[#111b21] font-sans selection:bg-[#00a884]/10">
      
      {/* 1. LEFT SIDEBAR */}
      <div className="w-[360px] flex flex-col bg-white border-r border-[#dadde1] z-[120]">
        <div className="p-8 pb-4 bg-[#f0f2f5]/50 border-b border-[#dadde1]">
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-lg shadow-[#00a884]/20 transition-transform active:scale-95 cursor-pointer">
                <MessageSquare className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-[17px] font-bold text-[#111b21] leading-none tracking-tight">Chat Federation</h1>
                <p className="text-[10px] text-[#00a884] font-semibold uppercase tracking-widest mt-2">{user?.role} Access</p>
             </div>
             <div 
               className="ml-auto w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer transition-all active:scale-90"
               onClick={() => setShowSearchModal(true)}
             >
                <Plus className="w-5 h-5" />
             </div>
          </div>

          <div className="relative group mb-6">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors" />
             <input 
               type="text" 
               placeholder="Filter threads..."
               className="w-full bg-white border border-[#f0f2f5] py-2.5 pl-12 pr-4 rounded-xl text-[14px] outline-none shadow-sm focus:border-[#00a884]/20 font-medium placeholder:italic transition-all"
               value={sidebarSearchQuery}
               onChange={(e) => setSidebarSearchQuery(e.target.value)}
             />
             {sidebarSearchQuery && (
               <X 
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 hover:text-slate-500 cursor-pointer" 
                  onClick={() => setSidebarSearchQuery('')}
               />
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-6 space-y-1 scrollbar-hide">
           <div>
              <p className="px-6 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#00a884] mb-8 opacity-50">Authorized Nodes</p>
              {filteredChannels.length === 0 ? (
                <p className="px-10 text-[11px] text-slate-300 italic">No nodes match your filter</p>
              ) : (
                filteredChannels.map(ch => (
                  <button 
                    key={ch.id}
                    onClick={() => { setViewMode('channels'); setActiveChannel(ch.id); setSidebarSearchQuery(''); }}
                    className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 group ${
                      viewMode === 'channels' && activeChannel === ch.id 
                      ? 'bg-[#f0f2f5] text-[#00a884]' 
                      : 'hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-transparent transition-all ${viewMode === 'channels' && activeChannel === ch.id ? 'bg-[#00a884] text-white shadow-xl shadow-[#00a884]/20' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:border-slate-100'}`}>
                        <Hash className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[15px] font-semibold truncate leading-none tracking-tight">{ch.label}</span>
                        <span className="text-[11px] text-slate-400 mt-1.5 opacity-60 font-semibold uppercase tracking-widest leading-none">Channel Network</span>
                      </div>
                  </button>
                ))
              )}
           </div>

           <div className="h-px bg-slate-100 my-10 mx-8" />

           <div>
              <p className="px-6 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#00a884] mb-8 opacity-50">Private Channels</p>
              {filteredConversations.length === 0 ? (
                <div className="px-10 py-4 text-center text-slate-200 uppercase text-[11px]">No active transmissions</div>
              ) : (
                filteredConversations.map(conv => (
                  <button 
                      key={conv.id}
                      onClick={() => { setViewMode('private'); setActiveConversation(conv); setSidebarSearchQuery(''); }}
                      className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 ${
                        viewMode === 'private' && activeConversation?.id === conv.id 
                        ? 'bg-[#f0f2f5] text-[#00a884]' 
                        : 'hover:bg-slate-50 text-slate-500'
                      }`}
                  >
                      <div className="w-11 h-11 rounded-2xl bg-white border border-[#dadde1] overflow-hidden shadow-sm flex items-center justify-center font-semibold text-[#111b21] uppercase text-[12px] group">
                        {conv.other_full_name.substring(0, 1)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[15px] font-semibold truncate tracking-tight">{conv.other_full_name}</span>
                        <span className="text-[11px] text-slate-400 mt-1 leading-none opacity-60 font-semibold uppercase tracking-widest">Secure Uplink</span>
                      </div>
                  </button>
                ))
              )}
           </div>
        </div>

        <div className="p-8 border-t border-[#dadde1] bg-[#f0f2f5]/50 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-white border border-[#dadde1] shadow-md flex items-center justify-center font-semibold text-[#00a884] uppercase text-[12px] relative transition-transform active:scale-95 cursor-pointer">
                 {user?.fullName?.substring(0, 1)}
                 <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold uppercase tracking-tight text-[#111b21] leading-none">{user?.fullName?.split(' ')[0]}</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 mt-1.5 leading-none">{user?.role}</span>
              </div>
           </div>
           <div className="flex items-center gap-6">
              <div onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:bg-white hover:text-red-500 cursor-pointer transition-all">
                  <LogOut className="w-5 h-5 translate-x-[-1px]" />
              </div>
              <Settings className="w-5 h-5 text-slate-300 hover:text-slate-500 cursor-pointer transition-colors" />
           </div>
        </div>
      </div>

      {/* 2. CHAT WORKSPACE */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />

        {/* Header */}
        <div className="h-[72px] px-10 flex items-center justify-between bg-[#f0f2f5] border-b border-[#dadde1] sticky top-0 z-[100] shadow-sm">
           <div className="flex items-center gap-5">
              <div className="w-11 h-11 rounded-full bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center font-semibold text-[#00a884] uppercase text-[12px]">
                {viewMode === 'channels' ? <Hash className="w-6 h-6" /> : activeConversation?.other_full_name.substring(0, 1)}
              </div>
              {!isMessageSearchOpen ? (
                <div className="flex flex-col">
                  <h3 className="text-[16px] font-bold text-[#111b21] leading-none tracking-tight">
                    {viewMode === 'channels' ? availableChannels.find(c => c.id === activeChannel)?.label : activeConversation?.other_full_name}
                  </h3>
                  <span className="text-[10px] font-semibold text-[#00a884] uppercase tracking-widest mt-1.5 opacity-60 leading-none">Security Encryption Protocol: Omega</span>
                </div>
              ) : (
                <div className="flex-1 max-w-sm ml-6 relative group animate-in slide-in-from-right-4 duration-300">
                   <input 
                      type="text" 
                      placeholder="Search messages..."
                      className="w-full bg-white border border-[#dadde1] py-2 px-10 rounded-full text-[14px] font-medium outline-none shadow-sm focus:border-[#00a884]/30"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      autoFocus
                   />
                   <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#00a884]" />
                   <X 
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 hover:text-red-500 cursor-pointer" 
                      onClick={() => { setIsMessageSearchOpen(false); setMessageSearchQuery(''); }}
                   />
                </div>
              )}
           </div>
           {!isMessageSearchOpen && (
              <div className="flex items-center gap-8">
                 <Search className="w-5 h-5 text-slate-500 hover:text-[#00a884] cursor-pointer" onClick={() => setIsMessageSearchOpen(true)} />
                 <MoreVertical className="w-5 h-5 text-slate-500 hover:text-[#00a884] cursor-pointer" />
              </div>
           )}
        </div>

        {/* Message Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-12 py-10 space-y-12 z-10 scrollbar-hide">
          {displayedMessages.map((msg, i) => {
            const isMe = msg.user_id === user?.id;
            const isOpen = openActionId === msg.id;
            const isPickerOpen = openReactionPickerId === msg.id;

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-700 group relative`}>
                <div className={`relative px-4 py-3 rounded-xl text-[14.5px] leading-relaxed shadow-md min-w-[80px] max-w-[68%] transition-all duration-300 ${
                  isMe ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none' : 'bg-white text-[#111b21] rounded-tl-none'
                }`}>
                  
                  <div className={`absolute top-0 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white rounded-full shadow-2xl z-30 cursor-pointer border border-slate-50 ${isMe ? 'right-full mr-4' : 'left-full ml-4'}`}>
                    <Smile className="w-4 h-4 text-slate-400 hover:text-amber-500" onClick={(e) => { e.stopPropagation(); setOpenReactionPickerId(isPickerOpen ? null : msg.id); }} />
                  </div>

                  {isPickerOpen && (
                    <div className={`absolute bottom-full mb-4 bg-white shadow-2xl rounded-full px-5 py-3 flex gap-4 z-[400] animate-in zoom-in-75 duration-200 border border-slate-100 ${isMe ? 'right-0' : 'left-0'}`}>
                      {commonEmojis.map(emoji => (
                        <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="text-xl transform hover:scale-150 active:scale-95 transition-transform">{emoji}</button>
                      ))}
                    </div>
                  )}

                  {viewMode === 'channels' && !isMe && <div className="text-[12px] font-semibold text-[#00a884] mb-1.5 uppercase tracking-tight opacity-90">{msg.full_name}</div>}

                  {msg.reply_to_id && (
                    <div className="mb-3 pl-4 border-l-4 py-2.5 pr-4 rounded-lg text-[13px] bg-black/5 border-[#00a884] border-opacity-40">
                       <div className="font-semibold text-[#00a884] text-[11px] mb-1 tracking-tighter uppercase opacity-80">{msg.parent_name}</div>
                       <div className="truncate block opacity-60 text-[13px] font-medium leading-none">{msg.parent_content}</div>
                    </div>
                  )}

                  {/* MEDIA & AUDIO CONTENT */}
                  {msg.media_url && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-slate-50 bg-slate-50/30">
                       {msg.media_url.match(/\.(mp3|wav|ogg|webm)$/i) ? (
                         <div className="p-4 bg-white shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#00a884]/10 flex items-center justify-center text-[#00a884]">
                               <Mic className="w-5 h-5" />
                            </div>
                            <audio controls src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${msg.media_url}`} className="h-8 filter hue-rotate-[140deg]" />
                         </div>
                       ) : msg.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                         <img src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${msg.media_url}`} alt="Asset" className="w-full h-full object-cover" />
                       ) : (
                         <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${msg.media_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5">
                            <FileText className="w-8 h-8 text-[#00a884]" />
                            <div className="flex flex-col min-w-0">
                               <span className="text-[14px] font-bold text-[#111b21] truncate">{msg.media_url.split('/').pop()}</span>
                               <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1">Institutional Node Transmission</span>
                            </div>
                         </a>
                       )}
                    </div>
                  )}

                  <div className="pr-14 pb-2 whitespace-pre-wrap font-medium tracking-tight text-[#111b21]">{renderMessageContent(msg.content)}</div>

                  <div className="flex items-center justify-end gap-2 h-4 absolute bottom-2.5 right-3">
                    <span className="text-[10px] font-semibold text-slate-400 opacity-60 uppercase tracking-tighter">{format(new Date(msg.created_at), 'HH:mm')}</span>
                    {isMe && <CheckCheck className="w-4 h-4 text-[#53bdeb] opacity-80" />}
                    <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : msg.id); }} className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-black/5 flex items-center justify-center shrink-0">
                       <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {isOpen && (
                     <div className="absolute top-[80%] right-0 mt-2 w-48 bg-white shadow-2xl rounded-[24px] py-3 z-[300] border border-slate-50 animate-in zoom-in-95 overflow-hidden">
                        <button onClick={() => { setReplyingTo(msg); setOpenActionId(null); }} className="w-full text-left px-6 py-3.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-4 transition-colors"><Reply className="w-4 h-4 opacity-30" /> Reply</button>
                        {(isMe || user?.role === 'super-admin') && <button onClick={() => handleDeleteMessage(msg.id)} className="w-full text-left px-6 py-3.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 flex items-center gap-4 transition-colors"><Trash className="w-4 h-4 opacity-30" /> Delete Transmission</button>}
                     </div>
                  )}

                  {msg.reactions && msg.reactions.length > 0 && (
                     <div className={`absolute -bottom-4 z-[50] flex flex-wrap gap-1 ${isMe ? 'right-4' : 'left-4'} animate-in slide-in-from-top-2`}>
                        {msg.reactions.map(r => (
                          <button key={r.emoji} onClick={() => handleReact(msg.id, r.emoji)} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm transition-all border ${r.me_reacted ? 'bg-[#d9fdd3] border-[#00a884]/30 text-[#00a884]' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                            <span>{r.emoji}</span><span className="text-[10px] opacity-80">{r.count}</span>
                          </button>
                        ))}
                     </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Hub - Footer */}
        <div className="p-0 bg-[#f0f2f5] min-h-[80px] flex items-center px-10 gap-8 z-[200] shrink-0 border-t border-[#dadde1] py-4">
           {isRecording ? (
             <div className="flex-1 flex items-center justify-between bg-white px-10 py-4 rounded-[28px] shadow-sm animate-in slide-in-from-bottom-6 duration-400">
                <div className="flex items-center gap-6">
                   <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                   <span className="text-[14px] font-bold text-slate-400 tracking-widest uppercase">{formatTime(recordingTime)}</span>
                   <div className="w-px h-6 bg-slate-100 ml-4" />
                   <p className="text-[12px] font-bold text-slate-300 uppercase tracking-widest italic ml-4">Capturing Institutional Signal...</p>
                </div>
                <div className="flex items-center gap-8">
                   <button onClick={cancelRecording} className="text-slate-400 hover:text-red-500 transition-colors uppercase text-[10px] font-bold tracking-[0.2em]">Discard</button>
                   <button onClick={stopRecording} className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-lg shadow-[#00a884]/20 active:scale-90 transition-all"><SendHorizontal className="w-6 h-6" /></button>
                </div>
             </div>
           ) : (
             <>
               <div className="flex items-center gap-6 relative shrink-0">
                  <div className="relative">
                    <Smile className={`w-6 h-6 cursor-pointer transition-all active:scale-90 ${showEmojiPicker ? 'text-[#00a884] scale-110' : 'text-slate-500 hover:text-amber-500'}`} onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-6 left-0 bg-white shadow-2xl rounded-[28px] border border-slate-50 p-6 z-[500] animate-in slide-in-from-bottom-4 w-[240px]">
                         <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mb-4">Quick Symbols</p>
                         <div className="grid grid-cols-5 gap-3">
                            {inputEmojis.map(emoji => <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-2xl hover:scale-135 transition-transform">{emoji}</button>)}
                         </div>
                      </div>
                    )}
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-white border border-[#dadde1] text-slate-500 hover:text-[#00a884] hover:shadow-md cursor-pointer transition-all active:scale-95 shadow-sm flex items-center justify-center relative" onClick={() => fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#00a884]" /> : <Paperclip className="w-5 h-5" />}
                      <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && sendMediaMessage(e.target.files[0])} />
                  </div>
               </div>
               
               <div className="flex-1 relative flex items-center">
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-[80px] left-0 w-[400px] bg-white shadow-2xl rounded-[28px] border border-slate-50 py-5 z-[400] animate-in slide-in-from-bottom-6 overflow-hidden">
                       <div className="px-8 pb-4 mb-2 border-b border-slate-50 flex items-center justify-between"><p className="text-[10px] font-semibold text-[#00a884] opacity-60 tracking-[0.3em]">Channel Directives</p><Hash className="w-3.5 h-3.5 text-[#00a884] opacity-40" /></div>
                       <div className="max-h-[280px] overflow-y-auto scrollbar-hide py-2">
                          {mentionSuggestions.map((s, idx) => <button key={idx} onClick={() => insertMention(s)} className="w-full text-left px-8 py-4 hover:bg-slate-50 flex items-center gap-5 transition-all group border-l-4 border-transparent hover:border-[#00a884]"><div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-[10px] font-semibold text-slate-400 group-hover:bg-[#00a884] group-hover:text-white uppercase">{s.type === 'user' ? s.label.substring(0, 1) : s.type.substring(0, 1)}</div><div className="flex flex-col min-w-0"><span className="text-[14px] font-semibold text-[#111b21] truncate tracking-tight">{s.label}</span><div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-semibold text-slate-300 uppercase tracking-widest leading-none bg-slate-50 px-2 py-0.5 rounded-full">{s.type}</span>{s.school_name && <span className="text-[9px] font-semibold text-[#00a884] uppercase tracking-widest leading-none opacity-60">• {s.school_name}</span>}</div></div></button>)}
                       </div>
                    </div>
                  )}
                  {replyingTo && (
                     <div className="absolute bottom-[80px] left-0 right-0 py-6 px-10 bg-white border-t-4 border-[#00a884] flex items-center justify-between shadow-2xl z-[350]">
                        <div className="flex items-center gap-6 overflow-hidden"><Reply className="w-5 h-5 text-[#00a884] opacity-40 shrink-0" /><div className="flex flex-col min-w-0"><span className="text-[11px] font-semibold text-[#00a884] uppercase tracking-widest leading-none">Responding to {replyingTo.full_name}</span><span className="text-[14px] font-bold text-slate-400 truncate italic mt-2 opacity-80 leading-none">{replyingTo.content}</span></div></div>
                        <button onClick={() => setReplyingTo(null)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-50 active:scale-90 transition-all"><X className="w-6 h-6" /></button>
                     </div>
                  )}
                  <textarea ref={inputRef} value={newMessage} onChange={handleInputChange} className="w-full bg-white border-none py-4 px-8 rounded-[24px] text-[15px] font-medium outline-none shadow-sm transition-all focus:shadow-md placeholder:italic leading-relaxed" placeholder={uploading ? "Uploading..." : "Institutional transmission..."} rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
               </div>

               <div className="flex items-center gap-4 shrink-0 transition-all duration-300">
                  {newMessage.trim() || uploading ? (
                    <button onClick={handleSendMessage} disabled={loading} className="w-14 h-14 flex items-center justify-center rounded-full text-[#00a884] bg-white border border-slate-100 shadow-lg active:scale-90 transition-all hover:shadow-[#00a884]/10"><SendHorizontal className="w-7 h-7" /></button>
                  ) : (
                    <button onClick={startRecording} className="w-14 h-14 flex items-center justify-center rounded-full text-slate-400 hover:text-[#00a884] hover:bg-white transition-all active:scale-95"><Mic className="w-7 h-7" /></button>
                  )}
               </div>
             </>
           )}
        </div>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[900] flex items-center justify-center p-8 animate-in fade-in">
           <div className="bg-white w-full max-w-[560px] rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
              <div className="p-12 pb-8 border-b border-slate-50 flex items-center justify-between"><div className="flex flex-col"><h2 className="text-[24px] font-bold text-[#111b21] tracking-tight leading-none uppercase">Broadcast Link</h2><span className="text-[11px] font-semibold text-[#00a884] uppercase tracking-widest mt-2 ml-1">Initiating secure session</span></div><button onClick={() => setShowSearchModal(false)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-50 active:scale-90 transition-all"><X className="w-7 h-7" /></button></div>
              <div className="p-10"><div className="relative group"><Search className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-200 group-focus-within:text-[#00a884]" /><input type="text" placeholder="Search colleague globally..." className="w-full bg-slate-50 py-6 pl-20 pr-10 rounded-3xl text-[17px] font-medium outline-none focus:bg-white border-2 border-transparent focus:border-[#00a884]/10 transition-all" value={searchQuery} onChange={(e) => handleSearchUsers(e.target.value)} autoFocus /></div></div>
              <div className="flex-1 overflow-y-auto px-8 pb-12 space-y-3 scrollbar-hide">
                 {searchResults.length === 0 ? <div className="h-full flex flex-col items-center justify-center py-20 text-slate-100 uppercase"><Globe className="w-24 h-24 opacity-10 animate-pulse" /><p className="text-[14px] font-bold tracking-[0.6em] mt-10">Searching Signal</p></div> : searchResults.map(res => <button key={res.id} onClick={() => startPrivateChat(res.id, res.label)} className="w-full text-left p-8 rounded-[32px] hover:bg-slate-50 flex items-center gap-8 group transition-all"><div className="w-14 h-14 rounded-3xl bg-[#00a884] flex items-center justify-center text-white text-[16px] font-bold shadow-xl shadow-[#00a884]/20 group-hover:scale-110 group-hover:rotate-6 transition-transform">{res.label.substring(0, 1)}</div><div className="flex flex-col min-w-0"><div className="flex items-center gap-3"><span className="text-[18px] font-bold text-[#111b21] tracking-tight">{res.label}</span><span className="text-[9px] font-semibold uppercase text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-full tracking-widest">{res.role}</span></div><span className="text-[12px] font-semibold uppercase text-slate-400 tracking-widest mt-2">{res.school_name || 'Autonomous Node'} Member</span></div><div className="ml-auto w-12 h-12 rounded-full border-2 border-slate-50 flex items-center justify-center text-slate-200 group-hover:border-[#00a884] transition-all"><div className="w-2 h-2 bg-current rounded-full" /></div></button>)}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GlobalChatPage;
