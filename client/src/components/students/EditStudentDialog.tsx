
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import React, { useEffect, useState } from 'react';
import { useAudit } from '../../contexts/AuditContext';
import { useClasses } from '../../hooks/useClasses';
import { useUpdateStudent } from '../../hooks/useStudents';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  studentId: string;
  admissionNumber: string;
  classAssigned: string;
  guardianName: string;
  guardianContact: string;
  homeAddress: string;
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
}

interface EditStudentDialogProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentDialog: React.FC<EditStudentDialogProps> = ({ student, open, onClose, onSuccess }) => {
  const updateStudentMutation = useUpdateStudent();
  const { classes } = useClasses();
  const { addAuditLog } = useAudit();
  const [formData, setFormData] = useState<Student | null>(null);

  useEffect(() => {
    if (student) {
      const s: any = student;
      setFormData({
        id: String(s.id ?? s.student_id ?? s.studentId ?? ''),
        firstName: s.first_name ?? s.firstName ?? '',
        lastName: s.last_name ?? s.lastName ?? '',
        gender: s.gender ?? s.meta?.gender ?? '',
        dateOfBirth: (() => {
          const v = s.date_of_birth ?? s.dateOfBirth ?? s.meta?.date_of_birth ?? '';
          if (!v) return '';
          try { return new Date(v).toISOString().split('T')[0]; } catch { return v; }
        })(),
        nationality: s.nationality ?? s.meta?.nationality ?? '',
        studentId: s.student_id ?? s.studentId ?? '',
        admissionNumber: s.admission_no ?? s.admissionNumber ?? s.meta?.admission_no ?? '',
        classAssigned: String(s.class_id ?? s.classAssigned ?? s.classId ?? ''),
        guardianName: s.guardian_name ?? s.guardianName ?? s.meta?.guardian_name ?? '',
        guardianContact: s.guardian_contact ?? s.guardianContact ?? s.meta?.guardian_contact ?? '',
        homeAddress: s.home_address ?? s.homeAddress ?? s.meta?.home_address ?? '',
        previousSchool: s.previous_school ?? s.previousSchool ?? s.meta?.previous_school ?? '',
        dateOfAdmission: (() => {
          const v = s.date_of_admission ?? s.dateOfAdmission ?? s.meta?.date_of_admission ?? '';
          if (!v) return '';
          try { return new Date(v).toISOString().split('T')[0]; } catch { return v; }
        })(),
        notes: s.notes ?? s.meta?.notes ?? s.notes ?? ''
      });
    }
  }, [student]);

  const handleInputChange = (field: keyof Student, value: string | number) => {
    if (formData) {
      setFormData({
        ...formData,
        [field]: value
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    // prepare payload mapping to API; only include optional fields if set
    const payload: any = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      admission_no: formData.admissionNumber || undefined,
      class_id: formData.classAssigned ? Number(formData.classAssigned) : undefined,
      gender: formData.gender || undefined,
      date_of_birth: formData.dateOfBirth || undefined,
      nationality: formData.nationality || undefined,
      guardian_name: formData.guardianName || undefined,
      guardian_contact: formData.guardianContact || undefined,
      home_address: formData.homeAddress || undefined,
      previous_school: formData.previousSchool || undefined,
      notes: formData.notes || undefined
    };

    // Only set date_of_admission if the user provided/left a value
    if (formData.dateOfAdmission) {
      payload.date_of_admission = formData.dateOfAdmission;
    }

    updateStudentMutation.mutate({ id: formData.id, payload }, {
      onSuccess: () => {
        // Add additional audit log for successful edit completion
        addAuditLog({
          actionType: 'Edit',
          module: 'Students',
          itemId: formData.id,
          itemName: `${formData.firstName} ${formData.lastName}`,
          reason: 'Student information updated successfully'
        });

        toast({ title: 'Student Updated', description: `${formData.firstName} ${formData.lastName} has been updated successfully` });
        onSuccess();
        onClose();
      },
      onError: (err: any) => {
        toast({ title: 'Update Failed', description: err?.message ?? 'Unable to update student', variant: 'destructive' });
      }
    });
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student Information</DialogTitle>
          <DialogDescription>Edit the selected student's personal and academic information.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality *</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => handleInputChange('nationality', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissionNumber">Admission Number</Label>
                <Input
                  id="admissionNumber"
                  value={formData.admissionNumber}
                  onChange={(e) => handleInputChange('admissionNumber', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classAssigned">Class Assigned *</Label>
                <Select value={formData.classAssigned} onValueChange={(value) => handleInputChange('classAssigned', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => {
                      const display = cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls.name ?? cls.className ?? 'Unassigned');
                      return (
                        <SelectItem key={cls.id} value={String(cls.id)}>
                          {display}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfAdmission">Date of Admission *</Label>
                <Input
                  id="dateOfAdmission"
                  type="date"
                  value={formData.dateOfAdmission}
                  onChange={(e) => handleInputChange('dateOfAdmission', e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="previousSchool">Previous School</Label>
                <Input
                  id="previousSchool"
                  value={formData.previousSchool}
                  onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Guardian Name *</Label>
                <Input
                  id="guardianName"
                  value={formData.guardianName}
                  onChange={(e) => handleInputChange('guardianName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardianContact">Guardian Contact *</Label>
                <Input
                  id="guardianContact"
                  value={formData.guardianContact}
                  onChange={(e) => handleInputChange('guardianContact', e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="homeAddress">Home Address *</Label>
                <Textarea
                  id="homeAddress"
                  value={formData.homeAddress}
                  onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* (Sibling fields removed) */}

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Additional Notes</h3>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Update Student</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentDialog;
