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
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden animate-in fade-in duration-500">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-6">
          <CardTitle className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Student Registry</span>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{filteredStudents.length} identities in filtered set</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 px-3 py-1">
                Network Population: {students.length}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <Input
                placeholder="Search by name, ID, or admission token..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-12 w-48 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider">
                  <SelectValue placeholder="Level Filter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl">
                  <SelectItem value="all-classes" className="rounded-lg">All Levels</SelectItem>
                  {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                    <SelectItem key={cls.id} value={cls.className} className="rounded-lg">
                      {cls.className.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-12 w-32 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl">
                  <SelectItem value="all-genders" className="rounded-lg">All</SelectItem>
                  <SelectItem value="Male" className="rounded-lg">MALE</SelectItem>
                  <SelectItem value="Female" className="rounded-lg">FEMALE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Students Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/50 dark:bg-slate-900/50">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 pl-6 text-center">Entity</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Identification</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Status & Level</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Age</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Guardian / Proxy</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 pr-6">Protocol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <Search className="w-12 h-12" />
                        <p className="text-sm font-black uppercase tracking-widest italic">Zero Identities Detected</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} className="group border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <TableCell className="pl-6">
                        <div className="relative mx-auto w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-900 shadow-lg overflow-hidden transition-transform group-hover:scale-110 duration-500">
                          <Avatar className="h-full w-full rounded-none">
                            {student.passportPhotoUrl ? (
                              <AvatarImage src={resolveLogoUrl(student.passportPhotoUrl) || undefined} alt="" className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-600 dark:text-slate-400 text-xs font-black">
                              {student.firstName?.[0]}{student.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-black text-slate-900 dark:text-white font-outfit tracking-tight">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2 py-0.5 rounded uppercase tracking-widest">
                              ID: {student.studentId}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5">
                            {student.classAssigned}
                          </Badge>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <div className={student.gender === 'Male' ? 'text-blue-500' : 'text-pink-500'}>
                              {student.gender.toUpperCase()}
                            </div>
                            <span>•</span>
                            <span>ADMISSION: {student.admissionNumber || '—'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {calculateAge(student.dateOfBirth)} <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Cycles</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">{student.guardianName || 'NOT SET'}</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            {student.guardianContact || '—'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                            onClick={() => handleViewStudent(student)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleEditStudent(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10"
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
            <div className="mt-6 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <p>Registry Viewport: {filteredStudents.length} units</p>
              <p>Total Population Index: {students.length}</p>
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
