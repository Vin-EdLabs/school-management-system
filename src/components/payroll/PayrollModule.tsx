import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';
import { Users, DollarSign, Wallet, AlertCircle, Plus, CheckCircle, Info, Pencil, Copy, KeyRound } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PayrollModule = () => {
  const { schoolId } = useSchool();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ staffId: string; pin: string; name: string } | null>(null);
  const [selectedPayee, setSelectedPayee] = useState<any>(null);
  const [selectedEditPayee, setSelectedEditPayee] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: '', role: '', monthly_salary: '' });
  const [newStaff, setNewStaff] = useState({ full_name: '', role: '', monthly_salary: '' });
  const [payForm, setPayForm] = useState({ amount: '', paid_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer' });

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadPayroll();
  }, [schoolId, month, year]);

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const res = await apiService.get<any>(`/payroll?month=${month}&year=${year}`);
      setData(res);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load payroll', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.full_name || !newStaff.monthly_salary) {
      toast({ title: 'Error', description: 'Name and salary are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await apiService.post<any>('/payroll/other-staff', {
        full_name: newStaff.full_name,
        role: newStaff.role || null,
        monthly_salary: parseFloat(newStaff.monthly_salary),
      });
      toast({ title: 'Staff Added', description: `${newStaff.full_name} has been added to payroll` });
      setNewStaff({ full_name: '', role: '', monthly_salary: '' });
      setAddStaffOpen(false);
      loadPayroll();
      if (res?.loginStaffId && res?.loginPin) {
        setLoginCredentials({ staffId: res.loginStaffId, pin: res.loginPin, name: newStaff.full_name });
        setCredentialsOpen(true);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to add staff', variant: 'destructive' });
    }
  };

  const openEditDialog = (payee: any) => {
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

  const handleRecordPayment = async () => {
    if (!selectedPayee || !payForm.amount) return;
    try {
      await apiService.post('/payroll/pay', {
        payee_type: selectedPayee.payeeType,
        payee_id: selectedPayee.id,
        month,
        year,
        amount: parseFloat(payForm.amount),
        paid_date: payForm.paid_date,
        payment_method: payForm.payment_method,
      });
      toast({ title: 'Payment Recorded', description: `GHS ${payForm.amount} recorded for ${selectedPayee.name}` });
      setPayDialogOpen(false);
      setSelectedPayee(null);
      setPayForm({ amount: '', paid_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer' });
      loadPayroll();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record payment', variant: 'destructive' });
    }
  };

  const openPayDialog = (payee: any) => {
    setSelectedPayee(payee);
    setPayForm({ amount: String(payee.monthlySalary), paid_date: new Date().toISOString().slice(0, 10), payment_method: 'Bank Transfer' });
    setPayDialogOpen(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monthly salary management — Teachers & staff</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-40 bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28 bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddStaffOpen(true)} variant="outline" className="border-border">
            <Plus className="w-4 h-4 mr-2" />
            Add Other Staff
          </Button>
        </div>
      </div>

      {/* Info banner - teachers auto-appear */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground font-semibold">Teachers appear automatically.</strong> When you add a teacher in the Teachers module with a monthly salary, they automatically appear here. Use &quot;Add Other Staff&quot; for non-teaching staff (secretaries, security, etc.).
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Staff</p>
                  <p className="text-xl font-bold text-foreground">{data.payroll?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Salary</p>
                  <p className="text-xl font-bold text-foreground">GHS {(data.summary?.totalSalary || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-xl font-bold text-foreground">{data.summary?.paidCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid</p>
                  <p className="text-xl font-bold text-foreground">{data.summary?.unpaidCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payroll Table */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Payroll — {MONTHS[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : !data?.payroll?.length ? (
            <div className="py-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No staff on payroll for this month.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Add teachers in the Teachers module, or add other staff above.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Role / Class</TableHead>
                    <TableHead className="font-semibold text-foreground">Staff ID</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Monthly Salary</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Amount Paid</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Paid Date</TableHead>
                    <TableHead className="w-[160px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payroll.map((p: any) => (
                    <TableRow key={`${p.payeeType}-${p.id}`} className="hover:bg-muted/30 border-border transition-colors">
                      <TableCell className="font-semibold text-foreground">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.role || '-'}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{p.staffId || '-'}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-foreground">GHS {p.monthlySalary.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">GHS {p.amountPaid.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            p.status === 'Paid'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : p.status === 'Partially Paid'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'border-border bg-muted text-muted-foreground'
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(p)} className="text-muted-foreground hover:text-foreground" title="Edit info and pay">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {p.status !== 'Paid' && (
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(p)} className="border-border">
                            Record Payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Other Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} placeholder="e.g. John Doe" className="mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} placeholder="e.g. Secretary, Security" className="mt-1" />
            </div>
            <div>
              <Label>Monthly Salary (GHS) *</Label>
              <Input type="number" value={newStaff.monthly_salary} onChange={(e) => setNewStaff({ ...newStaff, monthly_salary: e.target.value })} placeholder="0.00" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStaffOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStaff} className="bg-slate-800 hover:bg-slate-700">Add Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selectedEditPayee?.payeeType === 'teacher' ? 'Teacher' : 'Staff'} — {selectedEditPayee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEditPayee && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full name" className="mt-1" />
              </div>
              {selectedEditPayee.payeeType === 'staff' && (
                <div>
                  <Label>Role</Label>
                  <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="e.g. Secretary, Security" className="mt-1" />
                </div>
              )}
              <div>
                <Label>Monthly Salary (GHS) *</Label>
                <Input type="number" value={editForm.monthly_salary} onChange={(e) => setEditForm({ ...editForm, monthly_salary: e.target.value })} placeholder="0.00" className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} className="bg-slate-800 hover:bg-slate-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login credentials dialog for new staff */}
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              Login Credentials for {loginCredentials?.name || 'Staff'}
            </DialogTitle>
          </DialogHeader>
          {loginCredentials && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Share these credentials. They login with <strong>Staff ID</strong> as username and <strong>PIN</strong> as password.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Staff ID (Username)</p>
                    <p className="font-mono font-semibold text-slate-800">{loginCredentials.staffId}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.staffId); toast({ title: 'Copied' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">PIN (Password)</p>
                    <p className="font-mono font-semibold text-slate-800">{loginCredentials.pin}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.pin); toast({ title: 'Copied' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Save this PIN now. It cannot be retrieved later.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Salary Payment — {selectedPayee?.name}</DialogTitle>
          </DialogHeader>
          {selectedPayee && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-600">Monthly Salary: GHS {selectedPayee.monthlySalary.toLocaleString()}</p>
              <div>
                <Label>Amount (GHS) *</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} className="bg-slate-800 hover:bg-slate-700">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollModule;
