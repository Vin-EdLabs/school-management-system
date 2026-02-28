import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { BookOpen, Users, ChevronRight, Eye } from 'lucide-react';

interface TeacherClass {
  id: number;
  class_name: string;
  level: string | null;
  stream: string | null;
  is_main: boolean;
  student_count: string;
}

const TeacherClassesModule = () => {
  const { schoolId } = useSchool();
  const { students, classes } = useData();
  const { user } = useAuth();
  const isAdminViewer = user?.role === 'administrator' || user?.role === 'super-admin';

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  // Build class list: all classes for admin, teacher-assigned only for teachers
  const allClassesAsTeacherClass = useMemo<TeacherClass[]>(() => {
    return classes.map(c => {
      const studentCount = students.filter(s =>
        s.classAssigned === c.className || (s.classAssignedId && String(s.classAssignedId) === String(c.id))
      ).length;
      return {
        id: Number(c.id),
        class_name: c.className,
        level: c.level || null,
        stream: c.stream || null,
        is_main: false,
        student_count: String(studentCount),
      };
    });
  }, [classes, students]);

  useEffect(() => {
    if (isAdminViewer) {
      setTeacherClasses(allClassesAsTeacherClass);
      if (allClassesAsTeacherClass.length && !selectedClassId) {
        setSelectedClassId(String(allClassesAsTeacherClass[0].id));
      }
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const list = await apiService.get<TeacherClass[]>('/teachers/me/classes');
        setTeacherClasses(Array.isArray(list) ? list : []);
        if (list?.length && !selectedClassId) setSelectedClassId(String(list[0].id));
      } catch {
        setTeacherClasses([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId, isAdminViewer, allClassesAsTeacherClass]);

  const selectedClass = teacherClasses.find(c => String(c.id) === selectedClassId);
  const classStudents = selectedClass
    ? students.filter(s => s.classAssigned === selectedClass.class_name || (s.classAssignedId && String(s.classAssignedId) === String(selectedClass.id)))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{isAdminViewer ? 'All Classes' : 'My Classes'}</h1>
            <p className="text-gray-600">{isAdminViewer ? 'View all classes and their students (read-only)' : 'View your assigned classes and students'}</p>
          </div>
        </div>
        {isAdminViewer && (
          <Badge variant="secondary" className="flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200">
            <Eye className="w-3 h-3" /> Read Only
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>{isAdminViewer ? 'All Classes' : 'Assigned Classes'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : teacherClasses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Assigned</h3>
              <p className="text-gray-500">You don't have any classes assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teacherClasses.map((cls) => (
                <div
                  key={cls.id}
                  className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer ${selectedClassId === String(cls.id) ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedClassId(String(cls.id))}
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{cls.class_name}</h4>
                    <p className="text-sm text-gray-500">{cls.student_count} students</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.is_main && <Badge variant="secondary">Main</Badge>}
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClass && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Students — {selectedClass.class_name}</span>
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
                {classStudents.map((student) => (
                  <div key={student.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-gray-500">ID: {student.studentId}</p>
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
