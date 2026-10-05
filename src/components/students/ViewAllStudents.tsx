import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
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
import { apiService } from '@/services/api';
import { useData, type Student } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { useAudit } from '../../contexts/AuditContext';
import { useSchool } from '../../contexts/SchoolContext';
import { resolveLogoUrl } from '../../services/tenantService';
import {
  Search,
  Eye,
  Pencil,
  UserX,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  ChevronDown,
  FilterX,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import LazyStudentAvatar from './LazyStudentAvatar';
import StudentDetailsDialog from './StudentDetailsDialog';
import EditStudentDialog from './EditStudentDialog';
import StudentQuickViewSheet from './StudentQuickViewSheet';
import {
  classBadgeClass,
  exportStudentsToCsv,
  normalizeEnrollmentStatus,
  enrollmentStatusLabel,
  isAlumniStudent,
  statusBadgeClass,
  totalScheduledFeesForStudent,
} from './studentRegistryUtils';
import { mapStudent } from '@/utils/studentMappers';
import { cn } from '@/lib/utils';
import { inferTermBounds, normalizeDateOnly } from '@/utils/inferTermBounds';

const PAGE_SIZES = [10, 25, 50] as const;
type SortKey = 'name' | 'studentId' | 'class' | 'gender' | 'status';

function studentDateAdded(student: Student): string {
  return student.createdAt || student.dateOfAdmission || '';
}

function studentInactivatedDate(student: Student): string {
  return student.inactivatedAt || student.updatedAt || student.createdAt || '';
}

type AcademicTermOption = {
  id: number;
  termName: string;
  year: string;
  startDate: string;
  endDate: string;
  label: string;
};

type ViewAllStudentsProps = {
  onRequestPromoteStudent?: (studentId: string) => void;
  /** active = main registry; inactive = archived students with preserved records */
  variant?: 'active' | 'inactive';
  readOnly?: boolean;
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

const ViewAllStudents: React.FC<ViewAllStudentsProps> = ({ onRequestPromoteStudent, variant = 'active', readOnly = false }) => {
  const { students, classes, setStudentStatus, payments, feeStructures, loading, refresh } = useData();
  const { currentTerm, activeAcademicTermId } = useActiveTerm();
  const { addAuditLog } = useAudit();
  const { school } = useSchool();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterGender, setFilterGender] = useState('all-genders');
  const [filterDiscount, setFilterDiscount] = useState<'all-discounts' | 'discounted' | 'full-discount' | 'partial-discount' | 'no-discount'>('all-discounts');
  const [academicTerms, setAcademicTerms] = useState<AcademicTermOption[]>([]);
  const [selectedAcademicTermId, setSelectedAcademicTermId] = useState<string>('all-terms');
  const [showRecentAdmissions, setShowRecentAdmissions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [quickViewStudent, setQuickViewStudent] = useState<Student | null>(null);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);

  const [inactiveTarget, setInactiveTarget] = useState<Student | null>(null);
  const [inactiveTermId, setInactiveTermId] = useState('');
  const [reactivateTarget, setReactivateTarget] = useState<Student | null>(null);
  const [termInactiveStudents, setTermInactiveStudents] = useState<Student[] | null>(null);
  const [termInactiveLoading, setTermInactiveLoading] = useState(false);

  const isInactiveView = variant === 'inactive';

  const loadInactiveStudents = useCallback(async (termId: string, terms: AcademicTermOption[]) => {
    if (termId === 'all-terms') {
      const rows = await apiService.get<Record<string, unknown>[]>('/students?status=inactive');
      return (Array.isArray(rows) ? rows : []).map(mapStudent);
    }

    const term = terms.find((t) => String(t.id) === termId);
    if (!term) return [];

    // Same term window + API as Academic Reports → students-left-list (proven working path)
    const inferred = inferTermBounds(term.termName, term.year);
    const termStart = normalizeDateOnly(term.startDate) || inferred.start;
    const termEnd = normalizeDateOnly(term.endDate) || inferred.end;
    const params = new URLSearchParams({
      termStart,
      termEnd,
      termName: term.termName,
      year: term.year,
      month: 'all',
    });
    if (term.id) params.set('termId', String(term.id));

    const rows = await apiService.get<Record<string, unknown>[]>(
      `/reports/academic/students-left-list?${params.toString()}`
    );

    return (Array.isArray(rows) ? rows : []).map((row) =>
      mapStudent({
        ...row,
        inactivated_at: row.left_date ?? row.inactivated_at,
        enrollment_status: row.enrollment_status ?? 'inactive',
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void apiService
      .get<Array<{ id: number; term_name: string; year: string; start_date?: string | null; end_date?: string | null }>>(
        '/settings/academic-terms?include_archived=true'
      )
      .then((rows) => {
        if (cancelled) return;
        const next = (Array.isArray(rows) ? rows : [])
          .map((row) => ({
            id: Number(row.id),
            termName: String(row.term_name || '').trim(),
            year: String(row.year || '').trim(),
            startDate: String(row.start_date || ''),
            endDate: String(row.end_date || ''),
            label: `${String(row.term_name || '').trim()} ${String(row.year || '').trim()}`.trim(),
          }))
          .filter((row) => row.id > 0 && row.label);
        setAcademicTerms(next);
        if (!isInactiveView && activeAcademicTermId && next.some((term) => term.id === activeAcademicTermId)) {
          setSelectedAcademicTermId(String(activeAcademicTermId));
        }
      })
      .catch(() => {
        if (!cancelled) setAcademicTerms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAcademicTermId, isInactiveView]);

  useEffect(() => {
    if (!isInactiveView) {
      setTermInactiveStudents(null);
      setTermInactiveLoading(false);
      return;
    }
    if (selectedAcademicTermId !== 'all-terms' && academicTerms.length === 0) {
      return;
    }
    let cancelled = false;
    setTermInactiveLoading(true);
    void loadInactiveStudents(selectedAcademicTermId, academicTerms)
      .then((mapped) => {
        if (!cancelled) setTermInactiveStudents(mapped);
      })
      .catch(() => {
        if (!cancelled) setTermInactiveStudents([]);
      })
      .finally(() => {
        if (!cancelled) setTermInactiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isInactiveView, selectedAcademicTermId, loadInactiveStudents, academicTerms]);

  const refetchInactiveStudents = useCallback(async () => {
    if (!isInactiveView) return;
    setTermInactiveLoading(true);
    try {
      const mapped = await loadInactiveStudents(selectedAcademicTermId, academicTerms);
      setTermInactiveStudents(mapped);
    } catch {
      setTermInactiveStudents([]);
    } finally {
      setTermInactiveLoading(false);
    }
  }, [isInactiveView, selectedAcademicTermId, loadInactiveStudents, academicTerms]);

  const selectedAcademicTerm = useMemo(
    () => academicTerms.find((term) => String(term.id) === selectedAcademicTermId) || null,
    [academicTerms, selectedAcademicTermId]
  );

  const isDateWithinTerm = useCallback((value: string | undefined, term: AcademicTermOption | null) => {
    if (!value || !term) return false;
    const dateOnly = value.split('T')[0];
    const start = term.startDate ? term.startDate.split('T')[0] : '';
    const end = term.endDate ? term.endDate.split('T')[0] : '';
    if (start && dateOnly < start) return false;
    if (end && dateOnly > end) return false;
    return true;
  }, []);

  const matchesAdmissionTerm = useCallback((student: Student, term: AcademicTermOption | null) => {
    if (!term) return true;
    if (student.admissionAcademicTermId != null) return student.admissionAcademicTermId === term.id;
    return isDateWithinTerm(student.dateOfAdmission, term);
  }, [isDateWithinTerm]);

  const matchesLeftTerm = useCallback((student: Student, term: AcademicTermOption | null) => {
    if (!term) return true;
    if (student.inactivatedAcademicTermId != null) {
      return Number(student.inactivatedAcademicTermId) === Number(term.id);
    }
    const leftDate = student.inactivatedAt || student.updatedAt;
    if (leftDate) return isDateWithinTerm(leftDate, term);
    return false;
  }, [isDateWithinTerm]);

  const resolveLeftTermLabel = useCallback(
    (student: Student): string | null => {
      if (student.inactivatedAcademicTermId != null) {
        const term = academicTerms.find((t) => t.id === student.inactivatedAcademicTermId);
        if (term) return term.label;
      }
      if (!student.inactivatedAt && !student.updatedAt) return null;
      const leftDate = student.inactivatedAt || student.updatedAt;
      for (const term of academicTerms) {
        if (isDateWithinTerm(leftDate, term)) return term.label;
      }
      return null;
    },
    [academicTerms, isDateWithinTerm]
  );

  const registryStudents = useMemo(() => {
    if (isInactiveView) {
      return termInactiveStudents ?? [];
    }
    return students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'active');
  }, [students, isInactiveView, termInactiveStudents]);

  const termPayments = useMemo(() => {
    return (payments || []).filter((p) => {
      if (!currentTerm || currentTerm === 'Not Set') return true;
      const t = p.term || '';
      return t === currentTerm || t.includes(currentTerm) || currentTerm.includes(t);
    });
  }, [payments, currentTerm]);

  const loadImageDataUrl = async (url?: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Image conversion failed'));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const hasDiscount = (student: Student) => {
    if (student.isBeneficiary) return true;
    const value = Number(student.discountValue ?? 0);
    return Boolean(student.discountType && value > 0);
  };

  const isFullDiscount = (student: Student) => {
    if (!student.isBeneficiary) return false;
    const type = student.discountType;
    const value = Number(student.discountValue ?? 0);
    if (!type) return true;
    if (type === 'percentage' && value >= 100) return true;
    return false;
  };

  const isPartialDiscount = (student: Student) => {
    return hasDiscount(student) && !isFullDiscount(student);
  };

  const discountLabel = (student: Student) => {
    if (!hasDiscount(student)) return 'No discount';
    if (isFullDiscount(student)) return 'Full waiver';
    if (student.discountType === 'percentage') return `Percentage ${Number(student.discountValue ?? 0)}%`;
    if (student.discountType === 'fixed') return `Fixed GHS ${Number(student.discountValue ?? 0).toLocaleString()}`;
    return 'Discount';
  };

  const discountKind = (student: Student) => {
    if (!hasDiscount(student)) return 'None';
    if (isFullDiscount(student)) return 'Full waiver';
    if (student.discountType === 'percentage') return 'Percentage';
    if (student.discountType === 'fixed') return 'Fixed amount';
    return student.isBeneficiary ? 'Full waiver' : 'None';
  };

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return registryStudents.filter((student) => {
      const matchesSearch =
        q === '' ||
        student.firstName.toLowerCase().includes(q) ||
        student.lastName.toLowerCase().includes(q) ||
        String(student.studentId).toLowerCase().includes(q) ||
        (student.admissionNumber || '').toLowerCase().includes(q);
      const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;
      const matchesGender = filterGender === 'all-genders' || student.gender === filterGender;
      const matchesDiscount =
        filterDiscount === 'all-discounts' ||
        (filterDiscount === 'discounted' && hasDiscount(student)) ||
        (filterDiscount === 'full-discount' && isFullDiscount(student)) ||
        (filterDiscount === 'partial-discount' && isPartialDiscount(student)) ||
        (filterDiscount === 'no-discount' && !hasDiscount(student));
      const matchesTermFilter = isInactiveView
        ? matchesLeftTerm(student, selectedAcademicTerm)
        : matchesAdmissionTerm(student, selectedAcademicTerm);
      const applyTermFilter = isInactiveView
        ? false
        : showRecentAdmissions && selectedAcademicTerm != null;
      const matchesRecentTermEvents = !applyTermFilter || matchesTermFilter;
      return matchesSearch && matchesClass && matchesGender && matchesDiscount && matchesRecentTermEvents;
    });
  }, [
    registryStudents,
    searchTerm,
    filterClass,
    filterGender,
    filterDiscount,
    showRecentAdmissions,
    selectedAcademicTerm,
    matchesAdmissionTerm,
    matchesLeftTerm,
    isInactiveView,
    termInactiveStudents,
  ]);

  const termAdmissionsCount = useMemo(
    () => {
      const pool = isInactiveView ? registryStudents : students;
      return pool.filter((student) => matchesAdmissionTerm(student, selectedAcademicTerm)).length;
    },
    [students, registryStudents, matchesAdmissionTerm, selectedAcademicTerm, isInactiveView]
  );

  const termLeftCount = useMemo(
    () => registryStudents.filter((student) => matchesLeftTerm(student, selectedAcademicTerm)).length,
    [registryStudents, matchesLeftTerm, selectedAcademicTerm]
  );

  const sortedStudents = useMemo(() => {
    if (showRecentAdmissions) {
      if (isInactiveView) {
        return [...filteredStudents].sort((a, b) => studentInactivatedDate(b).localeCompare(studentInactivatedDate(a)));
      }
      return [...filteredStudents].sort((a, b) => studentDateAdded(b).localeCompare(studentDateAdded(a)));
    }
    return sortStudents(filteredStudents, sortKey, sortDir);
  }, [filteredStudents, sortKey, sortDir, showRecentAdmissions, isInactiveView]);

  const allFilteredDiscountedCount = useMemo(() => {
    return sortedStudents.filter(hasDiscount).length;
  }, [sortedStudents]);

  const selectedDiscountedCount = useMemo(() => {
    if (selected.size === 0) return 0;
    return sortedStudents.filter((s) => selected.has(s.id) && hasDiscount(s)).length;
  }, [sortedStudents, selected]);

  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, safePage, pageSize]);

  useEffect(() => {
    void refresh(['fees']);
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterClass, filterGender, filterDiscount, showRecentAdmissions, selectedAcademicTermId, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterClass('all-classes');
    setFilterGender('all-genders');
    setFilterDiscount('all-discounts');
    setShowRecentAdmissions(false);
    setSelectedAcademicTermId(activeAcademicTermId ? String(activeAcademicTermId) : 'all-terms');
    setSortKey('name');
    setSortDir('asc');
  };

  const toggleRecentAdmissions = () => {
    setShowRecentAdmissions((open) => {
      const next = !open;
      if (next && selectedAcademicTermId === 'all-terms' && activeAcademicTermId) {
        setSelectedAcademicTermId(String(activeAcademicTermId));
      }
      return next;
    });
  };

  const handleAcademicTermChange = (value: string) => {
    setSelectedAcademicTermId(value);
    if (isInactiveView && value !== 'all-terms') {
      setShowRecentAdmissions(true);
    }
  };

  const recentToggleLabel = isInactiveView ? 'Recently inactivated' : 'Recently added students';

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

  const runSetInactive = async (student: Student, termId: number): Promise<boolean> => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Students',
      itemId: student.id,
      itemName: `${student.firstName} ${student.lastName} (set inactive)`,
    });
    const termLabel = academicTerms.find((t) => t.id === termId)?.label || 'selected term';
    try {
      await setStudentStatus(student.id, 'inactive', { inactivationTermId: termId });
      await refresh(['students']);
      await refetchInactiveStudents();
      toast({
        title: 'Student set inactive',
        description: `${student.firstName} ${student.lastName} is inactive for ${termLabel}. All records are preserved.`,
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
      return true;
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update status', variant: 'destructive' });
      return false;
    }
  };

  const runReactivate = async (student: Student): Promise<boolean> => {
    addAuditLog({
      actionType: 'Edit',
      module: 'Students',
      itemId: student.id,
      itemName: `${student.firstName} ${student.lastName} (reactivated)`,
    });
    try {
      await setStudentStatus(student.id, 'active');
      await refresh(['students']);
      await refetchInactiveStudents();
      toast({
        title: 'Student reactivated',
        description: `${student.firstName} ${student.lastName} is active again and will appear in active lists.`,
      });
      return true;
    } catch (e: any) {
      toast({ title: 'Reactivate failed', description: e?.message || 'Could not reactivate student', variant: 'destructive' });
      return false;
    }
  };

  const confirmSetInactive = (student: Student) => {
    setInactiveTarget(student);
    setInactiveTermId('');
  };

  const exportSelectedCsv = (exportAll = false) => {
    const rows = (!exportAll && selected.size > 0)
      ? sortedStudents.filter((s) => selected.has(s.id))
      : sortedStudents;

    if (rows.length === 0) {
      toast({ title: 'No students found', description: 'No students match the current filters to export.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([exportStudentsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const classTag = filterClass !== 'all-classes' ? `-${filterClass.replace(/\s+/g, '_')}` : '';
    const genderTag = filterGender !== 'all-genders' ? `-${filterGender}` : '';
    a.download = `students-export${classTag}${genderTag}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export ready', description: `${rows.length} student(s) exported to CSV.` });
  };

  const exportSelectedPdf = async (exportAll = false) => {
    const rows = (!exportAll && selected.size > 0)
      ? sortedStudents.filter((s) => selected.has(s.id))
      : sortedStudents;

    if (rows.length === 0) {
      toast({ title: 'No students found', description: 'No students match the current filters to export.', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    toast({ title: 'Preparing PDF...', description: `Building PDF for ${rows.length} student(s) in batches.` });

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 14;
      const logoUrl = resolveLogoUrl(school?.logo_url ?? null);
      const logoDataUrl = await loadImageDataUrl(logoUrl);
      const headerTop = 18;
      const headerHeight = 24;

      if (logoDataUrl) {
        const logoTypeMatch = logoDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,/i);
        const logoType = logoTypeMatch ? (logoTypeMatch[1].toUpperCase() === 'JPG' ? 'JPEG' : logoTypeMatch[1].toUpperCase()) : 'PNG';
        doc.addImage(logoDataUrl, logoType as 'PNG' | 'JPEG', margin, headerTop - 2, 24, 24);
      }

      const schoolTitle = school?.name?.trim() || 'School Name';
      const titleX = logoDataUrl ? margin + 32 : margin;

      // Filter descriptors for report title & metadata
      const filterParts: string[] = [];
      if (filterClass !== 'all-classes') filterParts.push(`Class: ${filterClass}`);
      if (filterGender !== 'all-genders') filterParts.push(`Gender: ${filterGender === 'male' ? 'Male' : filterGender === 'female' ? 'Female' : filterGender}`);
      if (filterDiscount !== 'all-discounts') {
        const dMap: Record<string, string> = {
          'discounted': 'Discounted',
          'full-discount': 'Full waiver',
          'partial-discount': 'Partial discount',
          'no-discount': 'No discount',
        };
        filterParts.push(`Discount: ${dMap[filterDiscount] || filterDiscount}`);
      }
      if (searchTerm.trim()) filterParts.push(`Search: "${searchTerm.trim()}"`);

      const filterSummary = filterParts.length > 0 ? filterParts.join(' | ') : 'All Students';
      const selectionSummary = (!exportAll && selected.size > 0)
        ? `${rows.length} student(s) selected`
        : `All ${rows.length} student(s) (${filterSummary})`;

      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.text(schoolTitle, titleX, headerTop + 6);
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`Student Roster — ${filterSummary}`, titleX, headerTop + 12);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, headerTop + headerHeight + 4);
      doc.text(selectionSummary, margin, headerTop + headerHeight + 10);
      doc.setLineWidth(0.35);
      doc.setDrawColor(45, 45, 45);
      doc.line(margin, headerTop + headerHeight + 12, 297 - margin, headerTop + headerHeight + 12);

      // Process rows in batches of 100 to prevent locking the browser event loop
      const BATCH_SIZE = 100;
      const body: string[][] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const batchRows = batch.map((student, bIdx) => {
          const index = i + bIdx;
          return [
            String(index + 1),
            `${student.firstName} ${student.lastName}`.trim(),
            student.studentId || '—',
            student.classAssigned || '—',
            student.gender || '—',
            student.dateOfBirth || '—',
            student.homeAddress || '—',
            discountKind(student),
            discountLabel(student),
            student.guardianName || '—',
            student.guardianContact || '—',
          ];
        });
        body.push(...batchRows);
        if (i + BATCH_SIZE < rows.length) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      autoTable(doc, {
        startY: headerTop + headerHeight + 18,
        head: [['#', 'Name', 'Student ID', 'Class', 'Gender', 'Date of birth', 'Location', 'Discount kind', 'Discount value', 'Guardian', 'Guardian phone']],
        body,
        theme: 'grid',
        headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center', fontSize: 8 },
        bodyStyles: { valign: 'middle', fontSize: 7.5 },
        styles: { cellPadding: 2, textColor: 55, overflow: 'linebreak' },
        margin: { left: margin, right: margin },
        tableLineColor: [180, 180, 180],
        tableLineWidth: 0.15,
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 36 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 16 },
          5: { cellWidth: 22 },
          6: { cellWidth: 46 },
          7: { cellWidth: 25 },
          8: { cellWidth: 22 },
          9: { cellWidth: 28 },
          10: { cellWidth: 24 },
        },
      });

      const pageCount = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`${schoolTitle} — Student Roster (${filterSummary})`, margin, pageHeight - 8);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      const classTag = filterClass !== 'all-classes' ? `-${filterClass.replace(/\s+/g, '_')}` : '';
      const genderTag = filterGender !== 'all-genders' ? `-${filterGender}` : '';
      doc.save(`students-export${classTag}${genderTag}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'PDF export ready', description: `${rows.length} student(s) exported to PDF.` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err?.message || 'Could not generate PDF file.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportSelectedDiscountPdf = async (exportAll = false) => {
    const pool = (!exportAll && selected.size > 0)
      ? sortedStudents.filter((s) => selected.has(s.id))
      : sortedStudents;

    // Filter strictly to ONLY students with an active discount or fee waiver
    const rows = pool.filter(hasDiscount);

    if (rows.length === 0) {
      toast({
        title: 'No discounted students found',
        description: selected.size > 0 && !exportAll
          ? 'None of the selected students have an active discount or fee waiver.'
          : 'None of the students matching the current filter have an active discount or fee waiver.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    toast({ title: 'Preparing Discount PDF...', description: `Building discount report for ${rows.length} discounted student(s).` });

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 14;
      const logoUrl = resolveLogoUrl(school?.logo_url ?? null);
      const logoDataUrl = await loadImageDataUrl(logoUrl);
      const headerTop = 18;
      const headerHeight = 24;

      if (logoDataUrl) {
        const logoTypeMatch = logoDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,/i);
        const logoType = logoTypeMatch ? (logoTypeMatch[1].toUpperCase() === 'JPG' ? 'JPEG' : logoTypeMatch[1].toUpperCase()) : 'PNG';
        doc.addImage(logoDataUrl, logoType as 'PNG' | 'JPEG', margin, headerTop - 2, 24, 24);
      }

      const schoolTitle = school?.name?.trim() || 'School Name';
      const titleX = logoDataUrl ? margin + 32 : margin;

      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.text(schoolTitle, titleX, headerTop + 6);
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text('Discount Allocation Report', titleX, headerTop + 12);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, headerTop + headerHeight + 4);
      doc.text(`Discounted students: ${rows.length}`, margin, headerTop + headerHeight + 10);
      doc.setLineWidth(0.35);
      doc.setDrawColor(45, 45, 45);
      doc.line(margin, headerTop + headerHeight + 12, 297 - margin, headerTop + headerHeight + 12);

      // Process in batches
      const BATCH_SIZE = 100;
      const body: string[][] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const batchRows = batch.map((student, bIdx) => {
          const index = i + bIdx;
          return [
            String(index + 1),
            `${student.firstName} ${student.lastName}`.trim(),
            student.studentId || '—',
            student.classAssigned || '—',
            student.dateOfBirth || '—',
            student.homeAddress || '—',
            discountKind(student),
            discountLabel(student),
          ];
        });
        body.push(...batchRows);
        if (i + BATCH_SIZE < rows.length) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      autoTable(doc, {
        startY: headerTop + headerHeight + 18,
        head: [['#', 'Name', 'Student ID', 'Class', 'Date of birth', 'Location', 'Discount kind', 'Discount value']],
        body,
        theme: 'grid',
        headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center', fontSize: 8 },
        bodyStyles: { valign: 'middle', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: 55, overflow: 'linebreak' },
        margin: { left: margin, right: margin },
        tableLineColor: [180, 180, 180],
        tableLineWidth: 0.15,
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 26 },
          3: { cellWidth: 24 },
          4: { cellWidth: 26 },
          5: { cellWidth: 75 },
          6: { cellWidth: 34 },
          7: { cellWidth: 34 },
        },
      });

      const pageCount = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`${schoolTitle} — Discount Allocation Report`, margin, pageHeight - 8);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      const classTag = filterClass !== 'all-classes' ? `-${filterClass.replace(/\s+/g, '_')}` : '';
      doc.save(`discount-allocation-report${classTag}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'PDF export ready', description: `${rows.length} discounted student(s) exported to PDF.` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err?.message || 'Could not generate PDF file.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
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

  const initialLoad =
    (loading && !isInactiveView && registryStudents.length === 0) ||
    (isInactiveView && termInactiveLoading && termInactiveStudents == null);

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {isInactiveView ? 'Inactive students' : 'Student registry'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {filteredStudents.length} of {registryStudents.length}{' '}
                {isInactiveView
                  ? showRecentAdmissions
                    ? 'recently inactivated'
                    : 'inactive'
                  : showRecentAdmissions
                    ? 'recent admissions'
                    : 'active'}{' '}
                students
                {searchTerm || filterClass !== 'all-classes' || filterGender !== 'all-genders' || filterDiscount !== 'all-discounts' || showRecentAdmissions
                  ? ' · filters active'
                  : ''}
              </p>
              {showRecentAdmissions ? (
                <p className="text-xs text-muted-foreground">
                  {isInactiveView
                    ? selectedAcademicTerm
                      ? `Inactivated in ${selectedAcademicTerm.label} · sorted by date inactivated (newest first)`
                      : 'All terms · sorted by date inactivated (newest first)'
                    : selectedAcademicTerm
                      ? `Admitted in ${selectedAcademicTerm.label} · sorted by date added (newest first)`
                      : 'All terms · sorted by date added (newest first)'}
                </p>
              ) : selectedAcademicTerm ? (
                <p className="text-xs text-muted-foreground">
                  {isInactiveView
                    ? `${termLeftCount} inactivated in ${selectedAcademicTerm.label}${termAdmissionsCount > 0 ? ` · ${termAdmissionsCount} were admitted in ${selectedAcademicTerm.label}` : ''}`
                    : `${termAdmissionsCount} admitted in ${selectedAcademicTerm.label} · ${termLeftCount} left in ${selectedAcademicTerm.label}`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant={showRecentAdmissions ? 'default' : 'outline'}
                size="sm"
                className="h-9 gap-1.5"
                onClick={toggleRecentAdmissions}
              >
                {isInactiveView ? <UserX className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
                {recentToggleLabel}
              </Button>
              <Select value={selectedAcademicTermId} onValueChange={handleAcademicTermChange}>
                <SelectTrigger className="h-9 w-[9.5rem] shrink-0 text-xs sm:w-[11rem] sm:text-sm" aria-label="Academic term">
                  <SelectValue placeholder="Term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-terms">All terms</SelectItem>
                  {academicTerms.map((term) => (
                    <SelectItem key={term.id} value={String(term.id)}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => exportSelectedPdf(false)}
                disabled={sortedStudents.length === 0 || isExporting}
              >
                <Download className="h-4 w-4 shrink-0" />
                {isExporting
                  ? 'Exporting...'
                  : selected.size > 0
                  ? `Export PDF (${selected.size})`
                  : `Export PDF (${sortedStudents.length})`}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={sortedStudents.length === 0 || isExporting}
                  >
                    Bulk actions
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {selected.size > 0 && (
                    <>
                      <DropdownMenuItem onClick={() => exportSelectedPdf(false)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF ({selected.size} selected)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportSelectedCsv(false)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV ({selected.size} selected)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => exportSelectedDiscountPdf(false)}
                        disabled={selectedDiscountedCount === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Discounts PDF ({selectedDiscountedCount} selected)
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => exportSelectedPdf(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF (All {sortedStudents.length} filtered)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelectedCsv(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV (All {sortedStudents.length} filtered)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportSelectedDiscountPdf(true)}
                    disabled={allFilteredDiscountedCount === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Discounts PDF ({allFilteredDiscountedCount} discounted)
                  </DropdownMenuItem>
                  {!readOnly && onRequestPromoteStudent && selected.size > 0 ? (
                  <DropdownMenuItem onClick={bulkPromote}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Go to promote ({selected.size})
                  </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              {selected.size > 0 && (
                <span className="w-full text-right text-xs text-muted-foreground tabular-nums sm:w-auto">
                  {selected.size} selected
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
            <div className="relative lg:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, student ID, admission…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 text-sm"
                aria-label="Search students"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore=""
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
            <Select value={filterDiscount} onValueChange={setFilterDiscount}>
              <SelectTrigger className="h-9 lg:col-span-2" aria-label="Filter by discount">
                <SelectValue placeholder="Discount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-discounts">All students</SelectItem>
                <SelectItem value="discounted">Discounted only</SelectItem>
                <SelectItem value="full-discount">Full discount</SelectItem>
                <SelectItem value="partial-discount">Partial discount</SelectItem>
                <SelectItem value="no-discount">No discount</SelectItem>
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
                  {isInactiveView
                    ? 'No inactive students. Students set inactive will appear here with all records preserved.'
                    : 'Try adjusting search or filters, or add students from the Add Student tab.'}
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
                            rowTint,
                            isInactiveView && 'opacity-75 saturate-[0.85] bg-muted/30'
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
                              <LazyStudentAvatar
                                studentId={student.id}
                                firstName={student.firstName}
                                lastName={student.lastName}
                                photoUrl={student.passportPhotoUrl}
                                hasPassportPhoto={student.hasPassportPhoto}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium leading-tight text-foreground">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  Adm. {student.admissionNumber || '—'}
                                  {isInactiveView && resolveLeftTermLabel(student)
                                    ? ` · Left ${resolveLeftTermLabel(student)}`
                                    : ''}
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
                              className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', statusBadgeClass(status))}
                            >
                              {enrollmentStatusLabel(student.enrollmentStatus)}
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
                              {!readOnly && (
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
                              )}
                              {!readOnly && (
                              !isInactiveView ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-md text-muted-foreground transition-transform hover:scale-105 hover:bg-amber-500/10 hover:text-amber-700"
                                      onClick={() => confirmSetInactive(student)}
                                      aria-label="Set student inactive"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Set inactive</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-md text-muted-foreground transition-transform hover:scale-105 hover:bg-emerald-500/10 hover:text-emerald-700"
                                      onClick={() => setReactivateTarget(student)}
                                      aria-label="Reactivate student"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Reactivate</TooltipContent>
                                </Tooltip>
                              )
                              )}
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
        payments={(selectedStudent && isAlumniStudent(selectedStudent) ? payments : termPayments) as any}
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
        onViewFull={(st) => {
          setQuickSheetOpen(false);
          setQuickViewStudent(null);
          handleViewStudent(st);
        }}
      />

      <AlertDialog
        open={!!inactiveTarget}
        onOpenChange={(o) => {
          if (!o) {
            setInactiveTarget(null);
            setInactiveTermId('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set student inactive?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set{' '}
              <span className="font-medium text-foreground">
                {inactiveTarget ? `${inactiveTarget.firstName} ${inactiveTarget.lastName}` : ''}
              </span>{' '}
              as inactive? Their records will be preserved but they will not appear in active lists or be billed next term.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="inactive-term-select">Inactive for academic term *</Label>
            <Select value={inactiveTermId || undefined} onValueChange={setInactiveTermId}>
              <SelectTrigger id="inactive-term-select">
                <SelectValue placeholder="Select the term they left" />
              </SelectTrigger>
              <SelectContent>
                {academicTerms.map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the term this student should appear under on the Inactive list and academic reports — not necessarily today&apos;s date.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-600/90 disabled:opacity-50"
              disabled={!inactiveTermId}
              onClick={async () => {
                if (inactiveTarget && inactiveTermId) {
                  await runSetInactive(inactiveTarget, Number(inactiveTermId));
                }
                setInactiveTarget(null);
                setInactiveTermId('');
              }}
            >
              Set inactive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reactivateTarget} onOpenChange={(o) => !o && setReactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate student?</AlertDialogTitle>
            <AlertDialogDescription>
              Reactivate{' '}
              <span className="font-medium text-foreground">
                {reactivateTarget ? `${reactivateTarget.firstName} ${reactivateTarget.lastName}` : ''}
              </span>
              ? They will return to active lists and be eligible for billing in future terms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (reactivateTarget) await runReactivate(reactivateTarget);
                setReactivateTarget(null);
              }}
            >
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default ViewAllStudents;
