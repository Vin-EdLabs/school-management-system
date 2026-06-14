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
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';
import { isAssignableTeacher, sortTeachersByName } from '@/utils/teacherFilters';
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

  const activeTeachers = teachers.filter(isAssignableTeacher).sort(sortTeachersByName);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    void refresh(['teachers']);
  }, [schoolId, refresh]);

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
  const assignedTeacherIds = classTeachers.map((ct) => ct.teacher_id);
  const availableTeachers = activeTeachers.filter(
    (t) => !assignedTeacherIds.some((id) => String(id) === String(t.id))
  );

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Assign Teachers to Class</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
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
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-foreground">
                <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-medium text-foreground">
                    Teachers for {selectedClass?.className || 'Class'}
                  </h4>
                  <Button size="sm" variant="primaryAction" onClick={() => setAddTeacherOpen(true)} disabled={availableTeachers.length === 0} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Teacher
                  </Button>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : classTeachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teachers assigned yet. Click &quot;Add Teacher&quot; to assign.</p>
                ) : (
                  <div className="space-y-2">
                    {classTeachers.map((ct) => (
                      <div
                        key={ct.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{ct.full_name}</span>
                          <span className="text-muted-foreground text-sm font-mono">{ct.staff_id}</span>
                          {ct.is_main && (
                            <Badge variant="default" className="bg-amber-600 text-white">Main</Badge>
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
                            variant="outline"
                            className="min-h-9 min-w-9 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
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
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
            <DialogTitle>Add Teacher to {selectedClass?.className}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 px-6 py-4">
            <div>
              <Label>Teacher</Label>
              <Select value={teacherToAdd} onValueChange={setTeacherToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(320px,60dvh)]">
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
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <Label htmlFor="addAsMain">Set as main teacher</Label>
            </div>
          </DialogBody>
          <DialogFooter className="form-action-bar shrink-0 gap-2 px-6 py-4">
            <Button variant="outline" onClick={() => setAddTeacherOpen(false)}>Cancel</Button>
            <Button variant="primaryAction" onClick={handleAddTeacher} disabled={!teacherToAdd}>Add Teacher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overview: Classes and their Teachers */}
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex items-center space-x-2">
            <School className="w-5 h-5" />
            <span>All Classes — Teachers Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {classes.map((cls) => {
              const nameNorm = (cls.className || '').trim().toLowerCase();
              const mainTeacher =
                teachers.find((t) => String(t.id) === String(cls.assignedTeacherId)) ||
                teachers.find((t) =>
                  (t.classAssigned || '')
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean)
                    .includes(nameNorm)
                );
              return (
                <div key={cls.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{cls.className}</p>
                    <p className="text-sm text-muted-foreground">
                      Level: {cls.level} {cls.stream ? `- ${cls.stream}` : ''}
                    </p>
                  </div>
                  <div>
                    {mainTeacher ? (
                      <Badge variant="default" className="bg-blue-600 text-white dark:bg-blue-500">
                        {mainTeacher.fullName}
                        {String(mainTeacher.id) === String(cls.assignedTeacherId) ? ' (Main)' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No teacher linked in list</Badge>
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
