
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, Edit, Trash2, Eye, Users, GraduationCap, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ViewAllClasses = () => {
  const { classes, students, teachers, deleteClass } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  console.log('ViewAllClasses: classes data:', classes);
  console.log('ViewAllClasses: classes length:', classes.length);

  const levels = ['KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JHS 1', 'JHS 2', 'JHS 3'];

  // Filter classes based on search and filters
  const filteredClasses = classes.filter(cls => {
    // Ensure cls and cls.className exist
    if (!cls || !cls.className) {
      console.log('ViewAllClasses: Filtering out class with missing data:', cls);
      return false;
    }

    const matchesSearch = searchTerm === '' || 
      cls.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.stream && cls.stream.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLevel = filterLevel === '' || cls.level === filterLevel;

    return matchesSearch && matchesLevel;
  });

  console.log('ViewAllClasses: filtered classes:', filteredClasses);

  const handleDeleteClass = (classId: string, className: string) => {
    const studentsInClass = students.filter(student => student.classAssigned === className);
    
    if (studentsInClass.length > 0) {
      toast({
        title: "Cannot Delete Class",
        description: `${className} has ${studentsInClass.length} students assigned. Please reassign students first.`,
        variant: "destructive"
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${className}? This action cannot be undone.`)) {
      deleteClass(classId);
      toast({
        title: "Class Deleted",
        description: `${className} has been removed from the system`,
      });
    }
  };

  const getStudentCount = (className: string) => {
    return students.filter(student => student.classAssigned === className).length;
  };

  const getAssignedTeacher = (teacherId?: string) => {
    if (!teacherId) return null;
    return teachers.find(teacher => teacher.id === teacherId);
  };

  // If no classes exist at all, show a different message
  if (classes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Classes (0)</span>
            <Badge variant="outline" className="text-sm">
              Total: 0 classes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-500 mb-6">
              You haven't created any classes yet. Start by creating your first class.
            </p>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create First Class</span>
            </Button>
          </div>
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
                <SelectItem value="">All Levels</SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Match Your Search</h3>
              <p className="text-gray-500">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
            </div>
          ) : (
            filteredClasses.map((cls) => {
              const studentCount = getStudentCount(cls.className);
              const assignedTeacher = getAssignedTeacher(cls.assignedTeacher);
              const utilization = cls.maxClassSize ? Math.round((studentCount / cls.maxClassSize) * 100) : 0;

              return (
                <Card key={cls.id} className="relative hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-800">
                          {cls.className}
                        </CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline">{cls.level}</Badge>
                          {cls.stream && (
                            <Badge variant="secondary">{cls.stream}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClass(cls.id, cls.className)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Student Count */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Students</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{studentCount}</span>
                        {cls.maxClassSize && (
                          <span className="text-gray-500">/{cls.maxClassSize}</span>
                        )}
                      </div>
                    </div>

                    {/* Class Utilization */}
                    {cls.maxClassSize && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Capacity</span>
                          <span className="text-gray-800">{utilization}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              utilization >= 90 ? 'bg-red-500' :
                              utilization >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Assigned Teacher */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <GraduationCap className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Class Teacher</span>
                      </div>
                      <div className="text-right">
                        {assignedTeacher ? (
                          <span className="text-sm font-medium text-gray-800">
                            {assignedTeacher.fullName}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Not assigned</span>
                        )}
                      </div>
                    </div>

                    {/* Status Indicators */}
                    <div className="flex justify-between items-center pt-2 text-xs">
                      <div className="flex space-x-2">
                        {studentCount === 0 && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Empty
                          </Badge>
                        )}
                        {utilization >= 90 && (
                          <Badge variant="outline" className="text-red-600 border-red-300">
                            Full
                          </Badge>
                        )}
                        {!assignedTeacher && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                            No Teacher
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Summary */}
        {filteredClasses.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Total Classes</p>
                <p className="text-lg font-semibold">{classes.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-lg font-semibold">
                  {classes.reduce((sum, cls) => sum + getStudentCount(cls.className), 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned Teachers</p>
                <p className="text-lg font-semibold">
                  {classes.filter(cls => cls.assignedTeacher).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Class Size</p>
                <p className="text-lg font-semibold">
                  {classes.length > 0 
                    ? Math.round(classes.reduce((sum, cls) => sum + getStudentCount(cls.className), 0) / classes.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewAllClasses;
