import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { usePaymentAccounts } from '../../hooks/usePaymentAccounts';
import {
  formatGhs,
  getAccountDisplayName,
  getPaymentAccountIcon,
  maskAccountNumber,
  needsOpeningBalanceSetup,
  type LegacyMigrationStatus,
  type PaymentAccount,
  type PaymentAccountBalance,
} from '../../utils/paymentAccounts';
import { formatDisplayDate } from '../../utils/dateFormat';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

type AccountForm = {
  account_type: 'cash' | 'bank' | 'momo';
  account_name: string;
  nickname: string;
  account_number: string;
  branch: string;
  network: string;
  phone_number: string;
  opening_balance: string;
  opening_balance_as_of: string;
  is_default: boolean;
};

const today = () => new Date().toISOString().split('T')[0];

const emptyForm = (): AccountForm => ({
  account_type: 'bank',
  account_name: '',
  nickname: '',
  account_number: '',
  branch: '',
  network: '',
  phone_number: '',
  opening_balance: '0',
  opening_balance_as_of: today(),
  is_default: false,
});

const PaymentAccountsModule = () => {
  const { hasAccess } = useAuth();
  const canManage = hasAccess('settings-full');
  const { accounts, balances, loading, refresh } = usePaymentAccounts({ includeBalances: true });

  const [legacyStatus, setLegacyStatus] = useState<LegacyMigrationStatus | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);
  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccount | null>(null);
  const [openingTarget, setOpeningTarget] = useState<PaymentAccountBalance | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm());
  const [openingForm, setOpeningForm] = useState({ opening_balance: '0', opening_balance_as_of: today() });
  const [legacyMappings, setLegacyMappings] = useState({ cash_account_id: '', bank_account_id: '', momo_account_id: '' });
  const [saving, setSaving] = useState(false);

  const balanceMap = useMemo(() => {
    const map = new Map<number, PaymentAccountBalance>();
    balances.forEach((b) => map.set(b.id, b));
    return map;
  }, [balances]);

  const hasCashAccount = accounts.some((a) => a.account_type === 'cash');
  const accountsByType = (type: string) => accounts.filter((a) => a.account_type === type);

  const loadLegacy = useCallback(async () => {
    if (!canManage) return;
    try {
      const legacy = await apiService.get<LegacyMigrationStatus>('/payment-accounts/legacy-status');
      setLegacyStatus(legacy);
    } catch {
      setLegacyStatus(null);
    }
  }, [canManage]);

  const loadAll = useCallback(async () => {
    await refresh();
    await loadLegacy();
  }, [refresh, loadLegacy]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openCreate = (type?: AccountForm['account_type']) => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      account_type: type || (hasCashAccount ? 'bank' : 'cash'),
      account_name: type === 'cash' || (!hasCashAccount && !type) ? 'Cash at Hand' : '',
    });
    setAccountDialogOpen(true);
  };

  const openEdit = (account: PaymentAccount) => {
    setEditing(account);
    setForm({
      account_type: account.account_type as AccountForm['account_type'],
      account_name: account.account_name,
      nickname: account.nickname || '',
      account_number: account.account_number || '',
      branch: account.branch || '',
      network: account.network || '',
      phone_number: account.phone_number || '',
      opening_balance: String(account.opening_balance ?? 0),
      opening_balance_as_of: account.opening_balance_as_of || today(),
      is_default: !!account.is_default,
    });
    setAccountDialogOpen(true);
  };

  const openOpeningBalance = (account: PaymentAccountBalance) => {
    setOpeningTarget(account);
    setOpeningForm({
      opening_balance: String(account.opening_balance ?? 0),
      opening_balance_as_of: account.opening_balance_as_of || today(),
    });
    setOpeningDialogOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!canManage) return;
    if (!form.account_name.trim() && form.account_type !== 'momo') {
      toast({ title: 'Validation', description: 'Account name is required', variant: 'destructive' });
      return;
    }
    if (form.account_type === 'bank' && !form.account_number.trim()) {
      toast({ title: 'Validation', description: 'Account number is required', variant: 'destructive' });
      return;
    }
    if (form.account_type === 'momo' && (!form.network || !form.phone_number.trim())) {
      toast({ title: 'Validation', description: 'Network and phone number are required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await apiService.put(`/payment-accounts/${editing.id}`, {
          account_name: form.account_name.trim(),
          nickname: form.nickname.trim() || null,
          account_number: form.account_number.trim() || null,
          branch: form.branch.trim() || null,
          network: form.network.trim() || null,
          phone_number: form.phone_number.trim() || null,
          is_default: form.is_default,
        });
        toast({ title: 'Account updated' });
      } else {
        const name =
          form.account_type === 'momo'
            ? form.account_name.trim() || `${form.network} MoMo`
            : form.account_name.trim();
        await apiService.post('/payment-accounts', {
          account_type: form.account_type,
          account_name: name,
          nickname: form.nickname.trim() || null,
          account_number: form.account_number.trim() || null,
          branch: form.branch.trim() || null,
          network: form.network.trim() || null,
          phone_number: form.phone_number.trim() || null,
          opening_balance: parseFloat(form.opening_balance || '0'),
          opening_balance_as_of: form.opening_balance_as_of || today(),
          is_default: form.is_default,
        });
        toast({ title: 'Account created' });
      }
      setAccountDialogOpen(false);
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpeningBalance = async () => {
    if (!canManage || !openingTarget) return;
    try {
      setSaving(true);
      await apiService.put(`/payment-accounts/${openingTarget.id}/opening-balance`, {
        opening_balance: parseFloat(openingForm.opening_balance || '0'),
        opening_balance_as_of: openingForm.opening_balance_as_of || today(),
      });
      toast({ title: 'Opening balance saved' });
      setOpeningDialogOpen(false);
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: PaymentAccount) => {
    if (!canManage || !window.confirm(`Deactivate "${getAccountDisplayName(account)}"?`)) return;
    try {
      await apiService.delete(`/payment-accounts/${account.id}`);
      toast({ title: 'Account deactivated' });
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    }
  };

  const handleLegacyMigrate = async () => {
    if (!canManage) return;
    try {
      setSaving(true);
      await apiService.post('/payment-accounts/legacy-migrate', {
        cash_account_id: legacyMappings.cash_account_id ? parseInt(legacyMappings.cash_account_id, 10) : undefined,
        bank_account_id: legacyMappings.bank_account_id ? parseInt(legacyMappings.bank_account_id, 10) : undefined,
        momo_account_id: legacyMappings.momo_account_id ? parseInt(legacyMappings.momo_account_id, 10) : undefined,
      });
      toast({ title: 'Legacy transactions mapped' });
      setLegacyDialogOpen(false);
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Migration failed', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Create accounts and set opening balances here once. Balances update automatically from transactions.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        )}
      </div>

      {!canManage && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-4 text-sm">
            Only administrators can configure payment accounts and opening balances.
          </CardContent>
        </Card>
      )}

      {canManage && legacyStatus?.showBanner && (
        <Card className="border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              You have <strong>{legacyStatus.totalUnlinked}</strong> unlinked legacy transaction(s). Map them to your accounts.
            </p>
            <Button size="sm" onClick={() => setLegacyDialogOpen(true)}>Map Legacy Transactions</Button>
          </CardContent>
        </Card>
      )}

      {canManage && !hasCashAccount && (
        <Card className="border-dashed border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Set up Cash at Hand</p>
              <p className="text-sm text-muted-foreground">
                Create your Cash at Hand account and enter its opening balance before recording transactions.
              </p>
            </div>
            <Button onClick={() => openCreate('cash')}>Create Cash at Hand</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && accounts.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Loading accounts…</CardContent></Card>
        ) : accounts.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No payment accounts configured yet.</CardContent></Card>
        ) : (
          accounts.map((account) => {
            const bal = balanceMap.get(account.id);
            return (
              <Card key={account.id} className={bal && needsOpeningBalanceSetup(bal) ? 'border-amber-300' : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span>{getPaymentAccountIcon(account.account_type)}</span>
                      <span className="truncate">{getAccountDisplayName(account)}</span>
                    </CardTitle>
                    <div className="flex shrink-0 gap-1">
                      {account.is_default && <Badge variant="secondary">Default</Badge>}
                      <Badge variant="outline" className="capitalize">{account.account_type}</Badge>
                    </div>
                  </div>
                  {account.account_type === 'bank' && account.account_number && (
                    <p className="text-xs text-muted-foreground">
                      {account.account_name} · {maskAccountNumber(account.account_number)}
                      {account.branch ? ` · ${account.branch}` : ''}
                    </p>
                  )}
                  {account.account_type === 'momo' && (
                    <p className="text-xs text-muted-foreground">{account.network} · {account.phone_number}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {canManage && bal && needsOpeningBalanceSetup(bal) && (
                    <button
                      type="button"
                      onClick={() => openOpeningBalance(bal)}
                      className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
                    >
                      Opening balance not yet set — tap to configure
                    </button>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Current balance</p>
                    <p className="text-2xl font-bold">{formatGhs(bal?.balance ?? parseFloat(String(account.opening_balance ?? 0)))}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Opening: {formatGhs(parseFloat(String(account.opening_balance ?? 0)))}
                    {account.opening_balance_as_of ? ` as of ${formatDisplayDate(account.opening_balance_as_of)}` : ''}
                    {bal?.opening_balance_locked ? ' · locked' : canManage ? ' · editable' : ''}
                  </p>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {bal && !bal.opening_balance_locked && (
                        <Button variant="outline" size="sm" onClick={() => openOpeningBalance(bal)}>
                          Set opening balance
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openEdit(account)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      {account.account_type !== 'cash' && (
                        <Button variant="outline" size="sm" onClick={() => handleDelete(account)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Account */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Payment Account' : 'Add Payment Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm((p) => ({ ...p, account_type: v as AccountForm['account_type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!hasCashAccount && <SelectItem value="cash">Cash at Hand</SelectItem>}
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="momo">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.account_type === 'bank' && (
              <>
                <div className="space-y-2"><Label>Bank Name</Label><Input value={form.account_name} onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))} placeholder="e.g. GCB Bank" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Account Number</Label><Input value={form.account_number} onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Branch</Label><Input value={form.branch} onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Account Nickname (optional)</Label><Input value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} placeholder="e.g. Main School Account" /></div>
              </>
            )}
            {form.account_type === 'momo' && (
              <>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={form.network} onValueChange={(v) => setForm((p) => ({ ...p, network: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN</SelectItem>
                      <SelectItem value="Telecel">Telecel</SelectItem>
                      <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Phone Number</Label><Input value={form.phone_number} onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Wallet Nickname (optional)</Label><Input value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} /></div>
              </>
            )}
            {form.account_type === 'cash' && !editing && (
              <div className="space-y-2"><Label>Account Name</Label><Input value={form.account_name} onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))} /></div>
            )}
            {!editing && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Opening Balance (GHS)</Label><Input type="number" min="0" step="0.01" value={form.opening_balance} onChange={(e) => setForm((p) => ({ ...p, opening_balance: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>As of Date</Label><Input type="date" value={form.opening_balance_as_of} onChange={(e) => setForm((p) => ({ ...p, opening_balance_as_of: e.target.value }))} /></div>
                </div>
                <p className="text-xs text-muted-foreground">Set opening balance now. It locks after the first transaction is linked to this account.</p>
              </>
            )}
            {editing && (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">
                Opening balance is configured separately via &quot;Set opening balance&quot; on the account card (Configurations only).
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><Label>Set as Default</Label><p className="text-xs text-muted-foreground">Pre-selected when recording transactions</p></div>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm((p) => ({ ...p, is_default: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccount} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opening Balance */}
      <Dialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Opening Balance</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {getAccountDisplayName(openingTarget || { account_name: '' } as PaymentAccount)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <div className="space-y-2"><Label>Opening Balance (GHS)</Label><Input type="number" min="0" step="0.01" value={openingForm.opening_balance} onChange={(e) => setOpeningForm((p) => ({ ...p, opening_balance: e.target.value }))} /></div>
            <div className="space-y-2"><Label>As of Date</Label><Input type="date" value={openingForm.opening_balance_as_of} onChange={(e) => setOpeningForm((p) => ({ ...p, opening_balance_as_of: e.target.value }))} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Editable until the first transaction is linked. After that it is permanently locked.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOpeningBalance} disabled={saving}>Save opening balance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legacy Migration */}
      <Dialog open={legacyDialogOpen} onOpenChange={setLegacyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Map Legacy Transactions</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">One-time mapping. Cannot be repeated after completion.</p>
          <div className="space-y-4 py-2">
            {legacyStatus && legacyStatus.groups.cash > 0 && (
              <div className="space-y-2">
                <Label>{legacyStatus.groups.cash} Cash transaction(s) → assign to:</Label>
                <Select value={legacyMappings.cash_account_id} onValueChange={(v) => setLegacyMappings((p) => ({ ...p, cash_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select cash account" /></SelectTrigger>
                  <SelectContent>{accountsByType('cash').map((a) => <SelectItem key={a.id} value={String(a.id)}>{getAccountDisplayName(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {legacyStatus && legacyStatus.groups.bank > 0 && (
              <div className="space-y-2">
                <Label>{legacyStatus.groups.bank} Bank transaction(s) → assign to:</Label>
                <Select value={legacyMappings.bank_account_id} onValueChange={(v) => setLegacyMappings((p) => ({ ...p, bank_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>{accountsByType('bank').map((a) => <SelectItem key={a.id} value={String(a.id)}>{getAccountDisplayName(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {legacyStatus && legacyStatus.groups.momo > 0 && (
              <div className="space-y-2">
                <Label>{legacyStatus.groups.momo} Mobile Money transaction(s) → assign to:</Label>
                <Select value={legacyMappings.momo_account_id} onValueChange={(v) => setLegacyMappings((p) => ({ ...p, momo_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select momo account" /></SelectTrigger>
                  <SelectContent>{accountsByType('momo').map((a) => <SelectItem key={a.id} value={String(a.id)}>{getAccountDisplayName(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegacyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLegacyMigrate} disabled={saving}>Confirm mapping</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentAccountsModule;
