
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useTeachers from '@/hooks/useTeachers';
import { Plus, Save } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface CreateClassFormProps {
  onSuccess?: () => void;
}

const CreateClassForm: React.FC<CreateClassFormProps> = ({ onSuccess }) => {
  const { createClass } = useClasses();
  const { teachers } = useTeachers();
  const [formData, setFormData] = useState({
    level: '',
    stream: '',
    assignedTeacher: 'no-teacher',
    maxClassSize: 30
  });

  const levels = [
    'KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
    'JHS 1', 'JHS 2', 'JHS 3'
  ];

  const streams = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'A', 'B', 'C', 'D'];

  const resolvedLevel = useMemo(
    () => formData.level.trim(),
    [formData.level]
  );

  const resolvedStream = useMemo(
    () => formData.stream.trim(),
    [formData.stream]
  );

  const derivedClassName = useMemo(() => {
    if (!resolvedLevel) return '';
    if (!resolvedStream) return resolvedLevel;
    return `${resolvedLevel} ${resolvedStream}`;
  }, [resolvedLevel, resolvedStream]);

  const activeTeachers = (teachers || []).filter((teacher: any) =>
    teacher.employmentStatus === 'Active' &&
    (teacher.fullName || teacher.full_name) &&
    (teacher.fullName || teacher.full_name).trim() !== ''
  );

  const selectedTeacher = useMemo(() => {
    if (!formData.assignedTeacher || formData.assignedTeacher === 'no-teacher') return null;
    return activeTeachers.find((teacher: any) => String(teacher.id) === formData.assignedTeacher);
  }, [formData.assignedTeacher, activeTeachers]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!resolvedLevel) {
      toast({
        title: "Validation Error",
        description: "Please select or enter a level",
        variant: "destructive"
      });
      return;
    }

    try {
      createClass.mutate({
        level: resolvedLevel,
        stream: resolvedStream,
        assignedTeacher: formData.assignedTeacher === 'no-teacher' ? '' : formData.assignedTeacher,
        maxClassSize: formData.maxClassSize
      });

      // Reset form
      setFormData({
        level: '',
        stream: '',
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
              <Label htmlFor="className">Class Name (Preview) *</Label>
              <Input
                id="className"
                value={derivedClassName}
                placeholder="Will be generated from level and stream"
                readOnly
                className="bg-muted"
              />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Input
                id="level"
                list="levels-list"
                value={formData.level}
                onChange={(e) => handleInputChange('level', e.target.value)}
                placeholder="Select or type a level"
                required
              />
              <datalist id="levels-list">
                {levels.map((level) => (
                  <option key={level} value={level} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stream">Stream/Section</Label>
              <Input
                id="stream"
                list="streams-list"
                value={formData.stream}
                onChange={(e) => handleInputChange('stream', e.target.value)}
                placeholder="Select or type a stream (optional)"
              />
              <datalist id="streams-list">
                {streams.map((stream) => (
                  <option key={stream} value={stream} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTeacher">Assigned Class Teacher</Label>
            <Select value={formData.assignedTeacher} onValueChange={(value) => handleInputChange('assignedTeacher', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher (optional)">
                  {selectedTeacher ? selectedTeacher.fullName || selectedTeacher.full_name : 'Select teacher (optional)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-teacher">No teacher assigned</SelectItem>
                {activeTeachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={String(teacher.id)}>
                    {teacher.fullName || teacher.full_name} {teacher.classAssigned ? `(Currently: ${teacher.classAssigned})` : ''}
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
