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
import { X, Camera } from 'lucide-react';
import { apiService } from '@/services/api';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import { teacherStatusBadge } from './TeacherStatusModals';
import StaffOptionalSections from '../staff/StaffOptionalSections';
import StaffFieldSelect from '../common/StaffFieldSelect';
import PasswordConfirmDialog from '../common/PasswordConfirmDialog';
import { persistStaffProfileFields } from '@/services/staffFieldApi';

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
  const { updateTeacher, subjects } = useData();
  const { user } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
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
  });
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowPasswordDialog(false);
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (teacher) {
      setFormData({
        fullName: teacher.fullName,
        gender: teacher.gender,
        dateOfBirth: teacher.dateOfBirth,
        phoneNumber: teacher.phoneNumber,
        email: teacher.email,
        address: teacher.address,
        subjectsTaught: teacher.subjectsTaught,
        employmentDate: teacher.employmentDate,
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
      });
      setShowEmergency(!!(teacher.emergencyContactName || teacher.emergencyContactPhone));
      setShowBank(!!(teacher.bankName || teacher.bankAccountNumber));
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [teacher]);

  const handleAddSubject = (subject: string) => {
    if (!formData.subjectsTaught.includes(subject)) {
      setFormData(prev => ({
        ...prev,
        subjectsTaught: [...prev.subjectsTaught, subject]
      }));
    }
  };

  const handleRemoveSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjectsTaught: prev.subjectsTaught.filter(s => s !== subject)
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const performUpdate = async () => {
    if (!teacher) return;
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;
    try {
      await updateTeacher(teacher.id, {
        fullName: formData.fullName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || undefined,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        address: formData.address,
        subjectsTaught: formData.subjectsTaught,
        employmentDate: formData.employmentDate || undefined,
        monthlySalary: salaryValue,
        notes: formData.notes,
        emergencyContactName: showEmergency ? formData.emergencyContactName : '',
        emergencyContactPhone: showEmergency ? formData.emergencyContactPhone : '',
        emergencyContactRelationship: showEmergency ? formData.emergencyContactRelationship : '',
        bankName: showBank ? formData.bankName : '',
        bankAccountName: showBank ? formData.bankAccountName : '',
        bankAccountNumber: showBank ? formData.bankAccountNumber : '',
        bankBranch: showBank ? formData.bankBranch : '',
        position: formData.position.trim() || undefined,
        department: formData.department.trim() || undefined,
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

  const handleUpdateClick = async () => {
    if (!teacher) return;
    if (!formData.fullName || !formData.email || !formData.phoneNumber) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input value={teacher.staffId} readOnly disabled className="bg-slate-50 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
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

          <div className="space-y-2">
            <Label>Subjects Taught</Label>
            <Select onValueChange={handleAddSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Add subjects" />
              </SelectTrigger>
              <SelectContent>
                {subjects.filter(subject => !formData.subjectsTaught.includes(subject.name)).map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.subjectsTaught.map((subject) => (
                <Badge key={subject} variant="secondary" className="flex items-center space-x-1">
                  <span>{subject}</span>
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => handleRemoveSubject(subject)}
                  />
                </Badge>
              ))}
            </div>
          </div>

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
      onConfirmed={performUpdate}
    />
    </>
  );
};

export default EditTeacherDialog;
