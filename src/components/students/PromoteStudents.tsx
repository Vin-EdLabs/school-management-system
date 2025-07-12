
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { TrendingUp, Users, User } from 'lucide-react';

const PromoteStudents = () => {
  const { students, classes, promoteStudent, promoteClass } = useData();
  const [promotionType, setPromotionType] = useState<'individual' | 'class'>('individual');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCurrentClass, setSelectedCurrentClass] = useState('');
  const [selectedNewClass, setSelectedNewClass] = useState('');

  const handleIndividualPromotion = () => {
    if (!selectedStudent || !selectedNewClass) {
      toast({
        title: "Validation Error",
        description: "Please select both student and new class",
        variant: "destructive"
      });
      return;
    }

    const student = students.find(s => s.id === selectedStudent);
    if (!student) return;

    promoteStudent(selectedStudent, selectedNewClass);
    
    toast({
      title: "Student Promoted",
      description: `${student.firstName} ${student.lastName} has been promoted to ${selectedNewClass}`,
    });

    // Reset form
    setSelectedStudent('');
    setSelectedNewClass('');
  };

  const handleClassPromotion = () => {
    if (!selectedCurrentClass || !selectedNewClass) {
      toast({
        title: "Validation Error",
        description: "Please select both current class and new class",
        variant: "destructive"
      });
      return;
    }

    const studentsInClass = students.filter(s => s.classAssigned === selectedCurrentClass);
    
    if (studentsInClass.length === 0) {
      toast({
        title: "No Students Found",
        description: `No students found in ${selectedCurrentClass}`,
        variant: "destructive"
      });
      return;
    }

    promoteClass(selectedCurrentClass, selectedNewClass);
    
    toast({
      title: "Class Promoted",
      description: `All ${studentsInClass.length} students from ${selectedCurrentClass} have been promoted to ${selectedNewClass}`,
    });

    // Reset form
    setSelectedCurrentClass('');
    setSelectedNewClass('');
  };

  const getStudentsInClass = (className: string) => {
    return students.filter(s => s.classAssigned === className);
  };

  return (
    <div className="space-y-6">
      {/* Promotion Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Student Promotion</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <Button
              variant={promotionType === 'individual' ? 'default' : 'outline'}
              onClick={() => setPromotionType('individual')}
              className="flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Individual Student</span>
            </Button>
            <Button
              variant={promotionType === 'class' ? 'default' : 'outline'}
              onClick={() => setPromotionType('class')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Entire Class</span>
            </Button>
          </div>

          {promotionType === 'individual' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.firstName} {student.lastName} - {student.classAssigned}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Promote to Class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedStudent && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Selected Student:</strong> {students.find(s => s.id === selectedStudent)?.firstName} {students.find(s => s.id === selectedStudent)?.lastName}
                  </p>
                  <p className="text-sm text-blue-600">
                    Current Class: {students.find(s => s.id === selectedStudent)?.classAssigned}
                  </p>
                </div>
              )}

              <Button onClick={handleIndividualPromotion} className="w-full md:w-auto">
                Promote Student
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Class</Label>
                  <Select value={selectedCurrentClass} onValueChange={setSelectedCurrentClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select current class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className} ({getStudentsInClass(cls.className).length} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Promote to Class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCurrentClass && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">
                    <strong>Students to be promoted from {selectedCurrentClass}:</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getStudentsInClass(selectedCurrentClass).map((student) => (
                      <Badge key={student.id} variant="outline" className="text-green-700">
                        {student.firstName} {student.lastName}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-green-600 mt-2">
                    Total: {getStudentsInClass(selectedCurrentClass).length} students
                  </p>
                </div>
              )}

              <Button onClick={handleClassPromotion} className="w-full md:w-auto">
                Promote Entire Class
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Class Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const studentsInClass = getStudentsInClass(cls.className);
              return (
                <div key={cls.id} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-lg">{cls.className}</h3>
                  <p className="text-sm text-gray-600">{cls.level}</p>
                  <div className="mt-2">
                    <Badge variant="outline">
                      {studentsInClass.length} students
                    </Badge>
                  </div>
                  {studentsInClass.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {studentsInClass.slice(0, 3).map((student) => (
                        <p key={student.id} className="text-xs text-gray-500">
                          {student.firstName} {student.lastName}
                        </p>
                      ))}
                      {studentsInClass.length > 3 && (
                        <p className="text-xs text-gray-400">
                          +{studentsInClass.length - 3} more...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PromoteStudents;
