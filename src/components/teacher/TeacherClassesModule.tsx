
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { School, Users, Search, ClipboardCheck, BookOpen } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';

const TeacherClassesModule = () => {
  const { students, teachers, classes } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Find the current teacher's data
  const currentTeacher = teachers.find(t => t.email === user?.email);
  
  // Get teacher's assigned classes
  const teacherClasses = currentTeacher?.classAssigned 
    ? classes.filter(cls => cls.className === currentTeacher.classAssigned).map(cls => {
        const classStudents = students.filter(s => s.classAssigned === cls.className);
        return {
          id: cls.id,
          name: cls.className,
          grade: cls.level,
          subject: currentTeacher.subjectsTaught.join(', ') || 'General',
          students: classStudents.length,
          schedule: 'Mon, Wed, Fri - 08:00 AM', // You can enhance this with real schedule data
          room: `Room ${cls.id.padStart(3, '0')}`,
          term: 'Current Term'
        };
      })
    : [];

  const filteredClasses = teacherClasses.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!currentTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <School className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Profile Not Found</h3>
            <p className="text-gray-500">Your teacher profile is not set up. Please contact the administrator.</p>
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
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <School className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Classes</h1>
            <p className="text-gray-600">Manage your assigned classes</p>
          </div>
        </div>
      </div>

      {/* Teacher Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {currentTeacher.fullName.split(' ').map(n => n.charAt(0)).join('')}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{currentTeacher.fullName}</h3>
                <p className="text-sm text-gray-500">Staff ID: {currentTeacher.staffId}</p>
                <p className="text-sm text-gray-500">Subjects: {currentTeacher.subjectsTaught.join(', ') || 'None assigned'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Assigned Class:</p>
              <p className="text-lg font-bold text-gray-900">{currentTeacher.classAssigned || 'None'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      {teacherClasses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search classes by name, subject, or grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classes Grid */}
      {filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((cls) => (
            <Card key={cls.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <School className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <p className="text-sm text-gray-500">{cls.subject}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{cls.grade}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Students:</span>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1 text-gray-400" />
                      <span className="font-medium">{cls.students}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Schedule:</span>
                    <span className="font-medium text-xs">{cls.schedule}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Room:</span>
                    <span className="font-medium">{cls.room}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Term:</span>
                    <span className="font-medium">{cls.term}</span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-3 border-t">
                  <Button size="sm" className="flex-1">
                    <Users className="w-4 h-4 mr-1" />
                    Students
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <ClipboardCheck className="w-4 h-4 mr-1" />
                    Attendance
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <BookOpen className="w-4 h-4 mr-1" />
                    Grades
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <School className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {!currentTeacher.classAssigned ? 'No Classes Assigned' : 'No classes found'}
            </h3>
            <p className="text-gray-500">
              {!currentTeacher.classAssigned 
                ? 'You have not been assigned to any classes yet. Please contact the administrator.'
                : searchTerm 
                  ? 'Try adjusting your search terms.' 
                  : 'No classes match your current assignment.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherClassesModule;
