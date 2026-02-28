
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useAttendance from '@/hooks/useAttendance';
import useClasses from '@/hooks/useClasses';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { Calendar, ClipboardCheck, Save, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AttendanceModule = () => {
  const { user } = useAuth();
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const { classes: rawClasses } = useClasses();

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    username: t.username || '',
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    staffId: t.staffId || t.staff_id || '',
    classAssigned: t.classAssigned || t.class_assigned || '',
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
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  // Use attendance hook
  const {
    attendance: fetchedAttendance,
    isLoading: isLoadingAttendance,
    bulkMarkAttendance,
    isBulkMarking,
  } = useAttendance(selectedClass ? Number(selectedClass) : undefined, selectedDate);

  // Determine if the current user is a super-admin
  useEffect(() => {
    if (fetchedAttendance && Array.isArray(fetchedAttendance)) {
      const attendanceMap: Record<string, boolean> = {};
      fetchedAttendance.forEach((record: any) => {
        const studentId = String(record.student_id);
        attendanceMap[studentId] = record.status === 'present';
      });
      setAttendance(attendanceMap);
    } else {
      setAttendance({});
    }
  }, [fetchedAttendance]);

  // Determine if the current user is a super-admin
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

  // Build teacher classes: super-admin sees all classes, teacher sees only assigned
  let teacherClasses: any[] = [];
  if (isSuperAdmin) {
    teacherClasses = classes;
  } else if (currentTeacher) {
    const assignedIds = Array.isArray(currentTeacher.classAssignedIds)
      ? currentTeacher.classAssignedIds.map((id: any) => Number(id))
      : [];
    const assignedList = Array.isArray(currentTeacher.classAssignedList)
      ? currentTeacher.classAssignedList.map((s: any) => String(s).trim())
      : [];
    const assignedIdSet = new Set(assignedIds.filter(id => !isNaN(id)));
    const assignedLabelSet = new Set(assignedList.filter(Boolean));
    const singleClassId = currentTeacher.classAssignedId ? Number(currentTeacher.classAssignedId) : null;
    const singleClassName = currentTeacher.classAssigned ? String(currentTeacher.classAssigned).trim() : '';

    // Filter classes by enriched assignment data, OR fallback to single class assignment if enriched data is empty
    const filtered = classes.filter((cls: any) => {
      const clsName = cls.className ? String(cls.className).trim() : '';
      const clsId = Number(cls.id);
      if (assignedIdSet.size > 0) return assignedIdSet.has(clsId);
      if (assignedLabelSet.size > 0) return assignedLabelSet.has(clsName);
      if (singleClassId && !isNaN(singleClassId)) return singleClassId === clsId;
      if (singleClassName) return singleClassName === clsName;
      return false;
    });

    teacherClasses = filtered;
  }

  // Get students for the selected class
  const selectedClassData = classes.find(cls => cls.id === selectedClass);
  const classStudents = selectedClassData
    ? students.filter(student => {
      const cid = String(selectedClassData.id);
      const studentClassId = student.classAssignedId ? String(student.classAssignedId) : null;
      if (studentClassId) return studentClassId === cid;
      return student.classAssigned === selectedClassData.className;
    })
    : [];

  // Helper: robustly compute student count for a class by id or name
  const studentCountForClass = (cls: any) => {
    try {
      const cid = String(cls.id);
      // look for common student-class fields (prefer id)
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

  const handleAttendanceChange = (studentId: string, present: boolean) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: present
    }));
  };

  const handleSaveAttendance = () => {
    if (!selectedClass) {
      toast({
        title: "Please select a class",
        variant: "destructive"
      });
      return;
    }

    // Build attendance records for all students
    const records = classStudents.map(student => ({
      class_id: Number(selectedClass),
      student_id: Number(student.id),
      attendance_date: selectedDate,
      status: (attendance[student.id] ? 'present' : 'absent') as 'present' | 'absent',
    }));

    // Call the mutation
    bulkMarkAttendance(records);
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    classStudents.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendance(allPresent);
  };

  const handleMarkAllAbsent = () => {
    const allAbsent: Record<string, boolean> = {};
    classStudents.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendance(allAbsent);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const totalStudents = classStudents.length;
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  if (!isSuperAdmin && !currentTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Teacher Not Found</h3>
            <p className="text-muted-foreground">You must be logged in as a teacher to access attendance.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin && teacherClasses.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Class Assigned</h3>
            <p className="text-muted-foreground">You don't have any classes assigned yet. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
            <p className="text-muted-foreground">{isSuperAdmin ? 'View and manage all class attendance' : 'Take and manage student attendance'}</p>
          </div>
        </div>
      </div>

      {/* Class and Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Select Class & Date</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map(cls => {
                    const count = studentCountForClass(cls);
                    return (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className} ({count} students)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          {/* Attendance Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {presentCount} / {totalStudents} Present
                    </span>
                  </div>
                  <Badge variant={attendancePercentage >= 90 ? "default" : attendancePercentage >= 80 ? "secondary" : "destructive"}>
                    {attendancePercentage}%
                  </Badge>
                </div>
                {!isSuperAdmin && (
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={handleMarkAllPresent}>
                      Mark All Present
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleMarkAllAbsent}>
                      Mark All Absent
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Student Attendance</span>
                {!isSuperAdmin && (
                  <Button
                    onClick={handleSaveAttendance}
                    disabled={isBulkMarking || isLoadingAttendance}
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isBulkMarking ? 'Saving...' : 'Save Attendance'}</span>
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classStudents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Students Found</h3>
                  <p className="text-muted-foreground">No students are assigned to this class yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classStudents.map(student => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {student.admissionNumber?.slice(-3) || (student.firstName?.charAt(0) || '') + (student.lastName?.charAt(0) || '')}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{student.firstName} {student.lastName}</p>
                          {(student.admission_no || student.admissionNumber) && <p className="text-sm text-muted-foreground">Admission: {student.admission_no || student.admissionNumber}</p>}
                        </div>
                      </div>
                      {!isSuperAdmin && (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`present-${student.id}`}
                              checked={attendance[student.id] === true}
                              onCheckedChange={() => handleAttendanceChange(student.id, true)}
                            />
                            <label
                              htmlFor={`present-${student.id}`}
                              className="text-sm font-medium text-green-600 cursor-pointer"
                            >
                              Present
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`absent-${student.id}`}
                              checked={attendance[student.id] === false}
                              onCheckedChange={() => handleAttendanceChange(student.id, false)}
                            />
                            <label
                              htmlFor={`absent-${student.id}`}
                              className="text-sm font-medium text-red-600 cursor-pointer"
                            >
                              Absent
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedClass && (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Select a Class</h3>
            <p className="text-muted-foreground">Choose a class from the dropdown above to take attendance.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceModule;
