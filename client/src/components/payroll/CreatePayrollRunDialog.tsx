import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Calendar } from 'lucide-react';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-95">
          <Plus className="w-4 h-4 mr-2" />
          New Payroll Run
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-2xl font-bold">Create Payroll Run</DialogTitle>
          <DialogDescription className="text-slate-500">
            Select the month and year you wish to process salaries for.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="monthYear" className="text-sm font-semibold">Select Payroll Period</Label>
            <Select value={monthYear} onValueChange={setMonthYear}>
              <SelectTrigger className="h-12 border-slate-200 focus:ring-blue-500">
                <SelectValue placeholder="Chose a month..." />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month} className="py-3">
                    {new Date(`${month}-01`).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRun.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {createRun.isPending ? 'Working...' : 'Initialize Run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePayrollRunDialog;
