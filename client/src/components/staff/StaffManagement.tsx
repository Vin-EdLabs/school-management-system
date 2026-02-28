import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import useStaffPayroll from '@/hooks/useStaffPayroll';
import * as staffService from '@/services/staffService';
import {
    Edit,
    Mail,
    Plus,
    Search,
    Trash2,
    UserPlus,
    Phone,
    Briefcase
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface StaffMember {
    id: string;
    staffId: string;
    name: string;
    email: string;
    phone: string;
    gender: string;
    role: string;
    monthlySalary: number;
    employmentStatus: string;
    employmentDate: string;
    address: string;
    notes: string;
    lastPaid?: string;
}

const PRESET_ROLES = [
    'Accountant',
    'Administrator',
    'Librarian',
    'Secretary',
    'Security Guard',
    'Driver',
    'Cleaner',
    'Cook',
    'Lab Technician',
    'Other'
];

const StaffManagement: React.FC = () => {
    const { staff: staffFromApi, createStaff, updateStaff, deleteStaff } = useStaffPayroll();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    const [formData, setFormData] = useState({
        staffId: '',
        name: '',
        email: '',
        phone: '',
        gender: '',
        role: '',
        customRole: '',
        monthlySalary: '',
        employmentStatus: 'Active',
        employmentDate: '',
        address: '',
        notes: ''
    });

    const filteredStaff = (staffFromApi || []).filter((s: any) => {
        const name = s.display_name || s.name || '';
        const id = s.staff_id || '';
        const role = s.role || '';
        const matchesSearch =
            name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            role.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || s.employment_status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleOpenAdd = async () => {
        setIsEditing(false);
        setSelectedStaff(null);
        setFormData({
            staffId: '',
            name: '',
            email: '',
            phone: '',
            gender: '',
            role: '',
            customRole: '',
            monthlySalary: '',
            employmentStatus: 'Active',
            employmentDate: new Date().toISOString().split('T')[0],
            address: '',
            notes: ''
        });

        setIsDialogOpen(true);

        // Fetch next ID
        try {
            const res = await staffService.getNextStaffId();
            if (res?.data?.nextId) {
                setFormData(prev => ({ ...prev, staffId: res.data.nextId }));
            }
        } catch (err) {
            console.error('Failed to fetch next staff ID', err);
        }
    };

    const handleOpenEdit = (s: any) => {
        setIsEditing(true);
        setSelectedStaff(s);
        const roleValue = s.role || '';
        const isPreset = PRESET_ROLES.includes(roleValue);

        setFormData({
            staffId: s.staff_id || '',
            name: s.display_name || s.name || '',
            email: s.email || '',
            phone: s.phone || '',
            gender: s.gender || '',
            role: isPreset ? roleValue : 'Other',
            customRole: isPreset ? '' : roleValue,
            monthlySalary: s.monthly_salary?.toString() || '',
            employmentStatus: s.employment_status || 'Active',
            employmentDate: s.employment_date ? s.employment_date.split('T')[0] : '',
            address: s.address || '',
            notes: s.notes || ''
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalRole = formData.role === 'Other' ? formData.customRole : formData.role;

        const payload = {
            staffId: formData.staffId,
            display_name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gender: formData.gender,
            role: finalRole,
            monthly_salary: parseFloat(formData.monthlySalary) || 0,
            employment_status: formData.employmentStatus,
            employment_date: formData.employmentDate,
            address: formData.address,
            notes: formData.notes
        };

        if (isEditing && selectedStaff) {
            updateStaff.mutate({ id: selectedStaff.id, payload }, {
                onSuccess: () => setIsDialogOpen(false)
            });
        } else {
            createStaff.mutate({ ...payload, password: formData.staffId }, {
                onSuccess: () => setIsDialogOpen(false)
            });
        }
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete ${name}?`)) {
            deleteStaff.mutate(id);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Active</Badge>;
            case 'suspended': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Suspended</Badge>;
            case 'left': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">Left</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Staff Management</h1>
                    <p className="text-muted-foreground">Manage administrative and non-teaching staff records.</p>
                </div>
                <Button onClick={handleOpenAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <UserPlus className="w-4 h-4 mr-2" />
                    New Staff Member
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, ID, or role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 border-border focus:ring-indigo-500 rounded-lg shadow-inner bg-muted/50/50"
                            />
                        </div>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full md:w-[180px] border-border rounded-lg bg-muted/50/50">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Suspended">Suspended</SelectItem>
                                <SelectItem value="Left">Left</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-card rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50/80">
                        <TableRow>
                            <TableHead className="px-6 py-4 font-semibold text-muted-foreground">Staff Info</TableHead>
                            <TableHead className="font-semibold text-muted-foreground">Role & Category</TableHead>
                            <TableHead className="font-semibold text-muted-foreground">Contact</TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-right">Monthly Salary</TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-center">Status</TableHead>
                            <TableHead className="px-6 font-semibold text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStaff.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic">
                                    No staff members found matching your search.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStaff.map((s: any) => (
                                <TableRow key={s.id} className="hover:bg-muted/50/50 transition-colors group">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100 shadow-sm">
                                                {(s.display_name || s.name || 'S').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-foreground leading-none mb-1">
                                                    {s.display_name || s.name}
                                                </div>
                                                <div className="text-xs font-mono text-muted-foreground uppercase flex items-center">
                                                    <span className="bg-muted px-1 rounded mr-1">ID</span> {s.staff_id || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">{s.role || 'Staff'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Phone className="w-3 h-3 text-muted-foreground" />
                                                {s.phone || '-'}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 italic">
                                                <Mail className="w-3 h-3 text-slate-300" />
                                                {s.email || '-'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="font-semibold text-foreground whitespace-nowrap">₵ {Number(s.monthly_salary || 0).toLocaleString()}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {getStatusBadge(s.employment_status || 'Active')}
                                    </TableCell>
                                    <TableCell className="px-6 text-right">
                                        <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:bg-slate-200"
                                                onClick={() => handleOpenEdit(s)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                onClick={() => handleDelete(s.id, s.display_name || s.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="bg-slate-900 text-white p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                {isEditing ? <Edit className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">
                                    {isEditing ? 'Edit Staff Member' : 'New Staff Registration'}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    {isEditing ? 'Update the details for this staff member.' : 'Enter the professional and personal information below.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Full Name *</Label>
                                <Input
                                    placeholder="Enter full name"
                                    className="border-border focus:ring-indigo-500 rounded-lg"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Staff ID (Auto-generated)</Label>
                                <Input
                                    placeholder="Loading..."
                                    className="border-border focus:ring-indigo-500 rounded-lg font-mono bg-muted/50 cursor-not-allowed"
                                    value={formData.staffId}
                                    readOnly
                                    disabled
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Assign Role *</Label>
                                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                                    <SelectTrigger className="border-border rounded-lg">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRESET_ROLES.map(role => (
                                            <SelectItem key={role} value={role}>{role}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.role === 'Other' && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Custom Role *</Label>
                                    <Input
                                        placeholder="Enter custom role"
                                        className="border-border focus:ring-indigo-500 rounded-lg"
                                        value={formData.customRole}
                                        onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Gender *</Label>
                                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                                    <SelectTrigger className="border-border rounded-lg">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase truncate">Primary Email</Label>
                                <Input
                                    placeholder="email@school.com"
                                    type="email"
                                    className="border-border focus:ring-indigo-500 rounded-lg"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</Label>
                                <Input
                                    placeholder="+233..."
                                    className="border-border focus:ring-indigo-500 rounded-lg"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Salary (GHS) *</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="border-border focus:ring-indigo-500 rounded-lg font-semibold"
                                    value={formData.monthlySalary}
                                    onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Employment Status</Label>
                                <Select value={formData.employmentStatus} onValueChange={(v) => setFormData({ ...formData, employmentStatus: v })}>
                                    <SelectTrigger className="border-border rounded-lg">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Suspended">Suspended</SelectItem>
                                        <SelectItem value="Left">Left</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">Employment Date</Label>
                                <Input
                                    type="date"
                                    className="border-border focus:ring-indigo-500 rounded-lg"
                                    value={formData.employmentDate}
                                    onChange={(e) => setFormData({ ...formData, employmentDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Resident Address</Label>
                            <Input
                                placeholder="Enter street and house number"
                                className="border-border focus:ring-indigo-500 rounded-lg"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Internal Notes</Label>
                            <Textarea
                                placeholder="Any additional information about this staff member..."
                                className="border-border focus:ring-indigo-500 rounded-lg min-h-[80px]"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                        <DialogFooter className="pt-4 gap-2">
                            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setIsDialogOpen(false)}>
                                Discard
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px] rounded-lg shadow-lg shadow-indigo-100">
                                {isEditing ? 'Save Changes' : 'Register Staff'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StaffManagement;
