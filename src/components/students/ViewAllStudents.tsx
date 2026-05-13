import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useData, type Student } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { useAudit } from '../../contexts/AuditContext';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  ChevronDown,
  FilterX,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveLogoUrl } from '../../services/tenantService';
import StudentDetailsDialog from './StudentDetailsDialog';
import EditStudentDialog from './EditStudentDialog';
import StudentQuickViewSheet from './StudentQuickViewSheet';
import {
  classBadgeClass,
  exportStudentsToCsv,
  normalizeEnrollmentStatus,
  statusBadgeClass,
  totalScheduledFeesForStudent,
} from './studentRegistryUtils';
import { cn } from '@/lib/utils';

const PAGE_SIZES = [10, 25, 50] as const;
type SortKey = 'name' | 'studentId' | 'class' | 'gender' | 'status';

type ViewAllStudentsProps = {
  onRequestPromoteStudent?: (studentId: string) => void;
};

function sortStudents(list: Student[], key: SortKey, dir: 'asc' | 'desc'): Student[] {
  const mul = dir === 'asc' ? 1 : -1;
  const cmp = (a: Student, b: Student): number => {
    switch (key) {
      case 'name': {
        const an = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bn = `${b.lastName} ${b.firstName}`.toLowerCase();
        return an < bn ? -1 * mul : an > bn ? 1 * mul : 0;
      }
      case 'studentId':
        return String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true }) * mul;
      case 'class':
        return (a.classAssigned || '').localeCompare(b.classAssigned || '') * mul;
      case 'gender':
        return (a.gender || '').localeCompare(b.gender || '') * mul;
      case 'status':
        return normalizeEnrollmentStatus(a.enrollmentStatus).localeCompare(normalizeEnrollmentStatus(b.enrollmentStatus)) * mul;
      default:
        return 0;
    }
  };
  return [...list].sort(cmp);
}

