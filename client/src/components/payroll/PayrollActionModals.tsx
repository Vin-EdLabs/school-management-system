import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import React, { useState } from 'react';
import { useAddBonus, useAddDeduction, useRecordPayment } from './usePayrollManagement';

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payrollItem: any;
    onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
    isOpen,
    onClose,
    payrollItem,
    onSuccess,
}) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [referenceNumber, setReferenceNumber] = useState('');
    const recordPayment = useRecordPayment();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        recordPayment.mutate(
            {
                itemId: payrollItem.id.toString(),
                payload: { paymentDate, paymentMethod, referenceNumber },
            },
            {
                onSuccess: () => {
                    toast({ title: 'Success', description: 'Payment recorded successfully' });
                    onSuccess();
                    onClose();
                },
                onError: (err: any) => {
                    toast({
                        title: 'Error',
                        description: err?.response?.data?.message ?? 'Failed to record payment',
                        variant: 'destructive',
                    });
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                        Record salary payment for {payrollItem?.display_name || payrollItem?.username}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Net Amount to Pay</Label>
                        <Input
                            id="amount"
                            value={`₵ ${Number(payrollItem?.net_amount || 0).toLocaleString()}`}
                            disabled
                            className="bg-gray-50 font-bold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Payment Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="method">Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ref">Reference Number / Transaction ID</Label>
                        <Input
                            id="ref"
                            placeholder="Optional"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={recordPayment.isPending}>
                            {recordPayment.isPending ? 'Processing...' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

interface AdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payrollItem: any;
    type: 'deduction' | 'bonus';
    onSuccess: () => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
    isOpen,
    onClose,
    payrollItem,
    type,
    onSuccess,
}) => {
    const [adjustmentType, setAdjustmentType] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const addDeduction = useAddDeduction();
    const addBonus = useAddBonus();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const mutation = type === 'deduction' ? addDeduction : addBonus;
        const payload = type === 'deduction'
            ? { deductionType: adjustmentType, amount: Number(amount), description }
            : { bonusType: adjustmentType, amount: Number(amount), description };

        mutation.mutate(
            {
                itemId: payrollItem.id.toString(),
                payload,
            },
            {
                onSuccess: () => {
                    toast({
                        title: 'Success',
                        description: `${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`
                    });
                    onSuccess();
                    onClose();
                    setAmount('');
                    setAdjustmentType('');
                    setDescription('');
                },
                onError: (err: any) => {
                    toast({
                        title: 'Error',
                        description: err?.response?.data?.message ?? `Failed to add ${type}`,
                        variant: 'destructive',
                    });
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
                    <DialogDescription>
                        Add a {type} for {payrollItem?.display_name || payrollItem?.username}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="adjType">{type.charAt(0).toUpperCase() + type.slice(1)} Type</Label>
                        <Input
                            id="adjType"
                            placeholder={type === 'deduction' ? 'e.g. Tax, Loan Repayment' : 'e.g. Overtime, Performance'}
                            value={adjustmentType}
                            onChange={(e) => setAdjustmentType(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="adjAmount">Amount (GHS)</Label>
                        <Input
                            id="adjAmount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="adjDesc">Description / Notes</Label>
                        <Textarea
                            id="adjDesc"
                            placeholder="Optional details"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={addDeduction.isPending || addBonus.isPending}>
                            Save {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
