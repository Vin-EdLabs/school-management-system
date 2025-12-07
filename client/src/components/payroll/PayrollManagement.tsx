import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Download, Play } from 'lucide-react';
import React, { useState } from 'react';
import CreatePayrollRunDialog from './CreatePayrollRunDialog';
import { useGenerateReport, useInitializeRun, usePayrollRunDetails, usePayrollRuns } from './usePayrollManagement';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'finalized':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount).replace('GHS', '₵');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payroll Management
          </CardTitle>
          <CreatePayrollRunDialog onSuccess={refetchRuns} />
        </CardHeader>
      </Card>

      {loadingRuns ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Loading payroll runs...
          </CardContent>
        </Card>
      ) : runsData.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No payroll runs yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Staff Count</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsData.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {new Date(`${run.month_year}-01`).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long'
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(run.status)}>
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.totalStaff ?? 0} staff</TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(run.total_amount || 0)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(run.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {run.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInitializeRun(run.id)}
                              title="Initialize payroll with all staff"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRun(run);
                              handleGenerateReport(run.id);
                            }}
                            title="Generate payroll report"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRun(run)}
                            className="text-blue-600"
                          >
                            View Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedRun && (
        <PayrollRunDetails
          payrollRun={selectedRun}
          onClose={() => setSelectedRun(null)}
          onUpdate={refetchRuns}
        />
      )}
    </div>
  );
};

interface PayrollRunDetailsProps {
  payrollRun: PayrollRun;
  onClose: () => void;
  onUpdate: () => void;
}

const PayrollRunDetails: React.FC<PayrollRunDetailsProps> = ({ payrollRun, onClose, onUpdate }) => {
  const { data: runDetails, isLoading: loadingDetails, refetch } = usePayrollRunDetails(payrollRun.id);
  const items = runDetails?.items || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount).replace('GHS', '₵');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Payroll Details -{' '}
            {new Date(`${payrollRun.month_year}-01`).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long'
            })}
          </CardTitle>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingDetails ? (
          <div className="text-center py-8 text-gray-500">Loading staff payroll items...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No payroll items. Initialize this run first.</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Bonuses</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.username}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.username}</TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(item.base_salary)}
                    </TableCell>
                    <TableCell className="font-mono text-red-600">
                      -{formatCurrency(item.deductions)}
                    </TableCell>
                    <TableCell className="font-mono text-green-600">
                      +{formatCurrency(item.bonuses)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {formatCurrency(item.net_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log('Record payment for', item.id)}
                        >
                          Pay Now
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Base Salary</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(items.reduce((sum, i) => sum + i.base_salary, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">
                  -{formatCurrency(items.reduce((sum, i) => sum + i.deductions, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Net Payable</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(items.reduce((sum, i) => sum + i.net_amount, 0))}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PayrollManagement;
