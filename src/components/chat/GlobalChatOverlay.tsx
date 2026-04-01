import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Globe, School, User as UserIcon, MessageSquare, Info, Lock } from 'lucide-react';
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
}

interface GlobalChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onboardingStep: number;
  onNextOnboarding: () => void;
}

const GlobalChatOverlay: React.FC<GlobalChatOverlayProps> = ({ 
  isOpen, 
  onClose, 
  onboardingStep, 
  onNextOnboarding 
}) => {
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

  // Define available channels based on role
  const channels = [
    { id: 'general', label: 'General', icon: <Globe className="w-4 h-4" /> },
    { id: 'teachers', label: 'Teachers', icon: <School className="w-4 h-4" />, roles: ['teacher', 'administrator', 'super-admin', 'principal'] },
    { id: 'financial', label: 'Financial', icon: <Lock className="w-4 h-4" />, roles: ['finance', 'administrator', 'super-admin', 'principal'] },
    { id: 'admin', label: 'Admin Only', icon: <Lock className="w-4 h-4" />, roles: ['administrator', 'super-admin', 'principal'] },
  ];

  const availableChannels = channels.filter(c => !c.roles || c.roles.includes(user?.role || ''));

  // Fetch history for active channel
  useEffect(() => {
    if (isOpen) {
      setMessages([]); // Clear while loading
      apiService.get<Message[]>(`/global-chat?channel=${activeChannel}`)
        .then(setMessages)
        .catch(console.error);
    }
  }, [isOpen, activeChannel]);

  // Handle Mention Sugggestions
  useEffect(() => {
    if (mentionQuery !== null) {
      const delaySearch = setTimeout(() => {
        apiService.get<any[]>(`/global-chat/mentions?query=${mentionQuery}&channel=${activeChannel}`)
          .then(res => {
            setSuggestions(res);
            setActiveSuggestionIndex(0);
          })
          .catch(console.error);
      }, 100);
      return () => clearTimeout(delaySearch);
    } else {
      setSuggestions([]);
    }
  }, [mentionQuery]);

  // Listen for new messages
  useEffect(() => {
    if (socket) {
      const handleNewMessage = (msg: Message) => {
        if (msg.channel === activeChannel) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      };
      socket.on('new-global-message', handleNewMessage);
      return () => {
        socket.off('new-global-message', handleNewMessage);
      };
    }
  }, [socket, activeChannel]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const [mentionMetaMap, setMentionMetaMap] = useState<Record<string, { id: any, type: string }>>({});

  const insertMention = (entity: any) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart;
    const textBefore = newMessage.substring(0, cursor);
    const lastAtPos = textBefore.lastIndexOf('@');
    
    if (lastAtPos === -1) return;

    const prefix = newMessage.substring(0, lastAtPos);
    const suffix = newMessage.substring(cursor);
    
    // We use a punctuation space (\u2008) as a delimiter. It's invisible but acts as a unique key.
    const delimiter = '\u2008';
    const tag = `@${entity.label}${delimiter} `;
    
    setMentionMetaMap(prev => ({
      ...prev,
      [`${entity.label}${delimiter}`]: { id: entity.id, type: entity.type === 'school' ? 'S' : entity.type === 'role' ? 'R' : 'U' }
    }));
    
    setNewMessage(prefix + tag + suffix);
    setMentionQuery(null);
    setSuggestions([]);
    
    // Position cursor after inserted tag
    setTimeout(() => {
      if (inputRef.current) {
         const newPos = prefix.length + tag.length;
         inputRef.current.setSelectionRange(newPos, newPos);
         inputRef.current.focus();
      }
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    
    const cursor = e.target.selectionStart;
    const textBefore = val.substring(0, cursor);
    const lastAtPos = textBefore.lastIndexOf('@');
    
    if (lastAtPos !== -1) {
      const lastWord = textBefore.substring(lastAtPos);
      if (!lastWord.includes(' ')) {
        setMentionQuery(lastWord.substring(1)); // Query part after @
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[activeSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        setSuggestions([]);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    // Use a copy to work on before trimming the final result
    let transmissionContent = newMessage;

    // Build the transmission content by looking up names in our meta map
    // We look for @NAME\u2008
    Object.keys(mentionMetaMap).forEach(key => {
       const meta = mentionMetaMap[key];
       const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       const regex = new RegExp(`@${escapedKey}`, 'g');
       transmissionContent = transmissionContent.replace(regex, `@{${meta.type}:${meta.id}:${key.replace('\u2008', '')}}\u200B`);
    });

    transmissionContent = transmissionContent.trim();
    setNewMessage('');
    setMentionMetaMap({}); // Clear for next message
    setLoading(true);
    try {
      await apiService.post('/global-chat', { content: transmissionContent, channel: activeChannel });
    } catch (error) {
       setNewMessage(newMessage); // Restore original for retry
    } finally {
      setLoading(false);
    }
  };

  // Helper to render message with highlighted mentions and dynamic name sync
  const renderMessageContent = (content: string) => {
    // Build a map of latest identities from the current message pool for "Sync Magic"
    const userMap: Record<number, string> = {};
    const schoolMap: Record<number, string> = {};
    
    messages.forEach(m => {
       if (m.user_id) userMap[m.user_id] = m.full_name;
       if (m.tenant_id) schoolMap[m.tenant_id] = m.tenant_name;
    });

    // Splitting by our sophisticated tag format: @{TYPE:ID:LABEL}\u200B
    const parts = content.split(/(@\{[USR]:.*?\})\u200B/g);

    return parts.map((part, i) => {
      if (part.startsWith('@{')) {
        // Parse the machine-readable format: @{TYPE:ID:LABEL}
        const inner = part.substring(2, part.length - 1);
        const [type, id, defaultLabel] = inner.split(':');
        
        let resolvedLabel = defaultLabel;
        const numericId = parseInt(id, 10);

        // SYNC MAGIC: Try to use latest known professional name from active chatter feed
        const latestPoolName = type === 'U' ? userMap[numericId] : type === 'S' ? schoolMap[numericId] : null;
        
        // Only override if the latest name is "Better" (not a technical username like 'superadmin')
        if (latestPoolName && latestPoolName !== 'superadmin' && !latestPoolName.includes('USR_')) {
           resolvedLabel = latestPoolName;
        }

        const displayPrefix = type === 'R' ? 'Role:' : type === 'S' && !resolvedLabel.startsWith('School:') ? 'School:' : '';
        
        return (
          <span key={i} className="text-[#0088cc] font-black underline decoration-2 underline-offset-2">
             @{displayPrefix}{resolvedLabel}
          </span>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#f4f4f5] flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Telegram Style Header */}
      <div className="w-full bg-[#0088cc] flex flex-col items-center shrink-0 shadow-md relative z-20">
        <div className="w-full h-[60px] flex items-center justify-center px-4">
          <div className="w-full max-w-[800px] flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                  <p className="font-bold text-sm leading-tight">Global Inter-School Exchange</p>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black leading-tight">
                    {connected ? 'Federation Secured' : 'Connecting...'}
                  </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors group"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Channel Tabs */}
        <div className="w-full max-w-[800px] flex items-center px-4 bg-black/10">
          {availableChannels.map(channel => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
                activeChannel === channel.id ? 'text-white' : 'text-white/60 hover:text-white/80'
              }`}
            >
              {channel.icon}
              {channel.label}
              {activeChannel === channel.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white animate-in fade-in" />
              )}
            </button>
          ))}
        </div>

        {/* Onboarding Step 2: In the Header area */}
        {onboardingStep === 2 && (
          <div className="absolute top-[110px] bg-white text-slate-800 p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-100 w-64 animate-fade-in-scale z-[110] left-1/2 -translate-x-1/2">
            <div className="flex items-start gap-3 mb-3">
               <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-blue-600" />
               </div>
               <div>
                  <p className="text-sm font-bold">Role-Based Rooms</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Swap between Teacher, Finance, and Admin rooms privately.</p>
               </div>
            </div>
            <div className="flex items-center justify-between mt-4">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 2 of 3</span>
               <button 
                  onClick={onNextOnboarding}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
               >
                  Next
               </button>
            </div>
            <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45" />
          </div>
        )}
      </div>

      {/* Message Feed Area */}
      <div 
        ref={scrollRef}
        className="flex-1 w-full max-w-[800px] overflow-y-auto p-6 space-y-4 scrollbar-hide"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50 grayscale">
             <MessageSquare className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-[0.2em]">No transmissions in #{activeChannel}</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.user_id === user?.id;
            const prevMsg = i > 0 ? messages[i-1] : null;
            const showSender = !isMe && prevMsg?.user_id !== msg.user_id;

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}>
                {showSender && (
                  <div className="flex items-center gap-2 mb-1 pl-3">
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-tighter">{msg.full_name}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">• {msg.tenant_name}</span>
                  </div>
                )}
                
                <div className={`relative px-4 py-2 rounded-2xl shadow-sm text-[14px] ${
                  isMe 
                    ? 'bg-[#effdde] text-slate-800 rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none'
                } max-w-[85%] flex flex-col border border-black/5`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>
                  <span className="text-[9px] text-slate-400 self-end mt-1 font-bold">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Telegram Style Input Area */}
      <div className="w-full max-w-[800px] px-4 pb-8 pt-2 shrink-0 relative">
        {/* Refined @Mention Suggestions UI (Telegram Style) */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-[90px] left-4 right-4 bg-white border border-slate-200 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.2)] overflow-hidden z-[120] animate-fade-in-scale">
             <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Federation Entities</span>
                <span className="text-[10px] text-[#0088cc] font-bold">↑↓ to navigate • Enter to select</span>
             </div>
             <div className="max-h-72 overflow-y-auto scrollbar-hide py-1">
                {suggestions.map((s, idx) => (
                  <button
                    key={`${s.type}-${s.id}`}
                    onClick={() => insertMention(s)}
                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                    className={`w-full px-6 py-4 flex items-center gap-4 transition-all duration-200 relative group ${
                      idx === activeSuggestionIndex ? 'bg-blue-50/80 shadow-[inset_4px_0_0_#0088cc]' : 'hover:bg-slate-50'
                    }`}
                  >
                     <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform ${
                       idx === activeSuggestionIndex ? 'scale-110' : ''
                     } ${
                       s.type === 'school' ? 'bg-amber-100 text-amber-600 border border-amber-200/50' :
                       s.type === 'role' ? 'bg-indigo-100 text-indigo-600 border border-indigo-200/50' :
                       'bg-emerald-100 text-emerald-600 border border-emerald-200/50'
                     }`}>
                        {s.type === 'school' ? <School className="w-5 h-5" /> :
                         s.type === 'role' ? <Lock className="w-5 h-5" /> :
                         <UserIcon className="w-5 h-5" />}
                     </div>
                     
                     <div className="flex flex-col items-start truncate overflow-hidden">
                        <span className={`text-base font-bold transition-colors ${
                          idx === activeSuggestionIndex ? 'text-[#0088cc]' : 'text-slate-800'
                        }`}>
                          {s.label || 'Unknown Node'}
                        </span>
                        
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                             s.type === 'school' ? 'bg-amber-50 text-amber-600 border-amber-200/50' :
                             s.type === 'role' ? 'bg-indigo-50 text-indigo-600 border-indigo-200/50' :
                             'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                           }`}>
                             {s.type}
                           </span>
                           {s.school_name && (
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                               • {s.school_name}
                             </span>
                           )}
                        </div>
                     </div>
                  </button>
                ))}
             </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="w-full bg-white border border-slate-200 rounded-[28px] flex flex-col overflow-hidden transition-all duration-300 focus-within:border-[#0088cc] focus-within:ring-2 focus-within:ring-[#0088cc]/5">
           <div className="flex items-end px-3 py-1.5 bg-slate-50/20">
              <div className="w-10 h-10 flex items-center justify-center text-slate-300 shrink-0 mb-0.5">
                 <Globe className="w-5 h-5 opacity-50" />
              </div>
              
              <div className="flex-1 relative min-h-[44px] flex items-center h-full">
                 {/* Precision Mirror Layer */}
                 <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-[15px] py-3 pl-1 pr-4 overflow-hidden leading-snug select-none text-transparent font-medium">
                    {newMessage.split(/(@[^\s\u2008]+\u2008)/g).map((part, i) => (
                      <span key={i} className={part.startsWith('@') && part.endsWith('\u2008') ? 'text-[#0088cc] font-black underline decoration-2 underline-offset-4' : ''}>
                        {part.replace('\u2008', '')}
                      </span>
                    ))}
                 </div>
                 
                 <textarea 
                   ref={inputRef}
                   rows={1}
                   value={newMessage}
                   onChange={handleInputChange}
                   onKeyDown={handleKeyDown}
                   placeholder={`Type @ to tag colleagues...`}
                   className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[15px] max-h-48 overflow-y-auto py-3 pl-1 pr-4 scrollbar-hide resize-none relative z-10 leading-snug text-slate-700 placeholder:text-slate-400 font-medium caret-[#0088cc]"
                 />
              </div>

              <div className="flex items-center gap-2 mb-1.5 shrink-0 ml-1">
                 <button 
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className="px-6 py-2.5 bg-[#0088cc] text-white rounded-[18px] flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-[0.15em] transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-[#0077bb] disabled:opacity-20 shadow-sm"
                 >
                    <span>Send</span>
                    <Send className={`w-3.5 h-3.5 -rotate-45 -translate-y-0.5 ${loading ? 'animate-pulse' : ''}`} />
                 </button>
              </div>
           </div>
        </form>

        {/* Onboarding Step 3: Above the Input Area */}
        {onboardingStep === 3 && (
          <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 bg-white text-slate-800 p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-100 w-64 animate-fade-in-scale z-[110]">
            <div className="flex items-start gap-3 mb-3">
               <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-blue-600" />
               </div>
               <div>
                  <p className="text-sm font-bold">Encrypted Link</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Your messages are scoped to the selected federation room.</p>
               </div>
            </div>
            <div className="flex items-center justify-between mt-4">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 3 of 3</span>
               <button 
                  onClick={onNextOnboarding}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
               >
                  Finish
               </button>
            </div>
          </div>
        )}
      </div>

      <div className="pb-3">
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] opacity-40">#{activeChannel} • Secure Institutional Node • Federation-X</p>
      </div>
    </div>
  );
};

export default GlobalChatOverlay;
