
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Save, Plus } from 'lucide-react';

interface CreateClassFormProps {
  onSuccess?: () => void;
}

const CreateClassForm: React.FC<CreateClassFormProps> = ({ onSuccess }) => {
  const { addClass, teachers } = useData();
  const [formData, setFormData] = useState({
    className: '',
    level: '',
    stream: 'no-stream',
    assignedTeacher: 'no-teacher',
    maxClassSize: 30
  });

  const levels = [
    'KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
    'JHS 1', 'JHS 2', 'JHS 3'
  ];

  const streams = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'A', 'B', 'C', 'D'];

  const activeTeachers = teachers.filter(teacher => 
    teacher.employmentStatus === 'Active' && 
    teacher.fullName && 
    teacher.fullName.trim() !== ''
  );

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.className || !formData.level) {
      toast({
        title: "Validation Error",
        description: "Please fill in class name and level",
        variant: "destructive"
      });
      return;
    }

    const assignedTeacherId = formData.assignedTeacher && formData.assignedTeacher !== 'no-teacher'
      ? parseInt(formData.assignedTeacher, 10)
      : undefined;

    try {
      await addClass({
        className: formData.className,
        level: formData.level,
        stream: formData.stream === 'no-stream' ? '' : formData.stream,
        assignedTeacher: formData.assignedTeacher === 'no-teacher' ? '' : formData.assignedTeacher,
        assignedTeacherId,
        maxClassSize: formData.maxClassSize,
        students: []
      });
      
      toast({
        title: "Class Created Successfully",
        description: `${formData.className} has been added to the system`,
      });

      // Reset form
      setFormData({
        className: '',
        level: '',
        stream: 'no-stream',
        assignedTeacher: 'no-teacher',
        maxClassSize: 30
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create class. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Create New Class</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name *</Label>
              <Input
                id="className"
                value={formData.className}
                onChange={(e) => handleInputChange('className', e.target.value)}
                placeholder="e.g., Primary 4 Yellow"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select value={formData.level} onValueChange={(value) => handleInputChange('level', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stream">Stream/Section</Label>
              <Select value={formData.stream} onValueChange={(value) => handleInputChange('stream', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stream (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-stream">No stream</SelectItem>
                  {streams.map((stream) => (
                    <SelectItem key={stream} value={stream}>
                      {stream}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxClassSize">Maximum Class Size</Label>
              <Input
                id="maxClassSize"
                type="number"
                min="1"
                max="50"
                value={formData.maxClassSize}
                onChange={(e) => handleInputChange('maxClassSize', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTeacher">Assigned Class Teacher</Label>
            <Select value={formData.assignedTeacher} onValueChange={(value) => handleInputChange('assignedTeacher', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-teacher">No teacher assigned</SelectItem>
                {activeTeachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName} {teacher.classAssigned ? `(Currently: ${teacher.classAssigned})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="submit" className="bg-gradient-to-r from-purple-500 to-pink-600">
              <Save className="w-4 h-4 mr-2" />
              Create Class
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateClassForm;
