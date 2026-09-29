import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Search, Users, Eye, Pencil, FileDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OtherStaffRecord } from './otherStaffTypes';
import StaffPhotoLightbox from './StaffPhotoLightbox';
import OtherStaffProfileDialog from './OtherStaffProfileDialog';
import OtherStaffFormDialog from './OtherStaffFormDialog';
import { useSchool } from '@/contexts/SchoolContext';
import { resolveLogoUrl } from '@/services/tenantService';
import { downloadOtherStaffRosterPdf } from '@/utils/buildStaffRosterPdf';
import { downloadOtherStaffRosterExcel } from '@/utils/buildStaffRosterExcel';

type Props = {
  refreshKey?: number;
};

const ViewAllOtherStaff: React.FC<Props> = ({ refreshKey = 0 }) => {
  const { school } = useSchool();
  const [staff, setStaff] = useState<OtherStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [includeNonCounted, setIncludeNonCounted] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<OtherStaffRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<OtherStaffRecord[]>(
        `/other-staff?status=${statusFilter}&gender=${genderFilter}`
      );
      setStaff(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load staff',
        variant: 'destructive',
      });
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, genderFilter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const positions = useMemo(
    () => Array.from(new Set(staff.map((s) => s.position).filter(Boolean))) as string[],
    [staff]
  );
  const departments = useMemo(
    () => Array.from(new Set(staff.map((s) => s.department).filter(Boolean))) as string[],
    [staff]
  );

  const isCounted = (s: OtherStaffRecord) => s.counts_as_staff !== false;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = staff.filter((s) => {
      const matchSearch =
        !q ||
        s.full_name?.toLowerCase().includes(q) ||
        s.staff_id?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q);
      const matchPos = positionFilter === 'all' || s.position === positionFilter;
      const matchDept = departmentFilter === 'all' || s.department === departmentFilter;
      return matchSearch && matchPos && matchDept;
    });
    return [...rows].sort((a, b) => {
      const ac = isCounted(a) ? 0 : 1;
      const bc = isCounted(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [staff, search, positionFilter, departmentFilter]);

  const openProfile = (s: OtherStaffRecord) => {
    setProfileId(s.id);
    setProfileOpen(true);
  };

  const countedFiltered = useMemo(() => filtered.filter(isCounted), [filtered]);

  const allFilteredSelected =
    countedFiltered.length > 0 && countedFiltered.every((s) => selected.has(s.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        countedFiltered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        countedFiltered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = () => {
    const base =
      selected.size > 0 ? filtered.filter((s) => selected.has(s.id)) : filtered;
    if (includeNonCounted) return base;
    return base.filter(isCounted);
  };

  const mapStaffRows = (rows: typeof filtered) =>
    rows.map((s) => ({
      fullName: s.full_name,
      staffId: s.staff_id,
      position: s.position || '',
      department: s.department || '',
      salary: Number(s.monthly_salary) || 0,
      phone: s.phone_number || '',
      email: s.email || '',
    }));

  const exportPdf = async () => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No staff match the current filters.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      await downloadOtherStaffRosterPdf({
        schoolName: school?.name || 'School',
        logoUrl: resolveLogoUrl(school?.logo_url ?? null),
        staff: mapStaffRows(rows),
      });
      toast({ title: 'PDF exported', description: `${rows.length} staff member(s) exported.` });
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
      toast({ title: 'Nothing to export', description: 'No staff match the current filters.', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      await downloadOtherStaffRosterExcel(mapStaffRows(rows));
      toast({ title: 'CSV exported', description: `${rows.length} staff member(s) exported.` });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Export failed', description: err?.message || 'Could not generate CSV file.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const countedInView = useMemo(() => filtered.filter(isCounted).length, [filtered]);

  return (
    <>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30 py-3 px-3.5 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center space-x-2 shrink-0 text-base sm:text-lg">
              <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              <span>
                All Other Staff ({countedInView}
                {filtered.length !== countedInView ? (
                  <span className="text-muted-foreground font-normal text-sm"> · {filtered.length} listed</span>
                ) : null}
                )
              </span>
            </CardTitle>
            <div className="relative w-full sm:w-72 md:w-80 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, staff ID, or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-background text-sm rounded-lg"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3.5 px-2.5 sm:px-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-wrap mb-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-32 sm:w-36 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All positions</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-32 sm:w-36 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28 sm:w-32 h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
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
              <label
                className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                title="Include non-counted staff in export"
              >
                <Checkbox
                  className="h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"
                  checked={includeNonCounted}
                  onCheckedChange={(v) => setIncludeNonCounted(v === true)}
                />
                Non-counted
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={exporting || filtered.length === 0}
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
                disabled={exporting || filtered.length === 0}
                onClick={() => void exportExcel()}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading staff...</div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-7 max-w-7 px-0.5 pl-2 pr-0">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all staff" />
                    </TableHead>
                    <TableHead className="w-10 px-0.5 text-center whitespace-nowrap">Photo</TableHead>
                    <TableHead className="whitespace-nowrap px-2">Name</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Staff ID</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Position</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Salary</TableHead>
                    <TableHead className="whitespace-nowrap px-2">Contact</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Department</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Type</TableHead>
                    <TableHead className="whitespace-nowrap px-1.5">Status</TableHead>
                    <TableHead className="w-16 pr-2.5 pl-0.5 whitespace-nowrap text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        No staff found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => {
                      const active = (s.employment_status || 'active').toLowerCase() === 'active';
                      const counted = isCounted(s);
                      return (
                        <TableRow
                          key={s.id}
                          className={`hover:bg-muted/40 cursor-pointer ${!active ? 'opacity-70' : ''} ${!counted ? 'opacity-60' : ''}`}
                          onClick={() => openProfile(s)}
                        >
                          <TableCell className="w-7 max-w-7 px-0.5 pl-2 pr-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(s.id)}
                              onCheckedChange={() => toggleSelect(s.id)}
                              aria-label={`Select ${s.full_name}`}
                            />
                          </TableCell>
                          <TableCell className="w-10 px-0.5 text-center">
                            <StaffPhotoLightbox
                              src={s.passport_photo_url}
                              name={s.full_name}
                              size="xs"
                              className="mx-auto"
                            />
                          </TableCell>
                          <TableCell className="py-2 px-2 whitespace-nowrap">
                            <div className="font-medium text-foreground text-sm flex items-center gap-1.5 leading-snug">
                              <span>{s.full_name}</span>
                              {!counted ? (
                                <Badge variant="outline" className="text-[9px] uppercase tracking-wide px-1 py-0 font-normal">
                                  Not Counted
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{s.gender || '—'}</div>
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            <span className="font-mono text-xs">{s.staff_id}</span>
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            {s.position ? (
                              <Badge variant="secondary" className="text-xs font-normal">{s.position}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            {s.monthly_salary != null && Number(s.monthly_salary) > 0 ? (
                              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                GHS {Number(s.monthly_salary).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-2 whitespace-nowrap">
                            <div className="text-xs leading-snug">
                              <div className="font-medium text-foreground">{s.phone_number || '—'}</div>
                              {s.email ? (
                                <div className="text-muted-foreground">{s.email}</div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            {s.department ? (
                              <span className="text-xs text-muted-foreground">{s.department}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            {s.employment_type ? (
                              <Badge variant="outline" className="text-xs font-normal">{s.employment_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-1.5 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs font-normal',
                                active
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {(s.employment_status || 'active').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 pr-2.5 pl-0.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                title="View profile"
                                onClick={() => openProfile(s)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                title="Edit"
                                onClick={() => {
                                  setEditStaff(s);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OtherStaffProfileDialog
        staffId={profileId}
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setProfileId(null);
        }}
        onUpdated={load}
      />

      <OtherStaffFormDialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditStaff(null);
        }}
        staff={editStaff}
        onSuccess={load}
      />
    </>
  );
};

export default ViewAllOtherStaff;
