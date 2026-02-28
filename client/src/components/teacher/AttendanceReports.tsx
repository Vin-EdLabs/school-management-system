import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClassAttendanceRange } from '@/hooks/useAttendance';
import useClasses from '@/hooks/useClasses';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { BarChart3, Calendar, Download, FileText, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActiveTerm, useActiveYear } from '@/hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';

interface AttendanceStats {
    studentId: number;
    studentName: string;
    gender: string;
    admissionNo: string;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    excusedDays: number;
    attendanceRate: number;
}

const AttendanceReports = () => {
    const { user } = useAuth();
    const { data: activeTerm } = useActiveTerm();
    const { data: activeYear } = useActiveYear();
    const { classes: rawClasses } = useClasses();
    const { students: rawStudents } = useStudents();
    const { teachers: rawTeachers } = useTeachers();

    const [selectedClass, setSelectedClass] = useState('');
    const [reportType, setReportType] = useState<'weekly' | 'term' | 'year'>('weekly');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Determine if the current user is a super-admin
    const roleStr = String(user?.role || '').toLowerCase();
    const isSuperAdmin = roleStr.includes('super');

    const teachers = (rawTeachers || []).map((t: any) => ({
        id: t.id ?? String(t.id),
        username: t.username || '',
        classAssignedIds: t.classAssignedIds ?? t.class_assigned_ids ?? []
    }));

    const classes = (rawClasses || []).map((c: any) => {
        const level = c.level || c.grade || '';
        const stream = c.stream || '';
        const derivedName = stream ? `${level} ${stream}` : level;
        return {
            id: c.id ?? String(c.id),
            className: c.className || c.class_name || c.name || derivedName || `Class ${c.id}`,
            teacherId: c.assignedTeacher ?? c.assignedTeacherId ?? c.teacher_id ?? c.teacherId
        };
    });

    // Find the current teacher's data based on user ID or username match
    const currentTeacher = teachers.find(t => {
        const teacherId = Number(t.id);
        const userId = Number(user?.id || 0);
        const teacherUsername = (t.username || '').toLowerCase();
        const userName = (user?.username || '').toLowerCase();

        return (teacherId && userId && teacherId === userId) ||
            (teacherUsername && userName && teacherUsername === userName);
    });

    // Filter classes for teachers (super-admin sees all)
    let availableClasses: any[] = [];
    if (isSuperAdmin) {
        availableClasses = classes;
    } else {
        const assignedIds = currentTeacher && Array.isArray(currentTeacher.classAssignedIds)
            ? currentTeacher.classAssignedIds.map((id: any) => Number(id))
            : [];
        const assignedIdSet = new Set(assignedIds.filter(id => !isNaN(id)));
        const userId = String(user?.id || (user as any)?.teacherId);

        availableClasses = classes.filter((cls: any) => {
            const clsId = Number(cls.id);
            const isAssignedDirectly = cls.teacherId !== undefined && cls.teacherId !== null && String(cls.teacherId) === userId;
            return assignedIdSet.has(clsId) || isAssignedDirectly;
        });
    }

    const students = (rawStudents || []).map((s: any) => ({
        id: s.id ?? String(s.id),
        firstName: s.first_name || s.firstName || '',
        lastName: s.last_name || s.lastName || '',
        gender: s.gender || 'Unknown',
        admissionNo: s.admission_no || s.admissionNumber || s.admission_number || '',
        classId: s.class_id ?? s.classId ?? null
    }));

    // Fetch attendance data for the selected range
    const { attendance: attendanceRecords } = useClassAttendanceRange(
        selectedClass ? Number(selectedClass) : undefined,
        startDate,
        endDate
    );

    // Calculate statistics
    const calculateStats = (): AttendanceStats[] => {
        const classStudents = students.filter(s => String(s.classId) === String(selectedClass));

        return classStudents.map(student => {
            const studentRecords = (attendanceRecords || []).filter(
                (r: any) => String(r.student_id) === String(student.id)
            );

            const present = studentRecords.filter((r: any) => r.status === 'present').length;
            const absent = studentRecords.filter((r: any) => r.status === 'absent').length;
            const late = studentRecords.filter((r: any) => r.status === 'late').length;
            const excused = studentRecords.filter((r: any) => r.status === 'excused').length;
            const total = studentRecords.length;

            return {
                studentId: Number(student.id),
                studentName: `${student.firstName} ${student.lastName}`.trim(),
                gender: student.gender,
                admissionNo: student.admissionNo,
                totalDays: total,
                presentDays: present,
                absentDays: absent,
                lateDays: late,
                excusedDays: excused,
                attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0
            };
        });
    };

    const stats = calculateStats();

    // Gender-based statistics
    const genderStats = {
        male: stats.filter(s => s.gender.toLowerCase() === 'male'),
        female: stats.filter(s => s.gender.toLowerCase() === 'female'),
        other: stats.filter(s => !['male', 'female'].includes(s.gender.toLowerCase()))
    };

    const avgAttendanceByGender = {
        male: genderStats.male.length > 0
            ? Math.round(genderStats.male.reduce((sum, s) => sum + s.attendanceRate, 0) / genderStats.male.length)
            : 0,
        female: genderStats.female.length > 0
            ? Math.round(genderStats.female.reduce((sum, s) => sum + s.attendanceRate, 0) / genderStats.female.length)
            : 0
    };

    // Set date ranges based on report type
    const setDateRange = (type: 'weekly' | 'term' | 'year') => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'weekly':
                start.setDate(today.getDate() - 7);
                break;
            case 'term':
                if (activeTerm?.start_date) {
                    start = new Date(activeTerm.start_date);
                    if (activeTerm.end_date) {
                        end = new Date(activeTerm.end_date);
                    }
                } else {
                    start.setMonth(today.getMonth() - 3);
                }
                break;
            case 'year':
                if (activeYear?.start_date) {
                    start = new Date(activeYear.start_date);
                    if (activeYear.end_date) {
                        end = new Date(activeYear.end_date);
                    }
                } else {
                    start.setMonth(0, 1); // Jan 1st
                }
                break;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        setReportType(type);
    };

    // Auto-initialize default range (Weekly)
    useEffect(() => {
        if (!startDate && !endDate) {
            setDateRange('weekly');
        }
    }, [startDate, endDate]);

    const exportToCSV = () => {
        const headers = ['Admission No', 'Name', 'Gender', 'Total Days', 'Present', 'Absent', 'Late', 'Excused', 'Attendance %'];
        const rows = stats.map(s => [
            s.admissionNo,
            s.studentName,
            s.gender,
            s.totalDays,
            s.presentDays,
            s.absentDays,
            s.lateDays,
            s.excusedDays,
            s.attendanceRate
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Attendance Reports</h1>
                        <p className="text-muted-foreground">Weekly, Term, and Annual attendance analysis</p>
                    </div>
                </div>
                {stats.length > 0 && (
                    <Button onClick={exportToCSV} className="flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5" />
                        <span>Report Configuration</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Class</label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableClasses.map(cls => (
                                        <SelectItem key={cls.id} value={cls.id}>
                                            {cls.className}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Report Type</label>
                            <div className="flex space-x-2">
                                <Button
                                    size="sm"
                                    variant={reportType === 'weekly' ? 'default' : 'outline'}
                                    onClick={() => setDateRange('weekly')}
                                >
                                    Weekly
                                </Button>
                                <Button
                                    size="sm"
                                    variant={reportType === 'term' ? 'default' : 'outline'}
                                    onClick={() => setDateRange('term')}
                                    title={activeTerm?.name ? `Current Term: ${activeTerm.name}` : 'Term'}
                                >
                                    {activeTerm?.name || 'Term'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={reportType === 'year' ? 'default' : 'outline'}
                                    onClick={() => setDateRange('year')}
                                    title={activeYear?.year_label || activeYear || 'Year'}
                                >
                                    {activeYear?.year_label || activeYear || 'Year'}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedClass && startDate && endDate && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Students</p>
                                        <p className="text-2xl font-bold">{stats.length}</p>
                                    </div>
                                    <Users className="w-8 h-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Avg Attendance</p>
                                        <p className="text-2xl font-bold">
                                            {stats.length > 0
                                                ? Math.round(stats.reduce((sum, s) => sum + s.attendanceRate, 0) / stats.length)
                                                : 0}%
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Male Avg</p>
                                        <p className="text-2xl font-bold">{avgAttendanceByGender.male}%</p>
                                        <p className="text-xs text-muted-foreground">{genderStats.male.length} students</p>
                                    </div>
                                    <FileText className="w-8 h-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Female Avg</p>
                                        <p className="text-2xl font-bold">{avgAttendanceByGender.female}%</p>
                                        <p className="text-xs text-muted-foreground">{genderStats.female.length} students</p>
                                    </div>
                                    <FileText className="w-8 h-8 text-pink-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs for different views */}
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList>
                            <TabsTrigger value="all">All Students</TabsTrigger>
                            <TabsTrigger value="male">Male Students</TabsTrigger>
                            <TabsTrigger value="female">Female Students</TabsTrigger>
                            <TabsTrigger value="low">Low Attendance</TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>All Students Attendance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admission No</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Gender</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Total Days</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Present</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Absent</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Late</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Attendance %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {stats.map(student => (
                                                    <tr key={student.studentId} className="hover:bg-muted/50">
                                                        <td className="px-4 py-3 text-sm">{student.admissionNo}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">{student.studentName}</td>
                                                        <td className="px-4 py-3 text-sm">{student.gender}</td>
                                                        <td className="px-4 py-3 text-sm text-center">{student.totalDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-green-600">{student.presentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-red-600">{student.absentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-yellow-600">{student.lateDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <Badge variant={
                                                                student.attendanceRate >= 90 ? 'default' :
                                                                    student.attendanceRate >= 75 ? 'secondary' :
                                                                        'destructive'
                                                            }>
                                                                {student.attendanceRate}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="male" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Male Students Attendance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admission No</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Total Days</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Present</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Absent</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Attendance %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {genderStats.male.map(student => (
                                                    <tr key={student.studentId} className="hover:bg-muted/50">
                                                        <td className="px-4 py-3 text-sm">{student.admissionNo}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">{student.studentName}</td>
                                                        <td className="px-4 py-3 text-sm text-center">{student.totalDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-green-600">{student.presentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-red-600">{student.absentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <Badge variant={student.attendanceRate >= 75 ? 'default' : 'destructive'}>
                                                                {student.attendanceRate}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="female" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Female Students Attendance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admission No</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Total Days</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Present</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Absent</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Attendance %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {genderStats.female.map(student => (
                                                    <tr key={student.studentId} className="hover:bg-muted/50">
                                                        <td className="px-4 py-3 text-sm">{student.admissionNo}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">{student.studentName}</td>
                                                        <td className="px-4 py-3 text-sm text-center">{student.totalDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-green-600">{student.presentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-red-600">{student.absentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <Badge variant={student.attendanceRate >= 75 ? 'default' : 'destructive'}>
                                                                {student.attendanceRate}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="low" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Low Attendance (&lt; 75%)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admission No</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Gender</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Total Days</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Present</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Absent</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Attendance %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {stats.filter(s => s.attendanceRate < 75).map(student => (
                                                    <tr key={student.studentId} className="hover:bg-muted/50">
                                                        <td className="px-4 py-3 text-sm">{student.admissionNo}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">{student.studentName}</td>
                                                        <td className="px-4 py-3 text-sm">{student.gender}</td>
                                                        <td className="px-4 py-3 text-sm text-center">{student.totalDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-green-600">{student.presentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-red-600">{student.absentDays}</td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <Badge variant="destructive">
                                                                {student.attendanceRate}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}

            {!selectedClass && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Select Class and Date Range</h3>
                        <p className="text-muted-foreground">Choose a class and date range to generate attendance reports.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default AttendanceReports;
