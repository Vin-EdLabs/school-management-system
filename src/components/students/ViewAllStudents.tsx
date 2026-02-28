import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { useAudit } from '../../contexts/AuditContext';
import { Search, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { resolveLogoUrl } from '../../services/tenantService';
import StudentDetailsDialog from './StudentDetailsDialog';
import EditStudentDialog from './EditStudentDialog';

const ViewAllStudents = () => {
  const { students, classes, deleteStudent, payments, feeStructures } = useData();
  const { currentTerm } = useActiveTerm();
  const { addAuditLog } = useAudit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterGender, setFilterGender] = useState('all-genders');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Filter students based on search and filters
  const filteredStudents = students.filter(student => {
    const matchesSearch = searchTerm === '' || 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm) ||
      student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;
    const matchesGender = filterGender === 'all-genders' || student.gender === filterGender;

    return matchesSearch && matchesClass && matchesGender;
  });

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowDetailsDialog(true);
  };

  const handleEditStudent = (student: any) => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Students',
      itemId: student.id,
      itemName: `${student.firstName} ${student.lastName}`,
    });
    setSelectedStudent(student);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (student: any) => {
    if (window.confirm(`Are you sure you want to delete ${student.firstName} ${student.lastName}?`)) {
      addAuditLog({
        actionType: 'Delete',
        module: 'Students',
        itemId: student.id,
        itemName: `${student.firstName} ${student.lastName}`,
      });
      deleteStudent(student.id);
      toast({
        title: "Student Deleted",
        description: `${student.firstName} ${student.lastName} has been removed from the system`,
      });
    }
  };

  const calculateAge = (dateOfBirth: string) => {
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
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                  {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
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
                  <TableHead className="w-14">Photo</TableHead>
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
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10 rounded-full border border-slate-200">
                          {student.passportPhotoUrl ? (
                            <AvatarImage src={resolveLogoUrl(student.passportPhotoUrl) || undefined} alt={`${student.firstName} ${student.lastName}`} className="object-cover" />
                          ) : null}
                          <AvatarFallback className="bg-slate-200 text-slate-600 text-sm font-medium">
                            {student.firstName?.[0]}{student.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            Admission: {student.admissionNumber || 'N/A'}
                          </div>
                          <Badge variant={student.gender === 'Male' ? 'default' : 'secondary'} className="text-xs">
                            {student.gender}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {student.studentId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.classAssigned}</Badge>
                      </TableCell>
                      <TableCell>
                        {calculateAge(student.dateOfBirth)} years
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{student.guardianName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{student.guardianContact}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleViewStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleEditStudent(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(student)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          {filteredStudents.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
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
        payments={(payments || []).filter((p: any) =>
          currentTerm && currentTerm !== 'Not Set' &&
          (p.term === currentTerm || (p.term && (p.term.includes(currentTerm) || currentTerm.includes(p.term))))
        )}
        totalFeesForStudent={selectedStudent ? (() => {
          const fs = feeStructures || [];
          const classMatch = (f: any) =>
            (f.classId != null && selectedStudent.classAssignedId != null && Number(f.classId) === Number(selectedStudent.classAssignedId)) ||
            (f.class_name === selectedStudent.classAssigned || f.className === selectedStudent.classAssigned);
          const termMatch = (f: any) => !currentTerm || currentTerm === 'Not Set' || !f.term ? false : f.term === currentTerm || f.term.includes(currentTerm) || currentTerm.includes(f.term);
          return fs.filter((f: any) => classMatch(f) && termMatch(f)).reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
        })() : 0}
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

    </>
  );
};

export default ViewAllStudents;
