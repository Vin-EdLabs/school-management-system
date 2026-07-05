import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Badge } from '@/components/ui/badge';

import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';

import { Search, Users, FileDown, FileSpreadsheet } from 'lucide-react';

import { apiService } from '@/services/api';

import { useData } from '@/contexts/DataContext';

import { toast } from '@/hooks/use-toast';

import { useSchool } from '@/contexts/SchoolContext';

import { resolveLogoUrl } from '@/services/tenantService';

import { downloadCombinedStaffRosterPdf } from '@/utils/buildStaffRosterPdf';

import { downloadCombinedStaffRosterExcel } from '@/utils/buildStaffRosterExcel';

import StaffPhotoLightbox from './StaffPhotoLightbox';

import LazyTeacherAvatar from '../teachers/LazyTeacherAvatar';

import TeacherDetailsDialog from '../teachers/TeacherDetailsDialog';

import OtherStaffProfileDialog from './OtherStaffProfileDialog';

import type { Teacher } from '@/contexts/DataContext';



export type AllStaffRow = {

  id: number;

  staff_id: string;

  full_name: string;

  gender?: string;

  phone_number?: string;

  email?: string;

  employment_status: string;

  staff_type: 'teacher' | 'other';

  position?: string;

  department?: string;

  passport_photo_url?: string;
  counts_as_staff?: boolean;
};



const rowKey = (row: AllStaffRow) => `${row.staff_type}-${row.id}`;



const typeBadge = (type: string) =>

  type === 'teacher'

    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'

    : 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';



const statusBadge = (status: string) => {

  const s = (status || 'active').toLowerCase();

  if (s === 'active') return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';

  if (s === 'suspended') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';

  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

};



