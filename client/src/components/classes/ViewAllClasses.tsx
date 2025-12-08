
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import { Edit, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import EditClassDialog from './EditClassDialog';

const ViewAllClasses = () => {
  const { classes: rawClasses, deleteClass, updateClass } = useClasses();
  const { students: rawStudents } = useStudents();
  const { teachers: rawTeachers } = useTeachers();
  const classes = (rawClasses || []).map((c: any) => {
    const level = c.level || c.grade || '';
    const stream = c.stream || '';
    const className = stream ? `${level} ${stream}` : level;
    return {
      id: c.id ?? c._id ?? String(c.id),
      className: className,
      level: level,
      stream: stream,
      maxClassSize: c.maxClassSize ?? c.max_class_size ?? c.capacity ?? 30,
      teacher_id: c.teacher_id || c.teacherId,
      // prefer explicit assignedTeacherName set by useClasses enrichment; keep the raw id in assignedTeacherId
      assignedTeacherName: (c as any).assignedTeacherName ?? (c as any).assigned_teacher_name ?? null,
      assignedTeacherId: (c as any).assignedTeacher ?? (c as any).assigned_teacher ?? null,
    };
  });

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || s.first || '',
    lastName: s.last_name || s.lastName || s.last || '',
    classAssigned: s.classAssigned || s.class_assigned || s.class || ''
  }));

  const teachers = (rawTeachers || []).map((t: any) => ({
    id: t.id ?? String(t.id),
    fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`,
    classAssigned: t.classAssigned || t.class_assigned || t.class || '',
    employmentStatus: t.employmentStatus || t.employment_status || 'Active'
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all-levels');

  console.log('ViewAllClasses: classes data:', classes);
  console.log('ViewAllClasses: students data:', students);

  // Filter classes based on search term and level
  const filteredClasses = classes.filter(classItem => {
    if (!classItem.className || classItem.className.trim() === '') return false;

    const matchesSearch = searchTerm === '' ||
      classItem.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.stream.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'all-levels' || classItem.level === filterLevel;

    return matchesSearch && matchesLevel;
  });

  // Get unique levels for filter dropdown
  const uniqueLevels = [...new Set(classes.map(c => c.level).filter(level => level && level.trim() !== ''))];

  const getClassStats = (classItem: any) => {
    const studentsInClass = students.filter(student => student.classAssigned === classItem.className);
    // Prefer the assignedTeacherName populated by useClasses enrichment
    if (classItem.assignedTeacherName && typeof classItem.assignedTeacherName === 'string') {
      return {
        studentCount: studentsInClass.length,
        teacherName: classItem.assignedTeacherName,
        hasTeacher: true
      };
    }

    // Fall back to assignedTeacherId (if present) then teacher_id
    const assignedTeacherId = classItem.assignedTeacherId ?? classItem.teacher_id;
    const assignedTeacher = assignedTeacherId
      ? teachers.find(teacher => String(teacher.id) === String(assignedTeacherId))
      : null;

    return {
      studentCount: studentsInClass.length,
      teacherName: assignedTeacher ? assignedTeacher.fullName : 'Not assigned',
      hasTeacher: !!assignedTeacher
    };
  };

  const handleDeleteClass = (classItem: any) => {
    const studentsInClass = students.filter(student => student.classAssigned === classItem.className);

    if (studentsInClass.length > 0) {
      toast({
        title: "Cannot Delete Class",
        description: `Cannot delete ${classItem.className} because it has ${studentsInClass.length} student(s) assigned.`,
        variant: "destructive"
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${classItem.className}?`)) {
      deleteClass.mutate(classItem.id);
    }
  };

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);

  const handleEditClass = (classItem: any) => {
    setSelectedClass(classItem);
    setShowEditDialog(true);
  };

  if (classes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Classes Found</h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first class. Classes help organize students by grade level and streams.
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" />
            Create First Class
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>All Classes ({filteredClasses.length})</span>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-sm">
              Total: {classes.length} classes
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
              placeholder="Search by class name, level, or stream..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-levels">All Levels</SelectItem>
                {uniqueLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Classes Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Assigned Teacher</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No classes found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((classItem) => {
                  const stats = getClassStats(classItem);
                  const capacityPercentage = (stats.studentCount / classItem.maxClassSize) * 100;

                  return (
                    <TableRow key={classItem.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {classItem.className}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{classItem.level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{classItem.stream}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{stats.studentCount}</span>
                          <span className="text-sm text-gray-500">
                            / {classItem.maxClassSize}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${capacityPercentage > 90 ? 'bg-red-500' :
                              capacityPercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                            style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                          ></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm ${stats.hasTeacher ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.teacherName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={capacityPercentage > 90 ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {Math.round(capacityPercentage)}% Full
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleEditClass(classItem)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClass(classItem)}
                          >
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
        {filteredClasses.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredClasses.length} of {classes.length} classes
          </div>
        )}
      </CardContent>
      {selectedClass && (
        <EditClassDialog
          classItem={selectedClass}
          open={showEditDialog}
          onClose={() => { setShowEditDialog(false); setSelectedClass(null); }}
          onSuccess={() => setShowEditDialog(false)}
        />
      )}
    </Card>
  );
};

export default ViewAllClasses;

