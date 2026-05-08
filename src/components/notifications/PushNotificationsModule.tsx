import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';
import { BellRing, RefreshCw, Send } from 'lucide-react';

type PushStats = {
  parentAccounts: number;
  subscribedAccounts: number;
  totalEndpoints: number;
  fcmTokens?: number;
  fcmConfigured?: boolean;
};

const PushNotificationsModule: React.FC = () => {
  const { hasAccess } = useAuth();
  const { school } = useSchool();
  const [stats, setStats] = useState<PushStats>({ parentAccounts: 0, subscribedAccounts: 0, totalEndpoints: 0, fcmTokens: 0, fcmConfigured: false });
  const [loadingStats, setLoadingStats] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('Parent Portal Test Notification');
  const [message, setMessage] = useState('This is a test push from school admin. If you can see this, push works while app is closed.');

  const loadStats = async () => {
    if (!hasAccess('push-notifications')) return;
    setLoadingStats(true);
    try {
      const res = await apiService.get<PushStats>('/settings/push/stats');
      setStats({
        parentAccounts: Number(res?.parentAccounts || 0),
        subscribedAccounts: Number(res?.subscribedAccounts || 0),
        totalEndpoints: Number(res?.totalEndpoints || 0),
        fcmTokens: Number(res?.fcmTokens || 0),
        fcmConfigured: Boolean(res?.fcmConfigured),
      });
    } catch (err: any) {
      toast({ title: 'Failed to load push stats', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats().catch(() => undefined);
  }, []);

  const sendTestPush = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiService.post<any>('/settings/push/test', { title, message });
      toast({
        title: 'Test push sent',
        description: `Parents: ${res.parentAccounts || 0}, subscribed: ${res.subscribedAccounts || 0}`,
      });
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Push send failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (!hasAccess('push-notifications')) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <BellRing className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Push Notifications</h1>
            <p className="text-gray-600">Send test notifications and monitor delivery readiness</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadStats} disabled={loadingStats}>
          {loadingStats ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Parent Accounts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.parentAccounts}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Subscribed Accounts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.subscribedAccounts}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total Device Endpoints</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalEndpoints}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">FCM Tokens</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.fcmTokens || 0}</p>
            <p className={`text-xs mt-1 ${stats.fcmConfigured ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.fcmConfigured ? 'Firebase ready' : 'Firebase not configured'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Push</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendTestPush} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pushTitle">Title</Label>
              <Input id="pushTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pushBody">Message</Label>
              <Input id="pushBody" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} required />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? 'Sending...' : `Send Test Push (${school?.name || 'School'})`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PushNotificationsModule;
