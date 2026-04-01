<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
import React, { useState } from 'react';
=======

>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Save, UserPlus, Camera, X } from 'lucide-react';
=======
import { toast } from '@/hooks/use-toast';
import { Save, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { useClasses } from '../../hooks/useClasses';
import { useCreateStudent } from '../../hooks/useStudents';
import { useActiveTerm } from '@/hooks/useSettings';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx

interface AddStudentFormProps {
  onSuccess?: () => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onSuccess }) => {
<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
  const { addStudent, classes } = useData();
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
=======
  const createStudentMutation = useCreateStudent();
  const { classes } = useClasses();
  const { data: activeTerm } = useActiveTerm();
  const hasActiveTerm = !!activeTerm;
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    nationality: 'Ghanaian',
    classAssigned: '',
    guardianName: '',
    guardianContact: '',
    homeAddress: '',
    previousSchool: '',
    dateOfAdmission: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file', description: 'Please select an image file (JPG, PNG)', variant: 'destructive' });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Please select an image under 2MB', variant: 'destructive' });
        return;
      }
      setPassportPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPassportPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
=======
    // Validation
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx
    if (!formData.firstName || !formData.lastName || !formData.gender || !formData.dateOfBirth || !formData.classAssigned) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const classObj = classes.find(c => c.className === formData.classAssigned);
    const classAssignedId = classObj ? parseInt(classObj.id, 10) : undefined;

    try {
<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
      const created = await addStudent({
        ...formData,
        classAssignedId,
      });

      if (passportPhoto && created?.id) {
        await apiService.uploadStudentPhoto(created.id, passportPhoto);
      }

      toast({
        title: "Student Added Successfully",
        description: created?.studentId && created?.admissionNumber
          ? `${formData.firstName} ${formData.lastName} — Student ID: ${created.studentId}, Admission: ${created.admissionNumber}`
          : `${formData.firstName} ${formData.lastName} has been added to the system`,
      });

      setFormData({
        firstName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        nationality: 'Ghanaian',
        classAssigned: '',
        guardianName: '',
        guardianContact: '',
        homeAddress: '',
        numberOfSiblings: 0,
        namesOfSiblings: '',
        previousSchool: '',
        dateOfAdmission: new Date().toISOString().split('T')[0],
        notes: ''
      });
      clearPhoto();
=======
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
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx

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
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800 font-semibold">
          <UserPlus className="w-5 h-5 text-slate-600" />
          Add New Student
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Passport Photo */}
          <div className="space-y-2">
            <Label className="text-slate-700">Passport Photo</Label>
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="text-xs text-slate-500">JPG, PNG or WebP. Max 2MB. Recommended: square photo for best display.</p>
              </div>
            </div>
          </div>

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
                className="bg-slate-50/50 border-slate-200"
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
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger className="bg-slate-50/50 border-slate-200">
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
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                placeholder="Enter nationality"
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
          </div>

          {/* School Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Student ID & Admission Number</Label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Auto-generated upon save (read-only)
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classAssigned">Class Assigned *</Label>
              <Select value={formData.classAssigned} onValueChange={(value) => handleInputChange('classAssigned', value)}>
                <SelectTrigger className="bg-slate-50/50 border-slate-200">
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
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianContact">Guardian Contact</Label>
              <Input
                id="guardianContact"
                value={formData.guardianContact}
                onChange={(e) => handleInputChange('guardianContact', e.target.value)}
                placeholder="Phone number"
                className="bg-slate-50/50 border-slate-200"
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
              className="bg-slate-50/50 border-slate-200"
            />
          </div>

<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
          {/* Family Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfSiblings">Number of Siblings</Label>
              <Input
                id="numberOfSiblings"
                type="number"
                min="0"
                value={formData.numberOfSiblings}
                onChange={(e) => handleInputChange('numberOfSiblings', parseInt(e.target.value) || 0)}
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namesOfSiblings">Names of Siblings</Label>
              <Input
                id="namesOfSiblings"
                value={formData.namesOfSiblings}
                onChange={(e) => handleInputChange('namesOfSiblings', e.target.value)}
                placeholder="Comma separated"
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
          </div>
=======
          {/* (Sibling fields removed) */}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="previousSchool">Previous School</Label>
              <Input
                id="previousSchool"
                value={formData.previousSchool}
                onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                placeholder="Optional"
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfAdmission">Date of Admission</Label>
              <Input
                id="dateOfAdmission"
                type="date"
                value={formData.dateOfAdmission}
                onChange={(e) => handleInputChange('dateOfAdmission', e.target.value)}
                className="bg-slate-50/50 border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
              className="bg-slate-50/50 border-slate-200"
            />
          </div>

<<<<<<< HEAD:src/components/students/AddStudentForm.tsx
          <div className="flex justify-end pt-2">
            <Button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white px-6">
=======
          <div className="flex flex-col items-end space-y-2">
            {!hasActiveTerm && <p className="text-sm text-red-500 font-medium">Please set an active academic term in settings to add students.</p>}
            <Button
              type="submit"
              disabled={!hasActiveTerm || createStudentMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/AddStudentForm.tsx
              <Save className="w-4 h-4 mr-2" />
              {createStudentMutation.isPending ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddStudentForm;
