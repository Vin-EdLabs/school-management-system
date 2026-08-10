import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  Trash2,
  BedDouble,
  GraduationCap,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import BoardingFeeBreakdownDisplay from '@/components/fees/BoardingFeeBreakdownDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  boardingService,
  type BoardingBed,
  type BoardingDorm,
  type BoardingEnrollment,
  type BoardingFeePreview,
  type BoardingRoom,
  type EnrollmentStatus,
} from '@/services/boardingService';
import BoardingDeleteConfirmDialog, {
  type BoardingDeleteConfirmState,
} from '@/components/boarding/BoardingDeleteConfirmDialog';
import BoardingStudentSearchPicker from '@/components/boarding/BoardingStudentSearchPicker';
import { formatDateForInput, formatDisplayDate } from '@/utils/dateFormat';

function formatGhs(amount: number | string | null | undefined) {
  return `GHS ${Number(amount || 0).toFixed(2)}`;
}

type BoardingFeeActionResult = {
  applied?: boolean;
  removed?: boolean;
  flaggedForReview?: boolean;
  skipped?: boolean;
  reason?: string;
  message?: string;
  amount?: number;
};

function showBoardingFeeToast(
  feeResult: BoardingFeeActionResult | null | undefined,
  fallbackTitle: string
) {
  if (!feeResult) {
    toast({ title: fallbackTitle });
    return;
  }
  if (feeResult.flaggedForReview) {
    toast({
      title: 'Boarding fee review required',
      description: feeResult.message,
      variant: 'destructive',
    });
    return;
  }
  if (feeResult.reason === 'not_configured') {
    toast({
      title: 'No boarding fee configured',
      description: feeResult.message || 'Go to Fee Setup to add one for this term.',
      variant: 'destructive',
    });
    return;
  }
  if (feeResult.applied) {
    toast({ title: 'Boarding fee applied', description: feeResult.message });
    return;
  }
  if (feeResult.removed) {
    toast({ title: 'Boarding fee removed', description: feeResult.message });
    return;
  }
  toast({ title: fallbackTitle, description: feeResult.message });
}

function studentGenderToDormGender(gender?: string | null): 'boys' | 'girls' | null {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'boys';
  if (g === 'female' || g === 'f') return 'girls';
  return null;
}

function genderBadgeLabel(gender?: string | null) {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return { label: 'Male', className: 'bg-blue-100 text-blue-800 border-0' };
  if (g === 'female' || g === 'f') return { label: 'Female', className: 'bg-rose-100 text-rose-800 border-0' };
  return { label: 'Gender not set', className: 'bg-amber-100 text-amber-800 border-0' };
}

interface BoardingBoardersProps {
  onNavigate?: (module: string) => void;
}

