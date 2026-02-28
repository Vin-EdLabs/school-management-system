
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useClasses from '@/hooks/useClasses';
import useSchedules from '@/hooks/useSchedules';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { BookOpen, Calendar, ClipboardCheck, Clock, School, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface TeacherDashboardProps {
  onNavigate?: (module: string) => void;
}

const TeacherDashboard = ({ onNavigate }: TeacherDashboardProps) => {
  const { user } = useAuth();
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const { classes: rawClasses } = useClasses();

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    username: t.username || t.userName || t.user_name || undefined,
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    staffId: t.staffId || t.staff_id || t.staffID || '',
    // include both display and id forms for reliable matching
    classAssignedId: t.classAssignedId ?? t.class_assigned_id ?? t.class_id ?? null,
    classAssigned: t.classAssigned || t.class_assigned || t.class || '',
    subjectsTaught: t.subjectsTaught || t.subjects_taught || [],
    email: t.email || '',
    phoneNumber: t.phoneNumber || t.phone_number || ''
  }));

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    admissionNumber: s.admissionNumber || s.admission_number || s.admission_no || '',
    classAssignedId: s.class_id ?? s.classId ?? s.class_assigned_id ?? null,
    classAssigned: s.classAssigned || s.class_assigned || s.class || ''
  }));

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || ''),
  }));

  // Find the current teacher's data based on username or teacherId
  // Match current user to a teacher record. Prefer explicit id or username match,
  // fall back to the previous fullName contains(username) heuristic for demo flows.
  const currentTeacher = teachers.find(t =>
    ((user as any)?.staffId && t.staffId && String(t.staffId) === String((user as any).staffId)) ||
    (user?.username && t.username && String(t.username).toLowerCase() === String(user.username).toLowerCase()) ||
    (t.staffId && user?.teacherId && String(t.staffId) === String(user.teacherId)) ||
    (String(t.id) === String(user?.id)) ||
    (t.fullName && (user as any)?.staffId && t.fullName.toLowerCase().includes(((user as any).staffId as string).toLowerCase())) ||
    (t.fullName && user?.username && t.fullName.toLowerCase().includes(user.username.toLowerCase()))
  );

  // Get schedules - will be fetched after currentTeacher is identified
  const { data: schedulesResp, isLoading: schedulesLoading } = useSchedules(currentTeacher?.id);
  const schedules = (schedulesResp as any)?.data || [];

  // Get teacher's assigned classes and students
  // Prefer matching by class id when available, otherwise fallback to class name
  const teacherClasses = currentTeacher?.classAssignedId != null
    ? classes.filter(cls => String(cls.id) === String(currentTeacher.classAssignedId))
    : currentTeacher?.classAssigned
      ? classes.filter(cls => cls.className === currentTeacher.classAssigned)
      : [];

  const teacherStudents = currentTeacher?.classAssignedId != null
    ? students.filter(student => String(student.classAssignedId) === String(currentTeacher.classAssignedId))
    : currentTeacher?.classAssigned
      ? students.filter(student => student.classAssigned === currentTeacher.classAssigned)
      : [];

  // Build today's schedule from real data with student counts
  const todaySchedule = schedules.map((schedule: any) => {
    const classId = schedule.class_id ?? schedule.classId;
    const cls = classes.find((c: any) => String(c.id) === String(classId));
    const classStudentCount = cls
      ? students.filter(s => (s.classAssignedId != null ? String(s.classAssignedId) === String(cls.id) : s.classAssigned === cls.className)).length
      : 0;
    const startTime = schedule.start_time ? schedule.start_time.slice(0, 5) : '09:00';
    const endTime = schedule.end_time ? schedule.end_time.slice(0, 5) : '10:00';

    // Use class_name from schedule if available, otherwise from classes array
    const className = schedule.class_name || cls?.className || schedule.className || `Class ${classId || 'Unknown'}`;

    return {
      id: schedule.id,
      name: className,
      students: classStudentCount,
      time: `${startTime} - ${endTime}`,
      room: schedule.room || 'TBA',
      subject: schedule.subject || 'N/A',
      dayOfWeek: schedule.day_of_week || 0
    };
  }).sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (!currentTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Teacher Profile Not Found</h3>
            <p className="text-muted-foreground">Your teacher profile is not set up. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {currentTeacher.fullName}!</h1>
            <p className="text-muted-foreground">Here's your teaching overview for today</p>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">My Classes</p>
                <p className="text-3xl font-bold text-foreground">{teacherClasses.length}</p>
              </div>
              <School className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-foreground">{teacherStudents.length}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subjects</p>
                <p className="text-3xl font-bold text-foreground">{currentTeacher.subjectsTaught.length}</p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Staff ID</p>
                <p className="text-xl font-bold text-foreground">{currentTeacher.staffId}</p>
              </div>
              <BookOpen className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>My Schedule</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
            ) : todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <School className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Classes Scheduled</h3>
                <p className="text-muted-foreground">You don't have any classes scheduled yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group schedules by day index and render day headings */}
                {(() => {
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const grouped: any[][] = Array.from({ length: 7 }, () => []);
                  todaySchedule.forEach((s) => {
                    const idx = Number(s.dayOfWeek) || 0;
                    if (!grouped[idx]) grouped[idx] = [];
                    grouped[idx].push(s);
                  });

                  return grouped.map((items, idx) => (
                    items && items.length > 0 ? (
                      <div key={idx}>
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">{dayNames[idx]}</h3>
                        <div className="space-y-2">
                          {items.map((cls: any) => (
                            <div key={cls.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                              <div>
                                <h4 className="font-medium text-foreground">{cls.name}</h4>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {cls.time}
                                  </span>
                                  <span>{cls.room}</span>
                                  <span>{cls.subject}</span>
                                  <span>{cls.students} students</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teacher Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Teacher Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Full Name:</span>
                <span className="text-sm text-foreground">{currentTeacher.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Staff ID:</span>
                <span className="text-sm text-foreground">{currentTeacher.staffId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Email:</span>
                <span className="text-sm text-foreground">{currentTeacher.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Phone:</span>
                <span className="text-sm text-foreground">{currentTeacher.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Class Assigned:</span>
                <span className="text-sm text-foreground">{currentTeacher.classAssigned || 'None'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Subjects:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTeacher.subjectsTaught.length > 0 ? (
                    currentTeacher.subjectsTaught.map((subject, index) => (
                      <Badge key={index} variant="outline">{subject}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No subjects assigned</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Overview */}
      {teacherStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>My Students ({teacherStudents.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherStudents.slice(0, 6).map((student) => (
                <div key={student.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{student.firstName} {student.lastName}</p>
                    <p className="text-sm text-muted-foreground">{student.admissionNumber}</p>
                  </div>
                </div>
              ))}
            </div>
            {teacherStudents.length > 6 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  View All Students ({teacherStudents.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherDashboard;
