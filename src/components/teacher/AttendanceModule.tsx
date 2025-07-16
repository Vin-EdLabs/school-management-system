
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { ClipboardCheck, Calendar, Users, Save } from 'lucide-react';

const AttendanceModule = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  // Mock data
  const teacherClasses = [
    { id: '1', name: 'Mathematics Grade 5', students: 25 },
    { id: '2', name: 'Science Grade 6', students: 22 },
    { id: '3', name: 'Mathematics Grade 6', students: 28 }
  ];

  const students = [
    { id: '1', name: 'Alice Johnson', rollNo: '001' },
    { id: '2', name: 'Bob Smith', rollNo: '002' },
    { id: '3', name: 'Carol Davis', rollNo: '003' },
    { id: '4', name: 'David Wilson', rollNo: '004' },
    { id: '5', name: 'Eva Brown', rollNo: '005' },
    { id: '6', name: 'Frank Miller', rollNo: '006' },
    { id: '7', name: 'Grace Lee', rollNo: '007' },
    { id: '8', name: 'Henry Taylor', rollNo: '008' }
  ];

  const handleAttendanceChange = (studentId: string, present: boolean) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: present
    }));
  };

  const handleSaveAttendance = () => {
    if (!selectedClass) {
      toast({
        title: "Please select a class",
        variant: "destructive"
      });
      return;
    }

    const presentCount = Object.values(attendance).filter(Boolean).length;
    const totalStudents = students.length;

    toast({
      title: "Attendance Saved",
      description: `Attendance for ${selectedDate} saved successfully. ${presentCount}/${totalStudents} students present.`
    });
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    students.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendance(allPresent);
  };

  const handleMarkAllAbsent = () => {
    const allAbsent: Record<string, boolean> = {};
    students.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendance(allAbsent);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const totalStudents = students.length;
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Attendance</h1>
            <p className="text-gray-600">Take and manage student attendance</p>
          </div>
        </div>
      </div>

      {/* Class and Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Select Class & Date</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.students} students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          {/* Attendance Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium">
                      {presentCount} / {totalStudents} Present
                    </span>
                  </div>
                  <Badge variant={attendancePercentage >= 90 ? "default" : attendancePercentage >= 80 ? "secondary" : "destructive"}>
                    {attendancePercentage}%
                  </Badge>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={handleMarkAllPresent}>
                    Mark All Present
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleMarkAllAbsent}>
                    Mark All Absent
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Student Attendance</span>
                <Button onClick={handleSaveAttendance} className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Attendance</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {students.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {student.rollNo}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">Roll No: {student.rollNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`present-${student.id}`}
                          checked={attendance[student.id] === true}
                          onCheckedChange={(checked) => handleAttendanceChange(student.id, checked as boolean)}
                        />
                        <label 
                          htmlFor={`present-${student.id}`}
                          className="text-sm font-medium text-green-600 cursor-pointer"
                        >
                          Present
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`absent-${student.id}`}
                          checked={attendance[student.id] === false}
                          onCheckedChange={(checked) => handleAttendanceChange(student.id, !(checked as boolean))}
                        />
                        <label 
                          htmlFor={`absent-${student.id}`}
                          className="text-sm font-medium text-red-600 cursor-pointer"
                        >
                          Absent
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedClass && (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Class</h3>
            <p className="text-gray-500">Choose a class from the dropdown above to take attendance.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceModule;