export const BoardingBoarders: React.FC<BoardingBoardersProps> = () => {
  const { user } = useAuth();
  const canManageEnrollments = user?.role !== 'matron' && user?.role !== 'house-master';
  const { students, classes } = useData();
  const [enrollments, setEnrollments] = useState<BoardingEnrollment[]>([]);
  const [dorms, setDorms] = useState<BoardingDorm[]>([]);
  const [rooms, setRooms] = useState<BoardingRoom[]>([]);
  const [beds, setBeds] = useState<BoardingBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | EnrollmentStatus>('all');
  const [filterDorm, setFilterDorm] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<BoardingEnrollment | null>(null);
  const [saving, setSaving] = useState(false);

  const [formStudentId, setFormStudentId] = useState('');
  const [formStatus, setFormStatus] = useState<EnrollmentStatus>('boarder');
  const [formDormId, setFormDormId] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [formBedId, setFormBedId] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [feePreview, setFeePreview] = useState<BoardingFeePreview | null>(null);
  const [loadingFeePreview, setLoadingFeePreview] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<BoardingDeleteConfirmState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardingEnrollment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, dormList] = await Promise.all([
        boardingService.listEnrollments(),
        boardingService.listDorms(),
      ]);
      setEnrollments(Array.isArray(rows) ? rows : []);
      setDorms(Array.isArray(dormList) ? dormList : []);
    } catch (e) {
      toast({ title: 'Failed to load boarders', description: (e as Error).message, variant: 'destructive' });
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enrollOpen && !convertOpen) {
      setFeePreview(null);
      return;
    }
    const studentId =
      enrollOpen && formStudentId
        ? formStudentId
        : convertOpen && selectedEnrollment
          ? String(selectedEnrollment.student_id)
          : '';
    if (!studentId || formStatus !== 'boarder') {
      setFeePreview(null);
      return;
    }
    let cancelled = false;
    setLoadingFeePreview(true);
    boardingService
      .previewBoardingFee(studentId)
      .then((data) => {
        if (!cancelled) setFeePreview(data);
      })
      .catch(() => {
        if (!cancelled) setFeePreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFeePreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enrollOpen, convertOpen, formStudentId, selectedEnrollment, formStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const feeNotice = (
    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-start gap-2">
        <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Boarding fee</p>
          {loadingFeePreview ? (
            <p className="text-muted-foreground">Checking fee setup…</p>
          ) : feePreview?.is_configured ? (
            <>
              <BoardingFeeBreakdownDisplay
                breakdown={{
                  lodging: feePreview.configured_lodging ?? feePreview.configured_amount,
                  feeding: feePreview.configured_feeding ?? 0,
                }}
                total={feePreview.configured_amount}
                compact
              />
              <p className="text-slate-700 dark:text-slate-300 pt-1">
                Will be added to the student&apos;s fee statement for this term.
              </p>
              {feePreview.is_applied ? (
                <div className="pt-1">
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">Already on statement:</p>
                  <BoardingFeeBreakdownDisplay
                    breakdown={{
                      lodging: feePreview.applied_lodging ?? feePreview.applied_amount,
                      feeding: feePreview.applied_feeding ?? 0,
                    }}
                    total={feePreview.applied_amount}
                    compact
                    showHeader={false}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-amber-800 dark:text-amber-200">
              No boarding fee is set for this term. Go to Fees → Fee Structure / Bill and click <strong>Set boarding fee</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const loadRoomsForDorm = async (dormId: string) => {
    if (!dormId) {
      setRooms([]);
      setBeds([]);
      return;
    }
    try {
      const list = await boardingService.listRooms(parseInt(dormId, 10));
      setRooms(Array.isArray(list) ? list : []);
    } catch {
      setRooms([]);
    }
    setFormRoomId('');
    setFormBedId('');
    setBeds([]);
  };

  const loadBedsForRoom = async (roomId: string) => {
    if (!roomId) {
      setBeds([]);
      return;
    }
    try {
      const list = await boardingService.listBeds(parseInt(roomId, 10));
      setBeds(Array.isArray(list) ? list.filter((b) => !b.is_occupied) : []);
    } catch {
      setBeds([]);
    }
    setFormBedId('');
  };

  const enrolledStudentIds = useMemo(() => new Set(enrollments.map((e) => e.student_id)), [enrollments]);

  const unenrolledStudents = useMemo(
    () =>
      (students || []).filter(
        (s) =>
          (s.enrollmentStatus || 'active').toLowerCase() === 'active' &&
          !enrolledStudentIds.has(parseInt(String(s.id), 10))
      ),
    [students, enrolledStudentIds]
  );

  const pickerStudent = useMemo(() => {
    const id =
      enrollOpen && formStudentId
        ? formStudentId
        : convertOpen && selectedEnrollment
          ? String(selectedEnrollment.student_id)
          : '';
    if (!id) return null;
    return (
      unenrolledStudents.find((s) => String(s.id) === id) ||
      (students || []).find((s) => String(s.id) === id) ||
      null
    );
  }, [enrollOpen, convertOpen, formStudentId, selectedEnrollment, unenrolledStudents, students]);

  const expectedDormGender = useMemo(
    () => studentGenderToDormGender(pickerStudent?.gender),
    [pickerStudent]
  );

  const eligibleDorms = useMemo(() => {
    if (!expectedDormGender) return dorms.filter((d) => Boolean(d.gender));
    return dorms.filter((d) => d.gender === expectedDormGender);
  }, [dorms, expectedDormGender]);

  const classOptions = useMemo(
    () =>
      [...(classes || [])]
        .filter((c) => c.className?.trim())
        .sort((a, b) => a.className.localeCompare(b.className)),
    [classes]
  );

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      const name = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        name.includes(q) ||
        (e.student_code || '').toLowerCase().includes(q) ||
        (e.admission_number || '').toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || e.status === filterStatus;
      const matchDorm = filterDorm === 'all' || String(e.dorm_id) === filterDorm;
      const matchClass = filterClass === 'all' || String(e.class_id) === filterClass;
      return matchSearch && matchStatus && matchDorm && matchClass;
    });
  }, [enrollments, search, filterStatus, filterDorm, filterClass]);

  const boysBoarders = useMemo(
    () => filtered.filter((e) => e.status === 'boarder' && String(e.gender || '').toLowerCase().startsWith('m')),
    [filtered]
  );
  const girlsBoarders = useMemo(
    () => filtered.filter((e) => e.status === 'boarder' && String(e.gender || '').toLowerCase().startsWith('f')),
    [filtered]
  );
  const otherRows = useMemo(
    () => filtered.filter((e) => !boysBoarders.includes(e) && !girlsBoarders.includes(e)),
    [filtered, boysBoarders, girlsBoarders]
  );

  const renderBoardingFeeCell = (row: BoardingEnrollment) => {
    if (row.status !== 'boarder') {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    const configured = Number(row.boarding_fee_configured || 0);
    const applied = Number(row.boarding_fee_applied || 0);
    if (configured <= 0) {
      return (
        <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800 text-[10px]">
          Not configured
        </Badge>
      );
    }
    return (
      <div className="space-y-0.5">
        <p className="text-sm font-mono tabular-nums">{formatGhs(applied > 0 ? applied : configured)}</p>
        <Badge
          className={cn(
            'border-0 text-[10px]',
            applied > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          )}
        >
          {applied > 0 ? 'On statement' : 'Will apply on save'}
        </Badge>
      </div>
    );
  };

  const openEnroll = () => {
    setFormStudentId('');
    setFormStatus('boarder');
    setFormDormId('');
    setFormRoomId('');
    setFormBedId('');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setRooms([]);
    setBeds([]);
    setEnrollOpen(true);
  };

  const openConvert = (row: BoardingEnrollment) => {
    setSelectedEnrollment(row);
    setFormStatus(row.status);
    setFormDormId(row.dorm_id ? String(row.dorm_id) : '');
    setFormRoomId(row.room_id ? String(row.room_id) : '');
    setFormBedId(row.bed_id ? String(row.bed_id) : '');
    setFormStartDate(formatDateForInput(row.start_date) || new Date().toISOString().slice(0, 10));
    if (row.dorm_id) void loadRoomsForDorm(String(row.dorm_id)).then(() => {
      if (row.room_id) void loadBedsForRoom(String(row.room_id));
    });
    setConvertOpen(true);
  };

  const submitEnroll = async () => {
    const studentId = parseInt(formStudentId, 10);
    if (!studentId) {
      toast({ title: 'Select a student', variant: 'destructive' });
      return;
    }
    if (formStatus === 'boarder' && !formBedId) {
      toast({ title: 'Boarders need a bed assignment', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await boardingService.createEnrollment({
        student_id: studentId,
        status: formStatus,
        dorm_id: formDormId ? parseInt(formDormId, 10) : null,
        room_id: formRoomId ? parseInt(formRoomId, 10) : null,
        bed_id: formBedId ? parseInt(formBedId, 10) : null,
        start_date: formStartDate || null,
      });
      showBoardingFeeToast((result as { feeResult?: BoardingFeeActionResult }).feeResult, 'Enrollment saved');
      setEnrollOpen(false);
      await loadData();
    } catch (e) {
      toast({ title: 'Enrollment failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const submitConvert = async () => {
    if (!selectedEnrollment) return;
    if (formStatus === 'boarder' && !formBedId) {
      toast({ title: 'Boarders need a bed assignment', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await boardingService.convertEnrollment(selectedEnrollment.id, {
        status: formStatus,
        dorm_id: formDormId ? parseInt(formDormId, 10) : null,
        room_id: formRoomId ? parseInt(formRoomId, 10) : null,
        bed_id: formBedId ? parseInt(formBedId, 10) : null,
        start_date: formStartDate || null,
      });
      showBoardingFeeToast((result as { feeResult?: BoardingFeeActionResult }).feeResult, 'Enrollment updated');
      setConvertOpen(false);
      await loadData();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const requestRemoveEnrollment = (row: BoardingEnrollment) => {
    setDeleteTarget(row);
    setDeleteConfirm({
      title: 'Remove boarding enrollment?',
      description:
        row.status === 'boarder'
          ? 'This removes the student from boarding for the current term, frees their bed, and voids the boarding fee on their statement if it was applied.'
          : 'This removes the student\'s boarding record for the current term.',
      subjectLabel: 'Student',
      subjectValue: `${row.first_name} ${row.last_name}`,
      confirmLabel: 'Yes, remove enrollment',
      warning:
        row.status === 'boarder' && Number(row.boarding_fee_applied || 0) > 0
          ? `Boarding fee ${formatGhs(row.boarding_fee_applied)} will be voided on the fee statement.`
          : undefined,
    });
  };

  const confirmRemoveEnrollment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await boardingService.deleteEnrollment(deleteTarget.id);
      showBoardingFeeToast((result as { feeResult?: BoardingFeeActionResult }).feeResult, 'Enrollment removed');
      setDeleteConfirm(null);
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      toast({ title: 'Remove failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status: EnrollmentStatus) =>
    status === 'boarder'
      ? 'bg-emerald-100 text-emerald-800 border-0'
      : 'bg-slate-100 text-slate-600 border-0';

  const renderEnrollmentRow = (row: BoardingEnrollment) => (
    <TableRow key={row.id}>
      <TableCell>
        <p className="font-semibold text-sm">
          {row.first_name} {row.last_name}
        </p>
        <p className="text-xs text-muted-foreground">{row.student_code || row.admission_number}</p>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-sm">
          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
          {row.class_name || '—'}
        </span>
      </TableCell>
      <TableCell>
        <Badge className={statusBadge(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell>{renderBoardingFeeCell(row)}</TableCell>
      <TableCell>
        {row.status === 'boarder' ? (
          <span className="text-xs flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-emerald-600" />
            {[row.dorm_name, row.room_name, row.bed_number ? `Bed ${row.bed_number}` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No bed</span>
        )}
      </TableCell>
      <TableCell className="text-sm tabular-nums">{formatDisplayDate(row.start_date, '—')}</TableCell>
      <TableCell className="text-right">
        {canManageEnrollments ? (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Convert / reassign" onClick={() => openConvert(row)}>
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Remove" onClick={() => requestRemoveEnrollment(row)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">View only</span>
        )}
      </TableCell>
    </TableRow>
  );

  const tableSections = [
    { title: 'Boys boarders', rows: boysBoarders, headerClass: 'text-blue-700 bg-blue-50/60' },
    { title: 'Girls boarders', rows: girlsBoarders, headerClass: 'text-rose-700 bg-rose-50/60' },
    { title: 'Day students & other', rows: otherRows, headerClass: 'text-slate-600 bg-slate-50/80' },
  ];

  const assignmentFields = (
    <>
      <div>
        <Label>Status</Label>
        <Select value={formStatus} onValueChange={(v) => setFormStatus(v as EnrollmentStatus)}>
          <SelectTrigger className="mt-1 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boarder">Boarder</SelectItem>
            <SelectItem value="day">Day student</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {formStatus === 'boarder' ? (
        <>
          {pickerStudent ? (
            <div className="rounded-xl border bg-slate-50/80 dark:bg-slate-900/40 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{pickerStudent.firstName} {pickerStudent.lastName}</p>
                <p className="text-xs text-muted-foreground">{pickerStudent.classAssigned || '—'}</p>
              </div>
              <Badge className={genderBadgeLabel(pickerStudent.gender).className}>
                {genderBadgeLabel(pickerStudent.gender).label}
              </Badge>
            </div>
          ) : null}
          <div>
            <Label>Dormitory</Label>
            {expectedDormGender ? (
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                Showing {expectedDormGender === 'boys' ? 'boys' : 'girls'} dormitories only
              </p>
            ) : pickerStudent ? (
              <p className="text-xs text-amber-700 mt-0.5 mb-1">Set student gender before assigning a dorm.</p>
            ) : null}
            <Select
              value={formDormId}
              onValueChange={(v) => {
                setFormDormId(v);
                void loadRoomsForDorm(v);
              }}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Select dorm" />
              </SelectTrigger>
              <SelectContent>
                {eligibleDorms.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No {expectedDormGender === 'girls' ? 'girls' : 'boys'} dormitory configured
                  </SelectItem>
                ) : (
                  eligibleDorms.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Room</Label>
            <Select
              value={formRoomId}
              onValueChange={(v) => {
                setFormRoomId(v);
                void loadBedsForRoom(v);
              }}
              disabled={!formDormId}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.room_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bed</Label>
            <Select value={formBedId} onValueChange={setFormBedId} disabled={!formRoomId}>
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Select vacant bed" />
              </SelectTrigger>
              <SelectContent>
                {beds.length === 0 ? (
                  <SelectItem value="__none" disabled>No vacant beds in this room</SelectItem>
                ) : (
                  beds.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      Bed {b.bed_number}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
      {formStatus === 'boarder' ? feeNotice : null}
      <div>
        <Label htmlFor="start-date">Start date</Label>
        <Input id="start-date" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1 rounded-xl" />
      </div>
    </>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boarders & Day Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enroll students, assign beds, and convert between boarder and day status.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          {canManageEnrollments ? (
            <Button type="button" variant="primaryAction" size="sm" className="rounded-xl" onClick={openEnroll}>
              <Plus className="h-4 w-4 mr-2" />
              Enroll student
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, admission…" className="h-10 pl-9 rounded-xl" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | EnrollmentStatus)}>
            <SelectTrigger className="w-full lg:w-40 h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="boarder">Boarders</SelectItem>
              <SelectItem value="day">Day students</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDorm} onValueChange={setFilterDorm}>
            <SelectTrigger className="w-full lg:w-44 h-10 rounded-xl">
              <SelectValue placeholder="All dorms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dorms</SelectItem>
              {dorms.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-full lg:w-44 h-10 rounded-xl">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/30">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            Enrollments ({filtered.length})
          </CardTitle>
          <CardDescription>Current term boarding assignments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && enrollments.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No enrollments match your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Boarding fee</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableSections.map((section) =>
                  section.rows.length === 0 ? null : (
                    <React.Fragment key={section.title}>
                      <TableRow className={cn('hover:bg-transparent', section.headerClass)}>
                        <TableCell colSpan={7} className="py-2 text-xs font-bold uppercase tracking-wide">
                          {section.title} ({section.rows.length})
                        </TableCell>
                      </TableRow>
                      {section.rows.map((row) => renderEnrollmentRow(row))}
                    </React.Fragment>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Enroll modal */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Enroll student</DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <BoardingStudentSearchPicker
              students={unenrolledStudents.map((s) => ({
                id: String(s.id),
                firstName: s.firstName,
                lastName: s.lastName,
                studentId: s.studentId,
                admissionNumber: s.admissionNumber,
                classAssigned: s.classAssigned,
                gender: s.gender,
              }))}
              value={formStudentId}
              onChange={setFormStudentId}
            />
            {assignmentFields}
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void submitEnroll()} disabled={saving}>
              {saving ? 'Saving…' : 'Enroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert modal */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>
              Convert / reassign — {selectedEnrollment?.first_name} {selectedEnrollment?.last_name}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>{assignmentFields}</DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void submitConvert()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoardingDeleteConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm(null);
            setDeleteTarget(null);
          }
        }}
        state={deleteConfirm}
        loading={deleting}
        onConfirm={() => void confirmRemoveEnrollment()}
      />
    </div>
  );
};

export default BoardingBoarders;
