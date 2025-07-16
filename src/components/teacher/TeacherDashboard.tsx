
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { School, Users, ClipboardCheck, BookOpen, Calendar, Clock } from 'lucide-react';

const TeacherDashboard = () => {
  const { user } = useAuth();

  // Mock data for teacher's classes
  const teacherClasses = [
    { id: '1', name: 'Mathematics Grade 5', students: 25, time: '08:00 AM', room: 'Room 101' },
    { id: '2', name: 'Science Grade 6', students: 22, time: '10:00 AM', room: 'Room 203' },
    { id: '3', name: 'Mathematics Grade 6', students: 28, time: '02:00 PM', room: 'Room 101' }
  ];

  const todayAttendance = [
    { class: 'Mathematics Grade 5', present: 23, total: 25, percentage: 92 },
    { class: 'Science Grade 6', present: 20, total: 22, percentage: 91 },
    { class: 'Mathematics Grade 6', present: 26, total: 28, percentage: 93 }
  ];

  const recentGrades = [
    { student: 'Alice Johnson', class: 'Mathematics Grade 5', assignment: 'Quiz 1', grade: 'A' },
    { student: 'Bob Smith', class: 'Science Grade 6', assignment: 'Lab Report', grade: 'B+' },
    { student: 'Carol Davis', class: 'Mathematics Grade 6', assignment: 'Test 1', grade: 'A-' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Welcome back, Teacher!</h1>
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
                <p className="text-3xl font-bold text-gray-900">
                  {teacherClasses.reduce((sum, cls) => sum + cls.students, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Attendance</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round(todayAttendance.reduce((sum, att) => sum + att.percentage, 0) / todayAttendance.length)}%
                </p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Grades</p>
                <p className="text-3xl font-bold text-gray-900">12</p>
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
              <span>Today's Classes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teacherClasses.map((cls) => (
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
          </CardContent>
        </Card>

        {/* Attendance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5" />
              <span>Today's Attendance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAttendance.map((att, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{att.class}</span>
                    <Badge variant={att.percentage >= 90 ? "default" : "secondary"}>
                      {att.percentage}%
                    </Badge>
                  </div>
                  <div className="flex text-sm text-gray-600">
                    <span>{att.present} present out of {att.total} students</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${att.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Grades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>Recent Grades Entered</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Student</th>
                  <th className="text-left py-2">Class</th>
                  <th className="text-left py-2">Assignment</th>
                  <th className="text-left py-2">Grade</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentGrades.map((grade, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{grade.student}</td>
                    <td className="py-2">{grade.class}</td>
                    <td className="py-2">{grade.assignment}</td>
                    <td className="py-2">
                      <Badge variant="outline">{grade.grade}</Badge>
                    </td>
                    <td className="py-2 text-gray-500">Today</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDashboard;
