import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, Users, Trash2, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


const ViewAllClasses = () => {
  const { classes, students, teachers, deleteClass } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all-levels');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const uniqueLevels = useMemo(
    () => [...new Set(classes.map((c) => c.level).filter((level) => level && level.trim() !== ''))],
    [classes]
  );

  const filteredClasses = useMemo(() => {
    return classes.filter((classItem) => {
      // Be resilient to backend/mapper differences (class_name vs name, etc.)
      const className = (classItem.className || (classItem as any).name || '').toString();
      const level = (classItem.level || '').toString();
      const stream = (classItem.stream || '').toString();

      if (!className || className.trim() === '') return false;

      const matchesSearch =
        searchTerm === '' ||
        className.toLowerCase().includes(searchTerm.toLowerCase()) ||
        level.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stream.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel = filterLevel === 'all-levels' || level === filterLevel;

      return matchesSearch && matchesLevel;
    });
  }, [classes, searchTerm, filterLevel]);

  const getResolvedClassName = (classItem: any) =>
    (classItem.className || classItem.name || '').toString();

  const getClassStats = (classItem: any) => {
    const className = getResolvedClassName(classItem);
    const assignedTeacherId =
      classItem.assignedTeacherId ?? (classItem as any).assigned_teacher_id;

    const studentsInClass = students.filter((student) => student.classAssigned === className);
    const assignedTeacher = assignedTeacherId
      ? teachers.find((t) => String(t.id) === String(assignedTeacherId))
      : null;

    return {
      className,
      studentCount: studentsInClass.length,
      teacherName: assignedTeacher ? assignedTeacher.fullName : 'Not assigned',
      hasTeacher: !!assignedTeacher,
    };
  };

  const handleDeleteClass = async (classItem: any) => {
    const className = getResolvedClassName(classItem);
    const studentsInClass = students.filter((student) => student.classAssigned === className);

    if (studentsInClass.length > 0) {
      toast({
        title: 'Cannot Delete Class',
        description: `Cannot delete ${className} because it has ${studentsInClass.length} student(s) assigned.`,
        variant: 'destructive',
      });
      return;
    }

    await deleteClass(classItem.id);
    toast({
      title: 'Class Deleted',
      description: `${className} has been deleted successfully.`,
    });
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
                  const capacityPercentage =
                    classItem.maxClassSize > 0
                      ? (stats.studentCount / classItem.maxClassSize) * 100
                      : 0;

                  const isExpanded = expandedClassId === String(classItem.id);
                  const resolvedClassName = stats.className;

                  return (
                    <React.Fragment key={classItem.id}>
                      <TableRow
                        onClick={() =>
                          setExpandedClassId((prev) =>
                            prev === String(classItem.id) ? null : String(classItem.id)
                          )
                        }
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="font-medium text-gray-900">{resolvedClassName}</div>
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
                            <span className="text-sm text-gray-500">/ {classItem.maxClassSize}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                capacityPercentage > 90
                                  ? 'bg-red-500'
                                  : capacityPercentage > 75
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                            />
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
                          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Class</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {resolvedClassName}? 
                                    {getClassStats(classItem).studentCount > 0
                                      ? `This class has ${getClassStats(classItem).studentCount} student(s) assigned.`
                                      : 'This action cannot be undone.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleDeleteClass(classItem)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${classItem.id}-expanded`} className="bg-gray-50">
                          <TableCell colSpan={7}>
                            <div className="p-4">
                              <div className="font-semibold mb-3 flex items-center justify-between">
                                <span>Class Details</span>
                                <span className="text-sm text-gray-500">{resolvedClassName}</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded border bg-white p-3">
                                  <div className="text-xs text-gray-500">Level</div>
                                  <div className="font-medium">{classItem.level}</div>
                                </div>
                                <div className="rounded border bg-white p-3">
                                  <div className="text-xs text-gray-500">Stream</div>
                                  <div className="font-medium">{classItem.stream}</div>
                                </div>
                                <div className="rounded border bg-white p-3">
                                  <div className="text-xs text-gray-500">Capacity</div>
                                  <div className="font-medium">
                                    {stats.studentCount} / {classItem.maxClassSize}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4">
                                <div className="text-sm font-semibold mb-2">Students in this class</div>
                                <div className="rounded border overflow-hidden bg-white">
                                  <table className="w-full text-left">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-xs text-gray-600">Student ID</th>
                                        <th className="px-3 py-2 text-xs text-gray-600">Name</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {students
                                        .filter((s) => s.classAssigned === resolvedClassName)
                                        .map((s) => (
                                          <tr key={s.id} className="border-t last:border-b">
                                            <td className="px-3 py-2 text-sm">{s.studentId}</td>
                                            <td className="px-3 py-2 text-sm">
                                              {s.firstName} {s.lastName}
                                            </td>
                                          </tr>
                                        ))}

                                      {students.filter((s) => s.classAssigned === resolvedClassName).length === 0 && (
                                        <tr>
                                          <td colSpan={2} className="px-3 py-3 text-sm text-gray-500">
                                            No students assigned
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
    </Card>
  );
};

export default ViewAllClasses;

