
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Users, User, School } from 'lucide-react';

const AssignClassToTeacher = () => {
  const { teachers, classes, updateTeacher, updateClass } = useData();
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const activeTeachers = teachers.filter(teacher => teacher.employmentStatus === 'Active');

  const handleAssignClass = () => {
    if (!selectedTeacher || !selectedClass) {
      toast({
        title: "Validation Error",
        description: "Please select both teacher and class",
        variant: "destructive"
      });
      return;
    }

    const teacher = teachers.find(t => t.id === selectedTeacher);
    const classData = classes.find(c => c.id === selectedClass);
    
    if (!teacher || !classData) return;

    // Check if teacher already has a class assigned
    if (teacher.classAssigned) {
      // Remove teacher from previous class
      const previousClass = classes.find(c => c.className === teacher.classAssigned);
      if (previousClass) {
        updateClass(previousClass.id, { assignedTeacher: '' });
      }
    }

    // Check if class already has a teacher assigned
    if (classData.assignedTeacher) {
      // Remove class from previous teacher
      const previousTeacher = teachers.find(t => t.id === classData.assignedTeacher);
      if (previousTeacher) {
        updateTeacher(previousTeacher.id, { classAssigned: '' });
      }
    }

    // Make new assignments
    updateTeacher(selectedTeacher, { classAssigned: classData.className });
    updateClass(selectedClass, { assignedTeacher: selectedTeacher });
    
    toast({
      title: "Class Assigned Successfully",
      description: `${teacher.fullName} has been assigned to ${classData.className}`,
    });

    // Reset form
    setSelectedTeacher('');
    setSelectedClass('');
  };

  const getTeacherCurrentClass = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.classAssigned || 'None';
  };

  const getClassCurrentTeacher = (classId: string) => {
    const classData = classes.find(c => c.id === classId);
    if (!classData?.assignedTeacher) return 'None';
    
    const teacher = teachers.find(t => t.id === classData.assignedTeacher);
    return teacher?.fullName || 'None';
  };

  return (
    <div className="space-y-6">
      {/* Assignment Form */}
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
                    {activeTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.fullName} - Current: {teacher.classAssigned || 'No class'}
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
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className} - Current Teacher: {getClassCurrentTeacher(cls.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(selectedTeacher || selectedClass) && (
              <div className="p-4 bg-blue-50 rounded-lg">
                {selectedTeacher && (
                  <p className="text-sm text-blue-800 mb-1">
                    <strong>Selected Teacher:</strong> {teachers.find(t => t.id === selectedTeacher)?.fullName}
                    <br />
                    <span className="text-blue-600">
                      Current Assignment: {getTeacherCurrentClass(selectedTeacher)}
                    </span>
                  </p>
                )}
                {selectedClass && (
                  <p className="text-sm text-blue-800">
                    <strong>Selected Class:</strong> {classes.find(c => c.id === selectedClass)?.className}
                    <br />
                    <span className="text-blue-600">
                      Current Teacher: {getClassCurrentTeacher(selectedClass)}
                    </span>
                  </p>
                )}
              </div>
            )}

            <Button onClick={handleAssignClass} className="w-full md:w-auto">
              <School className="w-4 h-4 mr-2" />
              Assign Class
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Assignments Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teachers and their Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Teachers & Classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTeachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{teacher.fullName}</p>
                    <p className="text-sm text-gray-500">
                      Subjects: {teacher.subjectsTaught.join(', ') || 'None listed'}
                    </p>
                  </div>
                  <div>
                    {teacher.classAssigned ? (
                      <Badge variant="default">{teacher.classAssigned}</Badge>
                    ) : (
                      <Badge variant="outline">No class assigned</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Classes and their Teachers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <School className="w-5 h-5" />
              <span>Classes & Teachers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classes.map((cls) => {
                const assignedTeacher = teachers.find(t => t.id === cls.assignedTeacher);
                return (
                  <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{cls.className}</p>
                      <p className="text-sm text-gray-500">
                        Level: {cls.level} {cls.stream ? `- ${cls.stream}` : ''}
                      </p>
                    </div>
                    <div>
                      {assignedTeacher ? (
                        <Badge variant="default">{assignedTeacher.fullName}</Badge>
                      ) : (
                        <Badge variant="outline">No teacher assigned</Badge>
                      )}
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
