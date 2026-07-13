import React, { useState } from 'react';
import { Megaphone, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { chatService } from '@/services/chatService';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';

type School = { id: number; name: string };

const ChatBroadcastPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [tenantId, setTenantId] = useState<string>('all');
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiService.get<School[]>('/schools', {
          skipTenant: true,
          skipTenantHeaders: true,
        });
        setSchools(Array.isArray(data) ? data : []);
      } catch {
        /* ignore */
      } finally {
        setLoadingSchools(false);
      }
    })();
  }, []);

  const send = async () => {
    if (message.trim().length < 1) {
      toast({ title: 'Enter a message', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const result = await chatService.superAdminBroadcast({
        message: message.trim(),
        tenant_id: tenantId === 'all' ? null : Number(tenantId),
      });
      toast({
        title: 'Broadcast sent',
        description: `Posted to ${result.posted} school${result.posted === 1 ? '' : 's'}.`,
      });
      setMessage('');
    } catch (err) {
      toast({
        title: 'Broadcast failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="rounded-2xl border-emerald-200/60 shadow-sm max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <Megaphone className="h-5 w-5" />
          Broadcast to Schools
        </CardTitle>
        <CardDescription>
          Posts as <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><Sparkles className="h-3.5 w-3.5" />ScholarNerve Team</span> in each school&apos;s General channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>School</Label>
          <Select value={tenantId} onValueChange={setTenantId} disabled={loadingSchools}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All schools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Write your platform announcement…"
            className="rounded-xl"
          />
        </div>
        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void send()} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send broadcast
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChatBroadcastPanel;
