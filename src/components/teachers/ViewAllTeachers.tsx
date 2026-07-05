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
          <TableCell className="w-8 max-w-8 px-1 pl-3 pr-0">
            <Checkbox
              checked={selected.has(teacher.id)}
              onCheckedChange={() => toggleSelect(teacher.id)}
              aria-label={`Select ${teacher.fullName}`}
            />
          </TableCell>
          <TableCell className="w-7 max-w-7 px-0 pr-0">
            {!isAssistant && hasAssistants ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => toggleExpanded(teacher.id)}
                title={expanded ? 'Collapse assistants' : 'Show assistants'}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : null}
          </TableCell>
          <TableCell>
            <LazyTeacherAvatar
              teacherId={teacher.id}
              fullName={teacher.fullName}
              hasPassportPhoto={teacher.hasPassportPhoto}
            />
          </TableCell>
          <TableCell>
            <div className={isAssistant ? 'pl-6 border-l-2 border-emerald-200 dark:border-emerald-800' : ''}>
              <div className="font-medium flex flex-wrap items-center gap-2">
                {teacher.fullName}
                {isAssistant ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Assistant
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">{teacher.gender}</div>
            </div>
          </TableCell>
          <TableCell>
            <span className="font-mono">{teacher.staffId}</span>
          </TableCell>
          <TableCell>
            {teacher.position ? (
              <Badge variant="secondary" className="text-xs">{teacher.position}</Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </TableCell>
          <TableCell>
            <div className="text-sm">
              <div>{teacher.phoneNumber}</div>
              <div className="text-muted-foreground">{teacher.email}</div>
            </div>
          </TableCell>
          <TableCell>
            {teacher.classAssigned ? (
              <Badge variant="outline">{teacher.classAssigned}</Badge>
            ) : (
              <span className="text-muted-foreground">No class</span>
            )}
          </TableCell>
          <TableCell>
            {badge ? (
              <Badge className={badge.className}>{badge.label}</Badge>
            ) : (
              <Badge className={getStatusColor(status)}>ACTIVE</Badge>
            )}
          </TableCell>
          <TableCell className="pr-2">
            {teacher.monthlySalary > 0 ? (
              <span className="font-mono">GHS {teacher.monthlySalary.toLocaleString()}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
          <TableCell className="sticky right-0 z-10 w-[1%] pl-1 pr-2 bg-card/95 text-right backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex justify-end items-center gap-0.5">
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
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>All Teachers ({filteredTeachers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, staff ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting || filteredTeachers.length === 0}
                onClick={() => void exportPdf()}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting || filteredTeachers.length === 0}
                onClick={() => void exportExcel()}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All main</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-48">
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
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 max-w-8 px-1 pl-3 pr-0">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all teachers" />
                  </TableHead>
                  <TableHead className="w-7 max-w-7 px-0 pr-0" />
                  <TableHead className="w-14 whitespace-nowrap">Photo</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                  <TableHead className="whitespace-nowrap">Position</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Class Assigned</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap pr-2">Salary</TableHead>
                  <TableHead className="sticky right-0 z-10 w-[1%] pl-1 pr-2 whitespace-nowrap bg-card/95 text-right backdrop-blur supports-[backdrop-filter]:bg-card/80">Actions</TableHead>
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
