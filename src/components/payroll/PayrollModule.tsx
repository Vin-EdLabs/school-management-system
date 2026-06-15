import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import {
  Users,
  DollarSign,
  Wallet,
  AlertCircle,
  Plus,
  CheckCircle,
  Info,
  Pencil,
  Copy,
  KeyRound,
  RefreshCw,
  Shield,
  Banknote,
  TrendingDown,
  CalendarClock,
} from 'lucide-react';
import { formatMoney, MONTH_NAMES } from './payrollUtils';
import PayrollDetailModal, { type PayrollRowSummary } from './PayrollDetailModal';

type PayrollRow = PayrollRowSummary & {
  monthlySalary: number;
  ssnitEnabled: boolean;
  grossSalary: number;
  ssnitPercent: number;
  ssnitAmount: number;
  otherDeductions: number;
  allowances: number;
  netSalary: number;
  amountPaid: number;
  paidDate?: string | null;
  paymentMethod?: string | null;
  payrollNotes?: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
};

type PayrollOverview = {
  month: number;
  year: number;
  currency: string;
  settings?: { defaultSsnitPercent: number; autoGeneratePayroll?: boolean; payrollGenerationDay?: number };
  payroll: PayrollRow[];
  summary: {
    totalStaff: number;
    totalGross: number;
    totalSsnit: number;
    totalNetScheduled: number;
    totalNetPaid: number;
    paidCount: number;
    unpaidCount: number;
    partialCount?: number;
  };
};

type PayrollSettings = {
  defaultSsnitPercent: number;
  currency: string;
  payrollGenerationDay: number;
  autoGeneratePayroll: boolean;
  payslipFooterText: string;
  payslipSignatureText: string;
};

type HistoryRow = {
  id: number;
  payeeType: string;
  payeeId: number;
  name: string;
  staffId: string | null;
  role: string;
  month: number;
  year: number;
  grossSalary: number;
  netSalary: number;
  amountPaid: number;
  status: string;
  paidDate: string | null;
};

