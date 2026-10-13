import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { apiService } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Search,
  MapPin,
  Bus,
  User,
  UserPlus,
  UserX,
  ArrowRight,
  Filter,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface RouteStop {
  id: string;
  name: string;
}

interface Route {
  id: string;
  name: string;
  stops: RouteStop[];
}

interface TransportStudent {
  id: number;
  first_name: string;
  last_name: string;
  passport_photo_url: string | null;
  class_name: string | null;
  level: string | null;
  student_transport_id: string;
  enrolled_at: string;
  transport_status: 'active' | 'inactive';
  route_name: string;
  route_id: string;
  stop_name: string;
  stop_id: string;
  vehicle_plate: string | null;
  vehicle_name: string | null;
  driver_name: string | null;
}

export const TransportStudents: React.FC = () => {
  const { students: allStudentsList } = useData(); // Context for all active students

  const [enrolledStudents, setEnrolledStudents] = useState<TransportStudent[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [viewTab, setViewTab] = useState<'enrolled' | 'unassigned'>('enrolled');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  // Enrollment Dialog state
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [enrollRouteId, setEnrollRouteId] = useState('');
  const [enrollStopId, setEnrollStopId] = useState('');
  const [savingEnrollment, setSavingEnrollment] = useState(false);

  // Removal state
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<TransportStudent | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsData, routesData] = await Promise.all([
        apiService.get<TransportStudent[]>('/transport/students'),
        apiService.get<Route[]>('/transport/routes'),
      ]);
      setEnrolledStudents(studentsData);
      setRoutes(routesData);
    } catch (err) {
      console.error('Failed to load transport students data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load transport student list.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Filter routes stop list based on selected enroll route
  const currentEnrollStops = useMemo(() => {
    if (!enrollRouteId) return [];
    const route = routes.find(r => r.id === enrollRouteId);
    return route ? route.stops : [];
  }, [enrollRouteId, routes]);

  // Extract unique classes for filtering
  const classesList = useMemo(() => {
    const cls = new Set<string>();
    allStudentsList.forEach(s => {
      if (s.classAssigned) cls.add(s.classAssigned);
    });
    return Array.from(cls).sort();
  }, [allStudentsList]);

  // Filtered enrolled students list
  const filteredEnrolled = useMemo(() => {
    return enrolledStudents.filter(s => {
      const matchSearch =
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toString().includes(searchTerm);
      const matchRoute = filterRoute === 'all' || s.route_id === filterRoute;
      const matchClass = filterClass === 'all' || s.class_name === filterClass;
      return matchSearch && matchRoute && matchClass;
    });
  }, [enrolledStudents, searchTerm, filterRoute, filterClass]);

  // Filtered unassigned students list
  const filteredUnassigned = useMemo(() => {
    // Get list of active students who are NOT currently in the enrolled list
    const enrolledIds = new Set(enrolledStudents.map(e => e.id));
    const activeUnassigned = allStudentsList.filter(
      s => (s.enrollmentStatus || 'active').toLowerCase() === 'active' && !enrolledIds.has(parseInt(s.id, 10))
    );

    return activeUnassigned.filter(s => {
      const matchSearch =
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = filterClass === 'all' || s.classAssigned === filterClass;
      return matchSearch && matchClass;
    });
  }, [enrolledStudents, allStudentsList, searchTerm, filterClass]);

  // Handle opening Quick Enroll
  const handleOpenEnroll = (studentId: number, name: string, currentRouteId?: string, currentStopId?: string) => {
    setSelectedStudentId(studentId);
    setSelectedStudentName(name);
    setEnrollRouteId(currentRouteId || '');
    setEnrollStopId(currentStopId || '');
    setEnrollDialogOpen(true);
  };

  // Submit Enrollment
  const handleConfirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !enrollRouteId || !enrollStopId) {
      toast({
        title: 'Validation Required',
        description: 'Please select a route and stop to enroll student.',
        variant: 'destructive',
      });
      return;
    }

    setSavingEnrollment(true);
    try {
      await apiService.post('/transport/students/enroll', {
        student_id: selectedStudentId,
        route_id: enrollRouteId,
        stop_id: enrollStopId,
      });

      toast({
        title: 'Enrollment Confirmed',
        description: `Student "${selectedStudentName}" enrolled in transport.`,
      });
      setEnrollDialogOpen(false);
      void loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Enrollment Failed',
        description: err?.message || 'Failed to enroll student.',
        variant: 'destructive',
      });
    } finally {
      setSavingEnrollment(false);
    }
  };

  // Handle opening Remove Confirm
  const handleOpenRemove = (s: TransportStudent) => {
    setStudentToRemove(s);
    setRemoveConfirmOpen(true);
  };

  // Submit Removal
  const handleConfirmRemove = async () => {
    if (!studentToRemove) return;
    setRemoving(true);
    try {
      await apiService.post('/transport/students/remove', {
        student_id: studentToRemove.id,
        route_id: studentToRemove.route_id,
      });

      toast({
        title: 'Student Removed',
        description: `Student "${studentToRemove.first_name} ${studentToRemove.last_name}" removed from transport route.`,
      });
      setRemoveConfirmOpen(false);
      setStudentToRemove(null);
      void loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Removal Failed',
        description: err?.message || 'Failed to remove student from route.',
        variant: 'destructive',
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white">Rider Roster</h1>
          <p className="mt-1 text-sm text-slate-500">Manage student route mapping, track designated stops, and review fleet occupancy.</p>
        </div>
      </div>

      {/* Tabs Selector & Search Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/40 p-2.5 rounded-2xl border border-slate-200/60 backdrop-blur">
        <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit">
          <Button
            type="button"
            variant={viewTab === 'enrolled' ? 'primaryAction' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewTab('enrolled');
              setSearchTerm('');
            }}
            className="rounded-lg text-xs h-8 font-semibold"
          >
            Enrolled Students ({enrolledStudents.length})
          </Button>
          <Button
            type="button"
            variant={viewTab === 'unassigned' ? 'primaryAction' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewTab('unassigned');
              setSearchTerm('');
            }}
            className="rounded-lg text-xs h-8 font-semibold"
          >
            Not Enrolled ({filteredUnassigned.length + (viewTab === 'unassigned' ? 0 : 0)} Active)
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8.5 h-8.5 text-xs rounded-xl"
            />
          </div>

          <div className="w-40">
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="h-8.5 text-xs rounded-xl">
                <SelectValue placeholder="Filter by Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classesList.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {viewTab === 'enrolled' && (
            <div className="w-44">
              <Select value={filterRoute} onValueChange={setFilterRoute}>
                <SelectTrigger className="h-8.5 text-xs rounded-xl">
                  <SelectValue placeholder="Filter by Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {routes.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Table Card */}
      <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 space-y-4">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-20 w-full rounded" />
              <Skeleton className="h-20 w-full rounded" />
            </div>
          ) : viewTab === 'enrolled' ? (
            // Enrolled Students List
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Rider Info</TableHead>
                    <TableHead className="font-semibold text-slate-700">Class</TableHead>
                    <TableHead className="font-semibold text-slate-700">Assigned Route & Stop</TableHead>
                    <TableHead className="font-semibold text-slate-700">Bus & Driver Duty</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrolled.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-10 w-10 text-slate-300" />
                          <p className="font-semibold text-slate-600">No transport riders found</p>
                          <p className="text-xs text-slate-400">Try adjusting your filters or enroll a new student.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEnrolled.map(student => (
                      <TableRow key={student.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border bg-slate-50 flex items-center justify-center">
                              {student.passport_photo_url ? (
                                <img src={student.passport_photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-4.5 w-4.5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{student.first_name} {student.last_name}</div>
                              <span className="text-[10px] text-slate-400 font-mono block">Rider ID: {student.id}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200/60 font-semibold text-xs">
                            {student.class_name || 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-xs block">{student.route_name}</span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                              {student.stop_name || 'No Stop Configured'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.vehicle_name ? (
                            <div className="space-y-0.5">
                              <span className="text-xs text-slate-700 flex items-center gap-1 font-medium">
                                <Bus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                {student.vehicle_name} ({student.vehicle_plate})
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 block">
                                <User className="h-3 w-3 shrink-0" />
                                Driver: {student.driver_name || '—'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Bus/Driver assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEnroll(student.id, `${student.first_name} ${student.last_name}`, student.route_id, student.stop_id)}
                              className="h-8 text-xs font-semibold hover:bg-slate-100 text-slate-600 rounded-lg gap-1 border border-transparent hover:border-slate-200"
                            >
                              Edit Stop
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenRemove(student)}
                              className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100"
                              title="Remove from Route"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Unassigned Students List
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Student Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Class Assigned</TableHead>
                    <TableHead className="font-semibold text-slate-700">Enrollment Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnassigned.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-48 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle className="h-10 w-10 text-emerald-400" />
                          <p className="font-semibold text-slate-600">All active students are enrolled</p>
                          <p className="text-xs text-slate-400">Great! No active student is currently unassigned from transport.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUnassigned.map(student => (
                      <TableRow key={student.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-slate-800">{student.firstName} {student.lastName}</div>
                            <span className="text-[10px] text-slate-400 block font-mono">ID: {student.studentId} • ADM: {student.admissionNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200/60 font-semibold text-xs">
                            {student.classAssigned || 'No Class'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200/50 capitalize text-[10px] font-bold">
                            {student.enrollmentStatus || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="primaryAction"
                            size="sm"
                            onClick={() => handleOpenEnroll(parseInt(student.id, 10), `${student.firstName} ${student.lastName}`)}
                            className="h-8 text-xs font-semibold rounded-lg gap-1.5"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Enroll Student
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enroll Student Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4 pr-12 text-left">
            <DialogTitle>Enroll student in transport</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Assign <span className="font-medium text-foreground">{selectedStudentName}</span> to a route and pickup stop.
            </p>
          </DialogHeader>

          <form onSubmit={handleConfirmEnroll} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <Bus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">Route &amp; stop</p>
                    <p className="mt-1 leading-6 text-slate-700">
                      Choose the route this student rides and the stop where they board or alight.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="routeSelect">Transport route *</Label>
                {routes.length === 0 ? (
                  <p className="text-xs text-amber-600 font-semibold">No active routes registered. Please configure routes first.</p>
                ) : (
                  <Select value={enrollRouteId} onValueChange={val => {
                    setEnrollRouteId(val);
                    setEnrollStopId('');
                  }}>
                    <SelectTrigger id="routeSelect">
                      <SelectValue placeholder="Choose a route..." />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {enrollRouteId && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <Label htmlFor="stopSelect">Designated stop *</Label>
                  {currentEnrollStops.length === 0 ? (
                    <p className="text-xs text-amber-600 font-semibold">No stops placed on this route yet.</p>
                  ) : (
                    <Select value={enrollStopId} onValueChange={setEnrollStopId}>
                      <SelectTrigger id="stopSelect">
                        <SelectValue placeholder="Choose a stop..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currentEnrollStops.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </DialogBody>

            <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEnrollDialogOpen(false)}
                disabled={savingEnrollment}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primaryAction"
                disabled={savingEnrollment || !enrollRouteId || !enrollStopId}
              >
                {savingEnrollment ? 'Enrolling...' : 'Confirm enrollment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Rider Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <UserX className="h-5 w-5" /> Cancel transport enrollment
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2 overflow-y-auto px-6 py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-800">"{studentToRemove?.first_name} {studentToRemove?.last_name}"</span> from the route <span className="font-bold text-slate-800">"{studentToRemove?.route_name}"</span>?
            </p>
            <p className="text-xs text-slate-400">
              The student will no longer be assigned to this route or stop. They can be re-enrolled at any time.
            </p>
          </DialogBody>
          <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveConfirmOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={removing}
            >
              {removing ? 'Removing...' : 'Confirm remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportStudents;
