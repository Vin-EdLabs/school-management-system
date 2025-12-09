import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import usePromotions from '@/hooks/usePromotions';
import { ArrowRight, Users } from 'lucide-react';
import { useState } from 'react';

const AssignStudentsToClass = () => {
  const { students, classes, promoteClassMutation, promoteStudentMutation, classIdToName } = usePromotions();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  // default to showing only unassigned students
  const [filterCurrentClass, setFilterCurrentClass] = useState('unassigned');

  const handleStudentSelect = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
    }
  };

  const handleAssignStudents = () => {
    if (!selectedClass || selectedStudents.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select both class and students",
        variant: "destructive"
      });
      return;
    }

    const targetClass = classes.find(c => c.id === selectedClass);
    if (!targetClass) {
      toast({
        title: "Error",
        description: "Selected class not found",
        variant: "destructive"
      });
      return;
    }

    const currentStudentsInClass = students.filter(s => s.classAssigned === targetClass.className).length;
    const newTotal = currentStudentsInClass + selectedStudents.length;

    if (targetClass.maxClassSize && newTotal > targetClass.maxClassSize) {
      toast({
        title: "Class Capacity Exceeded",
        description: `This would exceed the class capacity of ${targetClass.maxClassSize} students`,
        variant: "destructive"
      });
      return;
    }

    // prepare batch updates: set class_id for each selected student
    const updates = selectedStudents.map(sid => ({ id: Number(sid), class_id: Number(selectedClass) }));
    promoteClassMutation.mutate(updates);

    toast({
      title: "Students Assigned Successfully",
      description: `${selectedStudents.length} students have been assigned to ${targetClass.className}`,
    });

    setSelectedStudents([]);
    setSelectedClass('');
  };

  const filteredStudents = students.filter(student => {
    if (filterCurrentClass === 'all') return true;
    if (filterCurrentClass === 'unassigned') return !student.classAssigned;
    return student.classAssigned === filterCurrentClass;
  });

  const getStudentCount = (className: string) => {
    return students.filter(student => student.classAssigned === className).length;
  };

  const availableClasses = classes.filter(cls => cls.className);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Assign Students to Class</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target class" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses
                      .filter(cls => cls.id && cls.className)
                      .map((cls) => {
                        const currentCount = getStudentCount(cls.className);
                        const capacity = cls.maxClassSize ? ` (${currentCount}/${cls.maxClassSize})` : ` (${currentCount})`;
                        return (
                          <SelectItem key={cls.id} value={String(cls.id)}>
                            {cls.className}{capacity}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter Students by Current Class</Label>
                <Select value={filterCurrentClass} onValueChange={setFilterCurrentClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All students</SelectItem>
                    <SelectItem value="unassigned">Unassigned students</SelectItem>
                    {availableClasses
                      .filter(cls => cls.className)
                      .map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className} ({getStudentCount(cls.className)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedClass && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Target Class:</strong> {availableClasses.find(c => c.id === selectedClass)?.className}
                </p>
                <p className="text-sm text-blue-600">
                  Selected Students: {selectedStudents.length}
                </p>
              </div>
            )}

            <Button
              onClick={handleAssignStudents}
              className="w-full md:w-auto"
              disabled={!selectedClass || selectedStudents.length === 0}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Assign {selectedStudents.length} Students
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Students ({filteredStudents.length} available)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No students found for the selected filter
              </p>
            ) : (
              filteredStudents.map((student) => (
                <div key={student.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={(checked) => handleStudentSelect(student.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          ID: {student.studentId} | Admission: {student.admissionNumber || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={student.gender === 'Male' ? 'default' : 'secondary'} className="text-xs mb-1">
                          {student.gender}
                        </Badge>
                        <div>
                          {student.classAssigned ? (
                            <Badge variant="outline">{student.classAssigned}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableClasses.map((cls) => {
              const studentCount = getStudentCount(cls.className);
              const utilization = cls.maxClassSize ? Math.round((studentCount / cls.maxClassSize) * 100) : 0;

              return (
                <div key={cls.id} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-lg">{cls.className}</h3>
                  <p className="text-sm text-gray-600">
                    {cls.level} {cls.stream ? `- ${cls.stream}` : ''}
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Students:</span>
                      <Badge variant="outline">
                        {studentCount}{cls.maxClassSize ? `/${cls.maxClassSize}` : ''}
                      </Badge>
                    </div>
                    {cls.maxClassSize && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Capacity</span>
                          <span>{utilization}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${utilization >= 90 ? 'bg-red-500' :
                              utilization >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignStudentsToClass;
