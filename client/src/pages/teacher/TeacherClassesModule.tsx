import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useClasses from '@/hooks/useClasses';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { BookOpen, ChevronRight, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const TeacherClassesModule = () => {
  const { user } = useAuth();
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const { classes: rawClasses, getClassStudents } = useClasses();

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    username: t.username || '',
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    staffId: t.staffId || t.staff_id || '',
    classAssigned: t.classAssigned || t.class_assigned || '',
    classAssignedId: t.classAssignedId ?? t.class_assigned_id ?? t.class_id ?? t.classId ?? null,
    // preserve enriched arrays if present
    classAssignedList: t.classAssignedList ?? t.class_assigned_list ?? [],
    classAssignedIds: t.classAssignedIds ?? t.class_assigned_ids ?? []
  }));

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    admissionNumber: s.admissionNumber || s.admission_number || '',
    classAssigned: s.classAssigned || s.class_assigned || (s.class_id ? String(s.class_id) : '') || (s.classId ? String(s.classId) : ''),
    classAssignedId: s.class_id ?? s.classId ?? null
  }));

  const classes = (rawClasses || []).map((c: any) => {
    const level = c.level || c.grade || '';
    const stream = c.stream || '';
    const derivedName = stream ? `${level} ${stream}` : level;
    return {
      id: c.id ?? String(c.id),
      level,
      stream,
      className: c.className || c.class_name || c.name || derivedName || `Class ${c.id}`
    };
  });
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Determine if the current user is a super-admin (allow some common variants)
  const roleStr = String(user?.role || '').toLowerCase();
  const isSuperAdmin = roleStr.includes('super');

  // Find the current teacher's data based on user ID or username match
  const currentTeacher = teachers.find(t => {
    const teacherId = Number(t.id);
    const userId = Number(user?.id || 0);
    const teacherUsername = (t.username || '').toLowerCase();
    const userName = (user?.username || '').toLowerCase();

    // Match by user ID first (most reliable), then exact username match
    return teacherId === userId ||
      (teacherUsername && userName && teacherUsername === userName);
  });

  // Build the teacherClasses data:
  // - For super-admin: list every teacher with their assigned classes (may be empty)
  // - For regular teacher: show only classes assigned to the current teacher
  let teacherClasses: any[] = [];
  if (isSuperAdmin) {
    teacherClasses = teachers.map(t => {
      const assignedList = Array.isArray((t as any).classAssignedList) ? (t as any).classAssignedList.map((s: any) => String(s).trim()) : [];
      const assignedIds = Array.isArray((t as any).classAssignedIds) ? (t as any).classAssignedIds.map((id: any) => Number(id)) : [];
      const assignedIdSet = new Set(assignedIds.filter(id => !isNaN(id)));
      const assignedLabelSet = new Set(assignedList.filter(Boolean));
      return {
        teacher: t,
        classes: classes.filter((cls: any) => {
          const clsName = cls.className ? String(cls.className).trim() : '';
          const clsId = Number(cls.id);
          if (assignedIdSet.size > 0) return assignedIdSet.has(clsId);
          if (assignedLabelSet.size > 0) return assignedLabelSet.has(clsName);
          return false;
        })
      };
    });
  } else {
    if (!currentTeacher) {
      teacherClasses = [];
    } else {
      const assignedList = Array.isArray((currentTeacher as any).classAssignedList) ? (currentTeacher as any).classAssignedList.map((s: any) => String(s).trim()) : [];
      const assignedIds = Array.isArray((currentTeacher as any).classAssignedIds) ? (currentTeacher as any).classAssignedIds.map((id: any) => Number(id)) : [];
      const assignedIdSet = new Set(assignedIds.filter(id => !isNaN(id)));
      const assignedLabelSet = new Set(assignedList.filter(Boolean));
      teacherClasses = classes.filter((cls: any) => {
        const clsName = cls.className ? String(cls.className).trim() : '';
        const clsId = Number(cls.id);
        if (assignedIdSet.size > 0) return assignedIdSet.has(clsId);
        if (assignedLabelSet.size > 0) return assignedLabelSet.has(clsName);
        return false;
      });
    }
  }

  // Get students for the selected class
  const selectedClassData = classes.find(cls => cls.id === selectedClass);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);

  // Helper: robustly compute student count for a class by id or name
  const studentCountForClass = (cls: any) => {
    try {
      const cid = String(cls.id);
      // look for common student-class fields
      const byId = students.filter(s => {
        const assigned = (s.classAssigned ?? s.class_assigned ?? s.classId ?? s.class_id ?? '').toString();
        return assigned === cid;
      }).length;
      if (byId > 0) return byId;
      const cname = (cls.className || '').toString();
      const byName = students.filter(s => {
        const assigned = (s.classAssigned ?? s.class_assigned ?? '').toString();
        return assigned === cname;
      }).length;
      return byName;
    } catch (e) {
      return 0;
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!selectedClassData) {
        if (mounted) setClassStudents([]);
        return;
      }
      setClassStudentsLoading(true);
      try {
        const rows = await getClassStudents(Number(selectedClassData.id));
        if (mounted) setClassStudents(rows || []);
      } catch (e) {
        if (mounted) setClassStudents([]);
      } finally {
        if (mounted) setClassStudentsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedClass]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Classes</h1>
            <p className="text-muted-foreground">Manage and view your assigned classes</p>
          </div>
        </div>
      </div>

      {/* Class List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>{isSuperAdmin ? 'Teachers & Assigned Classes' : 'Assigned Classes'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!isSuperAdmin && teacherClasses.length === 0) || (isSuperAdmin && teacherClasses.length === 0) ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Classes Assigned</h3>
              <p className="text-muted-foreground">No classes are assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {isSuperAdmin ? (
                // show each teacher and their classes
                teacherClasses.map((entry: any) => (
                  <div key={entry.teacher.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{entry.teacher.fullName || entry.teacher.username}</h4>
                        <p className="text-sm text-muted-foreground">{entry.classes.length} assigned class{entry.classes.length !== 1 ? 'es' : ''}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entry.classes.length === 0 ? (
                        <div className="text-sm text-muted-foreground col-span-full">No classes assigned</div>
                      ) : (
                        entry.classes.map((cls: any) => (
                          <div key={cls.id} className={`flex items-center justify-between p-2 bg-card border rounded ${selectedClass === cls.id ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setSelectedClass(cls.id)} style={{ cursor: 'pointer' }}>
                            <div>
                              <div className="font-medium text-foreground">{cls.className} - {studentCountForClass(cls)} students</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // non-super-admin: show classes as before
                teacherClasses.map((cls: any) => {
                  const studentCount = studentCountForClass(cls);
                  return (
                    <div
                      key={cls.id}
                      className={`flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors ${selectedClass === cls.id ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setSelectedClass(cls.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div>
                        <h4 className="font-medium text-foreground">{cls.className} - {studentCount} students</h4>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  );
                })
              )}
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
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Students in Class</h3>
                <p className="text-muted-foreground">No students are assigned to this class yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classStudents.map((student: any) => {
                  const first = (student.firstName || student.first_name || student.first || '').toString();
                  const last = (student.lastName || student.last_name || student.last || '').toString();
                  const displayFirst = first.charAt ? first.charAt(0) : '';
                  const displayLast = last.charAt ? last.charAt(0) : '';
                  const admission = student.admission_no ?? student.admissionNumber ?? student.admission_number ?? student.admission ?? '';
                  return (
                    <div key={student.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {displayFirst}{displayLast}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{(student.firstName ?? student.first_name ?? '')} {(student.lastName ?? student.last_name ?? '')}</p>
                        <p className="text-sm text-muted-foreground">Admission: {admission}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherClassesModule;