const PayrollModule = () => {
  const { schoolId, school } = useSchool();
  const { socket } = useSocket();
  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<PayrollOverview | null>(null);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [confirmPayOpen, setConfirmPayOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ staffId: string; pin: string; name: string } | null>(null);
  const [selectedPayee, setSelectedPayee] = useState<PayrollRow | null>(null);
  const [selectedEditPayee, setSelectedEditPayee] = useState<PayrollRow | null>(null);
  const [detailRow, setDetailRow] = useState<PayrollRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', role: '', monthly_salary: '' });
  const [newStaff, setNewStaff] = useState({ full_name: '', role: '', monthly_salary: '' });
  const [payForm, setPayForm] = useState({
    paid_date: new Date().toISOString().slice(0, 10),
    payment_method: 'Bank Transfer',
    payment_account_id: '',
    notes: '',
  });
  const [settingsForm, setSettingsForm] = useState<Partial<PayrollSettings>>({});
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histMonth, setHistMonth] = useState<string>('all');
  const [histYear, setHistYear] = useState<string>('all');
  const [histStaff, setHistStaff] = useState<string>('all');
  const [histStatus, setHistStatus] = useState<string>('all');
  const autoPreparedRef = useRef<string>('');

  const loadSettings = useCallback(async () => {
    try {
      const s = await apiService.get<PayrollSettings>('/payroll/settings');
      setSettings(s);
      setSettingsForm(s);
    } catch {
      setSettings(null);
    }
  }, []);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get<PayrollOverview>(`/payroll?month=${month}&year=${year}`);
      setData(res);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load payroll', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const q = new URLSearchParams();
      if (histMonth !== 'all') q.set('month', histMonth);
      if (histYear !== 'all') q.set('year', histYear);
      if (histStatus !== 'all') q.set('status', histStatus);
      if (histStaff !== 'all') {
        const [pt, id] = histStaff.split(':');
        q.set('payee_type', pt);
        q.set('payee_id', id);
      }
      const res = await apiService.get<HistoryRow[]>(`/payroll/history?${q}`);
      setHistoryRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load history', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  }, [histMonth, histYear, histStaff, histStatus]);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadSettings();
  }, [schoolId, loadSettings]);

  useEffect(() => {
    if (schoolId == null) return;
    loadPayroll();
  }, [schoolId, month, year, loadPayroll]);

  useEffect(() => {
    if (tab === 'history' && schoolId != null) loadHistory();
  }, [tab, schoolId, loadHistory]);

  useEffect(() => {
    if (!socket || schoolId == null) return;
    const onEvt = (evt: { entity?: string } | undefined) => {
      const e = evt?.entity || '';
      if (
        e === 'salary-payment' ||
        e === 'expense' ||
        e === 'payroll-staff' ||
        e === 'teacher' ||
        e === 'payroll-settings'
      ) {
        loadPayroll();
        loadSettings();
        if (tab === 'history') loadHistory();
      }
    };
    socket.on('tenant-data-changed', onEvt);
    return () => {
      socket.off('tenant-data-changed', onEvt);
    };
  }, [socket, schoolId, loadPayroll, loadSettings, loadHistory, tab]);

  useEffect(() => {
    if (!settings?.autoGeneratePayroll || schoolId == null) return;
    const key = `${schoolId}-${month}-${year}`;
    if (autoPreparedRef.current === key) return;
    let cancelled = false;
    (async () => {
      try {
        await apiService.post('/payroll/prepare-month', { month, year });
        if (!cancelled) {
          autoPreparedRef.current = key;
          loadPayroll();
        }
      } catch {
        /* ignore auto prepare failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings?.autoGeneratePayroll, schoolId, month, year, loadPayroll]);

  const openDetail = (p: PayrollRow) => {
    setDetailRow(p);
    setDetailOpen(true);
  };

  const handleAddStaff = async () => {
    if (!newStaff.full_name || !newStaff.monthly_salary) {
      toast({ title: 'Error', description: 'Name and salary are required', variant: 'destructive' });
      return;
    }
    try {
      const addedName = newStaff.full_name;
      await apiService.post<any>('/payroll/other-staff', {
        full_name: addedName,
        role: newStaff.role || null,
        monthly_salary: parseFloat(newStaff.monthly_salary),
      });
      toast({ title: 'Staff Added', description: `${addedName} has been added to payroll` });
      setNewStaff({ full_name: '', role: '', monthly_salary: '' });
      setAddStaffOpen(false);
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to add staff', variant: 'destructive' });
    }
  };

  const openEditDialog = (payee: PayrollRow) => {
    setSelectedEditPayee(payee);
    setEditForm({
      full_name: payee.name,
      role: payee.role || '',
      monthly_salary: String(payee.monthlySalary),
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedEditPayee || !editForm.full_name || !editForm.monthly_salary) return;
    try {
      if (selectedEditPayee.payeeType === 'teacher') {
        await apiService.put(`/teachers/${selectedEditPayee.id}`, {
          full_name: editForm.full_name,
          monthly_salary: parseFloat(editForm.monthly_salary),
        });
      } else {
        await apiService.put(`/payroll/other-staff/${selectedEditPayee.id}`, {
          full_name: editForm.full_name,
          role: editForm.role || null,
          monthly_salary: parseFloat(editForm.monthly_salary),
        });
      }
      toast({ title: 'Updated', description: `${editForm.full_name} has been updated` });
      setEditDialogOpen(false);
      setSelectedEditPayee(null);
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to update', variant: 'destructive' });
    }
  };

  const submitPayment = async () => {
    if (!selectedPayee) return;
    try {
      await apiService.post('/payroll/pay', {
        payee_type: selectedPayee.payeeType,
        payee_id: selectedPayee.id,
        month,
        year,
        paid_date: payForm.paid_date,
        payment_method: payForm.payment_method,
        payment_account_id: payForm.payment_account_id ? parseInt(payForm.payment_account_id, 10) : undefined,
        notes: payForm.notes || undefined,
      });
      toast({
        title: 'Payment recorded',
        description: `Net ${formatMoney(data?.currency || 'GHS', selectedPayee.netSalary)} recorded for ${selectedPayee.name}. Expense added to finance.`,
      });
      setPayDialogOpen(false);
      setConfirmPayOpen(false);
      setSelectedPayee(null);
      setPayForm({
        paid_date: new Date().toISOString().slice(0, 10),
        payment_method: 'Bank Transfer',
        payment_account_id: '',
        notes: '',
      });
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record payment', variant: 'destructive' });
    }
  };

  const openPayDialog = (payee: PayrollRow) => {
    setSelectedPayee(payee);
    setPayForm({
      paid_date: new Date().toISOString().slice(0, 10),
      payment_method: 'Bank Transfer',
      payment_account_id: '',
      notes: '',
    });
    setPayDialogOpen(true);
  };

  const prepareMonth = async () => {
    try {
      await apiService.post('/payroll/prepare-month', { month, year });
      toast({ title: 'Prepared', description: `Payroll lines refreshed for ${MONTH_NAMES[month - 1]} ${year}.` });
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to prepare month', variant: 'destructive' });
    }
  };

  const saveSettings = async () => {
    try {
      const body = {
        defaultSsnitPercent: parseFloat(String(settingsForm.defaultSsnitPercent ?? 5.5)),
        currency: settingsForm.currency || 'GHS',
        payrollGenerationDay: parseInt(String(settingsForm.payrollGenerationDay ?? 1), 10),
        autoGeneratePayroll: Boolean(settingsForm.autoGeneratePayroll),
        payslipFooterText: settingsForm.payslipFooterText ?? '',
        payslipSignatureText: settingsForm.payslipSignatureText ?? '',
      };
      const s = await apiService.put<PayrollSettings>('/payroll/settings', body);
      setSettings(s);
      setSettingsForm(s);
      toast({ title: 'Saved', description: 'Payroll settings updated.' });
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save settings', variant: 'destructive' });
    }
  };

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);
  const cur = data?.currency || settings?.currency || 'GHS';
  const staffOptions =
    data?.payroll?.map((p) => ({
      value: `${p.payeeType}:${p.id}`,
      label: `${p.name} (${p.payeeType === 'teacher' ? 'Teacher' : 'Staff'})`,
    })) || [];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur border-b border-border mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Salaries, SSNIT, payslips, and finance-linked payments</p>
        </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
              <SelectTrigger className="w-[160px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger className="w-[100px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>
            <Button variant="outline" size="sm" onClick={prepareMonth} className="border-border">
              <RefreshCw className="w-4 h-4 mr-1" />
              Prepare month
            </Button>
            <Button onClick={() => setAddStaffOpen(true)} variant="primaryAction" size="sm" className="h-9">
              <Plus className="w-4 h-4 mr-1" />
              Add staff
          </Button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-medium">Teachers</strong> are included from the Teachers module.{' '}
              <strong className="text-foreground font-medium">SSNIT</strong> is calculated on gross salary when enabled per staff. Recording a payment creates a{' '}
              <strong className="text-foreground font-medium">Payroll</strong> expense and updates this register.
        </div>
      </div>

      {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total staff</p>
                    <p className="text-xl font-bold">{data.summary?.totalStaff ?? 0}</p>
              </div>
            </CardContent>
          </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total gross</p>
                    <p className="text-xl font-bold">{formatMoney(cur, data.summary?.totalGross ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total SSNIT</p>
                    <p className="text-xl font-bold">{formatMoney(cur, data.summary?.totalSsnit ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net paid out</p>
                    <p className="text-xl font-bold">{formatMoney(cur, data.summary?.totalNetPaid ?? 0)}</p>
              </div>
            </CardContent>
          </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid staff</p>
                    <p className="text-xl font-bold">{data.summary?.paidCount ?? 0}</p>
              </div>
            </CardContent>
          </Card>
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unpaid staff</p>
                    <p className="text-xl font-bold">{data.summary?.unpaidCount ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-2 border-b border-border bg-muted/20">
              <CardTitle className="text-lg">
                Register — {MONTH_NAMES[month - 1]} {year}
              </CardTitle>
              {data?.settings && (
                <p className="text-xs text-muted-foreground font-normal">
                  Default SSNIT {data.settings.defaultSsnitPercent}% · {cur}
                </p>
              )}
        </CardHeader>
            <CardContent className="p-0">
          {loading ? (
                <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
          ) : !data?.payroll?.length ? (
                <div className="py-16 text-center px-4">
                  <Wallet className="w-12 h-12 text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-muted-foreground">No staff on payroll for this month.</p>
            </div>
          ) : (
                <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                      <TableRow className="hover:bg-transparent border-border bg-muted/40">
                        <TableHead className="font-semibold whitespace-nowrap min-w-[140px]">Name</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap">Role</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap">SSNIT</TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap">Gross</TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap">SSNIT</TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap">Other ded.</TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap">Net</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                        <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                      {data.payroll.map((p) => (
                        <TableRow
                          key={`${p.payeeType}-${p.id}`}
                          className="cursor-pointer border-border hover:bg-muted/40 transition-colors"
                          onClick={() => openDetail(p)}
                        >
                          <TableCell className="font-medium">
                            <div>{p.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{p.staffId || '—'}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate">{p.role || '—'}</TableCell>
                      <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                p.ssnitEnabled
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-xs font-normal text-emerald-700 dark:text-emerald-400'
                                  : 'border-red-500/40 bg-red-500/10 text-xs font-normal text-red-700 dark:text-red-400'
                              }
                            >
                              {p.ssnitEnabled ? 'On' : 'Off'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatMoney(cur, p.grossSalary)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600 dark:text-orange-400">
                            {formatMoney(cur, p.ssnitAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatMoney(cur, p.otherDeductions)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatMoney(cur, p.netSalary)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge
                          variant="outline"
                          className={
                            p.status === 'Paid'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : p.status === 'Partially Paid'
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                    : 'border-border bg-muted/50 text-muted-foreground'
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openDetail(p)} title="Details">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {p.status !== 'Paid' && (
                                <Button size="sm" variant="secondary" className="h-8" onClick={() => openPayDialog(p)}>
                                  Pay
                          </Button>
                        )}
                            </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-0">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Month</Label>
              <Select value={histMonth} onValueChange={setHistMonth}>
                <SelectTrigger className="w-[140px] mt-1">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Select value={histYear} onValueChange={setHistYear}>
                <SelectTrigger className="w-[100px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Staff</Label>
              <Select value={histStaff} onValueChange={setHistStaff}>
                <SelectTrigger className="w-[200px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {staffOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={histStatus} onValueChange={setHistStatus}>
                <SelectTrigger className="w-[130px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partially Paid">Partial</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="mb-0.5" onClick={() => loadHistory()}>
              Apply filters
            </Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Period</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                            No salary records for these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyRows.map((h) => (
                          <TableRow key={h.id} className="border-border">
                            <TableCell className="whitespace-nowrap text-sm">
                              {MONTH_NAMES[h.month - 1]} {h.year}
                            </TableCell>
                            <TableCell className="font-medium">{h.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{h.role}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatMoney(cur, h.grossSalary)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatMoney(cur, h.netSalary)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatMoney(cur, h.amountPaid)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {h.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 max-w-xl mt-0">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Payroll settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsForm && (
                <>
                  <div>
                    <Label>Default SSNIT %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1 max-w-xs"
                      value={settingsForm.defaultSsnitPercent ?? 5.5}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultSsnitPercent: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Standard rate in Ghana is often 5.5% (employee tier).</p>
                  </div>
                  <div>
                    <Label>Currency code</Label>
                    <Input
                      className="mt-1 max-w-xs"
                      value={settingsForm.currency || 'GHS'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4" />
                      Payroll generation day (1–28)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      className="mt-1 max-w-xs"
                      value={settingsForm.payrollGenerationDay ?? 1}
                      onChange={(e) => setSettingsForm({ ...settingsForm, payrollGenerationDay: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Auto-generate payroll rows</p>
                      <p className="text-xs text-muted-foreground">When enabled, opening a month refreshes draft lines for all staff.</p>
                    </div>
                    <Switch
                      checked={!!settingsForm.autoGeneratePayroll}
                      onCheckedChange={(v) => setSettingsForm({ ...settingsForm, autoGeneratePayroll: v })}
                      className="data-[state=checked]:!bg-emerald-500 data-[state=unchecked]:!bg-red-500"
                    />
                  </div>
                  <div>
                    <Label>Payslip footer text</Label>
                    <Input
                      className="mt-1"
                      value={settingsForm.payslipFooterText ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, payslipFooterText: e.target.value })}
                      placeholder="e.g. Thank you for your service."
                    />
                  </div>
                  <div>
                    <Label>Payslip signature line</Label>
                    <Input
                      className="mt-1"
                      value={settingsForm.payslipSignatureText ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, payslipSignatureText: e.target.value })}
                      placeholder="e.g. Headteacher / Finance Officer"
                    />
                  </div>
                  <Button onClick={saveSettings} variant="primaryAction">
                    Save settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PayrollDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        month={month}
        year={year}
        row={detailRow}
        currency={cur}
        schoolName={school?.name || 'School'}
        schoolLogo={school?.logo_url}
        onSaved={loadPayroll}
        onEditProfile={(r) => {
          setDetailOpen(false);
          openEditDialog(r as PayrollRow);
        }}
      />

      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden p-6 sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add other staff</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-1 pr-1">
            <div>
              <Label>Full name *</Label>
              <Input value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Monthly salary ({cur}) *</Label>
              <Input type="number" value={newStaff.monthly_salary} onChange={(e) => setNewStaff({ ...newStaff, monthly_salary: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-2">
            <Button variant="outline" onClick={() => setAddStaffOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} variant="primaryAction">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden p-6 sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit {selectedEditPayee?.payeeType === 'teacher' ? 'teacher' : 'staff'}</DialogTitle>
          </DialogHeader>
          {selectedEditPayee && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-1 pr-1">
              <div>
                <Label>Full name *</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="mt-1" />
              </div>
              {selectedEditPayee.payeeType === 'staff' && (
                <div>
                  <Label>Role</Label>
                  <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="mt-1" />
                </div>
              )}
              <div>
                <Label>Monthly salary — contract ({cur}) *</Label>
                <Input type="number" value={editForm.monthly_salary} onChange={(e) => setEditForm({ ...editForm, monthly_salary: e.target.value })} className="mt-1" />
              </div>
              <p className="text-xs text-muted-foreground">
                For a one-month gross change only, use the payroll row <strong className="text-foreground font-medium">Details</strong> dialog and edit &quot;Gross salary — this month&quot;.
              </p>
            </div>
          )}
          <DialogFooter className="shrink-0 border-t border-border pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} variant="primaryAction">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden p-6 sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Login — {loginCredentials?.name}
            </DialogTitle>
          </DialogHeader>
          {loginCredentials && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain text-sm">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Staff ID</span>
                  <span className="font-mono font-medium">{loginCredentials.staffId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">PIN</span>
                  <span className="font-mono font-medium">{loginCredentials.pin}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(loginCredentials.staffId)}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy ID
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(loginCredentials.pin)}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy PIN
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Record payment — {selectedPayee?.name}</DialogTitle>
          </DialogHeader>
          {selectedPayee && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross</span>
                  <span>{formatMoney(cur, selectedPayee.grossSalary)}</span>
                </div>
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>SSNIT</span>
                  <span>-{formatMoney(cur, selectedPayee.ssnitAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other ded.</span>
                  <span>-{formatMoney(cur, selectedPayee.otherDeductions)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allowances</span>
                  <span>+{formatMoney(cur, selectedPayee.allowances)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400 pt-1 border-t border-border">
                  <span>Net to pay</span>
                  <span>{formatMoney(cur, selectedPayee.netSalary)}</span>
                </div>
              </div>
              <div>
                <Label>Payment date</Label>
                <Input type="date" className="mt-1" value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} />
              </div>
              <PaymentAccountSelect
                value={payForm.payment_account_id}
                onChange={(accountId, paymentMethod) =>
                  setPayForm({ ...payForm, payment_account_id: accountId, payment_method: paymentMethod })
                }
                label="Payment Account"
              />
              {payForm.payment_method === 'Bank Transfer' &&
                (selectedPayee.bankName || selectedPayee.bankAccountNumber) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Bank details (from profile)</p>
                    {selectedPayee.bankName && <p>{selectedPayee.bankName}</p>}
                    {selectedPayee.bankAccountName && <p>{selectedPayee.bankAccountName}</p>}
                    {selectedPayee.bankAccountNumber && (
                      <p className="font-mono">{selectedPayee.bankAccountNumber}</p>
                    )}
                    {selectedPayee.bankBranch && (
                      <p className="text-muted-foreground">{selectedPayee.bankBranch}</p>
                    )}
                  </div>
                )}
              <div>
                <Label>Payment notes (optional)</Label>
                <Input className="mt-1" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Reference / remarks" />
              </div>
            </div>
          )}
          <DialogFooter className="mt-auto shrink-0 gap-2 border-t border-border bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primaryAction"
              onClick={() => {
                setConfirmPayOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPayOpen} onOpenChange={setConfirmPayOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm salary payment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p>
                  This will record a <strong className="text-foreground">Payroll</strong> expense for{' '}
                  <strong className="text-foreground">{selectedPayee && formatMoney(cur, selectedPayee.netSalary)}</strong> and mark{' '}
                  <strong className="text-foreground">{selectedPayee?.name}</strong> as paid for {MONTH_NAMES[month - 1]} {year}.
                </p>
                <p>This action posts to your school expenses and cannot be undone from this screen.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPayOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void submitPayment();
              }}
              className="bg-gradient-to-r from-[#146C43] via-[#16A34A] to-[#22C55E] text-white shadow-md shadow-emerald-500/20 hover:from-[#0F5132] hover:via-[#146C43] hover:to-[#16A34A] hover:shadow-emerald-500/30"
            >
              Confirm payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayrollModule;
