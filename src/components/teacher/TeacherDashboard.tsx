
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { School, Users, ClipboardCheck, BookOpen, Calendar, Clock } from 'lucide-react';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { students, teachers, classes } = useData();

  // Find the current teacher's data
  const currentTeacher = teachers.find(t => t.email === user?.email);
  
  // Get teacher's assigned classes and students
  const teacherClasses = currentTeacher?.classAssigned 
    ? classes.filter(cls => cls.className === currentTeacher.classAssigned)
    : [];

  const teacherStudents = currentTeacher?.classAssigned
    ? students.filter(student => student.classAssigned === currentTeacher.classAssigned)
    : [];

  // Mock today's schedule based on teacher's classes (you can enhance this with real schedule data)
  const todaySchedule = teacherClasses.map((cls, index) => ({
    id: cls.id,
    name: cls.className,
    students: students.filter(s => s.classAssigned === cls.className).length,
    time: ['08:00 AM', '10:00 AM', '02:00 PM'][index] || '09:00 AM',
    room: `Room ${101 + index}`
  }));

  if (!currentTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Profile Not Found</h3>
            <p className="text-gray-500">Your teacher profile is not set up. Please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Welcome back, {currentTeacher.fullName}!</h1>
            <p className="text-gray-600">Here's your teaching overview for today</p>
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">My Classes</p>
                <p className="text-3xl font-bold text-gray-900">{teacherClasses.length}</p>
              </div>
              <School className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{teacherStudents.length}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subjects</p>
                <p className="text-3xl font-bold text-gray-900">{currentTeacher.subjectsTaught.length}</p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Staff ID</p>
                <p className="text-xl font-bold text-gray-900">{currentTeacher.staffId}</p>
              </div>
              <BookOpen className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>My Classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySchedule.length === 0 ? (
              <div className="text-center py-8">
                <School className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Assigned</h3>
                <p className="text-gray-500">You don't have any classes assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todaySchedule.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{cls.name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {cls.time}
                        </span>
                        <span>{cls.room}</span>
                        <span>{cls.students} students</span>
                      </div>
                    </div>
                    <Button size="sm">View Class</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teacher Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Teacher Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Full Name:</span>
                <span className="text-sm text-gray-900">{currentTeacher.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Staff ID:</span>
                <span className="text-sm text-gray-900">{currentTeacher.staffId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Email:</span>
                <span className="text-sm text-gray-900">{currentTeacher.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Phone:</span>
                <span className="text-sm text-gray-900">{currentTeacher.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Class Assigned:</span>
                <span className="text-sm text-gray-900">{currentTeacher.classAssigned || 'None'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Subjects:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTeacher.subjectsTaught.length > 0 ? (
                    currentTeacher.subjectsTaught.map((subject, index) => (
                      <Badge key={index} variant="outline">{subject}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No subjects assigned</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Overview */}
      {teacherStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>My Students ({teacherStudents.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherStudents.slice(0, 6).map((student) => (
                <div key={student.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                    <p className="text-sm text-gray-500">{student.admissionNumber}</p>
                  </div>
                </div>
              ))}
            </div>
            {teacherStudents.length > 6 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  View All Students ({teacherStudents.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherDashboard;
