
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useStudents from '@/hooks/useStudents';
import { BookOpen, Edit3, Plus, Users } from 'lucide-react';
import { useState } from 'react';

const GradesModule = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [gradeValue, setGradeValue] = useState('');

  const { students: apiStudents } = useStudents();
  const { classes: apiClasses } = useClasses();

  // Normalize API shapes to the small shape used in this UI
  const normalizeStudent = (s: any) => ({
    id: s?.id ?? s?.studentId ?? s?._id ?? '',
    name: s?.firstName ? `${s.firstName} ${s?.lastName ?? ''}` : s?.fullName ?? s?.full_name ?? s?.name ?? 'Student',
    rollNo: s?.rollNo ?? s?.roll_no ?? s?.studentNumber ?? ''
  });

  const normalizeClass = (c: any) => ({
    id: c?.id ?? c?._id ?? c?.classId ?? '',
    name: c?.className ?? c?.class_name ?? c?.name ?? ''
  });

  const classesList = (apiClasses || []).map(normalizeClass);
  const studentsList = (apiStudents || []).map(normalizeStudent);

  const assignments = [
    { id: '1', name: 'Quiz 1', type: 'Quiz', maxScore: 100 },
    { id: '2', name: 'Midterm Exam', type: 'Exam', maxScore: 100 },
    { id: '3', name: 'Lab Report 1', type: 'Assignment', maxScore: 50 },
    { id: '4', name: 'Final Project', type: 'Project', maxScore: 100 }
  ];

  const [grades, setGrades] = useState<any[]>([]);

  const [isEditGradeOpen, setIsEditGradeOpen] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editSelectedStudent, setEditSelectedStudent] = useState('');
  const [editSelectedAssignment, setEditSelectedAssignment] = useState('');
  const [editGradeValue, setEditGradeValue] = useState('');

  const getLetterGrade = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 65) return 'D';
    return 'F';
  };

  const handleAddGrade = () => {
    if (!selectedStudent || !selectedAssignment || !gradeValue) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const assignment = assignments.find(a => a.id === selectedAssignment);
    const student = studentsList.find(s => s.id === selectedStudent);
    const score = parseFloat(gradeValue);
    const letterGrade = getLetterGrade(score, assignment?.maxScore || 100);

    toast({
      title: "Grade Added",
      description: `Grade ${letterGrade} (${score}/${assignment?.maxScore}) added for ${student?.name} - ${assignment?.name}`
    });

    setIsAddGradeOpen(false);
    setSelectedStudent('');
    setSelectedAssignment('');
    setGradeValue('');
  };

  const openEdit = (gradeId: string) => {
    const g = grades.find(x => x.id === gradeId);
    if (!g) return;
    setEditingGradeId(gradeId);
    setEditSelectedStudent(g.studentId);
    setEditSelectedAssignment(g.assignmentId);
    setEditGradeValue(String(g.score));
    setIsEditGradeOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingGradeId || !editSelectedStudent || !editSelectedAssignment || !editGradeValue) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    const assignment = assignments.find(a => a.id === editSelectedAssignment);
    const student = studentsList.find(s => s.id === editSelectedStudent);
    const score = parseFloat(editGradeValue);
    const letterGrade = getLetterGrade(score, assignment?.maxScore || 100);

    setGrades(prev => prev.map(g => g.id === editingGradeId
      ? {
        ...g,
        studentId: editSelectedStudent,
        studentName: student?.name || g.studentName,
        assignmentId: editSelectedAssignment,
        assignmentName: assignment?.name || g.assignmentName,
        score,
        maxScore: assignment?.maxScore || g.maxScore,
        grade: letterGrade
      }
      : g
    ));

    toast({
      title: 'Grade Updated',
      description: `Grade ${letterGrade} (${score}/${assignment?.maxScore}) updated for ${student?.name} - ${assignment?.name}`
    });

    setIsEditGradeOpen(false);
    setEditingGradeId(null);
    setEditSelectedStudent('');
    setEditSelectedAssignment('');
    setEditGradeValue('');
  };

  const filteredGrades = selectedClass && selectedAssignment
    ? grades.filter(g => g.assignmentId === selectedAssignment)
    : grades;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Grades</h1>
            <p className="text-gray-600">Manage student grades and assessments</p>
          </div>
        </div>
        <Dialog open={isAddGradeOpen} onOpenChange={setIsAddGradeOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Grade</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Grade</DialogTitle>
              <DialogDescription>Add a grade for a student and assignment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentsList.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} {student.rollNo ? `(${student.rollNo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment</Label>
                <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map(assignment => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.name} ({assignment.type}) - {assignment.maxScore} pts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Score</Label>
                <Input
                  type="number"
                  placeholder="Enter score"
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  max={assignments.find(a => a.id === selectedAssignment)?.maxScore || 100}
                />
              </div>
              <Button onClick={handleAddGrade} className="w-full">
                Add Grade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditGradeOpen} onOpenChange={setIsEditGradeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Grade</DialogTitle>
              <DialogDescription>Modify the selected grade information.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={editSelectedStudent} onValueChange={setEditSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentsList.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} {student.rollNo ? `(${student.rollNo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment</Label>
                <Select value={editSelectedAssignment} onValueChange={setEditSelectedAssignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map(assignment => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.name} ({assignment.type}) - {assignment.maxScore} pts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Score</Label>
                <Input
                  type="number"
                  placeholder="Enter score"
                  value={editGradeValue}
                  onChange={(e) => setEditGradeValue(e.target.value)}
                  max={assignments.find(a => a.id === editSelectedAssignment)?.maxScore || 100}
                />
              </div>
              <Button onClick={handleSaveEdit} className="w-full">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Grades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classesList.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignment</Label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map(assignment => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.name} ({assignment.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Student Grades</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredGrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3">Student</th>
                    <th className="text-left py-3">Assignment</th>
                    <th className="text-left py-3">Score</th>
                    <th className="text-left py-3">Percentage</th>
                    <th className="text-left py-3">Grade</th>
                    <th className="text-left py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.map(grade => (
                    <tr key={grade.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{grade.studentName}</p>
                        </div>
                      </td>
                      <td className="py-3">{grade.assignmentName}</td>
                      <td className="py-3">{grade.score}/{grade.maxScore}</td>
                      <td className="py-3">
                        {Math.round((grade.score / grade.maxScore) * 100)}%
                      </td>
                      <td className="py-3">
                        <Badge variant={
                          grade.grade.startsWith('A') ? 'default' :
                            grade.grade.startsWith('B') ? 'secondary' :
                              grade.grade.startsWith('C') ? 'outline' : 'destructive'
                        }>
                          {grade.grade}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button size="sm" variant="outline" onClick={() => openEdit(grade.id)}>
                          <Edit3 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No grades found</h3>
              <p className="text-gray-500">
                {selectedClass || selectedAssignment
                  ? 'No grades match your current filters.'
                  : 'Start by adding grades for your students.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GradesModule;
