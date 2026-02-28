
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import useAcademicTerms from '@/hooks/useAcademicTerms';
import { AlertCircle, BookOpen, DollarSign, Eye, GraduationCap, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { calculateStudentFeeStatus, getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';

interface AdministratorDashboardProps {
  onNavigate?: (module: string) => void;
}

const AdministratorDashboard = ({ onNavigate }: AdministratorDashboardProps) => {
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const { classes: rawClasses } = useClasses();
  const { payments: rawPayments } = usePayments();
  const { feeStructures: rawFeeStructures } = useFeeStructures();
  const { terms } = useAcademicTerms();

  const students = (rawStudents || []).map((s: any) => {
    let classAssigned = s.classAssigned || s.class_assigned || '';
    if (!classAssigned && s.class_id && rawClasses && rawClasses.length > 0) {
      const cls = rawClasses.find((c: any) => String(c.id) === String(s.class_id));
      if (cls) classAssigned = (cls.level && cls.stream) ? `${cls.level} ${cls.stream}` : (cls.level || '');
    }
    return {
      id: s.id ?? String(s.id),
      firstName: s.first_name || s.firstName || '',
      lastName: s.last_name || s.lastName || '',
      studentId: s.studentId || s.student_id || s.id || '',
      classAssigned,
      gender: s.gender || s.sex || ''
    };
  });

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    firstName: t.firstName || t.first_name || '',
    lastName: t.lastName || t.last_name || '',
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    gender: t.gender || ''
  }));

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || '')
  }));

  const payments = (rawPayments || []).map((p: any) => {
    let termName = p.term || p.term_name || '';
    if (!termName && p.term_id && terms && terms.length > 0) {
      const termObj = terms.find((t: any) => String(t.id) === String(p.term_id));
      if (termObj) termName = termObj.name;
    }
    return {
      id: p.id ?? String(p.id),
      studentId: String(p.student_id || p.studentId || p.student),
      term: termName,
      amount: Number(p.amount || 0)
    };
  });

  const feeStructures = (rawFeeStructures || []).map((f: any) => {
    let termName = f.term || f.term_name || '';
    if (!termName && f.term_id && terms && terms.length > 0) {
      const termObj = terms.find((t: any) => String(t.id) === String(f.term_id));
      if (termObj) termName = termObj.name;
    }
    return {
      id: f.id ?? String(f.id),
      className: f.className || f.class_name || '',
      term: termName
    };
  });
  const [selectedClass, setSelectedClass] = useState('all-classes');
  const [activeAcademicTerm, setActiveAcademicTerm] = useState('');
  const [activeAcademicYear, setActiveAcademicYear] = useState('');

  // Load active academic settings
  useEffect(() => {
    const activeTerm = getActiveAcademicTerm(terms);
    const activeYear = getActiveAcademicYear(terms);
    setActiveAcademicTerm(activeTerm);
    setActiveAcademicYear(activeYear);
  }, [terms]);

  // Calculate real-time student statistics
  const totalStudents = students.length;
  const maleStudents = students.filter(s => s.gender === 'Male').length;
  const femaleStudents = students.filter(s => s.gender === 'Female').length;

  // Calculate real-time teacher statistics
  const totalTeachers = teachers.length;
  const maleTeachers = teachers.filter(t => t.gender === 'Male').length;
  const femaleTeachers = teachers.filter(t => t.gender === 'Female').length;

  // Calculate active classes count
  const activeClasses = classes.filter(cls => cls.className && cls.className.trim() !== '').length;

  // Filter students by class
  const filteredStudents = selectedClass === 'all-classes'
    ? students
    : students.filter(student => student.classAssigned === selectedClass);

  // Calculate fee status for each student using real data
  const studentsWithFeeStatus = filteredStudents.map(student => ({
    ...student,
    feeStatus: calculateStudentFeeStatus(student.id, activeAcademicTerm, students, feeStructures, payments)
  }));

  // Calculate real-time fee overview totals
  const totalOwing = studentsWithFeeStatus
    .filter(s => s.feeStatus.status === 'Amount Owing')
    .reduce((sum, s) => sum + s.feeStatus.balance, 0);

  const fullyPaidCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'Fully Paid').length;
  const owingCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'Amount Owing').length;
  const noFeeSetCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'No Fee Set').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Administrator Dashboard</h1>
            <p className="text-muted-foreground">Academic Year: {activeAcademicYear} | {activeAcademicTerm}</p>
          </div>
        </div>
      </div>

      {/* Overview Cards with Real Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {maleStudents} Male • {femaleStudents} Female
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <BookOpen className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeachers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {maleTeachers} Male • {femaleTeachers} Female
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClasses}</div>
            <div className="text-xs text-muted-foreground mt-1">
              All levels active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fee Status Overview</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fullyPaidCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Fully Paid • {owingCount} Owing • {noFeeSetCount} No Fee Set
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Fee Status Section with Real Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Student Fee Status</span>
            </CardTitle>
            <div className="flex items-center space-x-4">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {totalOwing > 0 && (
                <Badge variant="destructive">
                  Total Owing: GHS {totalOwing.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {studentsWithFeeStatus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found in the selected class
              </div>
            ) : (
              <div className="grid gap-4">
                {studentsWithFeeStatus.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.classAssigned} • ID: {student.studentId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {student.feeStatus.status === 'Amount Owing' ? (
                        <div className="text-right">
                          <Badge variant="destructive" className="flex items-center space-x-1 mb-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Amount Owing</span>
                          </Badge>
                          <div className="text-sm font-mono text-red-600">
                            GHS {student.feeStatus.balance.toLocaleString()}
                          </div>
                        </div>
                      ) : student.feeStatus.status === 'Fully Paid' ? (
                        <Badge variant="default" className="bg-green-500">
                          Fully Paid
                        </Badge>
                      ) : student.feeStatus.status === 'Credit Balance' ? (
                        <div className="text-right">
                          <Badge variant="default" className="bg-blue-500 mb-1">
                            Credit Balance
                          </Badge>
                          <div className="text-sm font-mono text-blue-600">
                            GHS {Math.abs(student.feeStatus.balance).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          No Fee Set
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdministratorDashboard;
