import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, Loader2 } from 'lucide-react';
import { apiService } from '@/services/api';

interface CreateClassFormProps {
  onSuccess?: () => void;
}

type ClassLevelRow = { id: number; name: string };

const CreateClassForm: React.FC<CreateClassFormProps> = ({ onSuccess }) => {
  const { addClass, teachers } = useData();
  const [formData, setFormData] = useState({
    className: '',
    level: '',
    stream: 'no-stream',
    assignedTeacher: 'no-teacher',
    maxClassSize: 30,
    isFinalClass: false,
  });

  const [levels, setLevels] = useState<string[]>([]);
  const [customLevels, setCustomLevels] = useState<ClassLevelRow[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [newLevelName, setNewLevelName] = useState('');
  const [addingLevel, setAddingLevel] = useState(false);

  const loadClassLevels = useCallback(async () => {
    setLevelsLoading(true);
    try {
      const data = await apiService.get<{ levels: string[]; custom: ClassLevelRow[] }>('/class-levels');
      setLevels(data.levels || []);
      setCustomLevels(data.custom || []);
    } catch {
      toast({
        title: 'Could not load levels',
        description: 'Using empty list; refresh the page or check your connection.',
        variant: 'destructive',
      });
      setLevels([]);
      setCustomLevels([]);
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClassLevels();
  }, [loadClassLevels]);

  const streams = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'A', 'B', 'C', 'D'];

  const handleAddCustomLevel = async () => {
    const name = newLevelName.trim();
    if (!name) {
      toast({ title: 'Enter a level name', variant: 'destructive' });
      return;
    }
    setAddingLevel(true);
    try {
      const row = await apiService.post<ClassLevelRow>('/class-levels', { name });
      setNewLevelName('');
      await loadClassLevels();
      setFormData((prev) => ({ ...prev, level: row.name }));
      toast({ title: 'Level added', description: `"${row.name}" is available for this school.` });
    } catch (e: unknown) {
      toast({
        title: 'Could not add level',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setAddingLevel(false);
    }
  };

  const handleRemoveCustomLevel = async (row: ClassLevelRow) => {
    if (!window.confirm(`Remove "${row.name}" from your school’s level list? Existing classes keep this label until edited.`)) {
      return;
    }
    try {
      await apiService.delete(`/class-levels/${row.id}`);
      await loadClassLevels();
      setFormData((prev) => (prev.level === row.name ? { ...prev, level: '' } : prev));
      toast({ title: 'Level removed' });
    } catch (e: unknown) {
      toast({
        title: 'Could not remove level',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    }
  };

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
        isFinalClass: formData.isFinalClass,
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
        maxClassSize: 30,
        isFinalClass: false,
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
              <Select
                value={formData.level}
                onValueChange={(value) => handleInputChange('level', value)}
                disabled={levelsLoading || levels.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={levelsLoading ? 'Loading levels…' : 'Select level'} />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Input
                  placeholder="Add a school-specific level"
                  value={newLevelName}
                  onChange={(e) => setNewLevelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomLevel();
                    }
                  }}
                  disabled={addingLevel}
                  className="sm:flex-1"
                />
                <Button type="button" variant="outline" onClick={handleAddCustomLevel} disabled={addingLevel || levelsLoading}>
                  {addingLevel ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add level'}
                </Button>
              </div>
              {customLevels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-muted-foreground w-full">School-only levels (remove from list):</span>
                  {customLevels.map((row) => (
                    <span
                      key={row.id}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                    >
                      {row.name}
                      <button
                        type="button"
                        className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => handleRemoveCustomLevel(row)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                max="200"
                value={formData.maxClassSize}
                onChange={(e) => handleInputChange('maxClassSize', parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              id="isFinalClass"
              type="checkbox"
              checked={formData.isFinalClass}
              onChange={(e) => setFormData((prev) => ({ ...prev, isFinalClass: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label htmlFor="isFinalClass" className="cursor-pointer text-sm font-normal">
              Final graduating class (e.g. JHS 3, SHS 3)
            </Label>
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

          <div className="form-action-bar flex justify-end">
            <Button type="submit" variant="primaryAction" className="min-h-10 w-full sm:w-auto">
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
