import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import SupportChatWindow from './SupportChatWindow';
import { Search, MessageSquare, Building2, Loader2 } from 'lucide-react';
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
  const { isPlatformSuperAdmin } = useAuth();
  const isSuperAdmin = isPlatformSuperAdmin;
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
       const interval = setInterval(fetchConversations, 60000);
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
      <div className="h-[calc(100dvh-120px)] min-h-[420px] overflow-hidden px-4 pb-4 pt-2 md:px-6">
        <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <SupportChatWindow isSuperAdmin={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-120px)] min-h-[420px] flex-col gap-0 overflow-hidden px-4 pb-4 pt-2 md:flex-row md:gap-0 md:px-6">
      {/* Conversations List */}
      <Card
        className={cn(
          'flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:mr-3 md:w-[320px] md:rounded-r-none md:border-r-0',
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="shrink-0 space-y-3 border-b border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Schools</h3>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inbox</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {conversations.reduce((sum, c) => sum + c.unread_count, 0)} new
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search schools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 border-border bg-background pl-9"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Loading</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-4 py-16 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-9 w-9 opacity-40" />
                <p className="text-sm font-medium">No schools match</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.tenant_id}
                  type="button"
                  onClick={() => handleSelectTenant({ id: conv.tenant_id, name: conv.tenant_name })}
                  className={cn(
                    'flex w-full gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedTenant?.id === conv.tenant_id
                      ? 'border-purple-500/40 bg-purple-500/10 shadow-md'
                      : 'border-transparent hover:border-border hover:bg-muted/50'
                  )}
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                    {conv.logo_url ? (
                      <img src={resolveLogoUrl(conv.logo_url)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-foreground">{conv.tenant_name}</span>
                      {conv.last_message_at && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {conv.last_image_url ? '📷 Image' : conv.last_message || 'No messages yet'}
                    </p>
                  </div>
                  {conv.unread_count > 0 && selectedTenant?.id !== conv.tenant_id && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {conv.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat */}
      <Card
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm md:rounded-l-none md:border-l-0',
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        )}
      >
        {selectedTenant ? (
          <SupportChatWindow tenantId={selectedTenant.id} tenantName={selectedTenant.name} isSuperAdmin onBack={() => setMobileView('list')} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-50" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Select a school</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Open a thread from the list to reply as ScholarNerve support.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SupportModule;
