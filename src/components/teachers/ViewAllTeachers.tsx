import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '../../contexts/DataContext';
import { useAudit } from '../../contexts/AuditContext';
import { Search, Edit, Users, Eye } from 'lucide-react';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import { teacherStatusBadge } from './TeacherStatusModals';
import type { Teacher } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import TeacherDetailsDialog from './TeacherDetailsDialog';
import EditTeacherDialog from './EditTeacherDialog';

const ViewAllTeachers = () => {
  const { teachers, classes } = useData();
  const { addAuditLog } = useAudit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchTerm === '' || 
      teacher.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = teacher.status || 'active';
    const matchesStatus =
      filterStatus === 'all' ||
      filterStatus === status;
    const matchesClass = filterClass === 'all-classes' || filterClass === 'no-class' ? 
      (filterClass === 'no-class' ? !teacher.classAssigned : true) : 
      teacher.classAssigned === filterClass;

    return matchesSearch && matchesStatus && matchesClass;
  });

  const getStatusColor = (status: string) => {
    const badge = teacherStatusBadge(status);
    return badge?.className || 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
  };

  const handleViewTeacher = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailsDialog(true);
  };

  const handleEditTeacher = (teacher: Teacher) => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Teachers',
      itemId: teacher.id,
      itemName: teacher.fullName,
    });
    setSelectedTeacher(teacher);
    setShowEditDialog(true);
  };

  return (
    <>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>All Teachers ({filteredTeachers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, staff ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  <SelectItem value="no-class">No Class Assigned</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 whitespace-nowrap">Photo</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Subjects</TableHead>
                  <TableHead className="whitespace-nowrap">Class Assigned</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Salary</TableHead>
                  <TableHead className="sticky right-0 z-10 min-w-[8.5rem] whitespace-nowrap bg-card/95 text-right backdrop-blur supports-[backdrop-filter]:bg-card/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No teachers found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => {
                    const status = teacher.status || 'active';
                    const badge = teacherStatusBadge(status);
                    const dimmed = status !== 'active';
                    return (
                    <TableRow key={teacher.id} className={`hover:bg-muted/40 ${dimmed ? 'opacity-70' : ''}`}>
                      <TableCell>
                        <LazyTeacherAvatar
                          teacherId={teacher.id}
                          fullName={teacher.fullName}
                          hasPassportPhoto={teacher.hasPassportPhoto}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{teacher.fullName}</div>
                          <div className="text-sm text-muted-foreground">{teacher.gender}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{teacher.staffId}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{teacher.phoneNumber}</div>
                          <div className="text-muted-foreground">{teacher.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjectsTaught.slice(0, 2).map((subject, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {teacher.subjectsTaught.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{teacher.subjectsTaught.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {teacher.classAssigned ? (
                          <Badge variant="secondary">{teacher.classAssigned}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No class</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {badge ? (
                          <Badge className={badge.className}>{badge.label}</Badge>
                        ) : (
                          <Badge className={getStatusColor(status)}>ACTIVE</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {teacher.monthlySalary > 0 ? (
                          <span className="font-mono">GHS {teacher.monthlySalary.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card/95 text-right backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewTeacher(teacher)}
                            className="h-9 w-9 p-0"
                            title="View teacher"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditTeacher(teacher)}
                            className="h-9 w-9 p-0"
                            title="Edit teacher"
                          >
                            <Edit className="w-4 h-4" />
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
          {filteredTeachers.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </div>
          )}
        </CardContent>
      </Card>

      <TeacherDetailsDialog
        teacher={selectedTeacher}
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
      />

      <EditTeacherDialog
        teacher={selectedTeacher}
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedTeacher(null);
        }}
      />

    </>
  );
};

export default ViewAllTeachers;
