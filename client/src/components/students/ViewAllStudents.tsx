import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Edit, Eye, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useClasses } from '../../hooks/useClasses';
import { useDeleteStudent, useStudents } from '../../hooks/useStudents';
import PasswordAuthDialog from '../common/PasswordAuthDialog';
import EditStudentDialog from './EditStudentDialog';
import StudentDetailsDialog from './StudentDetailsDialog';

const ViewAllStudents = () => {
  const { students } = useStudents();
  const { classes } = useClasses();
  const deleteStudentMutation = useDeleteStudent();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterGender, setFilterGender] = useState('all-genders');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete', student: any } | null>(null);

  // Filter students based on search and filters
  const filteredStudents = students.filter((student: any) => {
    const first = (student.first_name || student.firstName || '').toString();
    const last = (student.last_name || student.lastName || '').toString();
    const admission = (student.admission_no || student.admissionNumber || student.admissionNumber || (student.meta && student.meta.admission_no) || '').toString();
    const sid = (student.student_id || student.studentId || student.id || '').toString();

    const matchesSearch = searchTerm === '' ||
      first.toLowerCase().includes(searchTerm.toLowerCase()) ||
      last.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sid.includes(searchTerm) ||
      admission.toLowerCase().includes(searchTerm.toLowerCase());

    const clsName = (() => {
      const cls = classes.find((c: any) => c.id === (student.class_id ?? student.classId ?? null));
      if (!cls) return 'Unassigned';
      return cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls?.name ?? cls?.className ?? 'Unassigned');
    })();

    const matchesClass = filterClass === 'all-classes' || clsName === filterClass;
    const gender = student.gender || student.meta?.gender || 'Unknown';
    const matchesGender = filterGender === 'all-genders' || gender === filterGender;

    return matchesSearch && matchesClass && matchesGender;
  });

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowDetailsDialog(true);
  };

  const handleEditStudent = (student: any) => {
    setPendingAction({ type: 'edit', student });
    setShowPasswordDialog(true);
  };

  const handleDeleteClick = (student: any) => {
    setPendingAction({ type: 'delete', student });
    setShowPasswordDialog(true);
  };

  const handlePasswordSuccess = (reason?: string) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'edit') {
      setSelectedStudent(pendingAction.student);
      setShowEditDialog(true);
    } else if (pendingAction.type === 'delete') {
      // perform delete via mutation
      deleteStudentMutation.mutate(pendingAction.student.id, {
        onSuccess: () => {
          toast({ title: 'Student Deleted', description: 'Student has been removed from the system' });
        },
        onError: (err: any) => {
          toast({ title: 'Delete Failed', description: err?.message ?? 'Unable to delete student', variant: 'destructive' });
        }
      });
    }

    setPendingAction(null);
  };

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Students ({filteredStudents.length})</span>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-sm">
                Total: {students.length} students
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, student ID, or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  {classes.map((cls: any) => {
                    const display = cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls.name ?? cls.className ?? 'Unassigned');
                    return (
                      <SelectItem key={cls.id} value={display}>
                        {display}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-genders">All</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Students Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Info</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student: any) => {
                    const cls = classes.find((c: any) => c.id === (student.class_id ?? student.classId ?? null));
                    const className = cls ? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : (cls?.name ?? cls?.className ?? 'Unassigned')) : 'Unassigned';
                    const first = student.first_name ?? student.firstName ?? '';
                    const last = student.last_name ?? student.lastName ?? '';
                    const admission = student.admission_no ?? student.admissionNumber ?? student.meta?.admission_no ?? 'N/A';
                    const sid = student.student_id ?? student.studentId ?? student.id;
                    const gender = student.gender ?? student.meta?.gender ?? 'Unknown';

                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {first} {last}
                            </div>
                            <div className="text-sm text-muted-foreground">Admission: {admission}</div>
                            <Badge variant={gender === 'Male' ? 'default' : 'secondary'} className="text-xs">
                              {gender}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{sid}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{className}</Badge>
                        </TableCell>
                        <TableCell>{calculateAge(student.date_of_birth ?? student.dateOfBirth)} years</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{student.guardian_name ?? student.guardianName ?? ''}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{student.guardian_contact ?? student.guardianContact ?? ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleViewStudent(student)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleEditStudent(student)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(student)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          {filteredStudents.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {students.length} students
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Details Dialog */}
      <StudentDetailsDialog
        student={selectedStudent}
        open={showDetailsDialog}
        onClose={() => {
          setShowDetailsDialog(false);
          setSelectedStudent(null);
        }}
      />

      {/* Edit Student Dialog */}
      <EditStudentDialog
        student={selectedStudent}
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
      />

      {/* Password Authentication Dialog */}
      <PasswordAuthDialog
        open={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false);
          setPendingAction(null);
        }}
        onSuccess={handlePasswordSuccess}
        action={pendingAction?.type || 'edit'}
        itemName={pendingAction ? `${pendingAction.student.firstName} ${pendingAction.student.lastName}` : ''}
        module="Students"
      />
    </>
  );
};

export default ViewAllStudents;
