import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useTeachers from '@/hooks/useTeachers';
import * as assignmentsService from '@/services/assignmentsService';
import { useQueryClient } from '@tanstack/react-query';
import { School, User, Users } from 'lucide-react';
import React, { useState } from 'react';

const AssignClassToTeacher: React.FC = () => {
  const { teachers, refreshTeachers } = useTeachers();
  const { classes } = useClasses();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const activeTeachers = (teachers || []).filter((teacher: any) => teacher.employmentStatus === 'Active');

  const handleAssignClass = async () => {
    if (!selectedTeacher || !selectedClass) {
      toast({ title: 'Validation Error', description: 'Please select both teacher and class', variant: 'destructive' });
      return;
    }

    const teacher = (teachers || []).find((t: any) => String(t.id) === String(selectedTeacher));
    const classData = (classes || []).find((c: any) => String(c.id) === String(selectedClass));

    if (!teacher || !classData) return;

    try {
      setLoading(true);

      await assignmentsService.createAssignment({ teacher_id: Number(selectedTeacher), class_id: Number(selectedClass) });


      // refreshTeachers force-fetches fresh data from server AND re-enriches — awaited so UI is ready
      await refreshTeachers();
      await queryClient.refetchQueries({ queryKey: ['classes'] });
      queryClient.removeQueries({ queryKey: ['classes', 'enriched'] });

      toast({ title: 'Class Assigned Successfully', description: `${teacher.fullName || teacher.full_name} has been assigned to ${classData.className || (classData.level ? `${classData.level}${classData.stream ? ' ' + classData.stream : ''}` : 'Unassigned')}` });

      setSelectedTeacher('');
      setSelectedClass('');
    } catch (err: any) {
      toast({ title: 'Assignment Error', description: err.message || 'Failed to assign class', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!selectedClass) {
      toast({ title: 'Validation Error', description: 'Please select a class to unassign', variant: 'destructive' });
      return;
    }
    if (!selectedTeacher) {
      toast({ title: 'Validation Error', description: 'Please select a teacher to unassign from this class', variant: 'destructive' });
      return;
    }

    const classData = (classes || []).find((c: any) => String(c.id) === String(selectedClass));
    if (!classData) return;

    try {
      setLoading(true);
      await assignmentsService.removeAssignment({ teacher_id: Number(selectedTeacher), class_id: Number(selectedClass) });
      await refreshTeachers();
      await queryClient.refetchQueries({ queryKey: ['classes'] });
      queryClient.removeQueries({ queryKey: ['classes', 'enriched'] });
      toast({ title: 'Assignment removed', description: `Teacher unassigned from ${classData.className || (classData.level ? `${classData.level}${classData.stream ? ' ' + classData.stream : ''}` : 'class')}` });
      setSelectedTeacher('');
      setSelectedClass('');
    } catch (err: any) {
      toast({ title: 'Unassign Error', description: err?.message || 'Failed to remove assignment', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getTeacherCurrentClass = (teacherId: string) => {
    const teacher = (teachers || []).find((t: any) => String(t.id) === String(teacherId));
    return teacher?.classAssigned || 'None';
  };

  const getClassCurrentTeacher = (classId: string) => {
    const classData = (classes || []).find((c: any) => String(c.id) === String(classId));
    if (!classData) return 'None';
    // assignedTeacherNames is set by enriched useClasses if available
    if (classData.assignedTeacherNames && classData.assignedTeacherNames.length > 0) return classData.assignedTeacherNames.join(', ');
    if (classData.assignedTeacherName) return classData.assignedTeacherName;
    if (!classData?.assignedTeacher) return 'None';
    const teacher = (teachers || []).find((t: any) => String(t.id) === String(classData.assignedTeacher));
    return teacher?.fullName || teacher?.full_name || 'None';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Assign Class to Teacher</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTeachers.map((teacher: any) => (
                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                        {teacher.fullName || teacher.full_name} - Current: {teacher.classAssigned || 'No class'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => {
                      const display = cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls.name ?? cls.className ?? 'Unassigned');
                      return (
                        <SelectItem key={cls.id} value={String(cls.id)}>
                          {display} - Current Teacher: {getClassCurrentTeacher(String(cls.id))}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(selectedTeacher || selectedClass) && (
              <div className="p-4 bg-blue-50 rounded-lg">
                {selectedTeacher && (
                  <p className="text-sm text-blue-800 mb-1">
                    <strong>Selected Teacher:</strong> {(teachers || []).find((t: any) => String(t.id) === String(selectedTeacher))?.fullName}
                    <br />
                    <span className="text-blue-600">Current Assignment: {getTeacherCurrentClass(selectedTeacher)}</span>
                  </p>
                )}
                {selectedClass && (
                  <p className="text-sm text-blue-800">
                    <strong>Selected Class:</strong> {(() => {
                      const c = (classes || []).find((x: any) => String(x.id) === String(selectedClass));
                      return c ? (c.level ? `${c.level}${c.stream ? ' ' + c.stream : ''}` : (c.name ?? c.className ?? 'Unassigned')) : 'Unknown';
                    })()}
                    <br />
                    <span className="text-blue-600">Current Teacher: {getClassCurrentTeacher(selectedClass)}</span>
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleAssignClass} className="w-full md:w-auto" disabled={loading}>
                <School className="w-4 h-4 mr-2" />
                Assign Class
              </Button>
              <Button variant="destructive" onClick={handleRemoveAssignment} disabled={loading || !selectedClass}>
                Remove Assignment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Teachers & Classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTeachers.map((teacher: any) => (
                <div key={teacher.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{teacher.fullName || teacher.full_name}</p>
                    <p className="text-sm text-gray-500">Subjects: {(teacher.subjectsTaught || []).join(', ') || 'None listed'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {(teacher.classAssignedList && teacher.classAssignedList.length > 0)
                      ? teacher.classAssignedList.map((cls: string, i: number) => (
                        <Badge key={i} variant="default">{cls}</Badge>
                      ))
                      : <Badge variant="outline">No class assigned</Badge>
                    }
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <School className="w-5 h-5" />
              <span>Classes & Teachers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classes.map((cls: any) => {
                const className = cls.className ?? (cls.level ? `${cls.level}${cls.stream ? ' - ' + cls.stream : ''}` : `Class ${cls.id}`);
                const names: string[] = cls.assignedTeacherNames ?? [];
                return (
                  <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{className}</p>
                      <p className="text-sm text-gray-500">Level: {cls.level}{cls.stream ? ` - ${cls.stream}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                      {names.length > 0
                        ? names.map((name, i) => <Badge key={i} variant="default">{name}</Badge>)
                        : <Badge variant="outline">No teacher assigned</Badge>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssignClassToTeacher;
