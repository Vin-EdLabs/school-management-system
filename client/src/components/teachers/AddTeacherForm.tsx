import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import useTeachers from '@/hooks/useTeachers';
import { toast } from '@/hooks/use-toast';
import { UserPlus, X } from 'lucide-react';

const SUBJECTS = [
  'Mathematics', 'English', 'Science', 'Social Studies', 'French',
  'Physical Education', 'Art', 'Music', 'Computer Studies', 'Religious Studies'
];

interface AddTeacherFormProps {
  onSuccess: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { createTeacher } = useTeachers();
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
    employmentStatus: 'Active',
    notes: ''
  });

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

    // Convert salary to number for storage, default to 0 if empty or invalid
    const salaryValue = formData.monthlySalary.trim() === '' ? 0 : parseFloat(formData.monthlySalary) || 0;

    addTeacher({
      ...formData,
      monthlySalary: salaryValue
    });

    toast({
      title: "Teacher Added Successfully",
      description: `${formData.fullName} has been added to the system`,
    });

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
              createTeacher.mutate({
              ...formData,
              monthlySalary: salaryValue
              }, {
              onSuccess: () => {
              toast({
                title: 'Teacher Added Successfully',
                description: `${formData.fullName} has been added to the system`
              });

            // Reset form
            setFormData({
              value = { formData.notes }
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
                  });

      onSuccess();
                },
                onError: () => {
        toast({ title: 'Error', description: 'Failed to add teacher', variant: 'destructive' });
                }
              });