const ViewAllStudents: React.FC<ViewAllStudentsProps> = ({ onRequestPromoteStudent }) => {
  const { students, classes, deleteStudent, payments, feeStructures, loading } = useData();
  const { currentTerm } = useActiveTerm();
  const { addAuditLog } = useAudit();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterGender, setFilterGender] = useState('all-genders');
  const [filterStatus, setFilterStatus] = useState('all-status');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [quickViewStudent, setQuickViewStudent] = useState<Student | null>(null);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const termPayments = useMemo(() => {
    return (payments || []).filter((p) => {
      if (!currentTerm || currentTerm === 'Not Set') return true;
      const t = p.term || '';
      return t === currentTerm || t.includes(currentTerm) || currentTerm.includes(t);
    });
  }, [payments, currentTerm]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        q === '' ||
        student.firstName.toLowerCase().includes(q) ||
        student.lastName.toLowerCase().includes(q) ||
        String(student.studentId).toLowerCase().includes(q) ||
        (student.admissionNumber || '').toLowerCase().includes(q);
      const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;
      const matchesGender = filterGender === 'all-genders' || student.gender === filterGender;
      const st = normalizeEnrollmentStatus(student.enrollmentStatus);
      const matchesStatus = filterStatus === 'all-status' || st === filterStatus;
      return matchesSearch && matchesClass && matchesGender && matchesStatus;
    });
  }, [students, searchTerm, filterClass, filterGender, filterStatus]);

  const sortedStudents = useMemo(
    () => sortStudents(filteredStudents, sortKey, sortDir),
    [filteredStudents, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterClass, filterGender, filterStatus, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterClass('all-classes');
    setFilterGender('all-genders');
    setFilterStatus('all-status');
    setSortKey('name');
    setSortDir('asc');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePageAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) pageSlice.forEach((s) => next.add(s.id));
      else pageSlice.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  const pageAllSelected = pageSlice.length > 0 && pageSlice.every((s) => selected.has(s.id));
  const pageSomeSelected = pageSlice.some((s) => selected.has(s.id)) && !pageAllSelected;

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowDetailsDialog(true);
  };

  const handleEditStudent = (student: Student) => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Students',
      itemId: student.id,
      itemName: `${student.firstName} ${student.lastName}`,
    });
    setSelectedStudent(student);
    setShowEditDialog(true);
  };

  const openQuickView = (student: Student) => {
    setQuickViewStudent(student);
    setQuickSheetOpen(true);
  };

  const runDelete = async (student: Student): Promise<boolean> => {
    addAuditLog({
      actionType: 'Delete',
      module: 'Students',
      itemId: student.id,
      itemName: `${student.firstName} ${student.lastName}`,
    });
    try {
      await deleteStudent(student.id);
      toast({
        title: 'Student removed',
        description: `${student.firstName} ${student.lastName} was deleted.`,
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
      return true;
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete', variant: 'destructive' });
      return false;
    }
  };

  const confirmDeleteOne = (student: Student) => setDeleteTarget(student);

  const exportSelectedCsv = () => {
    const rows = students.filter((s) => selected.has(s.id));
    if (rows.length === 0) {
      toast({ title: 'Nothing selected', description: 'Select at least one student to export.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([exportStudentsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export ready', description: `${rows.length} student(s) exported.` });
  };

  const bulkPromote = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast({ title: 'Nothing selected', description: 'Select a student first.', variant: 'destructive' });
      return;
    }
    if (ids.length > 1) {
      toast({
        title: 'Promote individually',
        description: 'Jump to Promote with one selected student, or use class promotion for a whole class.',
      });
      return;
    }
    onRequestPromoteStudent?.(ids[0]);
    if (!onRequestPromoteStudent) {
      toast({ title: 'Promote', description: 'Open the Promote tab to move students to the next class.' });
    }
  };

  const runBulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      const st = students.find((s) => s.id === id);
      if (st) await runDelete(st);
    }
    setBulkDeleteOpen(false);
    setSelected(new Set());
  };

  const initialLoad = loading && students.length === 0;

  const totalFeesForDialog = useCallback(
    (st: Student | null) => {
      if (!st) return 0;
      return totalScheduledFeesForStudent(st, feeStructures, currentTerm);
    },
    [feeStructures, currentTerm]
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Student registry</h2>
              <p className="text-xs text-muted-foreground">
                {filteredStudents.length} of {students.length} students
                {searchTerm || filterClass !== 'all-classes' || filterGender !== 'all-genders' || filterStatus !== 'all-status'
                  ? ' · filters active'
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={selected.size === 0}>
                    Bulk actions
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportSelectedCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkPromote}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Go to promote (1)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => selected.size > 0 && setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete selected…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selected.size > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{selected.size} selected</span>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
            <div className="relative lg:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, student ID, admission…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 text-sm"
                aria-label="Search students"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="h-9 lg:col-span-2" aria-label="Filter by class">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-classes">All classes</SelectItem>
                {classes
                  .filter((cls) => cls.className && cls.className.trim() !== '')
                  .map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="h-9 lg:col-span-2" aria-label="Filter by gender">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-genders">All genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 lg:col-span-2" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Select
                value={sortKey}
                onValueChange={(v) => {
                  setSortKey(v as SortKey);
                  setSortDir('asc');
                }}
              >
                <SelectTrigger className="h-9 min-w-[8rem] flex-1" aria-label="Sort by">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="studentId">Student ID</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="gender">Gender</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                {sortDir === 'asc' ? 'Asc' : 'Desc'}
              </Button>
            </div>
            <div className="flex gap-2 lg:col-span-2 lg:justify-end">
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearFilters}>
                <FilterX className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[5.5rem]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          {initialLoad ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-md" />
              ))}
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No students match</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Try adjusting search or filters, or add students from the Add Student tab.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={clearFilters}>
                <FilterX className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          ) : (
            <>
              <div className="max-h-[min(70vh,560px)] max-w-[100vw] overflow-auto">
                <Table className="min-w-[720px] text-sm">
                  <TableHeader className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur-md">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-3">
                        <Checkbox
                          checked={pageAllSelected ? true : pageSomeSelected ? 'indeterminate' : false}
                          onCheckedChange={(v) => togglePageAll(!!v)}
                          aria-label="Select all on this page"
                        />
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-foreground"
                          onClick={() => toggleSort('name')}
                        >
                          Student
                          {sortKey === 'name' && <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-foreground"
                          onClick={() => toggleSort('studentId')}
                        >
                          Student ID
                          {sortKey === 'studentId' && <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-foreground"
                          onClick={() => toggleSort('class')}
                        >
                          Class / level
                          {sortKey === 'class' && <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-foreground"
                          onClick={() => toggleSort('gender')}
                        >
                          Gender
                          {sortKey === 'gender' && <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="min-w-[140px]">Contact</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-foreground"
                          onClick={() => toggleSort('status')}
                        >
                          Status
                          {sortKey === 'status' && <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="w-[120px] pr-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageSlice.map((student, idx) => {
                      const status = normalizeEnrollmentStatus(student.enrollmentStatus);
                      const rowTint = idx % 2 === 1 ? 'bg-muted/25' : '';
                      return (
                        <TableRow
                          key={student.id}
                          className={cn(
                            'group cursor-pointer border-border/60 transition-colors hover:bg-muted/50',
                            rowTint
                          )}
                          onClick={() => openQuickView(student)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openQuickView(student);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Open quick view for ${student.firstName} ${student.lastName}`}
                        >
                          <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(student.id)}
                              onCheckedChange={(v) => toggleOne(student.id, !!v)}
                              aria-label={`Select ${student.firstName} ${student.lastName}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3 py-0.5">
                              <Avatar className="h-9 w-9 rounded-lg border border-border/80 shadow-sm">
                                {student.passportPhotoUrl ? (
                                  <AvatarImage
                                    src={resolveLogoUrl(student.passportPhotoUrl) || undefined}
                                    alt=""
                                    className="object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="rounded-lg text-xs font-semibold">
                                  {student.firstName?.[0]}
                                  {student.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-medium leading-tight text-foreground">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  Adm. {student.admissionNumber || '—'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">{student.studentId}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('max-w-[160px] truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium', classBadgeClass(student.classAssigned))}
                              title={student.classAssigned}
                            >
                              {student.classAssigned || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{student.gender || '—'}</TableCell>
                          <TableCell>
                            <div className="max-w-[180px]">
                              <p className="truncate text-xs font-medium text-foreground">{student.guardianName || '—'}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">{student.guardianContact || '—'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize', statusBadgeClass(status))}
                            >
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md text-muted-foreground transition-transform hover:scale-105 hover:bg-muted hover:text-foreground"
                                    onClick={() => handleViewStudent(student)}
                                    aria-label="Full profile"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Full profile</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md text-muted-foreground transition-transform hover:scale-105 hover:bg-muted hover:text-foreground"
                                    onClick={() => handleEditStudent(student)}
                                    aria-label="Edit student"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md text-muted-foreground transition-transform hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => confirmDeleteOne(student)}
                                    aria-label="Delete student"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p className="tabular-nums">
                  Page {safePage} of {totalPages} · Showing {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, sortedStudents.length)} of {sortedStudents.length}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <StudentDetailsDialog
        student={selectedStudent}
        open={showDetailsDialog}
        onClose={() => {
          setShowDetailsDialog(false);
          setSelectedStudent(null);
        }}
        payments={termPayments as any}
        totalFeesForStudent={totalFeesForDialog(selectedStudent)}
      />

      <EditStudentDialog
        student={selectedStudent}
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedStudent(null);
        }}
      />

      <StudentQuickViewSheet
        student={quickViewStudent}
        open={quickSheetOpen}
        onOpenChange={(o) => {
          setQuickSheetOpen(o);
          if (!o) setQuickViewStudent(null);
        }}
        payments={termPayments as any}
        currentTerm={currentTerm}
        feeStructures={feeStructures}
        onEdit={(st) => {
          setQuickSheetOpen(false);
          setQuickViewStudent(null);
          handleEditStudent(st);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : ''}
              </span>{' '}
              and their records from this school. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await runDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} students?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected students will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void runBulkDelete()}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default ViewAllStudents;
