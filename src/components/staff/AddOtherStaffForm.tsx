import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Camera } from 'lucide-react';
import StaffOptionalSections from './StaffOptionalSections';
import StaffFieldSelect from '../common/StaffFieldSelect';
import { FormFieldError, FormValidationSummary } from '@/components/common/FormFieldError';
import {
  clearFieldError,
  fieldInvalidClass,
  getOtherStaffValidationRules,
  scrollToFormField,
  validateFormFields,
} from '@/utils/formValidation';
import type { OtherStaffRecord } from './otherStaffTypes';

interface AddOtherStaffFormProps {
  onSuccess: () => void;
}

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

const AddOtherStaffForm: React.FC<AddOtherStaffFormProps> = ({ onSuccess }) => {
  const [form, setForm] = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);

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
    if (isSubmitting || submitLock.current) return;
    if (!runValidation()) return;

    setIsSubmitting(true);
    submitLock.current = true;
    try {
      const body = {
        ...form,
        date_of_birth: form.date_of_birth.trim() || null,
        employment_date: form.employment_date.trim() || null,
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

      const created = await apiService.post<OtherStaffRecord>('/other-staff', body);

      if (photoFile && created.id) {
        try {
          await apiService.uploadOtherStaffPhoto(String(created.id), photoFile);
        } catch {
          toast({
            title: 'Photo upload failed',
            description: 'Staff was saved; you can add a photo when editing.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Staff Added Successfully',
        description: `${form.full_name} has been added (${created.staff_id})`,
      });

      setForm(emptyForm());
      setPhotoFile(null);
      setPhotoPreview(null);
      setShowEmergency(false);
      setShowBank(false);
      onSuccess();
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add staff',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm overflow-visible">
      <CardHeader className="border-b border-border/70 bg-muted/30 px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-lg text-card-foreground">
          <UserPlus className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <span>Add Non-Teaching Staff</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-5 sm:px-6 md:px-8 md:py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormValidationSummary message={validationSummary} />
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
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth (Optional)</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set('date_of_birth', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={form.phone_number}
                onChange={(e) => set('phone_number', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="home_address">Home Address</Label>
              <Textarea
                id="home_address"
                value={form.home_address}
                onChange={(e) => set('home_address', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="national_id">National ID</Label>
              <Input
                id="national_id"
                value={form.national_id}
                onChange={(e) => set('national_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qualification">Qualification</Label>
              <Input
                id="qualification"
                value={form.qualification}
                onChange={(e) => set('qualification', e.target.value)}
                placeholder="e.g. B.Ed, HND, PGDE, Diploma in Basic Education"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground pt-2 border-t border-border/60">Employment Details</p>
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
              placeholder="e.g. Bus Driver, Security, Accountant"
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
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employment_date">Employment Date</Label>
              <Input
                id="employment_date"
                type="date"
                value={form.employment_date}
                onChange={(e) => set('employment_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_salary">Monthly Salary (GHS)</Label>
              <Input
                id="monthly_salary"
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_salary}
                onChange={(e) => set('monthly_salary', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssnit_number">SSNIT Number</Label>
              <Input
                id="ssnit_number"
                value={form.ssnit_number}
                onChange={(e) => set('ssnit_number', e.target.value)}
              />
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
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-action-bar flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Staff ID will be auto-generated (e.g. STF001). Required fields are marked with *.
            </p>
            <Button type="submit" variant="primaryAction" className="min-h-11 w-full sm:w-auto sm:min-w-40" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {isSubmitting ? 'Processing...' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddOtherStaffForm;
