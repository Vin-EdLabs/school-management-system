import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { SETTINGS_CARD_CLASS } from './SettingsSection';
import { cn } from '@/lib/utils';

export interface SchoolPaymentSettings {
  mtnMomoNumber: string;
  mtnMomoName: string;
  vodafoneCashNumber: string;
  vodafoneCashName: string;
  airteltigoNumber: string;
  airteltigoName: string;
  merchantId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
}

const emptySettings: SchoolPaymentSettings = {
  mtnMomoNumber: '',
  mtnMomoName: '',
  vodafoneCashNumber: '',
  vodafoneCashName: '',
  airteltigoNumber: '',
  airteltigoName: '',
  merchantId: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  paymentInstructions: '',
};

const PaymentDetailsSettings = () => {
  const [settings, setSettings] = useState<SchoolPaymentSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<SchoolPaymentSettings>('/settings/payment');
      setSettings({ ...emptySettings, ...data });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Could not load payment details', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiService.put('/settings/payment', settings);
      toast({ title: 'Payment details saved', description: 'Parents will see these when making payments.' });
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof SchoolPaymentSettings, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={settings[key]}
        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
        placeholder={placeholder}
        disabled={loading}
      />
    </div>
  );

  return (
    <Card className={cn(SETTINGS_CARD_CLASS, 'h-full')}>
      <CardHeader className="px-5 py-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="h-4 w-4 text-emerald-600" />
          Payment Details
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          MoMo, bank, and instructions shown to parents when they submit payment proof.
        </p>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MTN MoMo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('mtnMomoNumber', 'MoMo Number', '024 XXX XXXX')}
              {field('mtnMomoName', 'MoMo Account Name', 'Name registered on MoMo')}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vodafone Cash</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('vodafoneCashNumber', 'Vodafone Cash Number', '050 XXX XXXX')}
              {field('vodafoneCashName', 'Vodafone Cash Name', 'Name registered on Vodafone Cash')}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AirtelTigo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('airteltigoNumber', 'AirtelTigo Number', '027 XXX XXXX')}
              {field('airteltigoName', 'AirtelTigo Name', 'Name registered on AirtelTigo')}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('merchantId', 'Merchant ID', 'Optional merchant ID')}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank Transfer</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('bankName', 'Bank Name', 'e.g. GCB Bank')}
              {field('bankAccountNumber', 'Bank Account Number')}
              {field('bankAccountName', 'Bank Account Name', 'Name on the bank account')}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Instructions</Label>
            <Textarea
              value={settings.paymentInstructions}
              onChange={(e) => setSettings((s) => ({ ...s, paymentInstructions: e.target.value }))}
              placeholder="Include your ward's name and student ID in the payment reference…"
              rows={4}
              disabled={loading}
            />
          </div>
          <Button type="submit" variant="primaryAction" className="w-full h-9" disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save Payment Details'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PaymentDetailsSettings;
