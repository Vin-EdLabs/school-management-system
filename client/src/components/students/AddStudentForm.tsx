
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Save, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { useClasses } from '../../hooks/useClasses';
import { useCreateStudent } from '../../hooks/useStudents';

interface AddStudentFormProps {
  onSuccess?: () => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onSuccess }) => {
  const createStudentMutation = useCreateStudent();
  const { classes } = useClasses();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    nationality: 'Ghanaian',
    admissionNumber: '',
    classAssigned: '',
    guardianName: '',
    guardianContact: '',
    homeAddress: '',
    previousSchool: '',
    dateOfAdmission: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.gender || !formData.dateOfBirth || !formData.classAssigned) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const payload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        admission_no: formData.admissionNumber || undefined,
        class_id: formData.classAssigned ? Number(formData.classAssigned) : undefined,
        date_of_admission: formData.dateOfAdmission,
        status: 'active',
        gender: formData.gender || undefined,
        date_of_birth: formData.dateOfBirth || undefined,
        nationality: formData.nationality || undefined,
        guardian_name: formData.guardianName || undefined,
        guardian_contact: formData.guardianContact || undefined,
        home_address: formData.homeAddress || undefined,
        previous_school: formData.previousSchool || undefined,
        notes: formData.notes || undefined,
      };

      createStudentMutation.mutate(payload, {
        onSuccess: () => {
          toast({
            title: 'Student Added Successfully',
            description: `${formData.firstName} ${formData.lastName} has been added to the system`,
          });

          // Reset form
          setFormData({
            firstName: '',
            lastName: '',
            gender: '',
            dateOfBirth: '',
            nationality: 'Ghanaian',
            admissionNumber: '',
            classAssigned: '',
            guardianName: '',
            guardianContact: '',
            homeAddress: '',
            previousSchool: '',
            dateOfAdmission: new Date().toISOString().split('T')[0],
            notes: ''
          });

          if (onSuccess) onSuccess();
        },
        onError: (err: any) => {
          toast({ title: 'Error', description: err?.message ?? 'Failed to add student. Please try again.', variant: 'destructive' });
        }
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add student. Please try again.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserPlus className="w-5 h-5" />
          <span>Add New Student</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter first name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
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
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                placeholder="Enter nationality"
              />
            </div>
          </div>

          {/* School Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input
                id="admissionNumber"
                value={formData.admissionNumber}
                onChange={(e) => handleInputChange('admissionNumber', e.target.value)}
                placeholder="Enter admission number (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classAssigned">Class Assigned *</Label>
              <Select value={formData.classAssigned} onValueChange={(value) => handleInputChange('classAssigned', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={String(cls.id)}>
                      {cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls.name ?? cls.className)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guardianName">Guardian Name</Label>
              <Input
                id="guardianName"
                value={formData.guardianName}
                onChange={(e) => handleInputChange('guardianName', e.target.value)}
                placeholder="Enter guardian name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianContact">Guardian Contact</Label>
              <Input
                id="guardianContact"
                value={formData.guardianContact}
                onChange={(e) => handleInputChange('guardianContact', e.target.value)}
                placeholder="Enter guardian phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="homeAddress">Home Address</Label>
            <Textarea
              id="homeAddress"
              value={formData.homeAddress}
              onChange={(e) => handleInputChange('homeAddress', e.target.value)}
              placeholder="Enter home address"
              rows={3}
            />
          </div>

          {/* (Sibling fields removed) */}

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="previousSchool">Previous School</Label>
              <Input
                id="previousSchool"
                value={formData.previousSchool}
                onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                placeholder="Enter previous school (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfAdmission">Date of Admission</Label>
              <Input
                id="dateOfAdmission"
                type="date"
                value={formData.dateOfAdmission}
                onChange={(e) => handleInputChange('dateOfAdmission', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes/Comments</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Enter any additional notes or comments"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="submit" className="bg-gradient-to-r from-blue-500 to-purple-600">
              <Save className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddStudentForm;
