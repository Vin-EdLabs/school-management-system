
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { ClipboardCheck, Calendar, Users, Save } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';

const AttendanceModule = () => {
  const { students, teachers, classes } = useData();
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  // Find the current teacher's assigned classes
  const currentTeacher = teachers.find(t => t.email === user?.email);
  const teacherClasses = currentTeacher?.classAssigned 
    ? classes.filter(cls => cls.className === currentTeacher.classAssigned)
    : [];

  // Get students for the selected class
  const selectedClassData = classes.find(cls => cls.id === selectedClass);
  const classStudents = selectedClassData 
    ? students.filter(student => student.classAssigned === selectedClassData.className)
    : [];

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
    const totalStudents = classStudents.length;

    // Here you would save to backend or local storage
    toast({
      title: "Attendance Saved",
      description: `Attendance for ${selectedDate} saved successfully. ${presentCount}/${totalStudents} students present.`
    });
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    classStudents.forEach(student => {
      allPresent[student.id] = true;
    });
    setAttendance(allPresent);
  };

  const handleMarkAllAbsent = () => {
    const allAbsent: Record<string, boolean> = {};
    classStudents.forEach(student => {
      allAbsent[student.id] = false;
    });
    setAttendance(allAbsent);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const totalStudents = classStudents.length;
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  if (!currentTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Not Found</h3>
            <p className="text-gray-500">You must be logged in as a teacher to access attendance.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentTeacher.classAssigned) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Class Assigned</h3>
            <p className="text-gray-500">You don't have any classes assigned yet. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                  {teacherClasses.map(cls => {
                    const studentCount = students.filter(s => s.classAssigned === cls.className).length;
                    return (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className} ({studentCount} students)
                      </SelectItem>
                    );
                  })}
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
              {classStudents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
                  <p className="text-gray-500">No students are assigned to this class yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classStudents.map(student => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {student.admissionNumber?.slice(-3) || student.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                          <p className="text-sm text-gray-500">Admission: {student.admissionNumber}</p>
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
              )}
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
