import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
import { Loader2, UserPlus, Camera, Info } from 'lucide-react';
import StaffOptionalSections from './StaffOptionalSections';
import StaffFieldSelect from '../common/StaffFieldSelect';
import PasswordConfirmDialog from '../common/PasswordConfirmDialog';
import { persistStaffProfileFields } from '@/services/staffFieldApi';
import { useAuth } from '../../contexts/AuthContext';
import { FormFieldError, FormValidationSummary } from '@/components/common/FormFieldError';
import {
  clearFieldError,
  fieldInvalidClass,
  getOtherStaffValidationRules,
  scrollToFormField,
  validateFormFields,
} from '@/utils/formValidation';
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
  qualification: '',
  specialization: '',
});

type Props = {
  open: boolean;
  onClose: () => void;
  staff?: OtherStaffRecord | null;
  onSuccess: () => void;
};

const OtherStaffFormDialog: React.FC<Props> = ({ open, onClose, staff, onSuccess }) => {
  const { user } = useAuth();
  const isEdit = !!staff?.id;
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState('');

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
        qualification: staff.qualification || '',
        specialization: staff.specialization || '',
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

  const runValidation = () => {
    const result = validateFormFields(getOtherStaffValidationRules(form));
    if (result.ok) {
      setFieldErrors({});
      setValidationSummary('');
      return true;
    }
    setFieldErrors(result.errors);
    setValidationSummary(result.summary);
    scrollToFormField(result.firstFieldId, result.firstSectionId);
    toast({
      title: 'Missing required information',
      description: result.summary,
      variant: 'destructive',
    });
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runValidation()) return;
    if (isEdit && user?.role !== 'super-admin') {
      setShowPasswordDialog(true);
      return;
    }
    await performSave();
  };

  const performSave = async () => {
    setSubmitting(true);
    try {
      const body = {
        ...form,
        date_of_birth: form.date_of_birth.trim() || null,
        employment_date: form.employment_date.trim() || null,
        monthly_salary: form.monthly_salary ? parseFloat(form.monthly_salary) : 0,
        qualification: form.qualification.trim() || null,
        specialization: form.specialization.trim() || null,
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
        await persistStaffProfileFields(form.position, form.department);
        toast({ title: 'Updated', description: `${form.full_name} has been updated` });
      } else {
        const created = await apiService.post<OtherStaffRecord>('/other-staff', body);
        id = created.id;
        await persistStaffProfileFields(form.position, form.department);
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
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle>{isEdit ? 'Edit staff member' : 'Add staff'}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit
              ? 'Update personal, employment, and payroll details for this staff member.'
              : 'Register non-teaching staff for payroll, transport, and optional system access.'}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5 overflow-y-auto px-6 py-4">
            <FormValidationSummary message={validationSummary} />
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Staff records</p>
                  <p className="mt-1 leading-6 text-slate-700">
                    {isEdit
                      ? 'Changes here update payroll and staff lists. To grant login access, use Users → Add Staff as User after saving.'
                      : 'A unique staff ID is generated automatically. Add employment and salary details now, or expand optional sections for emergency and bank info.'}
                  </p>
                </div>
              </div>
            </div>
          <div id="other-staff-personal" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="other-staff-full-name">Full Name *</Label>
              <Input
                id="other-staff-full-name"
                value={form.full_name}
                onChange={(e) => {
                  clearFieldError(fieldErrors, 'other-staff-full-name', setFieldErrors);
                  set('full_name', e.target.value);
                }}
                className={fieldInvalidClass(!!fieldErrors['other-staff-full-name'])}
              />
              <FormFieldError message={fieldErrors['other-staff-full-name']} />
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
              <Label htmlFor="other-staff-dob">Date of Birth (Optional)</Label>
              <Input
                id="other-staff-dob"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set('date_of_birth', e.target.value)}
              />
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
              <Label>Qualification</Label>
              <Input
                value={form.qualification}
                onChange={(e) => set('qualification', e.target.value)}
                placeholder="e.g. B.Ed, HND, PGDE, Diploma in Basic Education"
              />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={form.specialization}
                onChange={(e) => set('specialization', e.target.value)}
                placeholder="e.g. Mathematics & ICT, English & Social Studies"
              />
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
          <div id="other-staff-employment" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StaffFieldSelect
              field="position"
              id="other-staff-position"
              label="Position"
              value={form.position}
              onChange={(value) => {
                clearFieldError(fieldErrors, 'other-staff-position', setFieldErrors);
                set('position', value);
              }}
              placeholder="e.g. Bus Driver, Accountant"
              required
              error={fieldErrors['other-staff-position']}
            />
            <StaffFieldSelect
              field="department"
              id="other-staff-department"
              label="Department"
              value={form.department}
              onChange={(value) => {
                clearFieldError(fieldErrors, 'other-staff-department', setFieldErrors);
                set('department', value);
              }}
              placeholder="e.g. Finance"
              required
              error={fieldErrors['other-staff-department']}
            />
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
          </DialogBody>
          <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primaryAction" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {isEdit ? 'Save changes' : 'Add staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <PasswordConfirmDialog
      open={showPasswordDialog}
      onOpenChange={setShowPasswordDialog}
      title="Confirm staff update"
      description="Enter your password to save changes to this staff profile."
      confirmLabel="Confirm update"
      onConfirmed={async () => {
        if (!runValidation()) {
          setShowPasswordDialog(false);
          return;
        }
        await performSave();
      }}
    />
    </>
  );
};

export default OtherStaffFormDialog;
