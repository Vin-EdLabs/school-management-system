import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';
import { Users, User, School, Plus, Trash2, Star } from 'lucide-react';

interface ClassTeacher {
  id: number;
  class_id: number;
  teacher_id: number;
  is_main: boolean;
  full_name: string;
  staff_id: string;
  subjects_taught?: string[];
}

const AssignClassToTeacher = () => {
  const { teachers, classes, refresh } = useData();
  const { schoolId } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [teacherToAdd, setTeacherToAdd] = useState('');
  const [addAsMain, setAddAsMain] = useState(false);

  const activeTeachers = teachers.filter(t => t.employmentStatus === 'Active');

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassTeachers();
    } else {
      setClassTeachers([]);
    }
  }, [selectedClassId]);

  const loadClassTeachers = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const list = await apiService.get<ClassTeacher[]>(`/classes/${selectedClassId}/teachers`);
      setClassTeachers(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load class teachers', variant: 'destructive' });
      setClassTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!selectedClassId || !teacherToAdd) return;
    try {
      await apiService.post(`/classes/${selectedClassId}/teachers`, {
        teacher_id: parseInt(teacherToAdd),
        is_main: addAsMain,
      });
      toast({ title: 'Teacher Added', description: 'Teacher has been added to this class' });
      setAddTeacherOpen(false);
      setTeacherToAdd('');
      setAddAsMain(false);
      await loadClassTeachers();
      await refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to add teacher', variant: 'destructive' });
    }
  };

  const handleRemoveTeacher = async (teacherId: number) => {
    if (!selectedClassId) return;
    try {
      await apiService.delete(`/classes/${selectedClassId}/teachers/${teacherId}`);
      toast({ title: 'Teacher Removed', description: 'Teacher has been removed from this class' });
      await loadClassTeachers();
      await refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to remove teacher', variant: 'destructive' });
    }
  };

  const handleSetMain = async (teacherId: number) => {
    if (!selectedClassId) return;
    try {
      await apiService.patch(`/classes/${selectedClassId}/teachers/${teacherId}/main`, {});
      toast({ title: 'Main Teacher Updated', description: 'Main teacher has been set' });
      await loadClassTeachers();
      await refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to set main teacher', variant: 'destructive' });
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const assignedTeacherIds = classTeachers.map(ct => ct.teacher_id);
  const availableTeachers = activeTeachers.filter(t => !assignedTeacherIds.includes(parseInt(t.id)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Assign Teachers to Class</span>
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Assign multiple teachers to one class. Set one as the main teacher.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.className} {cls.level ? `— ${cls.level} ${cls.stream || ''}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-800">
                    Teachers for {selectedClass?.className || 'Class'}
                  </h4>
                  <Button size="sm" onClick={() => setAddTeacherOpen(true)} disabled={availableTeachers.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Teacher
                  </Button>
                </div>

                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : classTeachers.length === 0 ? (
                  <p className="text-sm text-slate-500">No teachers assigned yet. Click &quot;Add Teacher&quot; to assign.</p>
                ) : (
                  <div className="space-y-2">
                    {classTeachers.map((ct) => (
                      <div
                        key={ct.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ct.full_name}</span>
                          <span className="text-slate-500 text-sm font-mono">{ct.staff_id}</span>
                          {ct.is_main && (
                            <Badge variant="default" className="bg-amber-600">Main</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!ct.is_main && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetMain(ct.teacher_id)}
                              title="Set as main teacher"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleRemoveTeacher(ct.teacher_id)}
                            title="Remove from class"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Teacher Dialog */}
      <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Teacher to {selectedClass?.className}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Teacher</Label>
              <Select value={teacherToAdd} onValueChange={setTeacherToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName} ({t.staffId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="addAsMain"
                checked={addAsMain}
                onChange={(e) => setAddAsMain(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Label htmlFor="addAsMain">Set as main teacher</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddTeacherOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeacher} disabled={!teacherToAdd}>Add Teacher</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overview: Classes and their Teachers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <School className="w-5 h-5" />
            <span>All Classes — Teachers Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {classes.map((cls) => {
              const mainTeacher = teachers.find(t => String(t.id) === String(cls.assignedTeacherId));
              return (
                <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{cls.className}</p>
                    <p className="text-sm text-gray-500">
                      Level: {cls.level} {cls.stream ? `- ${cls.stream}` : ''}
                    </p>
                  </div>
                  <div>
                    {mainTeacher ? (
                      <Badge variant="default">{mainTeacher.fullName} (Main)</Badge>
                    ) : (
                      <Badge variant="outline">No main teacher</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignClassToTeacher;
