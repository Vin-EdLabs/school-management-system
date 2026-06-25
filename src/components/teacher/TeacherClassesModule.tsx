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

const resolvePhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (/^https?:\/\//i.test(photoUrl) || photoUrl.startsWith('data:')) return photoUrl;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${origin}${normalized}`;
};

const TeacherClassesModule = ({ schoolWideReadOnly = false }: { schoolWideReadOnly?: boolean }) => {
  const { schoolId } = useSchool();
  const { students, classes } = useData();
  const { user } = useAuth();
  const isAdminViewer =
    schoolWideReadOnly || user?.role === 'administrator' || user?.role === 'super-admin';

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
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 leading-tight">
              {isAdminViewer ? 'All Classes' : 'My Classes'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              {isAdminViewer ? 'All classes and students (read-only)' : 'Your assigned classes and students'}
            </p>
          </div>
        </div>
        {isAdminViewer && (
          <Badge variant="secondary" className="w-fit flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 shrink-0">
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
                  className={`flex items-center justify-between min-h-[56px] p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/60 cursor-pointer touch-manipulation active:scale-[0.99] transition-transform ${selectedClassId === String(cls.id) ? 'ring-2 ring-blue-500' : ''}`}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {classStudents.map((student) => (
                  <div key={student.id} className="flex items-center space-x-3 min-h-[52px] p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                      {student.passportPhotoUrl ? (
                        <img
                          src={resolvePhotoUrl(student.passportPhotoUrl)}
                          alt={`${student.firstName} ${student.lastName}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <>{student.firstName.charAt(0)}{student.lastName.charAt(0)}</>
                      )}
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
