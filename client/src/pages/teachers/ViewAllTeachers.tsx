import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
<<<<<<< HEAD:src/components/teachers/ViewAllTeachers.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '../../contexts/DataContext';
import { useAudit } from '../../contexts/AuditContext';
import { Search, Edit, Trash2, Users, Eye } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
=======
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/ViewAllTeachers.tsx
import { toast } from '@/hooks/use-toast';
import { Edit, Eye, Search, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useAudit } from '../../contexts/AuditContext';
import { useClasses } from '../../hooks/useClasses';
import { useDeleteTeacher, useTeachers } from '../../hooks/useTeachers';
import PasswordAuthDialog from '../../components/common/PasswordAuthDialog';
import EditTeacherDialog from './EditTeacherDialog';
<<<<<<< HEAD:src/components/teachers/ViewAllTeachers.tsx
=======
import TeacherDetailsDialog from './TeacherDetailsDialog';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/ViewAllTeachers.tsx

const ViewAllTeachers = () => {
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();
  const deleteTeacherMutation = useDeleteTeacher();
  const { addAuditLog } = useAudit();
  const teachers = teachersQuery.teachers ?? [];
  const classes = classesQuery.classes ?? [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all-status');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
<<<<<<< HEAD:src/components/teachers/ViewAllTeachers.tsx
=======
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete', teacher: any } | null>(null);
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/ViewAllTeachers.tsx

  const filteredTeachers = teachers.filter((teacher: any) => {
    const name = (teacher?.fullName ?? '').toString();
    const username = (teacher?.staffId ?? teacher?.username ?? '').toString();
    const email = (teacher?.email ?? '').toString();

    const matchesSearch = searchTerm === '' ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all-status' || (teacher?.employmentStatus ?? '') === filterStatus;
    const matchesClass = filterClass === 'all-classes' || filterClass === 'no-class' ?
      (filterClass === 'no-class' ? !(teacher?.classAssigned) : true) :
      (teacher?.classAssigned ?? '') === filterClass;

    return matchesSearch && matchesStatus && matchesClass;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Left':
        return 'bg-red-100 text-red-800';
      case 'Suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const handleViewTeacher = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailsDialog(true);
  };

  const handleEditTeacher = (teacher: any) => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Teachers',
      itemId: teacher.id,
      itemName: teacher.fullName,
    });
    setSelectedTeacher(teacher);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (teacher: any) => {
    if (window.confirm(`Are you sure you want to delete ${teacher.fullName}?`)) {
      addAuditLog({
        actionType: 'Delete',
        module: 'Teachers',
        itemId: teacher.id,
        itemName: teacher.fullName,
      });
<<<<<<< HEAD:src/components/teachers/ViewAllTeachers.tsx
      deleteTeacher(teacher.id);
      toast({
        title: "Teacher Deleted",
        description: `${teacher.fullName} has been removed from the system`,
=======

      deleteTeacherMutation.mutate(pendingAction.teacher.id, {
        onSuccess: () => {
          toast({ title: 'Teacher Deleted', description: `${pendingAction.teacher.fullName} has been removed from the system` });
        },
        onError: (err: any) => {
          toast({ title: 'Delete Failed', description: err?.message ?? 'Unable to delete teacher', variant: 'destructive' });
        }
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/ViewAllTeachers.tsx
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>All Teachers ({filteredTeachers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email..."
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
                  <SelectItem value="all-status">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Left">Left</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  <SelectItem value="no-class">No Class Assigned</SelectItem>
                  {classes.map((cls) => {
                    const display = cls.className ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : `Class ${cls.id}`);
                    return (
                      <SelectItem key={cls.id} value={display}>
                        {display}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Class Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
<<<<<<< HEAD:src/components/teachers/ViewAllTeachers.tsx
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
=======
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/teachers/ViewAllTeachers.tsx
                      No teachers found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10 rounded-full border border-slate-200">
                          <AvatarFallback className="bg-slate-200 text-slate-600 text-sm font-medium">
                            {(teacher.fullName || 'U').split(/\s+/).map(n => n[0]).join('').slice(0, 2) || '?'}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{teacher.fullName}</div>
                          <div className="text-sm text-muted-foreground">{teacher.gender}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{teacher.staffId ?? teacher.username}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{teacher.phoneNumber}</div>
                          <div className="text-muted-foreground">{teacher.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(teacher?.subjectsTaught ?? []).slice(0, 2).map((subject, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {(teacher?.subjectsTaught ?? []).length > 2 && (
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
                        <Badge className={getStatusColor(teacher.employmentStatus)}>
                          {teacher.employmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(teacher?.monthlySalary ?? 0) > 0 ? (
                          <span className="font-mono">GHS {Number(teacher.monthlySalary).toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewTeacher(teacher)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTeacher(teacher)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(teacher)}
                            className="text-red-600 hover:text-red-800"
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
          {filteredTeachers.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
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
