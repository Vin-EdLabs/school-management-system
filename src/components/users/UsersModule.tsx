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
  DialogFooter,
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
};

const roleColors: Record<string, string> = {
  'super-admin': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  administrator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  finance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  teacher: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  staff: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

const roleIcons: Record<string, React.ElementType> = {
  'super-admin': Shield,
  administrator: Shield,
  finance: Wallet,
  teacher: GraduationCap,
  staff: UserCheck,
};

const UsersModule = () => {
  const { schoolId } = useSchool();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SchoolUser | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    role: 'administrator' as 'administrator' | 'finance' | 'teacher' | 'staff',
  });
  const [resetPassword, setResetPassword] = useState('');

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({ title: 'Error', description: 'Username and password required', variant: 'destructive' });
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
        password: newUser.password,
        email: newUser.email || undefined,
        role: newUser.role,
      });
      toast({ title: 'User Created', description: `${newUser.username} has been added` });
      setNewUser({ username: '', password: '', email: '', role: 'administrator' });
      setCreateOpen(false);
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to create user', variant: 'destructive' });
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
    
    const minLength = selectedUser.role === 'teacher' || selectedUser.role === 'staff' ? 5 : 6;
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
        <Button
          onClick={() => setCreateOpen(true)}
          variant="primaryAction"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-sm text-foreground/80">
          <strong className="text-indigo-700 dark:text-indigo-300">Teachers and Staff appear automatically.</strong> When you add a teacher or payroll staff, they get login credentials (Staff ID + PIN). Use &quot;Create User&quot; to add Administrators or Finance officers manually.
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
              <p className="text-sm text-muted-foreground/60 mt-1">Add teachers in Teachers or create an Administrator/Finance user.</p>
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
                      <TableRow key={u.id} className="hover:bg-muted/30 border-border">
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
                            {(u.role === 'teacher' || u.role === 'staff') && u.staff_id && (
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
                          <Badge variant="outline" className={roleColors[u.role] || 'bg-slate-100 text-slate-700'}>
                            {roleLabels[u.role] || u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={u.is_active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-muted text-muted-foreground'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResetDialog(u)}
                            className="border-border hover:bg-muted"
                          >
                            <KeyRound className="w-4 h-4 mr-1.5" />
                            Reset Password
                          </Button>
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Create New User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label>Username *</Label>
              <Input
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="e.g. admin, finance1"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Password * (min {newUser.role === 'teacher' || newUser.role === 'staff' ? 5 : 6} characters)</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••"
                className="mt-1"
                required
                minLength={newUser.role === 'teacher' || newUser.role === 'staff' ? 5 : 6}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v: any) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator">Administrator</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Use Teacher/Staff for manual accounts; normally they get accounts when added via Teachers or Payroll.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primaryAction">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Reset Password — {selectedUser ? displayName(selectedUser) : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set a new password for <strong>{selectedUser.username}</strong> ({roleLabels[selectedUser.role] || selectedUser.role}). They will use this to log in.
              </p>
              <div>
                <Label>New Password * (min {selectedUser.role === 'teacher' || selectedUser.role === 'staff' ? 5 : 6} characters)</Label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  required
                  minLength={selectedUser.role === 'teacher' || selectedUser.role === 'staff' ? 5 : 6}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700">Reset Password</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersModule;
