import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api';
import { writeCachedPlatformUi } from '@/utils/platformUiSettings';
import { useToast } from '@/hooks/use-toast';

type PlatformUiSettings = {
  zoomNudgeEnabled: boolean;
};

const PlatformSettingsModule: React.FC = () => {
  const { toast } = useToast();
  const [ui, setUi] = useState<PlatformUiSettings>({ zoomNudgeEnabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<{ ui?: PlatformUiSettings }>('/super-admin/settings', {
        skipTenant: true,
      });
      setUi({
        zoomNudgeEnabled: data?.ui?.zoomNudgeEnabled === true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load platform settings';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<PlatformUiSettings>) => {
    setSaving(true);
    try {
      const data = await apiService.put<{ ui?: PlatformUiSettings }>(
        '/super-admin/settings',
        patch,
        { skipTenant: true, skipTenantHeaders: true }
      );
      const nextUi = {
        zoomNudgeEnabled: data?.ui?.zoomNudgeEnabled === true,
      };
      setUi(nextUi);
      writeCachedPlatformUi(nextUi);
      window.dispatchEvent(new CustomEvent('platform-settings-changed', { detail: nextUi }));
      toast({ title: 'Platform settings saved' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-outfit text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Platform Settings
          </h3>
          <p className="max-w-2xl text-sm font-medium text-slate-500">
            Control platform-wide UI behaviour for all schools and staff portals.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Desktop zoom tip</CardTitle>
              <CardDescription>
                Shows a bottom-right tip on desktop when browser zoom is at 100% or higher, suggesting 80–90% for
                Markbook and dashboards.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enable zoom notification</p>
            <p className="text-xs text-slate-500">Turn off completely to hide this tip for every user on the platform.</p>
          </div>
          <Switch
            checked={ui.zoomNudgeEnabled}
            disabled={loading || saving}
            onCheckedChange={(checked) => void save({ zoomNudgeEnabled: checked })}
            aria-label="Enable desktop zoom notification"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformSettingsModule;
