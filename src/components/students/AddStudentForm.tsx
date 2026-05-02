import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Save, UserPlus, Camera, X, GraduationCap as ScholarshipIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface AddStudentFormProps {
  onSuccess?: () => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onSuccess }) => {
  const { addStudent, classes } = useData();
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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
    numberOfSiblings: 0,
    namesOfSiblings: '',
    previousSchool: '',
    dateOfAdmission: new Date().toISOString().split('T')[0],
    notes: '',
    isBeneficiary: false,
    beneficiaryType: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    beneficiaryNotes: ''
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

    const classObj = classes.find(c => c.className === formData.classAssigned);
    const classAssignedId = classObj ? parseInt(classObj.id, 10) : undefined;

    try {
      const created = await addStudent({
        ...formData,
        classAssignedId,
      });

      if (created && passportPhoto) {
        await apiService.uploadStudentPhoto(created.id, passportPhoto);
      }

      toast({
        title: "Student Added Successfully",
        description: created 
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
        notes: '',
        isBeneficiary: false,
        beneficiaryType: '',
        discountType: 'percentage',
        discountValue: 0,
        beneficiaryNotes: ''
      });
      clearPhoto();

      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden animate-in fade-in zoom-in duration-500">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-6">
        <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-white font-black font-outfit text-xl tracking-tight">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          Add New Student
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Passport Photo Section */}
          <div className="bg-slate-50/30 dark:bg-slate-800/20 p-6 rounded-[1.5rem] border border-slate-200/50 dark:border-slate-700/50 space-y-4">
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Passport Identity</Label>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-500/50 group-hover:bg-indigo-50/10 shadow-inner">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <Camera className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute inset-0 rounded-[2rem] bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors pointer-events-none" />
              </div>
              <div className="flex-1 space-y-4 w-full">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="h-12 cursor-pointer bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 dark:file:bg-white file:text-white dark:file:text-slate-900 file:uppercase file:tracking-widest"
                />
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">JPG/PNG/WEBP • Max 2MB • Square Ratio Recommended</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Personal Profile</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="firstName" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">First Name <span className="text-red-500">*</span></Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="e.g. Michael"
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="lastName" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Last Name <span className="text-red-500">*</span></Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="e.g. Mensah"
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="gender" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Gender <span className="text-red-500">*</span></Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                  <SelectTrigger className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl">
                    <SelectItem value="Male" className="rounded-lg">Male</SelectItem>
                    <SelectItem value="Female" className="rounded-lg">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="dateOfBirth" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Date of Birth <span className="text-red-500">*</span></Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="nationality" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Nationality <span className="text-red-500">*</span></Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => handleInputChange('nationality', e.target.value)}
                  placeholder="Enter nationality"
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Institutional Context</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* School Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Identity Tokens</Label>
                <div className="h-12 flex items-center px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 italic">
                  Auto-Provisioned Upon Commit
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="classAssigned" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Level Assignment <span className="text-red-500">*</span></Label>
                <Select value={formData.classAssigned} onValueChange={(value) => handleInputChange('classAssigned', value)}>
                  <SelectTrigger className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.className} className="rounded-lg">
                        {cls.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Guardian Protocol</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Guardian Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="guardianName" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Guardian Identity <span className="text-red-500">*</span></Label>
                <Input
                  id="guardianName"
                  value={formData.guardianName}
                  onChange={(e) => handleInputChange('guardianName', e.target.value)}
                  placeholder="Enter primary guardian"
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="guardianContact" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Communication Channel <span className="text-red-500">*</span></Label>
                <Input
                  id="guardianContact"
                  value={formData.guardianContact}
                  onChange={(e) => handleInputChange('guardianContact', e.target.value)}
                  placeholder="Phone or Email"
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="homeAddress" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Geographical Baseline <span className="text-red-500">*</span></Label>
              <Textarea
                id="homeAddress"
                value={formData.homeAddress}
                onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                placeholder="Full residential coordinates..."
                rows={3}
                required
                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Supplementary Forensics</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Family & Admission Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="numberOfSiblings" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Sibling Count</Label>
                <Input
                  id="numberOfSiblings"
                  type="number"
                  min="0"
                  value={formData.numberOfSiblings}
                  onChange={(e) => handleInputChange('numberOfSiblings', parseInt(e.target.value) || 0)}
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="namesOfSiblings" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Internal Siblings</Label>
                <Input
                  id="namesOfSiblings"
                  value={formData.namesOfSiblings}
                  onChange={(e) => handleInputChange('namesOfSiblings', e.target.value)}
                  placeholder="List linked identities"
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="previousSchool" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Legacy Entity</Label>
                <Input
                  id="previousSchool"
                  value={formData.previousSchool}
                  onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                  placeholder="Previous Institution"
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="dateOfAdmission" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Onboarding Date <span className="text-red-500">*</span></Label>
                <Input
                  id="dateOfAdmission"
                  type="date"
                  value={formData.dateOfAdmission}
                  onChange={(e) => handleInputChange('dateOfAdmission', e.target.value)}
                  required
                  className="h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="notes" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Administrative Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional context or medical warnings..."
                rows={3}
                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {/* Beneficiary Information */}
            <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-8 rounded-[2rem] border border-indigo-500/20 shadow-sm transition-all hover:shadow-md group">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                      <ScholarshipIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <Label className="text-xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Beneficiary Protocol</Label>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2 ml-1">Apply Financial Support or Scholarships</p>
                </div>
                <Switch
                  checked={formData.isBeneficiary}
                  onCheckedChange={(checked) => handleInputChange('isBeneficiary', checked)}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              {formData.isBeneficiary && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-950 rounded-2xl border border-indigo-500/20 shadow-inner">
                    <Switch
                      id="isFullScholarship"
                      checked={formData.discountType === 'percentage' && formData.discountValue === 100}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            discountType: 'percentage',
                            discountValue: 100,
                            beneficiaryType: prev.beneficiaryType || 'Full Scholarship'
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            discountValue: 0
                          }));
                        }
                      }}
                    />
                    <Label htmlFor="isFullScholarship" className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest cursor-pointer">
                      Full Scholarship (100% Free)
                    </Label>
                  </div>

                  {!(formData.discountType === 'percentage' && formData.discountValue === 100) && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="beneficiaryType" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Support Archetype</Label>
                          <Select 
                            value={formData.beneficiaryType} 
                            onValueChange={(value) => handleInputChange('beneficiaryType', value)}
                          >
                            <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-indigo-500/30 rounded-xl">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-indigo-500/20 shadow-2xl">
                              <SelectItem value="Full Scholarship" className="rounded-lg">Full Scholarship</SelectItem>
                              <SelectItem value="Partial Scholarship" className="rounded-lg">Partial Scholarship</SelectItem>
                              <SelectItem value="Staff Child Discount" className="rounded-lg">Staff Child Discount</SelectItem>
                              <SelectItem value="Bursary" className="rounded-lg">Bursary</SelectItem>
                              <SelectItem value="Sibling Discount" className="rounded-lg">Sibling Discount</SelectItem>
                              <SelectItem value="Other" className="rounded-lg">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="discountType" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Calculation Metric</Label>
                          <Select 
                            value={formData.discountType} 
                            onValueChange={(value: 'percentage' | 'fixed') => handleInputChange('discountType', value)}
                          >
                            <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-indigo-500/30 rounded-xl">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-indigo-500/20 shadow-2xl">
                              <SelectItem value="percentage" className="rounded-lg">Percentage (%)</SelectItem>
                              <SelectItem value="fixed" className="rounded-lg">Fixed Sum</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="discountValue" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                            {formData.discountType === 'percentage' ? 'Quantum (%)' : 'Scalar Amount'}
                          </Label>
                          <Input
                            id="discountValue"
                            type="number"
                            min="0"
                            max={formData.discountType === 'percentage' ? 100 : undefined}
                            value={formData.discountValue}
                            onChange={(e) => handleInputChange('discountValue', parseFloat(e.target.value) || 0)}
                            className="h-12 bg-white dark:bg-slate-950 border-indigo-500/30 rounded-xl font-black text-indigo-600 dark:text-indigo-400 text-lg shadow-inner"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <Label htmlFor="beneficiaryNotes" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Beneficiary Reasoning</Label>
                    <Textarea
                      id="beneficiaryNotes"
                      value={formData.beneficiaryNotes}
                      onChange={(e) => handleInputChange('beneficiaryNotes', e.target.value)}
                      placeholder="Award criteria, validity period, etc."
                      rows={2}
                      className="bg-white dark:bg-slate-900 border-indigo-500/30 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" className="h-14 px-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 dark:shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Save className="w-4 h-4 mr-3" />
              Commit Identity
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddStudentForm;
