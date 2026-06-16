import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Search, MapPin, UserCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AssignStudentsModalProps {
  route: {
    id: string;
    name: string;
    stops: Array<{ id: string; name: string }>;
  } | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSelectedStudentId?: string | null;
}

export const AssignStudentsModal: React.FC<AssignStudentsModalProps> = ({
  route,
  open,
  onClose,
  onSuccess,
  initialSelectedStudentId,
}) => {
  const { students } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStops, setSelectedStops] = useState<Record<string, string>>({}); // studentId -> stopId
  const [saving, setSaving] = useState(false);

  // Get active students only
  const activeStudents = useMemo(() => {
    return students.filter(s => (s.enrollmentStatus || 'active').toLowerCase() === 'active');
  }, [students]);

  // Extract unique classes for filter
  const classesList = useMemo(() => {
    const cls = new Set<string>();
    activeStudents.forEach(s => {
      if (s.classAssigned) cls.add(s.classAssigned);
    });
    return Array.from(cls).sort();
  }, [activeStudents]);

  // Filter students based on search and class selection
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      const matchSearch =
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchClass = selectedClass === 'all' || s.classAssigned === selectedClass;
      
      // If initialSelectedStudentId is provided, force include that student if matched, or focus on it
      if (initialSelectedStudentId && s.id === initialSelectedStudentId) {
        return true;
      }

      return matchSearch && matchClass;
    });
  }, [activeStudents, searchTerm, selectedClass, initialSelectedStudentId]);

  const handleStopSelect = (studentId: string, stopId: string) => {
    setSelectedStops(prev => ({
      ...prev,
      [studentId]: stopId,
    }));
  };

  const handleSave = async (studentId: string) => {
    const stopId = selectedStops[studentId];
    if (!stopId || !route) {
      toast({
        title: 'Selection required',
        description: 'Please select a route stop to enroll this student.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await apiService.post('/transport/students/enroll', {
        student_id: parseInt(studentId, 10),
        route_id: route.id,
        stop_id: stopId,
      });

      toast({
        title: 'Student Enrolled',
        description: 'Student has been assigned to transport route stop successfully.',
      });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Enrollment Failed',
        description: err?.message || 'Failed to enroll student in transport.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!route) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Assign Students to Route: <span className="text-indigo-600">{route.name}</span></DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students by name, ID, or admission number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classesList.map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[30%]">Student Name</TableHead>
                  <TableHead className="w-[20%]">Class</TableHead>
                  <TableHead className="w-[35%]">Select Route Stop</TableHead>
                  <TableHead className="w-[15%] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-slate-400" />
                        <p>No active students matching criteria found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map(student => {
                    const chosenStopId = selectedStops[student.id] || '';
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{student.firstName} {student.lastName}</div>
                          <div className="text-[11px] text-slate-500">{student.studentId} • ADM: {student.admissionNumber}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 font-medium">
                            {student.classAssigned || 'No Class'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {route.stops.length === 0 ? (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" /> No stops configured on this route yet.
                            </span>
                          ) : (
                            <Select
                              value={chosenStopId}
                              onValueChange={val => handleStopSelect(student.id, val)}
                            >
                              <SelectTrigger className="h-9 w-full max-w-xs">
                                <SelectValue placeholder="Choose a stop..." />
                              </SelectTrigger>
                              <SelectContent>
                                {route.stops.map(stop => (
                                  <SelectItem key={stop.id} value={stop.id}>
                                    {stop.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="primaryAction"
                            size="sm"
                            disabled={!chosenStopId || saving}
                            onClick={() => handleSave(student.id)}
                            className="h-8 gap-1"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogBody>

        <DialogFooter className="px-6 py-4 border-t gap-2 bg-slate-50">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
