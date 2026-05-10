import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import SupportChatWindow from './SupportChatWindow';
import { Search, MessageSquare, Building2, Clock, CheckCheck, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";
import { resolveLogoUrl } from '../../services/tenantService';

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

const SupportModule = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super-admin';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<{ id: number; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(isSuperAdmin);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const fetchConversations = async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await apiService.get<Conversation[]>('/support-chat/conversations');
      setConversations(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    if (isSuperAdmin) {
       const interval = setInterval(fetchConversations, 10000);
       return () => clearInterval(interval);
    }
  }, [isSuperAdmin]);

  const handleSelectTenant = (tenant: { id: number; name: string }) => {
    setSelectedTenant(tenant);
    setMobileView('chat');
  };

  const filteredConversations = conversations.filter(c => 
    c.tenant_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-4 md:p-6 h-[calc(100dvh-140px)] md:h-[calc(100dvh-100px)]">
        <div className="max-w-5xl mx-auto h-full bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <SupportChatWindow isSuperAdmin={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100dvh-140px)] md:h-[calc(100dvh-100px)] flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Conversations List */}
      <Card className={cn(
        "w-full md:w-96 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl shadow-slate-100 dark:shadow-none border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-300",
        mobileView === 'chat' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 space-y-4 shrink-0 bg-white dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Messages</h3>
            <Badge className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 rounded-lg">
              {conversations.reduce((sum, c) => sum + c.unread_count, 0)} New
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <Input 
              placeholder="Search schools..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-transparent dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-950 transition-all shadow-inner dark:text-white"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 bg-white dark:bg-slate-900">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300 dark:text-slate-700" />
                <p className="text-xs text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">Loading Chats</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-20 px-6 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-600">No schools found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.tenant_id}
                  onClick={() => handleSelectTenant({ id: conv.tenant_id, name: conv.tenant_name })}
                  className={cn(
                    "w-full p-4 rounded-[1.25rem] md:rounded-[1.5rem] flex gap-4 transition-all duration-300 group relative",
                    selectedTenant?.id === conv.tenant_id 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-[1.02] z-10" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm">
                    {conv.logo_url ? (
                      <img src={resolveLogoUrl(conv.logo_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <Building2 className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-bold truncate text-sm", selectedTenant?.id === conv.tenant_id ? "text-white" : "text-slate-900 dark:text-slate-100")}>
                        {conv.tenant_name}
                      </span>
                      {conv.last_message_at && (
                        <span className={cn("text-[9px] font-bold uppercase tracking-tighter shrink-0", selectedTenant?.id === conv.tenant_id ? "text-indigo-200" : "text-slate-400 dark:text-slate-500")}>
                          {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className={cn("text-xs truncate font-medium leading-relaxed", selectedTenant?.id === conv.tenant_id ? "text-indigo-100" : "text-slate-500 dark:text-slate-400")}>
                      {conv.unread_count > 0 && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
                      {conv.last_image_url ? "📷 Image" : (conv.last_message || "No messages yet")}
                    </p>
                  </div>
                  {conv.unread_count > 0 && selectedTenant?.id !== conv.tenant_id && (
                    <Badge className="absolute top-4 right-4 bg-emerald-500 text-white border-0 h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-lg text-[10px] font-black">
                      {conv.unread_count}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat Window */}
      <Card className={cn(
        "flex-1 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 dark:shadow-none border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white dark:border-slate-800",
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        {selectedTenant ? (
          <SupportChatWindow 
            tenantId={selectedTenant.id} 
            tenantName={selectedTenant.name} 
            isSuperAdmin={true} 
            onBack={() => setMobileView('list')}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center space-y-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-50 dark:bg-indigo-950/30 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-indigo-500 dark:text-indigo-400 animate-bounce shadow-inner">
              <MessageSquare className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Select a conversation</h2>
              <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Choose a school from the list to start providing high-quality support and assistance.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SupportModule;
