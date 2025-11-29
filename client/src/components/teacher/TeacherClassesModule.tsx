import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import useClasses from '@/hooks/useClasses';
import { BookOpen, Users, Calendar, Clock, ChevronRight } from 'lucide-react';

const TeacherClassesModule = () => {
  const { user } = useAuth();
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const { classes: rawClasses } = useClasses();

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    staffId: t.staffId || t.staff_id || '' ,
    classAssigned: t.classAssigned || t.class_assigned || ''
  }));

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    admissionNumber: s.admissionNumber || s.admission_number || '' ,
    classAssigned: s.classAssigned || s.class_assigned || ''
  }));

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.className || c.class_name || c.name || ''
  }));
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Find the current teacher's data based on username or teacherId
  const currentTeacher = teachers.find(t => 
    t.staffId === user?.teacherId || 
    t.fullName.toLowerCase().includes(user?.username?.toLowerCase() || '')
  );

  // Get teacher's assigned classes
  const teacherClasses = currentTeacher?.classAssigned 
    ? classes.filter(cls => cls.className === currentTeacher.classAssigned)
    : [];

  // Get students for the selected class
  const selectedClassData = classes.find(cls => cls.id === selectedClass);
  const classStudents = selectedClassData 
    ? students.filter(student => student.classAssigned === selectedClassData.className)
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Classes</h1>
            <p className="text-gray-600">Manage and view your assigned classes</p>
          </div>
        </div>
      </div>

      {/* Class List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>Assigned Classes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teacherClasses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Assigned</h3>
              <p className="text-gray-500">You don't have any classes assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teacherClasses.map(cls => {
                const studentCount = students.filter(s => s.classAssigned === cls.className).length;
                return (
                  <div 
                    key={cls.id} 
                    className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${selectedClass === cls.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedClass(cls.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <h4 className="font-medium text-gray-900">{cls.className}</h4>
                      <p className="text-sm text-gray-500">{studentCount} students</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Details */}
      {selectedClass && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Class Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Students in Class</h3>
                <p className="text-gray-500">No students are assigned to this class yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classStudents.map(student => (
                  <div key={student.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-gray-500">Admission: {student.admissionNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherClassesModule;
