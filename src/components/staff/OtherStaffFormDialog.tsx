import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Camera } from 'lucide-react';
import StaffOptionalSections from './StaffOptionalSections';
import type { OtherStaffRecord } from './otherStaffTypes';

export type { OtherStaffRecord } from './otherStaffTypes';

const emptyForm = () => ({
  full_name: '',
  gender: '',
  date_of_birth: '',
  phone_number: '',
  email: '',
  home_address: '',
  national_id: '',
  position: '',
  department: '',
  employment_type: '',
  employment_date: '',
  monthly_salary: '',
  ssnit_number: '',
  ssnit_enabled: false,
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  bank_name: '',
  bank_account_number: '',
  bank_branch: '',
  bank_account_name: '',
  notes: '',
});

type Props = {
  open: boolean;
  onClose: () => void;
  staff?: OtherStaffRecord | null;
  onSuccess: () => void;
};

const OtherStaffFormDialog: React.FC<Props> = ({ open, onClose, staff, onSuccess }) => {
  const isEdit = !!staff?.id;
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setPhotoFile(null);
      setPhotoPreview(null);
      setShowEmergency(false);
      setShowBank(false);
      return;
    }
    if (staff) {
      setForm({
        full_name: staff.full_name || '',
        gender: staff.gender || '',
        date_of_birth: staff.date_of_birth?.slice(0, 10) || '',
        phone_number: staff.phone_number || '',
        email: staff.email || '',
        home_address: staff.home_address || '',
        national_id: staff.national_id || '',
        position: staff.position || '',
        department: staff.department || '',
        employment_type: staff.employment_type || '',
        employment_date: staff.employment_date?.slice(0, 10) || '',
        monthly_salary: staff.monthly_salary != null ? String(staff.monthly_salary) : '',
        ssnit_number: staff.ssnit_number || '',
        ssnit_enabled: !!staff.ssnit_enabled,
        emergency_contact_name: staff.emergency_contact_name || '',
        emergency_contact_phone: staff.emergency_contact_phone || '',
        emergency_contact_relationship: staff.emergency_contact_relationship || '',
        bank_name: staff.bank_name || '',
        bank_account_number: staff.bank_account_number || '',
        bank_branch: staff.bank_branch || '',
        bank_account_name: staff.bank_account_name || '',
        notes: staff.notes || '',
      });
      setShowEmergency(!!(
        staff.emergency_contact_name ||
        staff.emergency_contact_phone ||
        staff.emergency_contact_relationship
      ));
      setShowBank(!!(
        staff.bank_name ||
        staff.bank_account_number ||
        staff.bank_branch ||
        staff.bank_account_name
      ));
      setPhotoPreview(staff.passport_photo_url || null);
    } else {
      setForm(emptyForm());
    }
  }, [open, staff]);

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...form,
        monthly_salary: form.monthly_salary ? parseFloat(form.monthly_salary) : 0,
        ssnit_enabled: form.ssnit_enabled,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        emergency_contact_relationship: form.emergency_contact_relationship || null,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_branch: form.bank_branch || null,
        bank_account_name: form.bank_account_name || null,
      };

      let id = staff?.id;
      if (isEdit && id) {
        await apiService.put(`/other-staff/${id}`, body);
        toast({ title: 'Updated', description: `${form.full_name} has been updated` });
      } else {
        const created = await apiService.post<OtherStaffRecord>('/other-staff', body);
        id = created.id;
        toast({ title: 'Staff Added', description: `${form.full_name} (${created.staff_id}) added` });
      }

      if (photoFile && id) {
        try {
          await apiService.uploadOtherStaffPhoto(String(id), photoFile);
        } catch {
          toast({ title: 'Photo upload failed', variant: 'destructive' });
        }
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Home Address</Label>
              <Textarea value={form.home_address} onChange={(e) => set('home_address', e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>National ID</Label>
              <Input value={form.national_id} onChange={(e) => set('national_id', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Passport Photo</Label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-foreground pt-2">Employment</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="e.g. Accountant" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Finance" />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={form.employment_type} onValueChange={(v) => set('employment_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employment Date</Label>
              <Input type="date" value={form.employment_date} onChange={(e) => set('employment_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Salary (GHS)</Label>
              <Input type="number" min="0" step="0.01" value={form.monthly_salary} onChange={(e) => set('monthly_salary', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>SSNIT Number</Label>
              <Input value={form.ssnit_number} onChange={(e) => set('ssnit_number', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch checked={form.ssnit_enabled} onCheckedChange={(v) => set('ssnit_enabled', v)} id="ssnit" />
              <Label htmlFor="ssnit">SSNIT enabled</Label>
            </div>
          </div>

          <StaffOptionalSections
            showEmergency={showEmergency}
            showBank={showBank}
            onToggleEmergency={() => setShowEmergency((v) => !v)}
            onToggleBank={() => setShowBank((v) => !v)}
            emergency={{
              name: form.emergency_contact_name,
              phone: form.emergency_contact_phone,
              relationship: form.emergency_contact_relationship,
            }}
            bank={{
              bankName: form.bank_name,
              accountName: form.bank_account_name,
              accountNumber: form.bank_account_number,
              branch: form.bank_branch,
            }}
            onEmergencyChange={(field, value) => {
              const map = {
                name: 'emergency_contact_name',
                phone: 'emergency_contact_phone',
                relationship: 'emergency_contact_relationship',
              } as const;
              set(map[field], value);
            }}
            onBankChange={(field, value) => {
              const map = {
                bankName: 'bank_name',
                accountName: 'bank_account_name',
                accountNumber: 'bank_account_number',
                branch: 'bank_branch',
              } as const;
              set(map[field], value);
            }}
          />

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primaryAction" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {isEdit ? 'Save Changes' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OtherStaffFormDialog;
