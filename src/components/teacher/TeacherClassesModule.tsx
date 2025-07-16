
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { School, Users, Search, ClipboardCheck, BookOpen } from 'lucide-react';

const TeacherClassesModule = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for teacher's classes
  const teacherClasses = [
    {
      id: '1',
      name: 'Mathematics Grade 5',
      grade: 'Grade 5',
      subject: 'Mathematics',
      students: 25,
      schedule: 'Mon, Wed, Fri - 08:00 AM',
      room: 'Room 101',
      term: 'Term 1 2024'
    },
    {
      id: '2',
      name: 'Science Grade 6',
      grade: 'Grade 6',
      subject: 'Science',
      students: 22,
      schedule: 'Tue, Thu - 10:00 AM',
      room: 'Room 203',
      term: 'Term 1 2024'
    },
    {
      id: '3',
      name: 'Mathematics Grade 6',
      grade: 'Grade 6',
      subject: 'Mathematics',
      students: 28,
      schedule: 'Mon, Wed, Fri - 02:00 PM',
      room: 'Room 101',
      term: 'Term 1 2024'
    }
  ];

  const filteredClasses = teacherClasses.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Search */}
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

      {/* Classes Grid */}
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

      {filteredClasses.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <School className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'No classes have been assigned to you yet.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeacherClassesModule;
