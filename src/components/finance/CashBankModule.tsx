import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { usePaymentAccounts } from '../../hooks/usePaymentAccounts';
import {
  formatGhs,
  formatPaymentAccountLabel,
  getAccountDisplayName,
  getPaymentAccountIcon,
  maskAccountNumber,
  type FundTransfer,
  type PaymentAccountBalance,
} from '../../utils/paymentAccounts';
import { formatDisplayDate } from '../../utils/dateFormat';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
  RefreshCw,
  Settings,
} from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

const CashBankModule = () => {
  const { hasAccess } = useAuth();
  const canTransfer = hasAccess('settings-full');
  const { accounts, balances, totalBalance, loading, refresh } = usePaymentAccounts({ includeBalances: true });

  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    transfer_date: today(),
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const balanceMap = useMemo(() => {
    const map = new Map<number, PaymentAccountBalance>();
    balances.forEach((b) => map.set(b.id, b));
    return map;
  }, [balances]);

  const loadTransfers = useCallback(async () => {
    try {
      const rows = await apiService.get<FundTransfer[]>('/payment-accounts/transfers?limit=50');
      setTransfers(rows || []);
    } catch {
      setTransfers([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await refresh();
    await loadTransfers();
  }, [refresh, loadTransfers]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleTransfer = async () => {
    if (!canTransfer) return;
    if (!transferForm.note.trim()) {
      toast({ title: 'Note required', description: 'Transfer note is mandatory', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiService.post('/payment-accounts/transfers', {
        from_account_id: parseInt(transferForm.from_account_id, 10),
        to_account_id: parseInt(transferForm.to_account_id, 10),
        amount: parseFloat(transferForm.amount),
        transfer_date: transferForm.transfer_date,
        note: transferForm.note.trim(),
      });
      toast({ title: 'Transfer completed' });
      setTransferDialogOpen(false);
      setTransferForm({ from_account_id: '', to_account_id: '', amount: '', transfer_date: today(), note: '' });
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Transfer failed', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReverseTransfer = async (transfer: FundTransfer) => {
    if (!canTransfer || !window.confirm('Reverse this transfer? An opposite transfer will be created.')) return;
    try {
      await apiService.post(`/payment-accounts/transfers/${transfer.id}/reverse`, {});
      toast({ title: 'Transfer reversed' });
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || err?.message, variant: 'destructive' });
    }
  };

  const sourceBalance = transferForm.from_account_id
    ? balanceMap.get(parseInt(transferForm.from_account_id, 10))?.balance ?? 0
    : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash &amp; Bank</h1>
          <p className="text-sm text-muted-foreground">
            View live balances and transfer funds between accounts. Configure accounts and opening balances under{' '}
            <strong>Configurations → Payment Accounts</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canTransfer && (
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)} disabled={accounts.length < 2}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfer Funds
            </Button>
          )}
        </div>
      </div>

      {!canTransfer && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-3 text-sm">
            Read-only view. Only administrators can transfer funds. Account setup is done in Configurations → Payment Accounts.
          </CardContent>
        </Card>
      )}

      {balances.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Settings className="h-8 w-8 opacity-50" />
            <p>No payment accounts yet.</p>
            {canTransfer && (
              <p>Go to <strong>Configurations → Payment Accounts</strong> to create accounts and set opening balances.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
        <CardContent className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Combined total across all accounts</p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{formatGhs(totalBalance)}</p>
          </div>
          <Landmark className="hidden h-12 w-12 text-emerald-500/40 sm:block" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {balances.map((account) => (
          <Card key={account.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{getPaymentAccountIcon(account.account_type)}</span>
                  <span className="truncate">{getAccountDisplayName(account)}</span>
                </CardTitle>
                {account.is_default && <Badge variant="secondary">Default</Badge>}
              </div>
              {account.account_type === 'bank' && account.account_number && (
                <p className="text-xs text-muted-foreground">
                  {account.account_name}{account.account_number ? ` · ${maskAccountNumber(account.account_number)}` : ''}
                  {account.branch ? ` · ${account.branch}` : ''}
                </p>
              )}
              {account.account_type === 'momo' && (
                <p className="text-xs text-muted-foreground">{account.network} · {account.phone_number}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Current balance</p>
                <p className="text-2xl font-bold">{formatGhs(account.balance)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Opening: {formatGhs(account.opening_balance ?? 0)}
                {account.opening_balance_as_of ? ` as of ${formatDisplayDate(account.opening_balance_as_of)}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowDownLeft className="h-3 w-3 text-emerald-600" /> Money in
                  </p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatGhs(account.money_in)}</p>
                </div>
                <div className="rounded-md bg-red-50 p-2 dark:bg-red-950/30">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-red-600" /> Money out
                  </p>
                  <p className="font-semibold text-red-700 dark:text-red-400">{formatGhs(account.money_out)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Transfer History</CardTitle></CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No fund transfers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDisplayDate(t.transfer_date)}</TableCell>
                      <TableCell>{t.from_account_name}</TableCell>
                      <TableCell>{t.to_account_name}</TableCell>
                      <TableCell>{formatGhs(parseFloat(String(t.amount)))}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{t.note}</TableCell>
                      <TableCell>{t.transferred_by_name || '—'}</TableCell>
                      <TableCell>
                        {t.is_reversed ? (
                          <Badge variant="secondary">REVERSED</Badge>
                        ) : t.original_transfer_id ? (
                          <Badge variant="outline">Reversal</Badge>
                        ) : canTransfer ? (
                          <Button variant="ghost" size="sm" onClick={() => handleReverseTransfer(t)}>Reverse</Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Funds</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This transfer is permanent and will be logged.
            </div>
          </div>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>From account</Label>
              <Select
                value={transferForm.from_account_id}
                onValueChange={(v) =>
                  setTransferForm((p) => ({ ...p, from_account_id: v, to_account_id: p.to_account_id === v ? '' : p.to_account_id }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{formatPaymentAccountLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.from_account_id && (
                <p className="text-xs text-muted-foreground">Available: {formatGhs(sourceBalance)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>To account</Label>
              <Select value={transferForm.to_account_id} onValueChange={(v) => setTransferForm((p) => ({ ...p, to_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => String(a.id) !== transferForm.from_account_id)
                    .map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{formatPaymentAccountLabel(a)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount (GHS)</Label>
                <Input type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={transferForm.transfer_date} onChange={(e) => setTransferForm((p) => ({ ...p, transfer_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note *</Label>
              <Textarea value={transferForm.note} onChange={(e) => setTransferForm((p) => ({ ...p, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={saving || !transferForm.note.trim()}>Confirm transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashBankModule;
