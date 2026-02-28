import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  DollarSign,
  Download,
  Play,
  ChevronLeft,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users
} from 'lucide-react';
import React, { useState } from 'react';
import CreatePayrollRunDialog from './CreatePayrollRunDialog';
import { useGenerateReport, useInitializeRun, usePayrollRunDetails, usePayrollRuns } from './usePayrollManagement';
import { RecordPaymentModal, AdjustmentModal } from './PayrollActionModals';

interface PayrollRun {
  id: number;
  month_year: string;
  status: string;
  total_amount: number;
  processed_date?: string;
  created_at: string;
  items?: any[];
  totalStaff?: number;
}

const PayrollManagement: React.FC = () => {
  const { data: runsData = [], isLoading: loadingRuns, refetch: refetchRuns } = usePayrollRuns();
  const initializeRun = useInitializeRun();
  const generateReport = useGenerateReport();
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

  const handleInitializeRun = (runId: number) => {
    initializeRun.mutate(runId, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Payroll run initialized with all staff members'
        });
        refetchRuns();
      },
      onError: (err: any) => {
        toast({
          title: 'Error',
          description: err?.response?.data?.message ?? 'Failed to initialize payroll run',
          variant: 'destructive'
        });
      }
    });
  };

  const handleGenerateReport = (runId: number) => {
    generateReport.mutate(runId, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Payroll report generated'
        });
      },
      onError: (err: any) => {
        toast({
          title: 'Error',
          description: err?.response?.data?.message ?? 'Failed to generate report',
          variant: 'destructive'
        });
      }
    });
  };

  const statusMap: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-800', icon: AlertCircle },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: Play },
    finalized: { label: 'Finalized', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount).replace('GHS', '₵');
  };

  if (selectedRun) {
    return (
      <PayrollRunDetails
        payrollRun={selectedRun}
        onBack={() => setSelectedRun(null)}
        onUpdate={refetchRuns}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payroll Management</h1>
          <p className="text-slate-500">Manage monthly staff salaries, deductions, and bonuses.</p>
        </div>
        <CreatePayrollRunDialog onSuccess={refetchRuns} />
      </div>

      {loadingRuns ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl" />)}
        </div>
      ) : runsData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Runs</p>
                  <h3 className="text-3xl font-bold mt-1">{runsData.length}</h3>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-100" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Last Processed</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {runsData.find(r => r.status === 'finalized')?.month_year
                      ? new Date(`${runsData.find(r => r.status === 'finalized')?.month_year}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : 'None'}
                  </h3>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Draft Runs</p>
                  <h3 className="text-3xl font-bold mt-1">{runsData.filter(r => r.status === 'draft').length}</h3>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-100" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loadingRuns ? (
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="py-20 text-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p>Loading payroll history...</p>
            </div>
          </CardContent>
        </Card>
      ) : runsData.length === 0 ? (
        <Card className="border-0 shadow-xl overflow-hidden bg-slate-50/50">
          <CardContent className="py-20 text-center text-slate-500">
            <div className="max-w-xs mx-auto">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No payroll runs yet</h3>
              <p className="text-sm mt-1">Create your first payroll run to start managing staff salaries.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg">Payroll History</CardTitle>
            <CardDescription>Recently created and processed payroll runs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 pointer-events-none">
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-center">Staff Count</TableHead>
                    <TableHead className="font-semibold text-right">Total Amount</TableHead>
                    <TableHead className="font-semibold">Created Date</TableHead>
                    <TableHead className="font-semibold text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsData.map((run) => {
                    const status = statusMap[run.status] || statusMap.draft;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={run.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-semibold text-slate-900">
                          {new Date(`${run.month_year}-01`).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${status.color} px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-fit border-0 font-medium`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-slate-600 font-medium">
                          <span className="flex items-center justify-center gap-1">
                            <Users className="w-4 h-4 text-slate-400" />
                            {run.totalStaff ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatCurrency(run.total_amount || 0)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(run.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex gap-2 justify-end">
                            {run.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 border-slate-200 hover:border-blue-500 hover:text-blue-500"
                                onClick={() => handleInitializeRun(run.id)}
                                title="Initialize with all staff"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-slate-200 hover:border-slate-800"
                              onClick={() => handleGenerateReport(run.id)}
                              title="Export Report"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
                              onClick={() => setSelectedRun(run)}
                            >
                              Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface PayrollRunDetailsProps {
  payrollRun: PayrollRun;
  onBack: () => void;
  onUpdate: () => void;
}

const PayrollRunDetails: React.FC<PayrollRunDetailsProps> = ({ payrollRun, onBack, onUpdate }) => {
  const { data: runDetails, isLoading: loadingDetails, refetch } = usePayrollRunDetails(payrollRun.id);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [modalType, setModalType] = useState<'payment' | 'deduction' | 'bonus' | null>(null);

  const items = runDetails?.items || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount).replace('GHS', '₵');
  };

  const totals = {
    base: items.reduce((sum: number, i: any) => sum + Number(i.base_salary), 0),
    deductions: items.reduce((sum: number, i: any) => sum + Number(i.deductions), 0),
    bonuses: items.reduce((sum: number, i: any) => sum + Number(i.bonuses), 0),
    net: items.reduce((sum: number, i: any) => sum + Number(i.net_amount), 0),
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-900">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to list
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {new Date(`${payrollRun.month_year}-01`).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long'
            })} Run
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-slate-500 font-medium">#{payrollRun.id}</Badge>
            <Badge className={
              payrollRun.status === 'finalized' ? 'bg-emerald-100 text-emerald-800 border-0' :
                payrollRun.status === 'processing' ? 'bg-blue-100 text-blue-800 border-0' :
                  'bg-slate-100 text-slate-800 border-0'
            }>
              {payrollRun.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gross Total</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totals.base)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Deductions</p>
            <p className="text-xl font-bold text-red-600 mt-1">-{formatCurrency(totals.deductions)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Bonuses</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">+{formatCurrency(totals.bonuses)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-indigo-50 border-indigo-100">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Net Payable</p>
            <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(totals.net)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {loadingDetails ? (
            <div className="text-center py-20 text-slate-400">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-2" />
              Loading items...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No payroll items found</h3>
              <p className="text-slate-500 mt-1">Please initialize this run to generate items for all active staff.</p>
              <Button
                className="mt-6 bg-slate-900 hover:bg-slate-800"
                onClick={() => {
                  onBack();
                }}
              >
                Go Back to List
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="py-4 font-semibold">Staff Member</TableHead>
                    <TableHead className="py-4 font-semibold text-right">Base Salary</TableHead>
                    <TableHead className="py-4 font-semibold text-right">Deductions</TableHead>
                    <TableHead className="py-4 font-semibold text-right">Bonuses</TableHead>
                    <TableHead className="py-4 font-semibold text-right">Net Amount</TableHead>
                    <TableHead className="py-4 font-semibold text-center">Status</TableHead>
                    <TableHead className="py-4 font-semibold text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b last:border-0">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {item.display_name?.charAt(0) || item.email?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.display_name || item.email}</p>
                            <p className="text-xs text-slate-500 font-mono uppercase tracking-tighter">{item.staff_id_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-600">
                        {formatCurrency(item.base_salary)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {item.deductions > 0 ? `-${formatCurrency(item.deductions)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {item.bonuses > 0 ? `+${formatCurrency(item.bonuses)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatCurrency(item.net_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            item.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 border-0'
                              : 'bg-amber-100 text-amber-800 border-0'
                          }
                        >
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex gap-1.5 justify-end">
                          {item.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setActiveItem(item);
                                  setModalType('deduction');
                                }}
                                title="Add Deduction"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                                onClick={() => {
                                  setActiveItem(item);
                                  setModalType('bonus');
                                }}
                                title="Add Bonus"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                onClick={() => {
                                  setActiveItem(item);
                                  setModalType('payment');
                                }}
                              >
                                Pay Now
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled
                              className="h-8 px-3 text-emerald-600 bg-emerald-50 opacity-100"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Paid
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

      {/* Modals */}
      {activeItem && modalType === 'payment' && (
        <RecordPaymentModal
          isOpen={true}
          onClose={() => {
            setActiveItem(null);
            setModalType(null);
          }}
          payrollItem={activeItem}
          onSuccess={() => {
            refetch();
            onUpdate();
          }}
        />
      )}

      {activeItem && (modalType === 'deduction' || modalType === 'bonus') && (
        <AdjustmentModal
          isOpen={true}
          onClose={() => {
            setActiveItem(null);
            setModalType(null);
          }}
          payrollItem={activeItem}
          type={modalType}
          onSuccess={() => {
            refetch();
            onUpdate();
          }}
        />
      )}
    </div>
  );
};

export default PayrollManagement;
