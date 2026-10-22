import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData, type Teacher } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Camera } from 'lucide-react';
import { apiService } from '@/services/api';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import { teacherStatusBadge } from './TeacherStatusModals';
import StaffOptionalSections from '../staff/StaffOptionalSections';
import StaffFieldSelect from '../common/StaffFieldSelect';
import PasswordConfirmDialog from '../common/PasswordConfirmDialog';
import { persistStaffProfileFields } from '@/services/staffFieldApi';
import ParentTeacherSelect from './ParentTeacherSelect';
import StaffLegalDocumentsSection, { TEACHER_DOC_CATEGORIES } from '../staff/StaffLegalDocumentsSection';
import type { StaffLegalDocument } from '../staff/otherStaffTypes';
import TeacherSubjectClassAssignment from './TeacherSubjectClassAssignment';
import { FormFieldError, FormValidationSummary } from '@/components/common/FormFieldError';
import {
  flattenSubjectClassMap,
  deriveSubjectNamesFromMap,
  groupedToSubjectClassMap,
  type SubjectClassMap,
  type TeacherSubjectClassesResponse,
} from '@/types/teacherSubjectClass';
import {
  clearFieldError,
  fieldInvalidClass,
  getTeacherValidationRules,
  scrollToFormField,
  validateFormFields,
} from '@/utils/formValidation';

