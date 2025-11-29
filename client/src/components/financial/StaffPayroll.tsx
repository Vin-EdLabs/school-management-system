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
import { toast } from '@/hooks/use-toast';
import useStaffPayroll from '@/hooks/useStaffPayroll';
import React, { useEffect, useState } from 'react';

interface StaffMember {
    id: string;
    name: string;
    position: string;
    monthlySalary: number;
    lastPaid?: string;
}

const sampleData: StaffMember[] = [
    { id: 's1', name: 'Alice Johnson', position: 'Accountant', monthlySalary: 3000, lastPaid: '2025-10-25' },
    { id: 's2', name: 'Mark Benson', position: 'Clerk', monthlySalary: 1200, lastPaid: '2025-10-25' },
    { id: 's3', name: 'Grace Lim', position: 'Admin Assistant', monthlySalary: 1500 },
];

const StaffPayroll: React.FC = () => {
    const { staff: staffFromApi, createStaff, updateStaff, payStaff } = useStaffPayroll();
    const [staff, setStaff] = useState<StaffMember[]>(sampleData);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formName, setFormName] = useState('');
    const [formPosition, setFormPosition] = useState('');
    const [formSalary, setFormSalary] = useState<number | ''>('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const today = () => new Date().toISOString().split('T')[0];

    const handlePay = (id: string) => {
        const paid = staff.find(s => s.id === id)?.name ?? 'Staff member';
        // call API to record payment; fallback to local update for immediate UI
        (payStaff as any).mutate({ id, payload: { date: today() } });
        setStaff((prev) => prev.map(s => s.id === id ? { ...s, lastPaid: today() } : s));
        toast({ title: 'Payment recorded', description: `${paid} marked as paid.` });
    };

    const handleProcessPayroll = () => {
        // naive: call payStaff for each staff member (fire-and-forget)
        (staffFromApi || []).forEach((s: any) => {
            (payStaff as any).mutate({ id: s.id, payload: { date: today() } });
        });
        setStaff((prev) => prev.map(s => ({ ...s, lastPaid: today() })));
        toast({ title: 'Payroll processed', description: 'Payroll processed for all staff.' });
    };

    const handleAddPayroll = () => {
        // Open dialog instead of using window.prompt
        setFormName('');
        setFormPosition('');
        setFormSalary('');
        setEditingId(null);
        setIsEditing(false);
        setIsAddOpen(true);
    };

    const handleAddSubmit = () => {
        if (!formName) {
            toast({ title: 'Validation', description: 'Name is required.' });
            return;
        }

        const monthlySalary = typeof formSalary === 'number' ? formSalary : Number(formSalary) || 0;

        if (isEditing && editingId) {
            // update existing locally and via API
            (updateStaff as any).mutate({ id: editingId, payload: { name: formName, position: formPosition || 'Staff', monthlySalary } });
            setStaff((prev) => prev.map(s => s.id === editingId ? { ...s, name: formName, position: formPosition || 'Staff', monthlySalary } : s));
            setIsEditing(false);
            setEditingId(null);
            setIsAddOpen(false);
            toast({ title: 'Updated', description: `${formName} updated.` });
            return;
        }

        const newStaff: StaffMember = {
            id: `s${Date.now()}`,
            name: formName,
            position: formPosition || 'Staff',
            monthlySalary,
        };

        // create via API and update local list
        // cast to any to satisfy the mutation's expected input type
        createStaff.mutate(newStaff as any);
        setStaff((prev) => [newStaff, ...prev]);
        setIsAddOpen(false);
        toast({ title: 'Added', description: `${newStaff.name} added to payroll.` });
    };

    const handleEditClick = (id: string) => {
        const s = staff.find(x => x.id === id);
        if (!s) return;
        setEditingId(id);
        setFormName(s.name);
        setFormPosition(s.position);
        setFormSalary(s.monthlySalary);
        setIsEditing(true);
        setIsAddOpen(true);
    };

    useEffect(() => {
        if (!isAddOpen) {
            // reset editing state when dialog closed
            setIsEditing(false);
            setEditingId(null);
            setFormName('');
            setFormPosition('');
            setFormSalary('');
        }
    }, [isAddOpen]);

    // Keep local `staff` in sync with API list when available
    useEffect(() => {
        if (staffFromApi && staffFromApi.length > 0) {
            // map API fields into local StaffMember shape where possible
            setStaff(staffFromApi.map((s: any) => ({
                id: s.id ?? s._id ?? s.staffId ?? `s${Date.now()}`,
                name: s.name ?? s.fullName ?? s.full_name ?? 'Staff',
                position: s.position ?? s.role ?? 'Staff',
                monthlySalary: Number(s.monthlySalary ?? s.salary ?? s.monthly_salary ?? 0) || 0,
                lastPaid: s.lastPaid ?? s.last_paid ?? s.last_payment_date ?? undefined
            })));
        }
    }, [staffFromApi]);

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Staff Payroll</h2>
                <div className="flex items-center">
                    <Button variant="secondary" size="sm" className="mr-2" onClick={handleAddPayroll}>Add Payroll</Button>
                    <Button variant="default" size="sm" onClick={handleProcessPayroll}>Process Payroll</Button>
                </div>
            </div>

            <div className="bg-white shadow rounded-md overflow-hidden">
                <table className="min-w-full table-auto">
                    <thead className="bg-gray-50">
                        <tr className="text-left">
                            <th className="px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-600">Position</th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-600">Monthly Salary</th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-600">Last Paid</th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map((s) => (
                            <tr key={s.id} className="border-t">
                                <td className="px-4 py-3">{s.name}</td>
                                <td className="px-4 py-3">{s.position}</td>
                                <td className="px-4 py-3">${s.monthlySalary.toLocaleString()}</td>
                                <td className="px-4 py-3">{s.lastPaid ?? 'Not paid'}</td>
                                <td className="px-4 py-3">
                                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handlePay(s.id)}>Pay</Button>
                                    <Button size="sm" variant="outline" onClick={() => handleEditClick(s.id)}>Edit</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Staff' : 'Add Staff to Payroll'}</DialogTitle>
                        <DialogDescription>{isEditing ? 'Update staff details.' : 'Fill in staff details to add to payroll.'}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} />
                        </div>

                        <div>
                            <Label htmlFor="position">Position</Label>
                            <Input id="position" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} />
                        </div>

                        <div>
                            <Label htmlFor="salary">Monthly Salary</Label>
                            <Input id="salary" type="number" value={formSalary as any} onChange={(e) => setFormSalary(e.target.value ? Number(e.target.value) : '')} />
                        </div>
                    </div>

                    <DialogFooter>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setIsAddOpen(false); setIsEditing(false); setEditingId(null); }}>Cancel</Button>
                            <Button size="sm" onClick={handleAddSubmit}>{isEditing ? 'Save' : 'Add'}</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StaffPayroll;
