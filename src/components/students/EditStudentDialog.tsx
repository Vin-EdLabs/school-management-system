import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useAudit } from '../../contexts/AuditContext';
import { useAuth } from '../../contexts/AuthContext';
import { uploadStudentPhotoInBackground } from '@/hooks/useStudentCache';
import { toast } from '@/hooks/use-toast';
import { Camera, Trash2, GraduationCap as ScholarshipIcon, UserPlus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

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
  guardian2Name?: string;
  guardian2Contact?: string;
  guardian2Relationship?: string;
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
  enrollmentStatus?: string;
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
  const { classes, updateStudent, students } = useData();
  const queryClient = useQueryClient();
  const { schoolId } = useSchool();
  const { addAuditLog } = useAudit();
  const { verifyPassword, user } = useAuth();
  const [formData, setFormData] = useState<Student | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [selectedSiblings, setSelectedSiblings] = useState<any[]>([]);

  useEffect(() => {
    if (student && students.length > 0) {
      const namesStr = student.namesOfSiblings || '';
      const matches = [...namesStr.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
      if (matches.length > 0) {
        const found = students.filter(s => matches.includes(s.admissionNumber) && s.id !== student.id);
        setSelectedSiblings(found);
      } else {
        setSelectedSiblings([]);
      }
    } else {
      setSelectedSiblings([]);
    }
  }, [student, students]);

  const matchingStudents = useMemo(() => {
    if (!siblingSearch.trim() || !formData) return [];
    const query = siblingSearch.toLowerCase();
    return students.filter(s => {
      if (s.id === formData.id) return false;
      if (selectedSiblings.some(sel => sel.id === s.id)) return false;
      return (
        s.firstName.toLowerCase().includes(query) ||
        s.lastName.toLowerCase().includes(query) ||
        s.admissionNumber.toLowerCase().includes(query)
      );
    }).slice(0, 5);
  }, [siblingSearch, students, selectedSiblings, formData]);

  const addSibling = (sib: any) => {
    if (!formData) return;
    const newSiblings = [...selectedSiblings, sib];
    setSelectedSiblings(newSiblings);
    const names = newSiblings.map(s => `${s.firstName} ${s.lastName} (${s.admissionNumber})`).join(', ');
    setFormData({
      ...formData,
      namesOfSiblings: names,
      numberOfSiblings: Math.max(formData.numberOfSiblings, newSiblings.length)
    });
    setSiblingSearch('');
  };

  const removeSibling = (sibId: string) => {
    if (!formData) return;
    const newSiblings = selectedSiblings.filter(s => s.id !== sibId);
    setSelectedSiblings(newSiblings);
    const names = newSiblings.map(s => `${s.firstName} ${s.lastName} (${s.admissionNumber})`).join(', ');
    setFormData({
      ...formData,
      namesOfSiblings: names,
      numberOfSiblings: Math.max(0, formData.numberOfSiblings - 1)
    });
  };

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student) {
      setFormData({
        ...student,
        enrollmentStatus: student.enrollmentStatus || 'active',
      });
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
        isBeneficiary: checked,
        ...(checked
          ? {}
          : {
            beneficiaryType: '',
            discountType: 'percentage',
            discountValue: 0,
            beneficiaryNotes: formData.beneficiaryNotes,
          }),
      });
    }
  };


  const performUpdate = () => {
    if (!formData) return;
    const photoToUpload = photoFile;
    const photoPreviewUrl = photoPreview;
    const snapshot = { ...formData };

    addAuditLog({
      actionType: 'Edit',
      module: 'Students',
      itemId: snapshot.id,
      itemName: `${snapshot.firstName} ${snapshot.lastName}`,
      reason: 'Student information updated successfully'
    });
    toast({ title: "Student Updated", description: `${snapshot.firstName} ${snapshot.lastName} has been updated successfully` });
    onSuccess();
    onClose();

    void updateStudent(snapshot.id, snapshot).catch((err: Error) => {
      toast({ title: 'Update Failed', description: err?.message || 'Failed to update student', variant: 'destructive' });
    });

    if (photoToUpload) {
      void uploadStudentPhotoInBackground(
        queryClient,
        schoolId,
        snapshot.id,
        photoToUpload,
        photoPreviewUrl || undefined
      );
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
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle>Edit Student Information</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-6 px-6 py-4">
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
                <Label htmlFor="enrollmentStatus">Enrollment status</Label>
                <Select
                  value={formData.enrollmentStatus || 'active'}
                  onValueChange={(value) => handleInputChange('enrollmentStatus', value)}
                >
                  <SelectTrigger id="enrollmentStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="graduated">Alumni (graduated)</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="guardian2Name">Second guardian name</Label>
                <Input
                  id="guardian2Name"
                  value={formData.guardian2Name || ''}
                  onChange={(e) => handleInputChange('guardian2Name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian2Contact">Second guardian contact</Label>
                <Input
                  id="guardian2Contact"
                  value={formData.guardian2Contact || ''}
                  onChange={(e) => handleInputChange('guardian2Contact', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian2Relationship">Relationship</Label>
                <Input
                  id="guardian2Relationship"
                  value={formData.guardian2Relationship || ''}
                  onChange={(e) => handleInputChange('guardian2Relationship', e.target.value)}
                  placeholder="e.g. Mother, Uncle"
                />
              </div>
            </div>
          </div>

          {/* Family Information */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="font-semibold text-lg">Family & Siblings Information</h3>
            <div className="bg-slate-50/50 dark:bg-slate-800/10 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-6">
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
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Includes both inside and outside school siblings.</p>
                </div>
                <div className="space-y-2 relative">
                  <Label>Search & Link Internal Siblings</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Type sibling name or admission number..."
                      value={siblingSearch}
                      onChange={(e) => setSiblingSearch(e.target.value)}
                      className="pr-8"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <UserPlus className="w-4 h-4" />
                    </div>
                  </div>

                  {matchingStudents.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                      {matchingStudents.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => addSibling(student)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between border-b border-slate-50 dark:border-slate-800/30 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            {student.passportPhotoUrl ? (
                              <img
                                src={resolveMediaUrl(student.passportPhotoUrl) || ''}
                                alt={`${student.firstName} ${student.lastName}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const photoUrl = resolveMediaUrl(student.passportPhotoUrl);
                                  if (photoUrl) {
                                    setPreviewPhoto({ url: photoUrl, name: `${student.firstName} ${student.lastName}` });
                                  }
                                }}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-800 hover:scale-110 active:scale-95 transition-all cursor-zoom-in shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase shrink-0">
                                {student.firstName[0]}{student.lastName[0]}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{student.firstName} {student.lastName}</p>
                              <p className="text-[9px] text-slate-500">{student.classAssigned || 'No Class'} • {student.admissionNumber}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded">Link</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedSiblings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Linked Internal Siblings ({selectedSiblings.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSiblings.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 pl-2 pr-1.5 py-1 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm animate-in zoom-in-95 duration-200"
                      >
                        {s.passportPhotoUrl ? (
                          <img
                            src={resolveMediaUrl(s.passportPhotoUrl) || ''}
                            alt={`${s.firstName} ${s.lastName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const photoUrl = resolveMediaUrl(s.passportPhotoUrl);
                              if (photoUrl) {
                                setPreviewPhoto({ url: photoUrl, name: `${s.firstName} ${s.lastName}` });
                              }
                            }}
                            className="w-6 h-6 rounded-md object-cover border border-indigo-200/50 dark:border-indigo-900/50 hover:scale-110 active:scale-95 transition-all cursor-zoom-in shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center font-bold text-[9px] text-indigo-600 dark:text-indigo-400 uppercase shrink-0">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                        )}
                        <span>{s.firstName} {s.lastName}</span>
                        <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-semibold">{s.classAssigned}</span>
                        <button
                          type="button"
                          onClick={() => removeSibling(s.id)}
                          className="w-4.5 h-4.5 rounded-md hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors text-slate-400 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="namesOfSiblings">Linked Siblings Details (System Value)</Label>
                <Input
                  id="namesOfSiblings"
                  value={formData.namesOfSiblings}
                  onChange={(e) => handleInputChange('namesOfSiblings', e.target.value)}
                  placeholder="Linked siblings list will populate here automatically..."
                  className="bg-slate-50 dark:bg-slate-800/30 text-slate-500"
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
                  <h3 className="font-semibold text-lg">Beneficiary & Discount</h3>
                </div>
                <p className="text-sm text-slate-500">Enable if student receives any form of fee discount</p>
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
                    Full Discount (100% Free)
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
                          <SelectItem value="Full Scholarship">Full Discount</SelectItem>
                          <SelectItem value="Partial Scholarship">Partial Discount</SelectItem>
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
                  <Label htmlFor="beneficiaryNotes">Discount Notes</Label>
                  <Textarea
                    id="beneficiaryNotes"
                    value={formData.beneficiaryNotes}
                    onChange={(e) => handleInputChange('beneficiaryNotes', e.target.value)}
                    placeholder="Reason for discount, awarding body, etc."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {showPassword && (
            <div className="border-t pt-4 space-y-4">
              <Label>Enter your password to confirm this update</Label>
              <div className="flex flex-wrap gap-2">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required className="flex-1 min-w-[12rem]" />
                <Button type="button" variant="outline" onClick={() => { setShowPassword(false); setPassword(''); }}>Cancel</Button>
                <Button type="button" variant="primaryAction" onClick={handlePasswordConfirmAndUpdate}>Confirm</Button>
              </div>
            </div>
          )}
          </DialogBody>

          {!showPassword && (
            <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primaryAction">
                Update Student
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>

      {/* Floating Lightbox Image Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="flex min-h-full w-full justify-center">
          <div
            className="relative my-auto mx-auto max-w-sm w-full max-h-[calc(100dvh-2rem)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-6 right-6 bg-slate-900/80 hover:bg-slate-800/80 hover:scale-110 text-white rounded-full p-2.5 transition-all shadow-lg z-[110]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-3 overflow-hidden border border-slate-200/20 shadow-2xl">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="w-full h-80 object-cover rounded-[1.5rem] shadow-sm"
              />
              <div className="mt-3 text-center pb-2">
                <p className="font-extrabold text-slate-900 dark:text-white text-base">{previewPhoto.name}</p>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider mt-0.5">Sibling Passport Preview</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default EditStudentDialog;
