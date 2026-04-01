import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
<<<<<<< HEAD:src/components/teachers/AddTeacherForm.tsx
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { UserPlus, X, Copy, KeyRound } from 'lucide-react';

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { addTeacher, subjects } = useData();
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ staffId: string; pin: string } | null>(null);
=======
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import useSubjects from '@/hooks/useSubjects';
import useTeachers from '@/hooks/useTeachers';
import * as teachersService from '@/services/teachersService';
import { UserPlus, X } from 'lucide-react';
import React, { useState } from 'react';

interface AddTeacherFormProps {
  onSuccess: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { createTeacher, teachers } = useTeachers();
  const { subjects: rawSubjects } = useSubjects();

  // Extract subject names, falling back to an empty array
  const subjects = (rawSubjects || []).map((s: any) => s.name || s.title || s.code).filter(Boolean);
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/AddTeacherForm.tsx
  const [formData, setFormData] = useState({
    staffId: '',
    password: '',
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
    employmentStatus: 'Active',
    notes: ''
  });

  // Fetch next available Staff ID from the backend securely
  React.useEffect(() => {
    let mounted = true;
    const fetchNextId = async () => {
      try {
        const res = await teachersService.getNextStaffId();
        if (mounted && res?.data?.nextId) {
          setFormData(prev => ({ ...prev, staffId: res.data.nextId }));
        }
      } catch (err) {
        console.error('Failed to fetch next staff ID', err);
      }
    };
    fetchNextId();
    return () => { mounted = false; };
  }, []);

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

    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.gender) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // staffId is optional (backend will generate if missing); password is optional and will default to staffId on backend

    // Convert salary to number for storage, default to 0 if empty or invalid
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

<<<<<<< HEAD:src/components/teachers/AddTeacherForm.tsx
    try {
      const result = await addTeacher({
        ...formData,
        monthlySalary: salaryValue
      });

      toast({
        title: "Teacher Added Successfully",
        description: `${formData.fullName} has been added to the system`,
      });

      if (result?.loginStaffId && result?.loginPin) {
        setLoginCredentials({ staffId: result.loginStaffId, pin: result.loginPin });
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
        employmentStatus: 'Active',
        notes: ''
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add teacher. Please try again.",
        variant: "destructive"
      });
    }
=======
    // Use the mutation returned by the hook to create the teacher
    createTeacher.mutate(
      {
        staffId: formData.staffId || undefined,
        password: formData.password || formData.staffId || undefined,
        fullName: formData.fullName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        address: formData.address,
        subjectsTaught: formData.subjectsTaught,
        classAssigned: formData.classAssigned,
        employmentDate: formData.employmentDate,
        monthlySalary: salaryValue,
        employmentStatus: formData.employmentStatus,
        notes: formData.notes
      } as any,
      {
        onSuccess: () => {
          toast({
            title: 'Teacher Added Successfully',
            description: `${formData.fullName} has been added to the system`
          });

          // Reset form
          setFormData({
            staffId: '',
            password: '',
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
            employmentStatus: 'Active',
            notes: ''
          });

          onSuccess();
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to add teacher', variant: 'destructive' });
        }
      }
    );
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/AddTeacherForm.tsx
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <span>Add New Teacher</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  {subjects.filter(subject => !formData.subjectsTaught.includes(subject.name)).map((subject) => (
                    <SelectItem key={subject.id} value={subject.name}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
<<<<<<< HEAD:src/components/teachers/AddTeacherForm.tsx
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.subjectsTaught.map((subject) => (
                  <Badge key={subject} variant="secondary" className="flex items-center space-x-1">
                    <span>{subject}</span>
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => handleRemoveSubject(subject)}
                    />
                  </Badge>
=======
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staffId">Staff ID (Auto-generated)</Label>
              <Input
                id="staffId"
                value={formData.staffId}
                disabled
                className="bg-muted font-mono"
                placeholder="Loading..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (defaults to Staff ID if left blank)</Label>
              <Input
                id="password"
                type="text"
                value={formData.password}
                placeholder={formData.staffId || 'Will default to staff ID'}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
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
                {subjects.filter((subject: string) => !formData.subjectsTaught.includes(subject)).map((subject: string) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/AddTeacherForm.tsx
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

<<<<<<< HEAD:src/components/teachers/AddTeacherForm.tsx
            <Button type="submit" className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Teacher
            </Button>
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
              <p className="text-sm text-slate-600">
                Share these credentials with the teacher. They login using <strong>Staff ID</strong> as username and <strong>PIN</strong> as password.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Staff ID (Username)</p>
                    <p className="font-mono font-semibold text-slate-800">{loginCredentials.staffId}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.staffId); toast({ title: 'Copied', description: 'Staff ID copied to clipboard' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">PIN (Password) — 5 digits</p>
                    <p className="font-mono font-semibold text-slate-800">{loginCredentials.pin}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(loginCredentials.pin); toast({ title: 'Copied', description: 'PIN copied to clipboard' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Save this PIN now. It cannot be retrieved later. For Teacher/Staff login, select the school, choose &quot;Teacher / Staff&quot; role, then enter Staff ID and PIN.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
=======
          <div className="space-y-2">
            <Label htmlFor="monthlySalary">Monthly Salary (GHS)</Label>
            <Input
              id="monthlySalary"
              value={formData.monthlySalary}
              onChange={(e) => setFormData(prev => ({ ...prev, monthlySalary: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Teacher
          </Button>
        </form>
      </CardContent>
    </Card>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/AddTeacherForm.tsx
  );
};

export default AddTeacherForm;
