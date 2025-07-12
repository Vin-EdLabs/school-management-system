
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';

interface AddTeacherFormProps {
  onSuccess?: () => void;
}

const AddTeacherForm: React.FC<AddTeacherFormProps> = ({ onSuccess }) => {
  const { addTeacher, classes } = useData();
  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    staffId: '',
    phoneNumber: '',
    email: '',
    address: '',
    subjectsTaught: '',
    classAssigned: '',
    employmentDate: '',
    monthlySalary: '',
    employmentStatus: 'Active',
    notes: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.fullName || !formData.gender || !formData.dateOfBirth || !formData.staffId || !formData.phoneNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const teacherData = {
      ...formData,
      subjectsTaught: formData.subjectsTaught.split(',').map(s => s.trim()).filter(s => s),
      monthlySalary: formData.monthlySalary ? parseFloat(formData.monthlySalary) : 0
    };

    addTeacher(teacherData);
    
    toast({
      title: "Success",
      description: `Teacher ${formData.fullName} has been added successfully`
    });

    // Reset form
    setFormData({
      fullName: '',
      gender: '',
      dateOfBirth: '',
      staffId: '',
      phoneNumber: '',
      email: '',
      address: '',
      subjectsTaught: '',
      classAssigned: '',
      employmentDate: '',
      monthlySalary: '',
      employmentStatus: 'Active',
      notes: ''
    });

    // Call onSuccess callback if provided
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Teacher</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Gender */}
            <div>
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

            {/* Date of Birth */}
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                required
              />
            </div>

            {/* Staff ID */}
            <div>
              <Label htmlFor="staffId">Staff ID *</Label>
              <Input
                id="staffId"
                value={formData.staffId}
                onChange={(e) => handleInputChange('staffId', e.target.value)}
                placeholder="Enter staff ID"
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="Enter phone number"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            {/* Employment Date */}
            <div>
              <Label htmlFor="employmentDate">Employment Date</Label>
              <Input
                id="employmentDate"
                type="date"
                value={formData.employmentDate}
                onChange={(e) => handleInputChange('employmentDate', e.target.value)}
              />
            </div>

            {/* Monthly Salary */}
            <div>
              <Label htmlFor="monthlySalary">Monthly Salary (GHS)</Label>
              <Input
                id="monthlySalary"
                type="number"
                value={formData.monthlySalary}
                onChange={(e) => handleInputChange('monthlySalary', e.target.value)}
                placeholder="Enter monthly salary"
              />
            </div>

            {/* Class Assigned */}
            <div>
              <Label htmlFor="classAssigned">Class Assigned</Label>
              <Select value={formData.classAssigned} onValueChange={(value) => handleInputChange('classAssigned', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Class Assigned</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employment Status */}
            <div>
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select value={formData.employmentStatus} onValueChange={(value) => handleInputChange('employmentStatus', value)}>
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

          {/* Address */}
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Enter address"
              rows={2}
            />
          </div>

          {/* Subjects Taught */}
          <div>
            <Label htmlFor="subjectsTaught">Subjects Taught</Label>
            <Input
              id="subjectsTaught"
              value={formData.subjectsTaught}
              onChange={(e) => handleInputChange('subjectsTaught', e.target.value)}
              placeholder="Enter subjects separated by commas (e.g., Mathematics, Science)"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            Add Teacher
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddTeacherForm;
