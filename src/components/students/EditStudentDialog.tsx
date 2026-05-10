import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { useAudit } from '../../contexts/AuditContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Camera, Trash2, GraduationCap as ScholarshipIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { apiService } from '../../services/api';

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
  classAssignedId?: number;
  guardianName: string;
  guardianContact: string;
  homeAddress: string;
  numberOfSiblings: number;
  namesOfSiblings: string;
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
  passportPhotoUrl?: string;
  isBeneficiary?: boolean;
  beneficiaryType?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  beneficiaryNotes?: string;
}

interface EditStudentDialogProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace('/api', '');

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

const EditStudentDialog: React.FC<EditStudentDialogProps> = ({ student, open, onClose, onSuccess }) => {
  const { classes, updateStudent } = useData();
  const { addAuditLog } = useAudit();
  const { verifyPassword, user } = useAuth();
  const [formData, setFormData] = useState<Student | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student) {
      setFormData({ ...student });
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [student]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (field: keyof Student, value: string | number) => {
    if (formData) {
      const updates: any = { [field]: value };
      
      // If class changed, find and update classAssignedId
      if (field === 'classAssigned') {
        const classObj = classes.find(c => c.className === value);
        if (classObj) {
          updates.classAssignedId = parseInt(classObj.id, 10);
        }
      }

      setFormData({
        ...formData,
        ...updates
      });
    }
  };

  const handleBeneficiaryToggle = (checked: boolean) => {
    if (formData) {
      setFormData({
        ...formData,
        isBeneficiary: checked
      });
    }
  };


  const performUpdate = async () => {
    if (!formData) return;
    setPhotoUploading(true);
    try {
      // Upload photo first if a new file was selected
      if (photoFile) {
        const result = await apiService.uploadStudentPhoto(formData.id, photoFile) as any;
        if (result?.passport_photo_url) {
          formData.passportPhotoUrl = result.passport_photo_url;
        }
      }
      await updateStudent(formData.id, formData);
      addAuditLog({
        actionType: 'Edit',
        module: 'Students',
        itemId: formData.id,
        itemName: `${formData.firstName} ${formData.lastName}`,
        reason: 'Student information updated successfully'
      });
      toast({ title: "Student Updated", description: `${formData.firstName} ${formData.lastName} has been updated successfully` });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err?.message || 'Failed to update student', variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    // Validation
    if (
      !formData.firstName || 
      !formData.lastName || 
      !formData.gender || 
      !formData.dateOfBirth || 
      !formData.nationality ||
      !formData.classAssigned ||
      !formData.dateOfAdmission ||
      !formData.guardianName ||
      !formData.guardianContact ||
      !formData.homeAddress
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields marked with *",
        variant: "destructive"
      });
      return;
    }

    if (user?.role === 'super-admin') {
      performUpdate();
    } else {
      setShowPassword(true);
    }
  };

  const handlePasswordConfirmAndUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({ title: 'Password required', description: 'Enter your password to continue', variant: 'destructive' });
      return;
    }
    const valid = await verifyPassword(password);
    if (!valid) {
      toast({ title: 'Incorrect password', description: 'Please try again', variant: 'destructive' });
      return;
    }
    setShowPassword(false);
    setPassword('');
    performUpdate();
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80dvh]">
        <DialogHeader>
          <DialogTitle>Edit Student Information</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Passport Photo */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Passport Photo</h3>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-20 h-24 rounded-lg overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : formData?.passportPhotoUrl ? (
                  <img
                    src={resolveMediaUrl(formData.passportPhotoUrl) || ''}
                    alt="Current"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-500">
                  {formData?.passportPhotoUrl && !photoPreview
                    ? 'Current photo shown. Select a new file to replace it.'
                    : 'Upload a passport-size photo (JPG, PNG).'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="student-photo-input"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {formData?.passportPhotoUrl ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  {photoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto} className="text-red-500 hover:text-red-700 gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                <Label>Student ID</Label>
                <Input value={formData.studentId} readOnly disabled className="bg-slate-50 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label>Admission Number</Label>
                <Input value={formData.admissionNumber} readOnly disabled className="bg-slate-50 cursor-not-allowed" />
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
                    {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                      <SelectItem key={cls.id} value={cls.className}>
                        {cls.className}
                      </SelectItem>
                    ))}
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

          {/* Family Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Family Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numberOfSiblings">Number of Siblings</Label>
                <Input
                  id="numberOfSiblings"
                  type="number"
                  min="0"
                  value={formData.numberOfSiblings}
                  onChange={(e) => handleInputChange('numberOfSiblings', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="namesOfSiblings">Names of Siblings</Label>
                <Input
                  id="namesOfSiblings"
                  value={formData.namesOfSiblings}
                  onChange={(e) => handleInputChange('namesOfSiblings', e.target.value)}
                />
              </div>
            </div>
          </div>

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

          {/* Beneficiary Information */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ScholarshipIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-lg">Beneficiary & Scholarship</h3>
                </div>
                <p className="text-sm text-slate-500">Enable if student receives any form of fee discount or scholarship</p>
              </div>
              <Switch
                checked={formData.isBeneficiary}
                onCheckedChange={handleBeneficiaryToggle}
              />
            </div>

            {formData.isBeneficiary && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100 mb-2">
                  <Switch
                    id="isFullScholarship"
                    checked={formData.discountType === 'percentage' && formData.discountValue === 100}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          discountType: 'percentage',
                          discountValue: 100,
                          beneficiaryType: formData.beneficiaryType || 'Full Scholarship'
                        });
                      } else {
                        setFormData({
                          ...formData,
                          discountValue: 0
                        });
                      }
                    }}
                  />
                  <Label htmlFor="isFullScholarship" className="text-indigo-900 font-bold cursor-pointer">
                    Full Scholarship (100% Free)
                  </Label>
                </div>

                {!(formData.discountType === 'percentage' && formData.discountValue === 100) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <Label htmlFor="beneficiaryType">Beneficiary Type</Label>
                      <Select 
                        value={formData.beneficiaryType} 
                        onValueChange={(value) => handleInputChange('beneficiaryType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full Scholarship">Full Scholarship</SelectItem>
                          <SelectItem value="Partial Scholarship">Partial Scholarship</SelectItem>
                          <SelectItem value="Staff Child Discount">Staff Child Discount</SelectItem>
                          <SelectItem value="Bursary">Bursary</SelectItem>
                          <SelectItem value="Sibling Discount">Sibling Discount</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountType">Discount Method</Label>
                      <Select 
                        value={formData.discountType} 
                        onValueChange={(value: 'percentage' | 'fixed') => handleInputChange('discountType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="discountValue">
                        {formData.discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount'}
                      </Label>
                      <Input
                        id="discountValue"
                        type="number"
                        min="0"
                        max={formData.discountType === 'percentage' ? 100 : undefined}
                        value={formData.discountValue}
                        onChange={(e) => handleInputChange('discountValue', parseFloat(e.target.value) || 0)}
                        className="font-bold text-indigo-600"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="beneficiaryNotes">Scholarship Notes</Label>
                  <Textarea
                    id="beneficiaryNotes"
                    value={formData.beneficiaryNotes}
                    onChange={(e) => handleInputChange('beneficiaryNotes', e.target.value)}
                    placeholder="Reason for scholarship, awarding body, etc."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {showPassword && (
            <div className="border-t pt-4 space-y-4">
              <Label>Enter your password to confirm this update</Label>
              <div className="flex gap-2">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required className="flex-1" />
                <Button type="button" variant="outline" onClick={() => { setShowPassword(false); setPassword(''); }}>Cancel</Button>
                <Button type="button" onClick={handlePasswordConfirmAndUpdate}>Confirm</Button>
              </div>
            </div>
          )}

          {!showPassword && (
            <DialogFooter className="pt-6 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose} disabled={photoUploading}>Cancel</Button>
              <Button type="submit" disabled={photoUploading}>
                {photoUploading ? 'Saving…' : 'Update Student'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentDialog;