const AllStaffView = () => {

  const { teachers } = useData();

  const { school } = useSchool();

  const [rows, setRows] = useState<AllStaffRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [includeNonCounted, setIncludeNonCounted] = useState(false);

  const [search, setSearch] = useState('');

  const [typeFilter, setTypeFilter] = useState('all');

  const [statusFilter, setStatusFilter] = useState('active');

  const [genderFilter, setGenderFilter] = useState('all');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);

  const [selectedOtherId, setSelectedOtherId] = useState<number | null>(null);

  const [otherDialogOpen, setOtherDialogOpen] = useState(false);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const data = await apiService.get<AllStaffRow[]>(

        `/other-staff/all-staff?type=${typeFilter}&status=${statusFilter}&gender=${genderFilter}`

      );

      setRows(Array.isArray(data) ? data : []);

    } catch (e: unknown) {

      const msg = e instanceof Error ? e.message : 'Failed to load staff';

      toast({ title: 'Error', description: msg, variant: 'destructive' });

      setRows([]);

    } finally {

      setLoading(false);

    }

  }, [typeFilter, statusFilter, genderFilter]);



  useEffect(() => {

    load();

  }, [load]);



  const isCountedRow = (row: AllStaffRow) =>
    row.staff_type === 'teacher' || row.counts_as_staff !== false;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? rows
      : rows.filter(
          (r) =>
            r.full_name?.toLowerCase().includes(q) ||
            r.staff_id?.toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => {
      const ac = isCountedRow(a) ? 0 : 1;
      const bc = isCountedRow(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [rows, search]);

  const selectableFiltered = useMemo(() => filtered.filter(isCountedRow), [filtered]);

  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((row) => selected.has(rowKey(row)));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((row) => next.delete(rowKey(row)));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((row) => next.add(rowKey(row)));
        return next;
      });
    }
  };



  const toggleSelect = (key: string) => {

    setSelected((prev) => {

      const next = new Set(prev);

      if (next.has(key)) next.delete(key);

      else next.add(key);

      return next;

    });

  };



  const exportRows = () => {
    const base =
      selected.size > 0 ? filtered.filter((row) => selected.has(rowKey(row))) : filtered;
    if (includeNonCounted) return base;
    return base.filter(isCountedRow);
  };



  const mapExportRows = (list: AllStaffRow[]) =>

    list.map((row) => ({

      fullName: row.full_name,

      staffId: row.staff_id,

      staffType: row.staff_type === 'teacher' ? 'Teacher' : 'Other Staff',

      position: row.position || '',

      department: row.department || '',

      phone: row.phone_number || '',

      email: row.email || '',

      status: row.employment_status || 'active',

    }));



  const exportPdf = async () => {

    const list = exportRows();

    if (list.length === 0) {

      toast({ title: 'Nothing to export', description: 'No staff match the current filters.', variant: 'destructive' });

      return;

    }

    setExporting(true);

    try {

      await downloadCombinedStaffRosterPdf({

        schoolName: school?.name || 'School',

        logoUrl: resolveLogoUrl(school?.logo_url ?? null),

        staff: mapExportRows(list),

      });

      toast({ title: 'PDF exported', description: `${list.length} staff member(s) exported.` });

    } catch (e: unknown) {

      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Could not generate PDF.', variant: 'destructive' });

    } finally {

      setExporting(false);

    }

  };



  const exportExcel = async () => {

    const list = exportRows();

    if (list.length === 0) {

      toast({ title: 'Nothing to export', description: 'No staff match the current filters.', variant: 'destructive' });

      return;

    }

    setExporting(true);

    try {

      await downloadCombinedStaffRosterExcel(mapExportRows(list));

      toast({ title: 'CSV exported', description: `${list.length} staff member(s) exported.` });

    } catch (e: unknown) {

      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Could not generate CSV file.', variant: 'destructive' });

    } finally {

      setExporting(false);

    }

  };



  const countedInView = useMemo(() => filtered.filter(isCountedRow).length, [filtered]);

  const openRow = (row: AllStaffRow) => {

    if (row.staff_type === 'teacher') {

      const t = teachers.find((x) => String(x.id) === String(row.id));

      if (t) {

        setSelectedTeacher(t);

        setTeacherDialogOpen(true);

      }

    } else {

      setSelectedOtherId(row.id);

      setOtherDialogOpen(true);

    }

  };



  return (

    <>

      <Card className="border-border bg-card shadow-sm">

        <CardHeader className="border-b border-border/70 bg-muted/30">

          <CardTitle className="flex items-center gap-2">

            <Users className="w-5 h-5" />

            <span>
              All Staff ({countedInView}
              {filtered.length !== countedInView ? (
                <span className="text-muted-foreground font-normal"> · {filtered.length} listed</span>
              ) : null}
              )
            </span>

            {selected.size > 0 ? (

              <Badge variant="secondary" className="ml-1 font-normal">

                {selected.size} selected

              </Badge>

            ) : null}

          </CardTitle>

        </CardHeader>

        <CardContent className="pt-6">

          <div className="flex flex-col lg:flex-row gap-4 mb-6">

            <div className="relative flex-1 min-w-0">

              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input

                placeholder="Search by name or staff ID..."

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                className="pl-10"

              />

            </div>

            <div className="flex flex-wrap items-center gap-2">

            <Select value={typeFilter} onValueChange={setTypeFilter}>

              <SelectTrigger className="w-40">

                <SelectValue placeholder="Type" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="all">All types</SelectItem>

                <SelectItem value="teacher">Teachers</SelectItem>

                <SelectItem value="other">Other Staff</SelectItem>

              </SelectContent>

            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>

              <SelectTrigger className="w-36">

                <SelectValue placeholder="Status" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="active">Active</SelectItem>

                <SelectItem value="inactive">Inactive</SelectItem>

                <SelectItem value="all">All statuses</SelectItem>

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

            <label
              className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-pointer"
              title="Include non-counted staff in export"
            >
              <Checkbox
                className="h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"
                checked={includeNonCounted}
                onCheckedChange={(v) => setIncludeNonCounted(v === true)}
              />
              Non-counted
            </label>

            <Button

              type="button"

              variant="outline"

              size="sm"

              disabled={exporting || filtered.length === 0}

              onClick={() => void exportPdf()}

            >

              <FileDown className="h-4 w-4 mr-2" />

              Export PDF{selected.size > 0 ? ` (${selected.size})` : ''}

            </Button>

            <Button

              type="button"

              variant="outline"

              size="sm"

              disabled={exporting || filtered.length === 0}

              onClick={() => void exportExcel()}

            >

              <FileSpreadsheet className="h-4 w-4 mr-2" />

              Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}

            </Button>

            </div>

          </div>



          {loading ? (

            <div className="py-12 text-center text-muted-foreground">Loading staff...</div>

          ) : filtered.length === 0 ? (

            <div className="py-12 text-center text-muted-foreground">No staff found.</div>

          ) : (

            <div className="rounded-md border border-border overflow-x-auto w-full bg-card">

              <Table>

                <TableHeader>

                  <TableRow>

                    <TableHead className="w-10">

                      <Checkbox

                        checked={allFilteredSelected}

                        onCheckedChange={toggleSelectAll}

                        aria-label="Select all staff"

                      />

                    </TableHead>

                    <TableHead className="w-14">Photo</TableHead>

                    <TableHead>Name</TableHead>

                    <TableHead>Staff ID</TableHead>

                    <TableHead>Type</TableHead>

                    <TableHead>Position</TableHead>

                    <TableHead>Department</TableHead>

                    <TableHead>Phone</TableHead>

                    <TableHead>Status</TableHead>

                  </TableRow>

                </TableHeader>

                <TableBody>

                  {filtered.map((row) => {

                    const key = rowKey(row);
                    const counted = isCountedRow(row);

                    return (

                      <TableRow

                        key={key}

                        className={`cursor-pointer hover:bg-muted/40 ${!counted ? 'opacity-60' : ''}`}

                        onClick={() => openRow(row)}

                      >

                        <TableCell onClick={(e) => e.stopPropagation()}>

                          <Checkbox

                            checked={selected.has(key)}

                            onCheckedChange={() => toggleSelect(key)}

                            aria-label={`Select ${row.full_name}`}

                          />

                        </TableCell>

                        <TableCell>

                          {row.staff_type === 'teacher' ? (

                            <LazyTeacherAvatar

                              teacherId={String(row.id)}

                              fullName={row.full_name}

                              photoUrl={row.passport_photo_url}

                              className="h-9 w-9"

                            />

                          ) : (

                            <StaffPhotoLightbox

                              src={row.passport_photo_url}

                              name={row.full_name}

                              size="sm"

                            />

                          )}

                        </TableCell>

                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            {row.full_name}
                            {!counted ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                Not Counted
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>

                        <TableCell className="font-mono text-sm">{row.staff_id}</TableCell>

                        <TableCell>

                          <Badge variant="outline" className={typeBadge(row.staff_type)}>

                            {row.staff_type === 'teacher' ? 'Teacher' : 'Staff'}

                          </Badge>

                        </TableCell>

                        <TableCell>{row.position || '—'}</TableCell>

                        <TableCell>{row.department || '—'}</TableCell>

                        <TableCell>{row.phone_number || '—'}</TableCell>

                        <TableCell>

                          <Badge variant="outline" className={statusBadge(row.employment_status)}>

                            {row.employment_status || 'active'}

                          </Badge>

                        </TableCell>

                      </TableRow>

                    );

                  })}

                </TableBody>

              </Table>

            </div>

          )}

        </CardContent>

      </Card>



      <TeacherDetailsDialog

        teacher={selectedTeacher}

        open={teacherDialogOpen}

        onClose={() => {

          setTeacherDialogOpen(false);

          setSelectedTeacher(null);

        }}

      />



      <OtherStaffProfileDialog

        staffId={selectedOtherId}

        open={otherDialogOpen}

        onClose={() => {

          setOtherDialogOpen(false);

          setSelectedOtherId(null);

        }}

        onUpdated={load}

      />

    </>

  );

};



export default AllStaffView;


