import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useData } from '../../contexts/DataContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useAudit } from '../../contexts/AuditContext';
import { Search, Edit, Users, Eye, FileDown, FileSpreadsheet, ChevronDown, ChevronRight, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import { teacherStatusBadge } from './TeacherStatusModals';
import type { Teacher } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import TeacherDetailsDialog from './TeacherDetailsDialog';
import EditTeacherDialog from './EditTeacherDialog';
import { resolveLogoUrl } from '@/services/tenantService';
import { downloadTeacherRosterPdf } from '@/utils/buildStaffRosterPdf';
import { downloadTeacherRosterExcel } from '@/utils/buildStaffRosterExcel';
import { apiService } from '@/services/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ViewAllTeachers = () => {
  const { teachers, classes, refresh } = useData();
  const { school } = useSchool();
  const { addAuditLog } = useAudit();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [detachConfirmTeacher, setDetachConfirmTeacher] = useState<Teacher | null>(null);

  const assistantsByParent = useMemo(() => {
    const map = new Map<string, Teacher[]>();
    teachers.forEach((t) => {
      if (!t.parentTeacherId) return;
      const list = map.get(t.parentTeacherId) || [];
      list.push(t);
      map.set(t.parentTeacherId, list);
    });
    return map;
  }, [teachers]);

  const matchesSearch = (teacher: Teacher) =>
    searchTerm === '' ||
    teacher.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.department || '').toLowerCase().includes(searchTerm.toLowerCase());

  const matchesClass = (teacher: Teacher) =>
    filterClass === 'all-classes' ||
    (filterClass === 'no-class' ? !teacher.classAssigned : teacher.classAssigned === filterClass);

  const matchesGender = (teacher: Teacher) => {
    if (genderFilter === 'all') return true;
    return (teacher.gender || '').trim().toLowerCase() === genderFilter;
  };

  const filteredTeachers = useMemo(() => {
    if (filterStatus === 'deactivated') {
      return teachers.filter((teacher) => {
        const status = teacher.status || 'active';
        return status === 'deactivated' && matchesSearch(teacher) && matchesClass(teacher) && matchesGender(teacher);
      });
    }
    return teachers.filter((teacher) => {
      if (teacher.parentTeacherId) return false;
      const status = teacher.status || 'active';
      const matchesStatus = filterStatus === 'all' || filterStatus === status;
      return matchesSearch(teacher) && matchesStatus && matchesClass(teacher) && matchesGender(teacher);
    });
  }, [teachers, filterStatus, searchTerm, filterClass, genderFilter]);

  const handleDetachAssistant = async (teacher: Teacher) => {
    setDetachingId(teacher.id);
    try {
      await apiService.post(`/teachers/${teacher.id}/detach-assistant`, {});
      toast({
        title: 'Assistant detached',
        description: `${teacher.fullName} is now a main teacher.`,
      });
      await refresh(['teachers']);
      setDetachConfirmTeacher(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: 'Detach failed',
        description: err?.message || 'Could not detach assistant.',
        variant: 'destructive',
      });
    } finally {
      setDetachingId(null);
    }
  };

  const toggleExpanded = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const renderTeacherRow = (teacher: Teacher, opts?: { isAssistant?: boolean }) => {
    const isAssistant = !!opts?.isAssistant;
    const status = teacher.status || 'active';
    const badge = teacherStatusBadge(status);
    const dimmed = status !== 'active';
    const assistants = assistantsByParent.get(teacher.id) || [];
    const visibleAssistants =
      filterStatus === 'deactivated'
        ? []
        : assistants.filter((a) => {
            const st = a.status || 'active';
            return (filterStatus === 'all' || filterStatus === st) && matchesGender(a);
          });
    const hasAssistants = !isAssistant && visibleAssistants.length > 0;
    const expanded = expandedParents.has(teacher.id);

    return (
      <React.Fragment key={teacher.id}>
        <TableRow className={`hover:bg-muted/40 ${dimmed ? 'opacity-70' : ''}`}>
          <TableCell className="w-7 max-w-7 px-0.5 pl-2 pr-0">
            <Checkbox
              checked={selected.has(teacher.id)}
              onCheckedChange={() => toggleSelect(teacher.id)}
              aria-label={`Select ${teacher.fullName}`}
            />
          </TableCell>
          <TableCell className="w-5 max-w-5 px-0">
            {!isAssistant && hasAssistants ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleExpanded(teacher.id)}
                title={expanded ? 'Collapse assistants' : 'Show assistants'}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            ) : null}
          </TableCell>
          <TableCell className="w-10 px-0.5 text-center">
            <LazyTeacherAvatar
              teacherId={teacher.id}
              fullName={teacher.fullName}
              hasPassportPhoto={teacher.hasPassportPhoto}
              className={isAssistant ? 'h-7 w-7 mx-auto' : 'h-8 w-8 mx-auto'}
            />
          </TableCell>
          <TableCell className="py-2 px-2">
            <div className={cn(isAssistant && 'pl-3 border-l-2 border-emerald-400 dark:border-emerald-600 ml-0.5')}>
              <div className="font-medium text-foreground flex items-center gap-1.5 leading-snug text-sm whitespace-nowrap">
                <span>{teacher.fullName}</span>
                {isAssistant ? (
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wide px-1 py-0 shrink-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/40">
                    Assistant
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{teacher.gender}</div>
            </div>
          </TableCell>
          <TableCell className="py-2 px-1.5 whitespace-nowrap">
            <span className="font-mono text-xs">{teacher.staffId}</span>
          </TableCell>
          <TableCell className="py-2 px-1.5 whitespace-nowrap">
            {teacher.position ? (
              <Badge variant="secondary" className="text-xs font-normal">{teacher.position}</Badge>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </TableCell>
          <TableCell className="py-2 px-1.5 whitespace-nowrap">
            {teacher.monthlySalary > 0 ? (
              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                GHS {teacher.monthlySalary.toLocaleString()}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </TableCell>
          <TableCell className="py-2 px-2 whitespace-nowrap">
            <div className="text-xs leading-snug">
              <div className="font-medium text-foreground">{teacher.phoneNumber || '—'}</div>
              {teacher.email ? (
                <div className="text-muted-foreground">{teacher.email}</div>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="py-2 px-1.5 whitespace-nowrap">
            {teacher.classAssigned ? (
              <Badge variant="outline" className="text-xs font-normal">{teacher.classAssigned}</Badge>
            ) : (
              <span className="text-muted-foreground text-xs">No class</span>
            )}
          </TableCell>
          <TableCell className="py-2 px-1.5 whitespace-nowrap">
            {badge ? (
              <Badge className={badge.className}>{badge.label}</Badge>
            ) : (
              <Badge className={getStatusColor(status)}>ACTIVE</Badge>
            )}
          </TableCell>
          <TableCell className="py-2 pr-2.5 pl-0.5 text-right whitespace-nowrap">
            <div className="flex justify-end items-center gap-1">
              {isAssistant ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetachConfirmTeacher(teacher)}
                  disabled={detachingId === teacher.id}
                  className="h-7 w-7 p-0"
                  title="Detach — become main teacher"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewTeacher(teacher)}
                className="h-7 w-7 p-0"
                title="View teacher"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEditTeacher(teacher)}
                className="h-7 w-7 p-0"
                title="Edit teacher"
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {!isAssistant && expanded
          ? visibleAssistants.map((a) => renderTeacherRow(a, { isAssistant: true }))
          : null}
      </React.Fragment>
    );
  };

  const getStatusColor = (status: string) => {
    const badge = teacherStatusBadge(status);
    return badge?.className || 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
  };

  const handleViewTeacher = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailsDialog(true);
  };

  const handleEditTeacher = (teacher: Teacher) => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Teachers',
      itemId: teacher.id,
      itemName: teacher.fullName,
    });
    setSelectedTeacher(teacher);
    setShowEditDialog(true);
  };

  const allFilteredSelected = filteredTeachers.length > 0 && filteredTeachers.every((t) => selected.has(t.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredTeachers.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredTeachers.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = () =>
    selected.size > 0 ? filteredTeachers.filter((t) => selected.has(t.id)) : filteredTeachers;

  const mapTeacherRows = (rows: typeof filteredTeachers) =>
    rows.map((t) => ({
      fullName: t.fullName,
      staffId: t.staffId,
      classes: t.classAssigned || '—',
      department: t.department || '—',
      salary: Number(t.monthlySalary) || 0,
      phone: t.phoneNumber || '',
      email: t.email || '',
    }));

  const exportPdf = async () => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No teachers match the current filters.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      await downloadTeacherRosterPdf({
        schoolName: school?.name || 'School',
        logoUrl: resolveLogoUrl(school?.logo_url ?? null),
        teachers: mapTeacherRows(rows),
      });
      toast({ title: 'PDF exported', description: `${rows.length} teacher(s) exported.` });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Export failed', description: err?.message || 'Could not generate PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No teachers match the current filters.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      await downloadTeacherRosterExcel(mapTeacherRows(rows));
      toast({ title: 'CSV exported', description: `${rows.length} teacher(s) exported.` });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Export failed', description: err?.message || 'Could not generate CSV file.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30 py-3 px-3.5 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center space-x-2 shrink-0 text-base sm:text-lg">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>All Teachers ({filteredTeachers.length})</span>
            </CardTitle>
            <div className="relative w-full sm:w-72 md:w-80 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, staff ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background text-sm rounded-lg"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3.5 px-2.5 sm:px-3.5">
          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-wrap mb-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32 sm:w-36 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All main</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-36 sm:w-44 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  <SelectItem value="no-class">No Class Assigned</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-24 sm:w-28 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={exporting || filteredTeachers.length === 0}
                onClick={() => void exportPdf()}
              >
                <FileDown className="h-4 w-4" />
                Export PDF{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={exporting || filteredTeachers.length === 0}
                onClick={() => void exportExcel()}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-7 max-w-7 px-0.5 pl-2 pr-0">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all teachers" />
                  </TableHead>
                  <TableHead className="w-5 max-w-5 px-0" />
                  <TableHead className="w-10 px-0.5 text-center whitespace-nowrap">Photo</TableHead>
                  <TableHead className="whitespace-nowrap px-2">Name</TableHead>
                  <TableHead className="whitespace-nowrap px-1.5">Staff ID</TableHead>
                  <TableHead className="whitespace-nowrap px-1.5">Position</TableHead>
                  <TableHead className="whitespace-nowrap px-1.5">Salary</TableHead>
                  <TableHead className="whitespace-nowrap px-2">Contact</TableHead>
                  <TableHead className="whitespace-nowrap px-1.5">Class Assigned</TableHead>
                  <TableHead className="whitespace-nowrap px-1.5">Status</TableHead>
                  <TableHead className="w-16 pr-2.5 pl-0.5 whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No teachers found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => renderTeacherRow(teacher))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          {filteredTeachers.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!detachConfirmTeacher}
        onOpenChange={(open) => {
          if (!open) setDetachConfirmTeacher(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach assistant?</AlertDialogTitle>
            <AlertDialogDescription>
              {detachConfirmTeacher ? (
                <>
                  <strong>{detachConfirmTeacher.fullName}</strong> will no longer be an assistant and will
                  appear as a main teacher in the list. Their login and teaching access stay the same.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!detachingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (detachConfirmTeacher) void handleDetachAssistant(detachConfirmTeacher);
              }}
              disabled={!!detachingId}
            >
              {detachingId ? 'Detaching…' : 'Yes, detach'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeacherDetailsDialog
        teacher={selectedTeacher}
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
      />

      <EditTeacherDialog
        teacher={selectedTeacher}
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedTeacher(null);
        }}
      />

    </>
  );
};

export default ViewAllTeachers;
