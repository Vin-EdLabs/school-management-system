import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useCreatePayrollRun } from './usePayrollManagement';

interface CreatePayrollRunDialogProps {
  onSuccess?: () => void;
}

const CreatePayrollRunDialog: React.FC<CreatePayrollRunDialogProps> = ({ onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [monthYear, setMonthYear] = useState('');
  const createRun = useCreatePayrollRun();

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!monthYear) {
      toast({
        title: 'Validation Error',
        description: 'Please select a month and year',
        variant: 'destructive'
      });
      return;
    }

    createRun.mutate({ monthYear }, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: `Payroll run created for ${monthYear}`
        });
        setMonthYear('');
        setOpen(false);
        onSuccess?.();
      },
      onError: (err: any) => {
        toast({
          title: 'Error',
          description: err?.response?.data?.message ?? 'Failed to create payroll run',
          variant: 'destructive'
        });
      }
    });
  };

  // Generate last 12 months
  const months = [];
  for (let i = 0; i < 12; i++) {
    let month = currentMonth - i;
    let year = currentYear;

    if (month <= 0) {
      month += 12;
      year -= 1;
    }

    const monthStr = String(month).padStart(2, '0');
    months.push(`${year}-${monthStr}`);
  }

  return (
    <div>
      {open ? (
        <Card>
          <CardHeader>
            <CardTitle>Create New Payroll Run</CardTitle>
            <CardDescription>Start a new payroll run for the selected month</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monthYear">Select Month & Year</Label>
                <Select value={monthYear} onValueChange={setMonthYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {new Date(`${month}-01`).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long'
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createRun.isPending}>
                  {createRun.isPending ? 'Creating...' : 'Create Payroll Run'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Payroll Run
        </Button>
      )}
    </div>
  );
};

export default CreatePayrollRunDialog;
