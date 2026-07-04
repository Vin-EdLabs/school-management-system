import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserPlus, X, Copy, KeyRound, Camera } from 'lucide-react';
import { apiService } from '@/services/api';
import StaffOptionalSections from '../staff/StaffOptionalSections';
import StaffFieldSelect from '../common/StaffFieldSelect';
import TeacherSubjectClassAssignment from './TeacherSubjectClassAssignment';
import { FormFieldError, FormValidationSummary } from '@/components/common/FormFieldError';
import { persistStaffProfileFields } from '@/services/staffFieldApi';
import ParentTeacherSelect from './ParentTeacherSelect';
import {
  flattenSubjectClassMap,
  deriveSubjectNamesFromMap,
  type SubjectClassMap,
} from '@/types/teacherSubjectClass';
import {
  clearFieldError,
  fieldInvalidClass,
  getTeacherValidationRules,
  scrollToFormField,
  validateFormFields,
} from '@/utils/formValidation';

interface AddTeacherFormProps {
  onSuccess: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { addTeacher, subjects, classes } = useData();
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ staffId: string; password: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectClassMap, setSubjectClassMap] = useState<SubjectClassMap>({});
  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    address: '',
    subjectsTaught: [] as string[],
    employmentDate: '',
    monthlySalary: '',
    notes: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankBranch: '',
    position: '',
    department: '',
    qualification: '',
    specialization: '',
  });
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [parentTeacherId, setParentTeacherId] = useState('');
  const submitLock = useRef(false);

  const runValidation = () => {
    const result = validateFormFields(getTeacherValidationRules(formData));
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

    const missingClass = selectedSubjectIds.some(
      (sid) => !(subjectClassMap[sid] || []).some((cid) => cid && cid.trim() !== '')
    );
    if (selectedSubjectIds.length > 0 && missingClass) {
      toast({
        title: 'Class required for each subject',
        description: 'Assign at least one class for every subject you added.',
        variant: 'destructive',
      });
      scrollToFormField('teacher-subject-class-assignment');
      return;
    }

    const subjectClassAssignments = flattenSubjectClassMap(subjectClassMap);

    // Convert salary to number for storage, default to 0 if empty or invalid
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

    setIsSubmitting(true);
    submitLock.current = true;
    try {
      const result = await addTeacher({
        ...formData,
        monthlySalary: salaryValue,
        employmentStatus: 'Active',
        subjectsTaught: deriveSubjectNamesFromMap(subjectClassMap, subjects),
        subjectClassAssignments,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelationship: formData.emergencyContactRelationship || undefined,
        bankName: formData.bankName || undefined,
        bankAccountName: formData.bankAccountName || undefined,
        bankAccountNumber: formData.bankAccountNumber || undefined,
        bankBranch: formData.bankBranch || undefined,
        position: formData.position.trim() || undefined,
        department: formData.department.trim() || undefined,
        parentTeacherId: parentTeacherId || null,
      });

      await persistStaffProfileFields(formData.position, formData.department);

      const teacherId = result?.id;
      if (photoFile && teacherId) {
        try {
          await apiService.uploadTeacherPhoto(String(teacherId), photoFile);
        } catch {
          toast({ title: 'Photo upload failed', description: 'Teacher was saved; you can add a photo when editing.', variant: 'destructive' });
        }
      }

      toast({
        title: "Teacher Added Successfully",
        description: `${formData.fullName} has been added to the system`,
      });

      if (result?.loginStaffId && (result?.loginPassword || result?.loginPin)) {
        setLoginCredentials({
          staffId: result.loginStaffId,
          password: result.loginPassword || result.loginPin || result.loginStaffId,
        });
        setCredentialsOpen(true);
      }

      setFormData({
        fullName: '',
        gender: '',
        dateOfBirth: '',
        phoneNumber: '',
        email: '',
        address: '',
        subjectsTaught: [],
        employmentDate: '',
        monthlySalary: '',
        notes: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelationship: '',
        bankName: '',
        bankAccountName: '',
        bankAccountNumber: '',
        bankBranch: '',
        position: '',
        department: '',
      });
      setSelectedSubjectIds([]);
      setSubjectClassMap({});
      setFieldErrors({});
      setValidationSummary('');
      setShowEmergency(false);
      setShowBank(false);
      setPhotoFile(null);
      setPhotoPreview(null);

      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add teacher. Please try again.';
      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <div className="space-y-0">
      <Card className="border-border bg-card shadow-sm overflow-visible">
        <CardHeader className="border-b border-border/70 bg-muted/30 px-4 py-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg text-card-foreground">
            <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Add New Teacher</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-5 sm:px-6 md:px-8 md:py-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormValidationSummary message={validationSummary} />
            <div id="teacher-personal" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-fullName">Full Name *</Label>
                <Input
                  id="teacher-fullName"
                  value={formData.fullName}
                  onChange={(e) => {
                    clearFieldError(fieldErrors, 'teacher-fullName', setFieldErrors);
                    setFormData(prev => ({ ...prev, fullName: e.target.value }));
                  }}
                  className={fieldInvalidClass(!!fieldErrors['teacher-fullName'])}
                />
                <FormFieldError message={fieldErrors['teacher-fullName']} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-gender">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => {
                    clearFieldError(fieldErrors, 'teacher-gender', setFieldErrors);
                    setFormData(prev => ({ ...prev, gender: value }));
                  }}
                >
                  <SelectTrigger id="teacher-gender" className={fieldInvalidClass(!!fieldErrors['teacher-gender'])}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <FormFieldError message={fieldErrors['teacher-gender']} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-phoneNumber">Phone Number *</Label>
                <Input
                  id="teacher-phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    clearFieldError(fieldErrors, 'teacher-phoneNumber', setFieldErrors);
                    setFormData(prev => ({ ...prev, phoneNumber: e.target.value }));
                  }}
                  className={fieldInvalidClass(!!fieldErrors['teacher-phoneNumber'])}
                />
                <FormFieldError message={fieldErrors['teacher-phoneNumber']} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher-email">Email Address *</Label>
              <Input
                id="teacher-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  clearFieldError(fieldErrors, 'teacher-email', setFieldErrors);
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                }}
                className={fieldInvalidClass(!!fieldErrors['teacher-email'])}
              />
              <FormFieldError message={fieldErrors['teacher-email']} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-qualification">Qualification</Label>
                <Input
                  id="teacher-qualification"
                  value={formData.qualification}
                  onChange={(e) => setFormData((prev) => ({ ...prev, qualification: e.target.value }))}
                  placeholder="e.g. B.Ed, HND, PGDE, Diploma in Basic Education"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-specialization">Specialization</Label>
                <Input
                  id="teacher-specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData((prev) => ({ ...prev, specialization: e.target.value }))}
                  placeholder="e.g. Mathematics & ICT, English & Social Studies"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StaffFieldSelect
                field="position"
                id="add-teacher-position"
                label="Position"
                value={formData.position}
                onChange={(value) => setFormData((prev) => ({ ...prev, position: value }))}
                placeholder="e.g. Senior Teacher, Head of Department"
              />
              <StaffFieldSelect
                field="department"
                id="add-teacher-department"
                label="Department"
                value={formData.department}
                onChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
                placeholder="e.g. Science, Administration"
              />
            </div>

            <TeacherSubjectClassAssignment
              subjects={subjects}
              classes={classes}
              selectedSubjectIds={selectedSubjectIds}
              subjectClassMap={subjectClassMap}
              onSelectedSubjectIdsChange={setSelectedSubjectIds}
              onSubjectClassMapChange={setSubjectClassMap}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employmentDate">Employment Date</Label>
                <Input
                  id="employmentDate"
                  type="date"
                  value={formData.employmentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, employmentDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Passport photo</Label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="h-20 w-20 rounded-full object-cover border" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
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

            <div className="space-y-2">
              <Label htmlFor="monthlySalary">Monthly Salary (GHS)</Label>
              <Input
                id="monthlySalary"
                type="text"
                placeholder="Enter salary amount"
                value={formData.monthlySalary}
                onChange={(e) => setFormData(prev => ({ ...prev, monthlySalary: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <ParentTeacherSelect value={parentTeacherId} onChange={setParentTeacherId} disabled={isSubmitting} />

            <StaffOptionalSections
              showEmergency={showEmergency}
              showBank={showBank}
              onToggleEmergency={() => setShowEmergency((v) => !v)}
              onToggleBank={() => setShowBank((v) => !v)}
              emergency={{
                name: formData.emergencyContactName,
                phone: formData.emergencyContactPhone,
                relationship: formData.emergencyContactRelationship,
              }}
              bank={{
                bankName: formData.bankName,
                accountName: formData.bankAccountName,
                accountNumber: formData.bankAccountNumber,
                branch: formData.bankBranch,
              }}
              onEmergencyChange={(field, value) => {
                const key =
                  field === 'name'
                    ? 'emergencyContactName'
                    : field === 'phone'
                      ? 'emergencyContactPhone'
                      : 'emergencyContactRelationship';
                setFormData((prev) => ({ ...prev, [key]: value }));
              }}
              onBankChange={(field, value) => {
                const key =
                  field === 'bankName'
                    ? 'bankName'
                    : field === 'accountName'
                      ? 'bankAccountName'
                      : field === 'accountNumber'
                        ? 'bankAccountNumber'
                        : 'bankBranch';
                setFormData((prev) => ({ ...prev, [key]: value }));
              }}
            />

            <div className="form-action-bar flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Required fields are marked with *.
              </p>
              <Button type="submit" variant="primaryAction" className="min-h-11 w-full sm:w-auto sm:min-w-40" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                {isSubmitting ? 'Processing...' : 'Add Teacher'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Login credentials dialog - admin can see and copy PIN */}
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              Login Credentials for Teacher
            </DialogTitle>
          </DialogHeader>
          {loginCredentials && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Share these credentials with the teacher. Username and default password are both the <strong>Staff ID</strong> (e.g. TCH002). They should change their password on first login.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide dark:text-slate-400">Staff ID (Username)</p>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{loginCredentials.staffId}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.staffId); toast({ title: 'Copied', description: 'Staff ID copied to clipboard' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide dark:text-slate-400">Default Password</p>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{loginCredentials.password}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.password); toast({ title: 'Copied', description: 'Password copied to clipboard' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded dark:bg-amber-950/40 dark:text-amber-300">
                Save these credentials now. For Teacher login, select the school, choose &quot;Teacher / Staff&quot; role, then enter Staff ID as username and password.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddTeacherForm;
