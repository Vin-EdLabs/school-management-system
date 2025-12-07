import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import useTeachers from '@/hooks/useTeachers';
import { UserPlus, X } from 'lucide-react';
import React, { useState } from 'react';

const SUBJECTS = [
  'Mathematics', 'English', 'Science', 'Social Studies', 'French',
  'Physical Education', 'Art', 'Music', 'Computer Studies', 'Religious Studies'
];

interface AddTeacherFormProps {
  onSuccess: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { createTeacher } = useTeachers();
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
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

  const generateUsername = (name: string) => {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12) || 'teacher';
    const rand = Math.floor(100 + Math.random() * 900);
    return `${base}${rand}`;
  };

  // Sync password with username whenever username changes
  React.useEffect(() => {
    if (formData.username && formData.password !== formData.username) {
      setFormData(prev => ({ ...prev, password: prev.username }));
    }
  }, [formData.username]);

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

    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.gender) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (!formData.username || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please provide a username and password for the teacher",
        variant: "destructive"
      });
      return;
    }

    // Convert salary to number for storage, default to 0 if empty or invalid
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

    // Use the mutation returned by the hook to create the teacher
    createTeacher.mutate(
      {
        username: formData.username,
        password: formData.password,
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
            username: '',
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
          setUserEditedUsername(false);

          onSuccess();
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to add teacher', variant: 'destructive' });
        }
      }
    );
  };

  return (
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
                onChange={(e) => {
                  const name = e.target.value;
                  const username = userEditedUsername ? formData.username : generateUsername(name);
                  setFormData(prev => ({
                    ...prev,
                    fullName: name,
                    username,
                    password: username
                  }));
                }}
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
              <Label htmlFor="username">Username (Auto-generated) *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => {
                  setUserEditedUsername(true);
                  const username = e.target.value;
                  setFormData(prev => ({ ...prev, username, password: username }));
                }}
                disabled
                className="bg-gray-100 text-gray-900 cursor-not-allowed"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (Same as username, change on first login) *</Label>
              <Input
                id="password"
                type="text"
                value={formData.password}
                placeholder={formData.username || 'Will auto-generate from username'}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                disabled
                className="bg-gray-100 text-gray-900 cursor-not-allowed"
                required
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
                {SUBJECTS.filter(subject => !formData.subjectsTaught.includes(subject)).map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
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
  );
};

export default AddTeacherForm;
