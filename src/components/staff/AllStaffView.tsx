import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Users } from 'lucide-react';
import { apiService } from '@/services/api';
import { useData } from '@/contexts/DataContext';
import { toast } from '@/hooks/use-toast';
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
};

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
  const [rows, setRows] = useState<AllStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [selectedOtherId, setSelectedOtherId] = useState<number | null>(null);
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<AllStaffRow[]>(
        `/other-staff/all-staff?type=${typeFilter}&status=${statusFilter}`
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load staff';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.staff_id?.toLowerCase().includes(q)
    );
  }, [rows, search]);

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
            <span>All Staff ({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or staff ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
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
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading staff...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No staff found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
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
                  {filtered.map((row) => (
                    <TableRow
                      key={`${row.staff_type}-${row.id}`}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openRow(row)}
                    >
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
                      <TableCell className="font-medium">{row.full_name}</TableCell>
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
                  ))}
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
