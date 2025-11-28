import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '../../contexts/DataContext';
import { useAudit } from '../../contexts/AuditContext';
import { Search, Edit, Trash2, Users, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TeacherDetailsDialog from './TeacherDetailsDialog';
import EditTeacherDialog from './EditTeacherDialog';
import PasswordAuthDialog from '../common/PasswordAuthDialog';

const ViewAllTeachers = () => {
  const { teachers, classes, deleteTeacher } = useData();
  const { addAuditLog } = useAudit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all-status');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: 'edit' | 'delete', teacher: any} | null>(null);

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchTerm === '' || 
      teacher.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all-status' || teacher.employmentStatus === filterStatus;
    const matchesClass = filterClass === 'all-classes' || filterClass === 'no-class' ? 
      (filterClass === 'no-class' ? !teacher.classAssigned : true) : 
      teacher.classAssigned === filterClass;

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
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewTeacher = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailsDialog(true);
  };

  const handleEditTeacher = (teacher: any) => {
    setPendingAction({ type: 'edit', teacher });
    setShowPasswordDialog(true);
  };

  const handleDeleteClick = (teacher: any) => {
    setPendingAction({ type: 'delete', teacher });
    setShowPasswordDialog(true);
  };

  const handlePasswordSuccess = (reason?: string) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'edit') {
      // Add audit log for edit attempt
      addAuditLog({
        actionType: 'Edit',
        module: 'Teachers',
        itemId: pendingAction.teacher.id,
        itemName: pendingAction.teacher.fullName,
        reason: reason
      });

      setSelectedTeacher(pendingAction.teacher);
      setShowEditDialog(true);
    } else if (pendingAction.type === 'delete') {
      // Add audit log for delete
      addAuditLog({
        actionType: 'Delete',
        module: 'Teachers',
        itemId: pendingAction.teacher.id,
        itemName: pendingAction.teacher.fullName,
        reason: reason
      });

      deleteTeacher(pendingAction.teacher.id);
      toast({
        title: "Teacher Deleted",
        description: `${pendingAction.teacher.fullName} has been removed from the system`,
      });
    }

    setPendingAction(null);
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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No teachers found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{teacher.fullName}</div>
                          <div className="text-sm text-gray-500">{teacher.gender}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{teacher.staffId}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{teacher.phoneNumber}</div>
                          <div className="text-gray-500">{teacher.email}</div>
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
                          <span className="text-gray-400">No class</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(teacher.employmentStatus)}>
                          {teacher.employmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {teacher.monthlySalary > 0 ? (
                          <span className="font-mono">GHS {teacher.monthlySalary.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
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

      {/* Password Authentication Dialog */}
      <PasswordAuthDialog
        open={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false);
          setPendingAction(null);
        }}
        onSuccess={handlePasswordSuccess}
        action={pendingAction?.type || 'edit'}
        itemName={pendingAction?.teacher?.fullName || ''}
        module="Teachers"
      />
    </>
  );
};

export default ViewAllTeachers;
