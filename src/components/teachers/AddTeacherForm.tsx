import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

interface AddTeacherFormProps {
  onSuccess: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { addTeacher, subjects } = useData();
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ staffId: string; password: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    address: '',
    subjectsTaught: [] as string[],
    classAssigned: '',
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
  });
  const [showEmergency, setShowEmergency] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const submitLock = useRef(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitLock.current) return;

    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.gender) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Convert salary to number for storage, default to 0 if empty or invalid
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

    setIsSubmitting(true);
    submitLock.current = true;
    try {
      const result = await addTeacher({
        ...formData,
        monthlySalary: salaryValue,
        employmentStatus: 'Active',
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelationship: formData.emergencyContactRelationship || undefined,
        bankName: formData.bankName || undefined,
        bankAccountName: formData.bankAccountName || undefined,
        bankAccountNumber: formData.bankAccountNumber || undefined,
        bankBranch: formData.bankBranch || undefined,
      });

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

      // Reset form
      setFormData({
        fullName: '',
        gender: '',
        dateOfBirth: '',
        phoneNumber: '',
        email: '',
        address: '',
        subjectsTaught: [],
        classAssigned: '',
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
      });
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
