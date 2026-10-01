import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  fetchSmsWallet,
  updateSmsPreferences,
  requestSenderId,
  initializeSmsTopup,
  verifySmsTopup,
  sendTestSms,
  fetchSmsLogs,
  type SmsWalletResponse,
  type SmsPackage,
  type SmsLogRow,
} from '@/services/smsApi';
import {
  CreditCard,
  MessageSquare,
  Send,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Zap,
  PhoneCall,
  History,
  Sliders,
  DollarSign,
} from 'lucide-react';

export const SmsWalletTab: React.FC<{ onBalanceUpdated?: (balance: number) => void }> = ({
  onBalanceUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState<SmsWalletResponse | null>(null);
  const [topupLoading, setTopupLoading] = useState<string | null>(null);
  const [savingToggles, setSavingToggles] = useState(false);

  // Sender ID request state
  const [requestedSenderId, setRequestedSenderId] = useState('');
  const [senderIdPurpose, setSenderIdPurpose] = useState('');
  const [submittingSenderId, setSubmittingSenderId] = useState(false);

  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [eventFilter, setEventFilter] = useState('all');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const data = await fetchSmsWallet();
      setWalletData(data);
      if (onBalanceUpdated) {
        onBalanceUpdated(data.wallet.balance);
      }
    } catch (err: any) {
      toast({
        title: 'Error loading SMS wallet',
        description: err?.message || 'Could not fetch SMS wallet details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLogsData = async (page = 1, event = eventFilter) => {
    try {
      setLoadingLogs(true);
      const res = await fetchSmsLogs({ page, limit: 15, eventType: event });
      setLogs(res.logs);
      setLogPage(res.pagination.page);
      setLogTotalPages(res.pagination.totalPages);
      setLogTotal(res.pagination.total);
    } catch (err: any) {
      console.warn('Failed to load SMS logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Check URL query on return from Paystack checkout: ?reference=SMS-TOPUP-...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    if (ref && ref.startsWith('SMS-TOPUP-')) {
      // Remove query param from URL without reload
      const nextUrl = window.location.pathname;
      window.history.replaceState({}, document.title, nextUrl);

      verifySmsTopup(ref)
        .then((res) => {
          toast({
            title: 'SMS Top-Up Successful! 🎉',
            description: `${res.creditsAdded} SMS credits have been added to your school's wallet. New balance: ${res.newBalance} credits.`,
          });
          loadWallet();
        })
        .catch((err: any) => {
          toast({
            title: 'Verification failed',
            description: err?.message || 'Failed to verify Paystack top-up.',
            variant: 'destructive',
          });
        });
    }
  }, []);

  useEffect(() => {
    loadWallet();
    loadLogsData(1, 'all');
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    if (!walletData) return;
    setSavingToggles(true);
    try {
      let updatedToggles = { ...walletData.wallet.toggles };
      let updatedEnabled = walletData.wallet.enabled;

      if (key === 'global_enabled') {
        updatedEnabled = value;
      } else {
        updatedToggles = {
          ...updatedToggles,
          [key]: value,
        };
      }

      const res = await updateSmsPreferences({
        enabled: updatedEnabled,
        toggles: updatedToggles,
      });

      setWalletData({
        ...walletData,
        wallet: res.wallet,
      });

      toast({
        title: 'SMS Preferences Saved',
        description: 'Your school notification preferences have been updated.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to update preferences',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSavingToggles(false);
    }
  };

  const handleBuyPackage = async (pkg: SmsPackage) => {
    setTopupLoading(pkg.id);
    try {
      const returnUrl = window.location.href.split('?')[0];
      const res = await initializeSmsTopup({
        packageId: pkg.id,
        callbackUrl: returnUrl,
      });

      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        throw new Error('No checkout URL returned from payment processor');
      }
    } catch (err: any) {
      toast({
        title: 'Top-up error',
        description: err?.message || 'Could not initiate Paystack checkout.',
        variant: 'destructive',
      });
      setTopupLoading(null);
    }
  };

  const handleRequestSenderId = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = requestedSenderId.trim().toUpperCase();
    if (!clean || clean.length < 3 || clean.length > 11) {
      toast({
        title: 'Invalid Sender ID',
        description: 'Sender ID must be 3 to 11 characters (letters and numbers only).',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingSenderId(true);
    try {
      const res = await requestSenderId({
        senderId: clean,
        purpose: senderIdPurpose,
      });
      toast({
        title: 'Sender ID Requested',
        description: res.message,
      });
      setRequestedSenderId('');
      setSenderIdPurpose('');
      await loadWallet();
    } catch (err: any) {
      toast({
        title: 'Request failed',
        description: err?.message || 'Could not submit Sender ID request.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingSenderId(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast({ title: 'Enter phone number', variant: 'destructive' });
      return;
    }

    setSendingTest(true);
    try {
      const res = await sendTestSms({
        phone: testPhone.trim(),
        message: testMessage.trim() || undefined,
      });
      toast({
        title: 'Test SMS Sent! 🚀',
        description: res.message,
      });
      setTestPhone('');
      setTestMessage('');
      await loadWallet();
      await loadLogsData(1, eventFilter);
    } catch (err: any) {
      toast({
        title: 'Test SMS Failed',
        description: err?.message || 'Could not dispatch test SMS.',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center space-x-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Loading SMS wallet and settings...</span>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const balance = wallet?.balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Balance Card */}
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                SMS Credit Balance
              </CardDescription>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">
              {balance.toLocaleString()}{' '}
              <span className="text-sm font-normal text-muted-foreground">credits</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-2">
              {balance > 100 ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Healthy Balance
                </Badge>
              ) : balance > 0 ? (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Low Balance (Top-up soon)
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Out of Credits
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sender ID Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Sender ID
              </CardDescription>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="font-mono text-2xl font-bold tracking-tight">
              {wallet?.senderId || 'SCHOLARNRV'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center space-x-2">
              {wallet?.senderIdStatus === 'approved' ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs">
                  Verified Custom ID
                </Badge>
              ) : wallet?.senderIdStatus === 'pending' ? (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs">
                  <Clock className="mr-1 h-3 w-3" /> Pending Telco Review
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  ScholarNerve Default
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gateway Status */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Gateway & Delivery
              </CardDescription>
              <PhoneCall className="h-4 w-4 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Arkesel SMS v2</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ghana Telcos (MTN, Telecel, AT)</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadWallet}>
                <RefreshCw className="mr-1 h-3 w-3" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="packages" className="gap-1.5 text-xs sm:text-sm">
            <CreditCard className="h-4 w-4" /> Top Up Credits
          </TabsTrigger>
          <TabsTrigger value="toggles" className="gap-1.5 text-xs sm:text-sm">
            <Sliders className="h-4 w-4" /> Notification Rules
          </TabsTrigger>
          <TabsTrigger value="senderid" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="h-4 w-4" /> Sender ID & Test
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm">
            <History className="h-4 w-4" /> Delivery Logs
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: TOP UP PACKAGES                                        */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Purchase SMS Credit Bundles</h3>
              <p className="text-sm text-muted-foreground">
                Credits are added immediately upon successful payment via MTN Mobile Money, Telecel Cash, AT, or Card.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {walletData?.packages?.map((pkg) => {
              const isPopular = pkg.badge === 'Popular';
              const isBest = pkg.badge === 'Best Value';
              const unitCost = (pkg.priceGhs / pkg.credits).toFixed(3);

              return (
                <Card
                  key={pkg.id}
                  className={`relative flex flex-col justify-between transition-all hover:shadow-md ${
                    isPopular ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-primary text-primary-foreground text-xs font-semibold uppercase">
                        {pkg.badge}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold">{pkg.name}</CardTitle>
                    <CardDescription className="text-xs">
                      ~GHS {unitCost} per SMS segment
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-4">
                    <div className="space-y-1">
                      <div className="text-3xl font-extrabold text-foreground">
                        {pkg.credits.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-muted-foreground">SMS</span>
                      </div>
                      <div className="text-lg font-semibold text-primary">
                        GHS {pkg.priceGhs.toFixed(2)}
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Never expires
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Delivery to all Ghana networks
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Instant top-up via Paystack MoMo
                      </li>
                    </ul>
                  </CardContent>

                  <div className="p-4 pt-0">
                    <Button
                      className="w-full gap-2 font-medium"
                      variant={isPopular ? 'default' : 'outline'}
                      disabled={topupLoading === pkg.id}
                      onClick={() => handleBuyPackage(pkg)}
                    >
                      {topupLoading === pkg.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Connecting...
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4" /> Buy for GHS {pkg.priceGhs}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Top-up History Table */}
          {walletData?.recentTopups && walletData.recentTopups.length > 0 && (
            <Card className="mt-6 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Recent Top-Up Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletData.recentTopups.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{tx.package_name}</TableCell>
                        <TableCell className="text-xs">GHS {Number(tx.amount_ghs).toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-600">
                          +{tx.credits_purchased}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={tx.status === 'successful' ? 'outline' : 'secondary'}
                            className={`text-xs ${
                              tx.status === 'successful'
                                ? 'border-emerald-500/30 text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: NOTIFICATION PREFERENCES & TOGGLES                     */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="toggles" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Automatic SMS Triggers</CardTitle>
                  <CardDescription className="text-xs">
                    Choose which actions in ScholarNerve automatically dispatch SMS notifications to parents and guardians.
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="master-sms-toggle" className="text-xs font-semibold">
                    Master SMS Switch:
                  </Label>
                  <Switch
                    id="master-sms-toggle"
                    checked={wallet?.enabled ?? true}
                    onCheckedChange={(checked) => handleToggle('global_enabled', checked)}
                    disabled={savingToggles}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 divide-y divide-border pt-0">
              {/* Payment Receipts */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Fee Payments & Receipts</Label>
                  <p className="text-xs text-muted-foreground">
                    Send an instant SMS receipt with amount paid and remaining balance whenever fees are paid (cash, bank, or online).
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.payments ?? true}
                  onCheckedChange={(c) => handleToggle('payments', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>

              {/* Attendance Absences */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Daily Attendance (Student Absence Alerts)</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically alert parents immediately when a student is marked absent during class attendance roll call.
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.attendance ?? true}
                  onCheckedChange={(c) => handleToggle('attendance', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>

              {/* Terminal Reports */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Terminal Report Cards Released</Label>
                  <p className="text-xs text-muted-foreground">
                    Notify parents via SMS when end-of-term results and report cards are officially published by class teachers.
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.grades ?? true}
                  onCheckedChange={(c) => handleToggle('grades', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>

              {/* Announcements & Broadcasts */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Announcements & Broadcasts</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow school administrators to send general and emergency SMS broadcasts to all parents or specific classes.
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.broadcasts ?? true}
                  onCheckedChange={(c) => handleToggle('broadcasts', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>

              {/* Boarding & Exeats */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Boarding Overdue Exeat & Disciplinary Notices</Label>
                  <p className="text-xs text-muted-foreground">
                    Send urgent SMS to guardians if a boarding student fails to return by their exeat deadline or on serious behavioral alerts.
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.exeats ?? true}
                  onCheckedChange={(c) => handleToggle('exeats', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>

              {/* Birthday Wishes */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Automated Birthday Greetings</Label>
                  <p className="text-xs text-muted-foreground">
                    Send automated celebratory birthday greetings to students and their families on their special day.
                  </p>
                </div>
                <Switch
                  checked={wallet?.toggles.birthdays ?? false}
                  onCheckedChange={(c) => handleToggle('birthdays', c)}
                  disabled={savingToggles || !wallet?.enabled}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SENDER ID & TEST SMS                                   */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="senderid" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Sender ID Registration Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Request Custom Sender ID</CardTitle>
                <CardDescription className="text-xs">
                  Your Sender ID is the display name parents see on their phone (e.g. <code>STPETERS</code>). 
                  Telcos require approval (3–11 alphanumeric characters).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletData?.pendingSenderIdRequest ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-2 font-semibold">
                      <Clock className="h-4 w-4" /> Request Under Review
                    </div>
                    <p className="mt-1">
                      Your requested Sender ID <strong>{walletData.pendingSenderIdRequest.requested_sender_id}</strong> was submitted on{' '}
                      {new Date(walletData.pendingSenderIdRequest.created_at).toLocaleDateString()}. Telco review normally takes 24–48 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestSenderId} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="req-sender-id" className="text-xs font-semibold">
                        Desired Sender ID (Max 11 characters)
                      </Label>
                      <Input
                        id="req-sender-id"
                        placeholder="e.g. ROSAGARDENS"
                        maxLength={11}
                        value={requestedSenderId}
                        onChange={(e) => setRequestedSenderId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        className="font-mono uppercase tracking-wider"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {requestedSenderId.length}/11 characters. Letters and numbers only (no spaces or symbols).
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="req-purpose" className="text-xs font-semibold">
                        School Name / Organization Details
                      </Label>
                      <Input
                        id="req-purpose"
                        placeholder="e.g. Rosa Gardens International School, Accra"
                        value={senderIdPurpose}
                        onChange={(e) => setSenderIdPurpose(e.target.value)}
                      />
                    </div>

                    <Button type="submit" size="sm" disabled={submittingSenderId || requestedSenderId.length < 3}>
                      {submittingSenderId ? 'Submitting...' : 'Submit Sender ID for Approval'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Test SMS Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Send Test SMS</CardTitle>
                <CardDescription className="text-xs">
                  Verify immediate delivery to your personal phone number. (Consumes 1 SMS credit).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendTest} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="test-phone" className="text-xs font-semibold">
                      Recipient Phone Number
                    </Label>
                    <Input
                      id="test-phone"
                      placeholder="e.g. 0244123456 or +233..."
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="test-msg" className="text-xs font-semibold">
                      Custom Message (Optional)
                    </Label>
                    <Input
                      id="test-msg"
                      placeholder="Leave blank for standard gateway test message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      maxLength={160}
                    />
                  </div>

                  <Button type="submit" size="sm" variant="outline" disabled={sendingTest || !testPhone.trim()}>
                    {sendingTest ? (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="mr-1 h-3 w-3" /> Send Test SMS
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: DELIVERY LOGS & AUDIT                                  */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Outbound SMS Delivery Logs</CardTitle>
                <CardDescription className="text-xs">
                  Full audit record of all messages sent from your school via Arkesel. Total: {logTotal}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => loadLogsData(logPage, eventFilter)}
                  disabled={loadingLogs}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="max-w-[280px]">Message</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                        {loadingLogs ? 'Loading SMS logs...' : 'No SMS messages have been sent yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div className="text-[10px] text-muted-foreground/70">
                            {new Date(log.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-mono font-medium">{log.recipient_phone}</div>
                          {log.recipient_name && (
                            <div className="text-[11px] text-muted-foreground">{log.recipient_name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {log.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {log.message}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {log.credits_deducted} cr
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === 'sent' ? 'outline' : 'destructive'}
                            className={`text-[10px] ${
                              log.status === 'sent'
                                ? 'border-emerald-500/30 text-emerald-600'
                                : ''
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {logTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div className="text-xs text-muted-foreground">
                    Page {logPage} of {logTotalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={logPage <= 1 || loadingLogs}
                      onClick={() => loadLogsData(logPage - 1, eventFilter)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={logPage >= logTotalPages || loadingLogs}
                      onClick={() => loadLogsData(logPage + 1, eventFilter)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmsWalletTab;
