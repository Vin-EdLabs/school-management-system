import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  fetchMasterArkeselBalance,
  fetchAllSenderIdRequests,
  updateSenderIdRequestStatus,
  adminCreditTenantSms,
  type SenderIdRequestRow,
} from '@/services/smsApi';
import { apiService } from '@/services/api';
import {
  Zap,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  PhoneCall,
  Search,
} from 'lucide-react';

interface SchoolItem {
  id: number;
  name: string;
  sms_balance?: number;
}

export const SuperAdminSmsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [masterBalance, setMasterBalance] = useState<{ balance?: number; currency?: string; error?: string } | null>(null);
  const [requests, setRequests] = useState<SenderIdRequestRow[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Manual Credit State
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>('');
  const [creditAmount, setCreditAmount] = useState<string>('500');
  const [creditReason, setCreditReason] = useState('Manual bank payment / Grant');
  const [crediting, setCrediting] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [balRes, reqRes, schoolsRes] = await Promise.all([
        fetchMasterArkeselBalance().catch((e) => ({ success: false, error: e?.message })),
        fetchAllSenderIdRequests().catch(() => []),
        apiService.get<any>('/schools').catch(() => ({ schools: [] })),
      ]);

      setMasterBalance(balRes);
      setRequests(reqRes);
      const schoolList = Array.isArray(schoolsRes) ? schoolsRes : schoolsRes?.schools || [];
      setSchools(schoolList);
    } catch (err: any) {
      toast({
        title: 'Error loading SMS admin data',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveSenderId = async (req: SenderIdRequestRow) => {
    setUpdatingId(req.id);
    try {
      await updateSenderIdRequestStatus(req.id, { status: 'approved' });
      toast({
        title: 'Sender ID Approved',
        description: `Sender ID '${req.requested_sender_id}' has been approved for ${req.school_name || 'school'}.`,
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Action failed',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectSenderId = async (req: SenderIdRequestRow) => {
    const reason = window.prompt('Enter rejection reason (e.g. invalid name, not matching school docs):');
    if (reason === null) return;

    setUpdatingId(req.id);
    try {
      await updateSenderIdRequestStatus(req.id, { status: 'rejected', rejectionReason: reason });
      toast({
        title: 'Sender ID Rejected',
        description: `Request for '${req.requested_sender_id}' was marked rejected.`,
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Action failed',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGrantCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      toast({ title: 'Select a school', variant: 'destructive' });
      return;
    }
    const credits = parseInt(creditAmount, 10);
    if (!credits || credits <= 0) {
      toast({ title: 'Enter a valid number of credits', variant: 'destructive' });
      return;
    }

    setCrediting(true);
    try {
      const res = await adminCreditTenantSms({
        tenantId: Number(selectedSchoolId),
        credits,
        reason: creditReason,
      });

      toast({
        title: 'Credits Granted! 🎉',
        description: `Successfully added ${credits} SMS credits. Previous: ${res.previousBalance}, New Balance: ${res.newBalance}.`,
      });
      setSelectedSchoolId('');
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Credit failed',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setCrediting(false);
    }
  };

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Master Arkesel Balance */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold">Master Arkesel Wallet</CardDescription>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {masterBalance?.balance != null
                ? `${masterBalance.currency || 'GHS'} ${Number(masterBalance.balance).toFixed(2)}`
                : masterBalance?.error
                  ? 'Key Pending'
                  : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {masterBalance?.error ? (
              <span className="text-amber-600">{masterBalance.error}</span>
            ) : (
              'Available wholesale credit for entire platform'
            )}
          </CardContent>
        </Card>

        {/* Pending Sender ID Requests */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold">Pending Sender IDs</CardDescription>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {requests.filter((r) => r.status === 'pending').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Awaiting telco verification and approval
          </CardContent>
        </Card>

        {/* Quick Refresh */}
        <Card className="border-border flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Gateway Status</CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-emerald-500" /> Arkesel v2 API
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={loadData} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Gateway Status
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Manual SMS Credit Grant Form */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" /> Manually Credit School SMS Wallet
            </CardTitle>
            <CardDescription className="text-xs">
              Allocate SMS units to any school (e.g. for offline bank transfers, cash payments, or complimentary trials).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGrantCredit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="search-school" className="text-xs font-semibold">
                  Select School
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-school"
                    placeholder="Search school name..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">-- Choose school --</option>
                  {filteredSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Tenant #{s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="credit-amount" className="text-xs font-semibold">
                    Credits to Add
                  </Label>
                  <Input
                    id="credit-amount"
                    type="number"
                    min="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    required
                    className="text-xs h-9 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="credit-reason" className="text-xs font-semibold">
                    Reason / Note
                  </Label>
                  <Input
                    id="credit-reason"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" disabled={crediting || !selectedSchoolId}>
                {crediting ? 'Crediting Wallet...' : 'Grant SMS Credits'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sender ID Requests Card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Sender ID Verification Queue
            </CardTitle>
            <CardDescription className="text-xs">
              Review and approve custom Sender IDs requested by schools.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Requested ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                        No Sender ID requests in queue.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          <div className="font-semibold">{r.school_name || `Tenant #${r.tenant_id}`}</div>
                          {r.purpose && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{r.purpose}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {r.requested_sender_id}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === 'approved'
                                ? 'outline'
                                : r.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className={`text-[10px] ${
                              r.status === 'approved' ? 'border-emerald-500/30 text-emerald-600' : ''
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                disabled={updatingId === r.id}
                                onClick={() => handleApproveSenderId(r)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                disabled={updatingId === r.id}
                                onClick={() => handleRejectSenderId(r)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminSmsPanel;
