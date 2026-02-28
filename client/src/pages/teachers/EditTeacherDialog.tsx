import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import useSubjects from '@/hooks/useSubjects';
import useTeachers from '@/hooks/useTeachers';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Teacher {
  id: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  staffId: string;
  phoneNumber: string;
  email: string;
  address: string;
  subjectsTaught: string[];
  classAssigned: string;
  employmentDate: string;
  monthlySalary: number;
  employmentStatus: string;
  notes: string;
}

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
  const { updateTeacher } = useTeachers();
  const { subjects } = useSubjects();
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
    employmentStatus: '',
    notes: ''
  });

  useEffect(() => {
    if (teacher) {
      const formatDate = (dateValue: any) => {
        if (!dateValue) return '';
        try {
          // If it's already a string like "2024-05-12", return it
          if (typeof dateValue === 'string' && dateValue.includes('-')) {
            return dateValue.split('T')[0];
          }
          // If it's a date object
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0];
        } catch {
          return '';
        }
      };

      setFormData({
        fullName: teacher.fullName || (teacher as any).display_name || '',
        gender: teacher.gender || '',
        dateOfBirth: formatDate(teacher.dateOfBirth || (teacher as any).date_of_birth),
        phoneNumber: teacher.phoneNumber || (teacher as any).phone || '',
        email: teacher.email || '',
        address: teacher.address || '',
        subjectsTaught: teacher.subjectsTaught || (teacher as any).subjects_taught || [],
        employmentDate: formatDate(teacher.employmentDate || (teacher as any).employment_date),
        monthlySalary: teacher.monthlySalary != null ? String(teacher.monthlySalary) : ((teacher as any).monthly_salary != null ? String((teacher as any).monthly_salary) : ''),
        employmentStatus: teacher.employmentStatus || (teacher as any).employment_status || '',
        notes: teacher.notes || ''
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacher) return;

    if (!formData.fullName || !formData.email || !formData.phoneNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Convert salary to number for storage
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

    updateTeacher.mutate({ id: teacher.id, payload: { ...formData, monthlySalary: salaryValue } }, {
      onSuccess: () => {
        toast({ title: 'Teacher Updated', description: `${formData.fullName} has been updated successfully` });
        onSuccess();
        onClose();
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update teacher', variant: 'destructive' });
      }
    });
  };

  if (!teacher) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Teacher Details</DialogTitle>
          <DialogDescription>Edit the selected teacher's profile and employment details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label>Subjects Taught</Label>
            <Select onValueChange={handleAddSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Add subjects" />
              </SelectTrigger>
              <SelectContent>
                {(subjects || []).filter((s: any) => {
                  const name = s.name ?? s.title ?? s.code ?? '';
                  return name && !formData.subjectsTaught.includes(name);
                }).map((s: any) => {
                  const name = s.name ?? s.title ?? s.code ?? '';
                  return (
                    <SelectItem key={s.id} value={name}>
                      {name}{s.code ? ` (${s.code})` : ''}
                    </SelectItem>
                  );
                })}
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
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select value={formData.employmentStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Left">Left</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Update Teacher
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTeacherDialog;
