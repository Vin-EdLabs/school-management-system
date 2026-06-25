import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
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
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  GraduationCap,
  Wallet,
  UserCheck,
  Copy,
  Info,
  Crown,
} from 'lucide-react';

interface SchoolUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  teacher_id: string | null;
  other_staff_id: number | null;
  is_active: boolean;
  is_primary_admin: boolean;
  full_name: string;
  staff_id: string | null;
  created_at?: string;
}

const roleLabels: Record<string, string> = {
  'super-admin': 'Super Admin',
  administrator: 'Administrator',
  finance: 'Finance',
  teacher: 'Teacher',
  staff: 'Staff',
  headmaster: 'Headmaster',
};

const roleColors: Record<string, string> = {
  'super-admin': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  administrator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  finance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  teacher: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  staff: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  headmaster: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
};

const roleIcons: Record<string, React.ElementType> = {
  'super-admin': Shield,
  administrator: Shield,
  finance: Wallet,
  teacher: GraduationCap,
  staff: UserCheck,
  headmaster: Crown,
};

const UsersModule = () => {
  const { schoolId } = useSchool();
  const { socket } = useSocket();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [staffUserOpen, setStaffUserOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SchoolUser | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    password: '',
    email: '',
    role: 'administrator' as 'administrator' | 'finance' | 'teacher' | 'staff',
  });
  const [resetPassword, setResetPassword] = useState('');

  type StaffWithoutUser = {
    id: number;
    staff_id: string;
    full_name: string;
    position?: string;
    department?: string;
    passport_photo_url?: string;
  };

  const [staffCandidates, setStaffCandidates] = useState<StaffWithoutUser[]>([]);
  const [staffUserForm, setStaffUserForm] = useState({
    staffId: '',
    username: '',
    password: '',
    role: 'staff' as 'staff' | 'finance' | 'administrator',
  });
  const [loadingStaffCandidates, setLoadingStaffCandidates] = useState(false);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<SchoolUser[]>('/settings/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load users', variant: 'destructive' });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [schoolId]);

  useEffect(() => {
    if (!socket) return;
    const onTenant = (evt: { entity?: string }) => {
      const entity = String(evt?.entity || '');
      if (entity === 'teacher' || entity === 'user') {
        void loadUsers();
      }
    };
    socket.on('tenant-data-changed', onTenant);
    return () => {
      socket.off('tenant-data-changed', onTenant);
    };
  }, [socket]);

  const loadStaffCandidates = async () => {
    setLoadingStaffCandidates(true);
    try {
      const data = await apiService.get<StaffWithoutUser[]>('/other-staff/without-users');
      setStaffCandidates(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load staff',
        variant: 'destructive',
      });
      setStaffCandidates([]);
    } finally {
      setLoadingStaffCandidates(false);
    }
  };

  const openStaffUserDialog = () => {
    setStaffUserForm({ staffId: '', username: '', password: '', role: 'staff' });
    setStaffUserOpen(true);
    loadStaffCandidates();
  };

  const handleCreateStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffIdNum = parseInt(staffUserForm.staffId, 10);
    if (!staffIdNum || !staffUserForm.username || !staffUserForm.password) {
      toast({ title: 'Error', description: 'Select staff, username, and password', variant: 'destructive' });
      return;
    }
    if (staffUserForm.password.length < 5) {
      toast({ title: 'Error', description: 'Password must be at least 5 characters', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post(`/other-staff/${staffIdNum}/create-user`, {
        username: staffUserForm.username.trim(),
        password: staffUserForm.password,
        role: staffUserForm.role,
      });
      toast({ title: 'User Created', description: `Account created for selected staff member` });
      setStaffUserOpen(false);
      loadUsers();
      loadStaffCandidates();
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({ title: 'Error', description: 'Username and password required', variant: 'destructive' });
      return;
    }
    if ((newUser.role === 'administrator' || newUser.role === 'finance') && !newUser.fullName.trim()) {
      toast({ title: 'Error', description: 'Full name is required for Administrator and Finance users', variant: 'destructive' });
      return;
    }
    const minLength = newUser.role === 'teacher' || newUser.role === 'staff' ? 5 : 6;
    if (newUser.password.length < minLength) {
      toast({ title: 'Error', description: `Password must be at least ${minLength} characters`, variant: 'destructive' });
      return;
    }
    try {
      await apiService.post('/settings/users', {
        username: newUser.username,
        fullName: newUser.fullName,
        password: newUser.password,
        email: newUser.email || undefined,
        role: newUser.role,
      });
      toast({ title: 'User Created', description: `${newUser.username} has been added` });
      setNewUser({ username: '', fullName: '', password: '', email: '', role: 'administrator' });
      setCreateOpen(false);
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to create user', variant: 'destructive' });
    }
  };

  const updateUser = async (user: SchoolUser, patch: Partial<{ role: string; isActive: boolean; fullName: string; email: string }>) => {
    try {
      await apiService.patch(`/settings/users/${user.id}`, patch);
      toast({
        title: 'User Updated',
        description: `${displayName(user)} has been updated`,
      });
      await loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to update user', variant: 'destructive' });
    }
  };

  const openResetDialog = (user: SchoolUser) => {
    setSelectedUser(user);
    setResetPassword('');
    setResetOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPassword) return;
    
    const minLength =
      selectedUser.role === 'teacher' || selectedUser.role === 'staff' || selectedUser.role === 'headmaster' ? 5 : 6;
    if (resetPassword.length < minLength) {
      toast({ title: 'Error', description: `Password must be at least ${minLength} characters`, variant: 'destructive' });
      return;
    }
    try {
      await apiService.post(`/settings/users/${selectedUser.id}/reset-password`, { newPassword: resetPassword });
      toast({ title: 'Password Reset', description: `Password has been reset for ${selectedUser.full_name || selectedUser.username}` });
      setResetOpen(false);
      setSelectedUser(null);
      setResetPassword('');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to reset password', variant: 'destructive' });
    }
  };

  const displayName = (u: SchoolUser) => u.full_name || u.username;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span>User Management</span>
          </h1>
          <p className="text-muted-foreground mt-1">All staff with system access. Create users and reset passwords.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openStaffUserDialog} variant="outline">
            <UserCheck className="w-4 h-4 mr-2" />
            Add Staff as User
          </Button>
          <Button onClick={() => setCreateOpen(true)} variant="primaryAction">
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-sm text-foreground/80">
          <strong className="text-indigo-700 dark:text-indigo-300">Teachers get accounts automatically</strong> when added (username and password = Staff ID). Other staff need explicit access via &quot;Add Staff as User&quot;. Use &quot;Create User&quot; for Administrators or Finance officers without a staff profile.
        </div>
      </div>

      {/* Users table */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/50 border-b border-border">
          <CardTitle className="text-foreground text-lg">All System Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-14 h-14 text-muted/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No users yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Teachers added in the Teachers module appear here automatically. You can reset passwords and manage access.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Login / Staff ID</TableHead>
                    <TableHead className="font-semibold text-foreground">Role</TableHead>
                    <TableHead className="font-semibold text-foreground">Email</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-right w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const RoleIcon = roleIcons[u.role] || UserCheck;
                    return (
                      <TableRow key={u.id} className={!u.is_active ? 'opacity-65 hover:bg-muted/30 border-border' : 'hover:bg-muted/30 border-border'}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <RoleIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{displayName(u)}</p>
                              {u.is_primary_admin && (
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Primary Admin</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-foreground/80">{u.username}</span>
                            {(u.role === 'teacher' || u.role === 'staff' || u.role === 'headmaster') && u.staff_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(u.username);
                                  toast({ title: 'Copied', description: 'Login ID copied' });
                                }}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!u.is_primary_admin && (u.role === 'administrator' || u.role === 'finance') ? (
                            <Select
                              value={u.role}
                              onValueChange={(role) => updateUser(u, { role })}
                            >
                              <SelectTrigger className="h-9 min-w-[145px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="administrator">Administrator</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : !u.is_primary_admin && u.teacher_id && (u.role === 'teacher' || u.role === 'headmaster') ? (
                            <Select
                              value={u.role}
                              onValueChange={(role) => updateUser(u, { role })}
                            >
                              <SelectTrigger className="h-9 min-w-[145px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="teacher">Teacher</SelectItem>
                                <SelectItem value="headmaster">Headmaster</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={roleColors[u.role] || 'bg-slate-100 text-slate-700'}>
                              {roleLabels[u.role] || u.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={u.is_active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-muted text-muted-foreground'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResetDialog(u)}
                              className="border-border hover:bg-muted"
                            >
                              <KeyRound className="w-4 h-4 mr-1.5" />
                              Reset
                            </Button>
                            <Button
                              size="sm"
                              variant={u.is_active ? 'destructive' : 'outline'}
                              disabled={u.is_primary_admin}
                              onClick={() => updateUser(u, { isActive: !u.is_active })}
                              title={u.is_primary_admin ? 'Primary admin cannot be deactivated' : undefined}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
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

      {/* Add Staff as User Dialog */}
      <Dialog open={staffUserOpen} onOpenChange={setStaffUserOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Add Staff as User
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Give an existing staff member a login account with username and password.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateStaffUser} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">Staff login accounts</p>
                    <p className="mt-1 leading-6 text-slate-700">
                      Teachers receive accounts automatically when added. Use this for other staff (drivers, accountants, etc.) who need system access.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Staff member *</Label>
                {loadingStaffCandidates ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : staffCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All active other staff already have user accounts.</p>
                ) : (
                  <Select
                    value={staffUserForm.staffId}
                    onValueChange={(v) => {
                      const s = staffCandidates.find((x) => String(x.id) === v);
                      setStaffUserForm({
                        ...staffUserForm,
                        staffId: v,
                        username: s?.staff_id || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffCandidates.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.full_name} — {s.staff_id}
                          {s.position ? ` (${s.position})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  className="font-mono"
                  value={staffUserForm.username}
                  onChange={(e) => setStaffUserForm({ ...staffUserForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Initial password * (min 5 characters)</Label>
                <Input
                  type="password"
                  value={staffUserForm.password}
                  onChange={(e) => setStaffUserForm({ ...staffUserForm, password: e.target.value })}
                  required
                  minLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={staffUserForm.role}
                  onValueChange={(v: 'staff' | 'finance' | 'administrator') =>
                    setStaffUserForm({ ...staffUserForm, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="administrator">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setStaffUserOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primaryAction" disabled={!staffUserForm.staffId || staffCandidates.length === 0}>
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Create User
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Add an administrator, finance officer, or manual login without a staff profile.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">When to use this</p>
                    <p className="mt-1 leading-6 text-slate-700">
                      Use Create User for administrators or finance officers. Teachers and other staff normally get accounts when added via Teachers or Payroll — use &quot;Add Staff as User&quot; for them instead.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="e.g. admin, finance1"
                  required
                />
              </div>
              {(newUser.role === 'administrator' || newUser.role === 'finance') && (
                <div className="space-y-2">
                  <Label>Full name *</Label>
                  <Input
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="e.g. Barbara Acquah"
                    required
                  />
                  <p className="text-xs text-muted-foreground">This name appears in the system header and audit records.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Password * (min {newUser.role === 'teacher' || newUser.role === 'staff' ? 5 : 6} characters)</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={newUser.role === 'teacher' || newUser.role === 'staff' ? 5 : 6}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v: any) => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrator">Administrator</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primaryAction">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className={detailDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 pr-0">
              <KeyRound className="w-5 h-5 shrink-0 text-amber-600" />
              <span className="min-w-0 break-words">
                Reset password — {selectedUser ? displayName(selectedUser) : ''}
              </span>
            </DialogTitle>
            {selectedUser ? (
              <p className="text-sm text-muted-foreground">
                Set a new login password for <strong>{selectedUser.username}</strong> ({roleLabels[selectedUser.role] || selectedUser.role}).
              </p>
            ) : null}
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleResetPassword} className="flex min-h-0 flex-1 flex-col">
              <DialogBody className={detailDialogBodyClass}>
                <div className="space-y-2">
                  <Label>New password * (min {selectedUser.role === 'teacher' || selectedUser.role === 'staff' || selectedUser.role === 'headmaster' ? 5 : 6} characters)</Label>
                  <Input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={selectedUser.role === 'teacher' || selectedUser.role === 'staff' || selectedUser.role === 'headmaster' ? 5 : 6}
                  />
                </div>
              </DialogBody>
              <DialogFooter className={detailDialogFooterClass}>
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700">Reset password</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersModule;