interface EditTeacherDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditTeacherDialog: React.FC<EditTeacherDialogProps> = ({
  teacher,
  open,
  onClose,
  onSuccess
}) => {
  const { updateTeacher, subjects, classes } = useData();
  const { user } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectClassMap, setSubjectClassMap] = useState<SubjectClassMap>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    address: '',
    nationalId: '',
    subjectsTaught: [] as string[],
    employmentDate: '',
    employmentType: '',
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
  const [parentTeacherId, setParentTeacherId] = useState('');
  const [documents, setDocuments] = useState<StaffLegalDocument[]>([]);
  // Only send documents back once the full list has loaded, so a failed fetch never wipes them.
  const [documentsLoaded, setDocumentsLoaded] = useState(false);

  useEffect(() => {
    if (!teacher || !open) {
      setDocuments([]);
      setDocumentsLoaded(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const full = await apiService.get<{ documents?: StaffLegalDocument[] }>(`/teachers/${teacher.id}`);
        if (cancelled) return;
        setDocuments(Array.isArray(full.documents) ? full.documents : []);
        setDocumentsLoaded(true);
      } catch {
        if (!cancelled) setDocumentsLoaded(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teacher?.id, open]);

  useEffect(() => {
    if (!open) {
      setShowPasswordDialog(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setFieldErrors({});
      setValidationSummary('');
    }
  }, [open]);

  useEffect(() => {
    if (!teacher || !open) return;
    setFormData({
      fullName: teacher.fullName,
      gender: teacher.gender,
      dateOfBirth: teacher.dateOfBirth,
      phoneNumber: teacher.phoneNumber,
      email: teacher.email,
      address: teacher.address,
      nationalId: teacher.nationalId || '',
      subjectsTaught: teacher.subjectsTaught,
      employmentDate: teacher.employmentDate,
      employmentType: teacher.employmentType || '',
      monthlySalary: teacher.monthlySalary.toString(),
      notes: teacher.notes,
      emergencyContactName: teacher.emergencyContactName || '',
      emergencyContactPhone: teacher.emergencyContactPhone || '',
      emergencyContactRelationship: teacher.emergencyContactRelationship || '',
      bankName: teacher.bankName || '',
      bankAccountName: teacher.bankAccountName || '',
      bankAccountNumber: teacher.bankAccountNumber || '',
      bankBranch: teacher.bankBranch || '',
      position: teacher.position || '',
      department: teacher.department || '',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
    });
    setShowEmergency(!!(teacher.emergencyContactName || teacher.emergencyContactPhone));
    setShowBank(!!(teacher.bankName || teacher.bankAccountNumber));
    setParentTeacherId(teacher.parentTeacherId || '');
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [teacher, open]);

  useEffect(() => {
    if (!teacher || !open) return;

    void (async () => {
      try {
        const data = await apiService.get<TeacherSubjectClassesResponse>(
          `/teachers/${teacher.id}/subject-classes`
        );
        const mapped = groupedToSubjectClassMap(data);
        if (mapped.selectedSubjectIds.length > 0) {
          setSelectedSubjectIds(mapped.selectedSubjectIds);
          setSubjectClassMap(mapped.subjectClassMap);
          return;
        }
      } catch {
        /* legacy fallback */
      }
      const legacyIds = (teacher.subjectsTaught || [])
        .map((name) => subjects.find((s) => s.name === name)?.id)
        .filter(Boolean) as string[];
      setSelectedSubjectIds(legacyIds);
      const legacyMap: SubjectClassMap = {};
      for (const sid of legacyIds) {
        legacyMap[sid] = (teacher.assignedClassIds || []).length
          ? [...teacher.assignedClassIds!]
          : teacher.classAssignedId
            ? [String(teacher.classAssignedId)]
            : [''];
      }
      setSubjectClassMap(legacyMap);
    })();
  }, [teacher?.id, open, subjects]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const performUpdate = async () => {
    if (!teacher) return;

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
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;
    try {
      await updateTeacher(teacher.id, {
        fullName: formData.fullName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth.trim(),
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        address: formData.address,
        nationalId: formData.nationalId.trim(),
        subjectsTaught: deriveSubjectNamesFromMap(subjectClassMap, subjects),
        employmentDate: formData.employmentDate.trim(),
        employmentType: formData.employmentType.trim(),
        monthlySalary: salaryValue,
        notes: formData.notes,
        emergencyContactName: showEmergency ? formData.emergencyContactName : '',
        emergencyContactPhone: showEmergency ? formData.emergencyContactPhone : '',
        emergencyContactRelationship: showEmergency ? formData.emergencyContactRelationship : '',
        bankName: showBank ? formData.bankName : '',
        bankAccountName: showBank ? formData.bankAccountName : '',
        bankAccountNumber: showBank ? formData.bankAccountNumber : '',
        bankBranch: showBank ? formData.bankBranch : '',
        position: formData.position.trim(),
        department: formData.department.trim(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        parentTeacherId: parentTeacherId || null,
        subjectClassAssignments,
        ...(documentsLoaded ? { documents } : {}),
      });

      await persistStaffProfileFields(formData.position, formData.department);

      if (photoFile) {
        try {
          await apiService.uploadTeacherPhoto(teacher.id, photoFile);
        } catch {
          toast({
            title: 'Photo upload failed',
            description: 'Other details were saved. Try uploading the photo again.',
            variant: 'destructive',
          });
        }
      }

      toast({ title: 'Teacher updated', description: `${formData.fullName} has been updated successfully.` });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err?.message || "Failed to update teacher. Please try again.", variant: "destructive" });
    }
  };

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

  const handleUpdateClick = async () => {
    if (!teacher) return;
    if (!runValidation()) return;
    // Super-admin can update without password; tenant users must verify their password
    if (user?.role === 'super-admin') {
      await performUpdate();
    } else {
      setShowPasswordDialog(true);
    }
  };

  if (!teacher) return null;

  const statusBadge = teacherStatusBadge(teacher.status || 'active');

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            Edit Teacher Details
            {statusBadge ? (
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="px-6 py-4">
        <div className="space-y-4">
          <FormValidationSummary message={validationSummary} />
          <div className="space-y-3">
            <Label>Passport Photo</Label>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="h-20 w-20 rounded-full object-cover border" />
                ) : (
                  <LazyTeacherAvatar
                    teacherId={teacher.id}
                    fullName={teacher.fullName}
                    hasPassportPhoto={teacher.hasPassportPhoto}
                    className="h-20 w-20"
                    eager
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a passport-size photo (JPG, PNG). Use Suspend/Deactivate on the profile to change employment status.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  {teacher.hasPassportPhoto || photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            </div>
          </div>

          <div id="teacher-personal" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input value={teacher.staffId} readOnly disabled className="bg-slate-50 cursor-not-allowed" />
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="teacher-nationalId">National ID</Label>
            <Input
              id="teacher-nationalId"
              value={formData.nationalId}
              onChange={(e) => setFormData((prev) => ({ ...prev, nationalId: e.target.value }))}
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
              id="teacher-position"
              label="Position"
              value={formData.position}
              onChange={(value) => setFormData((prev) => ({ ...prev, position: value }))}
              placeholder="e.g. Senior Teacher, Head of Department"
            />
            <StaffFieldSelect
              field="department"
              id="teacher-department"
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
              <Label htmlFor="teacher-employmentType">Employment Type</Label>
              <Select
                value={formData.employmentType || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, employmentType: value }))}
              >
                <SelectTrigger id="teacher-employmentType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <ParentTeacherSelect
            excludeTeacherId={teacher.id}
            value={parentTeacherId}
            onChange={setParentTeacherId}
          />

          <StaffLegalDocumentsSection
            key={documentsLoaded ? 'docs-loaded' : 'docs-loading'}
            documents={documents}
            onChange={setDocuments}
            isDriver={false}
            disabled={!documentsLoaded}
            categories={TEACHER_DOC_CATEGORIES}
          />

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

        </div>
        </DialogBody>

        <DialogFooter className="form-action-bar shrink-0 gap-2 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primaryAction" onClick={() => void handleUpdateClick()}>Update Teacher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PasswordConfirmDialog
      open={showPasswordDialog}
      onOpenChange={setShowPasswordDialog}
      title="Confirm teacher update"
      description="Enter your password to save changes to this teacher profile."
      confirmLabel="Confirm update"
      onConfirmed={async () => {
        if (!runValidation()) {
          setShowPasswordDialog(false);
          return;
        }
        await performUpdate();
      }}
    />
    </>
  );
};

export default EditTeacherDialog;
