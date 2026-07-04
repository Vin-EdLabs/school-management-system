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
      const data = await apiService.get<OtherStaffRecord[]>(`/other-staff?status=${statusFilter}`);
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
  }, [statusFilter]);

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
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span>
              All Other Staff ({countedInView}
              {filtered.length !== countedInView ? (
                <span className="text-muted-foreground font-normal"> · {filtered.length} listed</span>
              ) : null}
              )
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, staff ID, or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Position" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground lg:col-span-2">
              <Checkbox
                checked={includeNonCounted}
                onCheckedChange={(v) => setIncludeNonCounted(v === true)}
              />
              Include non-counted staff in export
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

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading staff...</div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all staff" />
                    </TableHead>
                    <TableHead className="w-12 whitespace-nowrap">Photo</TableHead>
                    <TableHead className="min-w-[180px] whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                    <TableHead className="whitespace-nowrap">Position</TableHead>
                    <TableHead className="whitespace-nowrap">Department</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Salary</TableHead>
                    <TableHead className="text-right min-w-[5.5rem] whitespace-nowrap">Actions</TableHead>
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
                          <TableCell className="py-2 w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(s.id)}
                              onCheckedChange={() => toggleSelect(s.id)}
                              aria-label={`Select ${s.full_name}`}
                            />
                          </TableCell>
                          <TableCell className="py-2 w-12">
                            <StaffPhotoLightbox
                              src={s.passport_photo_url}
                              name={s.full_name}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                              {s.full_name}
                              {!counted ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                  Not Counted
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{s.gender || '—'}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{s.staff_id}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{s.phone_number || '—'}</div>
                              <div className="text-muted-foreground">{s.email || ''}</div>
                            </div>
                          </TableCell>
                          <TableCell>{s.position || '—'}</TableCell>
                          <TableCell>{s.department || '—'}</TableCell>
                          <TableCell>{s.employment_type || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={active ? 'text-emerald-600 border-emerald-500/30' : ''}>
                              {s.employment_status || 'active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.monthly_salary != null && Number(s.monthly_salary) > 0 ? (
                              <span className="font-mono">GHS {Number(s.monthly_salary).toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 w-9 p-0"
                                title="View profile"
                                onClick={() => openProfile(s)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 w-9 p-0"
                                title="Edit"
                                onClick={() => {
                                  setEditStaff(s);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
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
