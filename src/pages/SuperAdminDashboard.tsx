import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { toast } from '@/hooks/use-toast';
import {
  Building2,
  Plus,
  Power,
  PowerOff,
  ArrowRight,
  LogOut,
  ExternalLink,
  Shield,
  ClipboardList,
  ImagePlus,
  KeyRound,
  Pencil,
  Mail,
  Phone,
  User,
  GraduationCap,
  MessageCircle,
  UserPlus,
  Globe,
  FileText,
  Sun,
  Moon,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import SuperAdminLoginForm from '../components/SuperAdminLoginForm';
import { resolveLogoUrl } from '../services/tenantService';

interface School {
  id: number;
  name: string;
  slug?: string;
  subdomain?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  subscription_status?: string;
  is_active?: boolean;
  created_at?: string;
}

interface Registration {
  id: number;
  school_name: string;
  admin_name: string;
  email: string;
  phone?: string;
  message?: string;
  status: string;
  internal_note?: string;
  tenant_id?: number;
  generated_password?: string;
  school_slug?: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  tenant_id?: number | null;
  user_id?: number | null;
  username?: string;
  tenant_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  created_at: string;
}

type Section = 'schools' | 'registrations' | 'audit' | 'super-admins';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [section, setSection] = useState<Section>('schools');
  const [schools, setSchools] = useState<School[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<{ id: number; name: string; slug: string; username: string; password: string } | null>(null);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [resetSchool, setResetSchool] = useState<School | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [auditFilters, setAuditFilters] = useState({ action: '', tenantId: '', limit: '500' });
  const [newSchool, setNewSchool] = useState({
    name: '',
    slug: '',
    subdomain: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [superAdmins, setSuperAdmins] = useState<Array<{ id: number; username: string; email?: string; full_name?: string; phone?: string }>>([]);
  const [showCreateSuperAdmin, setShowCreateSuperAdmin] = useState(false);
  const [newSuperAdmin, setNewSuperAdmin] = useState({ username: '', password: '', email: '', fullName: '', phone: '' });
  const [resetSuperAdmin, setResetSuperAdmin] = useState<{ id: number; username: string } | null>(null);
  const [superAdminNewPass, setSuperAdminNewPass] = useState('');
  const [noteReg, setNoteReg] = useState<Registration | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('superadmin-theme') === 'dark');

  useEffect(() => {
    localStorage.setItem('superadmin-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (user && user.role !== 'super-admin') {
      navigate('/select-school');
      return;
    }
    if (user?.role === 'super-admin') loadData();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'audit') loadAuditLogs();
  }, [auditFilters.action, auditFilters.tenantId, auditFilters.limit, section]);

  const loadAuditLogs = async () => {
    const params = new URLSearchParams();
    if (auditFilters.limit) params.set('limit', auditFilters.limit);
    if (auditFilters.action) params.set('action', auditFilters.action);
    if (auditFilters.tenantId) params.set('tenantId', auditFilters.tenantId);
    const res = await apiService.get<AuditLog[]>(`/audit/all?${params}`);
    setAuditLogs(Array.isArray(res) ? res : []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [schoolsList, regs, admins] = await Promise.all([
        apiService.get<School[]>('/schools'),
        apiService.get<Registration[]>('/school-registrations'),
        apiService.get<Array<{ id: number; username: string; email?: string; full_name?: string; phone?: string }>>('/schools/super-admins').catch(() => []),
      ]);
      setSchools(Array.isArray(schoolsList) ? schoolsList : []);
      setRegistrations(Array.isArray(regs) ? regs : []);
      setSuperAdmins(Array.isArray(admins) ? admins : []);
      await loadAuditLogs();
    } catch {
      setSchools([]);
      setRegistrations([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSchools = async () => {
    try {
      const list = await apiService.get<School[]>('/schools');
      setSchools(Array.isArray(list) ? list : []);
    } catch {
      setSchools([]);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await apiService.post('/schools', {
        name: newSchool.name,
        slug: newSchool.slug || undefined,
        subdomain: newSchool.subdomain || undefined,
        adminUsername: newSchool.adminUsername,
        adminPassword: newSchool.adminPassword,
        adminEmail: newSchool.adminEmail || undefined,
        primary_color: newSchool.primaryColor,
        secondary_color: newSchool.secondaryColor,
      });
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const token = localStorage.getItem('authToken');
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        await fetch(`${base}/schools/${res.id}/logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      setCreatedSchool({
        id: res.id,
        name: newSchool.name,
        slug: res.slug,
        username: newSchool.adminUsername,
        password: newSchool.adminPassword,
      });
      toast({ title: 'School created successfully!' });
      setShowCreate(false);
      setNewSchool({ name: '', slug: '', subdomain: '', adminUsername: '', adminPassword: '', adminEmail: '', primaryColor: '#2563eb', secondaryColor: '#7c3aed' });
      setLogoFile(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create school', variant: 'destructive' });
    }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchool) return;
    try {
      await apiService.put(`/schools/${editSchool.id}`, {
        name: editSchool.name,
        slug: editSchool.slug,
        subdomain: editSchool.subdomain,
        primary_color: editSchool.primary_color,
        secondary_color: editSchool.secondary_color,
      });
      if (editLogoFile) {
        const formData = new FormData();
        formData.append('logo', editLogoFile);
        const token = localStorage.getItem('authToken');
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        await fetch(`${base}/schools/${editSchool.id}/logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      toast({ title: 'School updated successfully!' });
      setEditSchool(null);
      setEditLogoFile(null);
      loadSchools();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update school', variant: 'destructive' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSchool || !newPassword || newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post(`/schools/${resetSchool.id}/reset-password`, { newPassword });
      toast({ title: 'Password reset successfully!' });
      setResetSchool(null);
      setNewPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to reset password', variant: 'destructive' });
    }
  };

  const updateRegistrationStatus = async (id: number, status: string) => {
    try {
      await apiService.patch(`/school-registrations/${id}/status`, { status });
      toast({ title: 'Status updated' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteRegistration = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this registration request?')) return;
    try {
      await apiService.delete(`/school-registrations/${id}`);
      toast({ title: 'Registration deleted' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete registration', variant: 'destructive' });
    }
  };

  const saveInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteReg) return;
    try {
      await apiService.patch(`/school-registrations/${noteReg.id}/note`, { internalNote: internalNote.trim() || null });
      toast({ title: 'Internal note saved' });
      setRegistrations((prev) => prev.map((r) => (r.id === noteReg.id ? { ...r, internal_note: internalNote.trim() || undefined } : r)));
      setNoteReg(null);
      setInternalNote('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (school: School) => {
    try {
      if (school.is_active) {
        await apiService.post(`/schools/${school.id}/deactivate`, {});
        toast({ title: 'School deactivated' });
      } else {
        await apiService.post(`/schools/${school.id}/activate`, {});
        toast({ title: 'School activated' });
      }
      loadSchools();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuperAdmin.username || !newSuperAdmin.password || newSuperAdmin.password.length < 6) {
      toast({ title: 'Username and password (min 6 chars) required', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post('/schools/super-admins', {
        username: newSuperAdmin.username,
        password: newSuperAdmin.password,
        email: newSuperAdmin.email || undefined,
        fullName: newSuperAdmin.fullName || undefined,
        phone: newSuperAdmin.phone || undefined,
      });
      toast({ title: 'Super admin created successfully!' });
      setShowCreateSuperAdmin(false);
      setNewSuperAdmin({ username: '', password: '', email: '', fullName: '', phone: '' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create', variant: 'destructive' });
    }
  };

  const handleResetSuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSuperAdmin || !superAdminNewPass || superAdminNewPass.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post(`/schools/super-admins/${resetSuperAdmin.id}/reset-password`, { newPassword: superAdminNewPass });
      toast({ title: 'Password reset successfully!' });
      setResetSuperAdmin(null);
      setSuperAdminNewPass('');
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    }
  };

  const openSchool = (school: School | { id: number; slug: string }) => {
    apiService.setTenantContext(school.id);
    localStorage.setItem('currentSchoolId', school.id.toString());
    const path = school.slug ? `/s/${school.slug}` : `/school/${school.id}`;
    navigate(path);
  };

  const loginUrl = (school: School | { id: number; slug: string }) => {
    const path = school.slug ? `/s/${school.slug}` : `/school/${school.id}`;
    return `${window.location.origin}${path}`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">Loading...</div>;
  if (!user) return <SuperAdminLoginForm />;
  if (user.role !== 'super-admin') return null;

  const mainItems = [
    { id: 'schools' as Section, label: 'Schools', icon: Building2 },
    { id: 'registrations' as Section, label: 'Registration Requests', icon: ClipboardList },
  ];
  const systemItems = [
    { id: 'super-admins' as Section, label: 'Super Admins', icon: UserPlus },
    { id: 'audit' as Section, label: 'Audit Logs', icon: Shield },
  ];

  return (
    <div className={darkMode ? 'dark' : ''}>
      <SidebarProvider>
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl">
          <SidebarHeader className="border-b border-slate-200/80 dark:border-slate-800 px-4 py-5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="font-bold text-sidebar-foreground truncate text-base tracking-tight">SCHOLARNERVE</h1>
                <p className="text-xs text-sidebar-foreground/60 truncate">Super Admin Portal</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4 gap-6 flex flex-col overflow-y-auto scrollbar-hide">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest px-3">Overview</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {mainItems.map(({ id, label, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        isActive={section === id}
                        onClick={() => setSection(id)}
                        className="rounded-xl mx-2 text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary/20 data-[active=true]:text-sidebar-primary data-[active=true]:font-bold hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="font-medium">{label}</span>
                        {id === 'registrations' && registrations.filter((r) => r.status === 'pending').length > 0 && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                            {registrations.filter((r) => r.status === 'pending').length}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest px-3">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {systemItems.map(({ id, label, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        isActive={section === id}
                        onClick={() => setSection(id)}
                        className="rounded-xl mx-2 text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary/20 data-[active=true]:text-sidebar-primary data-[active=true]:font-bold hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="font-medium">{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-slate-200 dark:bg-slate-700 mx-2" />
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 dark:border-slate-800 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => window.open('/', '_blank')}
                  className="rounded-xl mx-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span>Visit Site</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate('/select-school')} className="rounded-xl mx-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  <ArrowRight className="h-4 w-4" />
                  <span>Switch to School</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} className="rounded-xl mx-2 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="px-4 py-3 border-t border-sidebar-border">
              <p className="text-[11px] text-sidebar-foreground/40 text-center uppercase tracking-widest font-bold">Powered by SCHOLARNERVE</p>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
          <header className="sticky top-0 z-10 h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex items-center gap-4 px-6 shadow-sm dark:shadow-slate-900/50">
            <SidebarTrigger className="-ml-1 h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" />
            <Separator orientation="vertical" className="h-6 bg-slate-200 dark:bg-slate-700" />
            <h2 className="font-bold text-slate-900 dark:text-white text-lg">
              {section === 'schools' && 'Schools'}
              {section === 'registrations' && 'Registration Requests'}
              {section === 'super-admins' && 'Super Admins'}
              {section === 'audit' && 'Audit Logs'}
            </h2>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.username}</span>
            </div>
          </header>

          <div className="flex-1 p-6 overflow-auto">
            {section === 'schools' && (
              <>
                {createdSchool && (
                  <Card className="mb-6 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        School Created Successfully!
                      </CardTitle>
                      <p className="text-emerald-700 dark:text-emerald-400 text-sm">Share these details with the school admin.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 p-4 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm">
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Login URL:</span> <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">{loginUrl(createdSchool)}</code></p>
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Username:</span> <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">{createdSchool.username}</code></p>
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Password:</span> <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">(the password you set)</code></p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => openSchool(createdSchool)} className="bg-indigo-600 hover:bg-indigo-700">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open School
                        </Button>
                        <Button variant="outline" onClick={() => setCreatedSchool(null)}>Dismiss</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Schools</h3>
                  <Button onClick={() => setShowCreate(!showCreate)} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Create School
                  </Button>
                </div>

                {showCreate && (
                  <Card className="mb-6 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-slate-900 dark:text-white">Create New School</CardTitle>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Admin account will be created automatically.</p>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateSchool} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-700">School Name *</Label>
                            <Input value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} className="mt-1" placeholder="e.g. St. Mary's Academy" required />
                          </div>
                          <div>
                            <Label className="text-slate-700">Slug</Label>
                            <Input value={newSchool.slug} onChange={(e) => setNewSchool({ ...newSchool, slug: e.target.value })} className="mt-1" placeholder="st-marys" />
                          </div>
                          <div>
                            <Label className="text-slate-700">Admin Username *</Label>
                            <Input value={newSchool.adminUsername} onChange={(e) => setNewSchool({ ...newSchool, adminUsername: e.target.value })} className="mt-1" placeholder="admin" required />
                          </div>
                          <div>
                            <Label className="text-slate-700">Admin Password *</Label>
                            <Input type="password" value={newSchool.adminPassword} onChange={(e) => setNewSchool({ ...newSchool, adminPassword: e.target.value })} className="mt-1" placeholder="••••••••" required minLength={6} />
                          </div>
                          <div>
                            <Label className="text-slate-700">Admin Email</Label>
                            <Input type="email" value={newSchool.adminEmail} onChange={(e) => setNewSchool({ ...newSchool, adminEmail: e.target.value })} className="mt-1" placeholder="admin@school.com" />
                          </div>
                          <div>
                            <Label className="text-slate-700">School Logo</Label>
                            <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-slate-700">Primary Color</Label>
                            <div className="flex gap-2 mt-1">
                              <Input type="color" value={newSchool.primaryColor} onChange={(e) => setNewSchool({ ...newSchool, primaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer" />
                              <Input value={newSchool.primaryColor} onChange={(e) => setNewSchool({ ...newSchool, primaryColor: e.target.value })} className="flex-1" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-slate-700">Secondary Color</Label>
                            <div className="flex gap-2 mt-1">
                              <Input type="color" value={newSchool.secondaryColor} onChange={(e) => setNewSchool({ ...newSchool, secondaryColor: e.target.value })} className="w-14 h-10 p-1 cursor-pointer" />
                              <Input value={newSchool.secondaryColor} onChange={(e) => setNewSchool({ ...newSchool, secondaryColor: e.target.value })} className="flex-1" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Create School</Button>
                          <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {loading ? (
                  <p className="text-slate-500">Loading...</p>
                ) : (
                  <div className="grid gap-4">
                    {schools.map((school) => (
                      <Card key={school.id} className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center gap-4 p-4">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-slate-100" style={{ backgroundColor: school.primary_color ? `${school.primary_color}20` : undefined }}>
                              {school.logo_url ? (
                                <img src={resolveLogoUrl(school.logo_url)!} alt="" className="w-full h-full object-contain p-1" />
                              ) : (
                                <Building2 className="w-7 h-7 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white">{school.name}</span>
                                <Badge variant={school.is_active ? 'default' : 'destructive'} className={school.is_active ? 'bg-emerald-600' : ''}>
                                  {school.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 mt-0.5 truncate">
                                ID: {school.id} {school.slug && `• /s/${school.slug}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Dialog open={!!editSchool && editSchool.id === school.id} onOpenChange={(o) => !o && setEditSchool(null)}>
                                <Button variant="outline" size="sm" onClick={() => setEditSchool({ ...school })}>
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Edit School</DialogTitle>
                                    <DialogDescription>Update school details and logo.</DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleUpdateSchool} className="space-y-4">
                                    {editSchool && (
                                      <>
                                        <div className="grid gap-4">
                                          <div>
                                            <Label>School Name</Label>
                                            <Input value={editSchool.name} onChange={(e) => setEditSchool({ ...editSchool, name: e.target.value })} className="mt-1" />
                                          </div>
                                          <div>
                                            <Label>Logo</Label>
                                            <Input type="file" accept="image/*" onChange={(e) => setEditLogoFile(e.target.files?.[0] || null)} className="mt-1" />
                                            {editSchool.logo_url && (
                                              <img src={resolveLogoUrl(editSchool.logo_url)!} alt="" className="mt-2 h-16 object-contain" />
                                            )}
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label>Primary Color</Label>
                                              <Input type="color" value={editSchool.primary_color || '#2563eb'} onChange={(e) => setEditSchool({ ...editSchool, primary_color: e.target.value })} className="mt-1 h-10" />
                                            </div>
                                            <div>
                                              <Label>Secondary Color</Label>
                                              <Input type="color" value={editSchool.secondary_color || '#7c3aed'} onChange={(e) => setEditSchool({ ...editSchool, secondary_color: e.target.value })} className="mt-1 h-10" />
                                            </div>
                                          </div>
                                        </div>
                                        <DialogFooter>
                                          <Button type="button" variant="outline" onClick={() => setEditSchool(null)}>Cancel</Button>
                                          <Button type="submit" className="bg-indigo-600">Save Changes</Button>
                                        </DialogFooter>
                                      </>
                                    )}
                                  </form>
                                </DialogContent>
                              </Dialog>

                              <Dialog open={!!resetSchool && resetSchool.id === school.id} onOpenChange={(o) => { if (!o) { setResetSchool(null); setNewPassword(''); } }}>
                                <Button variant="outline" size="sm" onClick={() => setResetSchool(school)}>
                                  <KeyRound className="w-4 h-4 mr-1" />
                                  Reset Password
                                </Button>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Reset Primary Admin Password</DialogTitle>
                                    <DialogDescription>
                                      Set a new password for {school.name}'s primary administrator.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div>
                                      <Label>New Password (min 6 characters)</Label>
                                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" placeholder="••••••••" required minLength={6} />
                                    </div>
                                    <DialogFooter>
                                      <Button type="button" variant="outline" onClick={() => setResetSchool(null)}>Cancel</Button>
                                      <Button type="submit" className="bg-indigo-600">Reset Password</Button>
                                    </DialogFooter>
                                  </form>
                                </DialogContent>
                              </Dialog>

                              <Button size="sm" variant="outline" onClick={() => toggleActive(school)}>
                                {school.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" onClick={() => openSchool(school)} className="bg-indigo-600 hover:bg-indigo-700">
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Open
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {schools.length === 0 && (
                      <Card className="border-slate-200 dark:border-slate-700 p-12 text-center">
                        <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 mb-4">No schools yet. Create your first school.</p>
                        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
                          Create School
                        </Button>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )}

            {section === 'registrations' && (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Registration Requests</h3>
                  <p className="text-sm text-slate-500">Schools that have registered via the landing page. Add internal notes for your team.</p>
                </div>
                {loading ? (
                  <p className="text-slate-500">Loading...</p>
                ) : registrations.length === 0 ? (
                  <Card className="border-slate-200 p-12 text-center">
                    <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No registration requests yet.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {registrations.map((r) => (
                      <Card key={r.id} className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">School</p>
                                <p className="font-semibold text-slate-900 dark:text-white">{r.school_name}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Admin</p>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="text-slate-900 dark:text-white">{r.admin_name}</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Contact</p>
                                <div className="space-y-1">
                                  <a href={`mailto:${r.email}`} className="flex items-center gap-2 text-indigo-600 hover:underline">
                                    <Mail className="w-4 h-4 shrink-0" />
                                    {r.email}
                                  </a>
                                  {r.phone && (
                                    <p className="flex items-center gap-2 text-sm text-slate-600">
                                      <Phone className="w-4 h-4 shrink-0" />
                                      {r.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Date</p>
                                <p className="text-slate-600 text-sm">{formatDate(r.created_at)}</p>
                                <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'approved' ? 'default' : r.status === 'contacted' ? 'outline' : 'destructive'} className="mt-1.5">
                                  {r.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setNoteReg(r); setInternalNote(r.internal_note || ''); }}
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                {r.internal_note ? 'Edit Note' : 'Add Note'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleDeleteRegistration(r.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                              {r.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateRegistrationStatus(r.id, 'contacted')}>Contacted</Button>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateRegistrationStatus(r.id, 'approved')}>Approve</Button>
                                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => updateRegistrationStatus(r.id, 'rejected')}>Reject</Button>
                                </>
                              )}
                            </div>
                          </div>
                          {r.message && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Additional Info</p>
                              <p className="text-slate-600 text-sm whitespace-pre-wrap">{r.message}</p>
                            </div>
                          )}
                          {r.internal_note && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200/60">
                              <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1">Internal Note</p>
                              <p className="text-slate-700 text-sm">{r.internal_note}</p>
                            </div>
                          )}
                          {r.status === 'approved' && r.generated_password && (
                            <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200/60">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <p className="text-sm font-bold text-emerald-900">School Created Successfully</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Admin Username</p>
                                  <code className="bg-white px-2 py-0.5 rounded border border-emerald-100 text-emerald-800 text-xs font-mono">admin</code>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Admin Password</p>
                                  <code className="bg-white px-2 py-0.5 rounded border border-emerald-100 text-emerald-800 text-xs font-mono">{r.generated_password}</code>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
                                onClick={() => openSchool({ id: r.tenant_id!, slug: r.school_slug! })}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                Open School Dashboard
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Dialog open={!!noteReg} onOpenChange={(o) => { if (!o) { setNoteReg(null); setInternalNote(''); } }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Internal Note</DialogTitle>
                      <DialogDescription>
                        Add a note for {noteReg?.school_name}. Only visible to super admins.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={saveInternalNote} className="space-y-4">
                      <textarea
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        className="w-full min-h-[100px] rounded-md border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        placeholder="e.g. Follow up next week, VIP school, etc."
                        rows={4}
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setNoteReg(null); setInternalNote(''); }}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600">Save Note</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {section === 'super-admins' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Super Admins</h3>
                  <Button onClick={() => setShowCreateSuperAdmin(!showCreateSuperAdmin)} className="bg-indigo-600 hover:bg-indigo-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Super Admin
                  </Button>
                </div>
                {showCreateSuperAdmin && (
                  <Card className="mb-6 border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-slate-900">Create New Super Admin</CardTitle>
                      <p className="text-slate-600 text-sm">Same powers as super admin. Username and password required.</p>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-700">Username *</Label>
                            <Input value={newSuperAdmin.username} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, username: e.target.value })} className="mt-1" placeholder="e.g. admin2" required />
                          </div>
                          <div>
                            <Label className="text-slate-700">Password *</Label>
                            <Input type="password" value={newSuperAdmin.password} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, password: e.target.value })} className="mt-1" placeholder="••••••••" required minLength={6} />
                          </div>
                          <div>
                            <Label className="text-slate-700">Full Name</Label>
                            <Input value={newSuperAdmin.fullName} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, fullName: e.target.value })} className="mt-1" placeholder="John Doe" />
                          </div>
                          <div>
                            <Label className="text-slate-700">Email</Label>
                            <Input type="email" value={newSuperAdmin.email} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, email: e.target.value })} className="mt-1" placeholder="admin@example.com" />
                          </div>
                          <div>
                            <Label className="text-slate-700">Phone</Label>
                            <Input value={newSuperAdmin.phone} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, phone: e.target.value })} className="mt-1" placeholder="+233..." />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
                          <Button type="button" variant="outline" onClick={() => setShowCreateSuperAdmin(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {superAdmins.map((sa) => (
                        <TableRow key={sa.id}>
                          <TableCell className="font-medium">{sa.username}</TableCell>
                          <TableCell>{sa.full_name || '—'}</TableCell>
                          <TableCell>{sa.email || '—'}</TableCell>
                          <TableCell>{sa.phone || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Dialog open={!!resetSuperAdmin && resetSuperAdmin.id === sa.id} onOpenChange={(o) => { if (!o) { setResetSuperAdmin(null); setSuperAdminNewPass(''); } }}>
                              <Button variant="outline" size="sm" onClick={() => setResetSuperAdmin({ id: sa.id, username: sa.username })}>
                                <KeyRound className="w-4 h-4 mr-1" />
                                Reset Password
                              </Button>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reset Password for {resetSuperAdmin?.username}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleResetSuperAdminPassword} className="space-y-4">
                                  <div>
                                    <Label>New Password</Label>
                                    <Input type="password" value={superAdminNewPass} onChange={(e) => setSuperAdminNewPass(e.target.value)} className="mt-1" minLength={6} required />
                                  </div>
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => { setResetSuperAdmin(null); setSuperAdminNewPass(''); }}>Cancel</Button>
                                    <Button type="submit" className="bg-indigo-600">Reset</Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {superAdmins.length === 0 && (
                    <div className="p-12 text-center text-slate-500">No super admins. Create one above.</div>
                  )}
                </Card>
              </>
            )}


            {section === 'audit' && (
              <>
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Audit Logs</h3>
                    <p className="text-sm text-slate-500">System-wide activity across all schools. Tracks logins, logouts, creates, updates, deletes.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
                      className="h-9 rounded-md border border-slate-200 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="">All actions</option>
                      <option value="LOGIN">Login</option>
                      <option value="LOGOUT">Logout</option>
                      <option value="CREATE">Create</option>
                      <option value="UPDATE">Update</option>
                      <option value="DELETE">Delete</option>
                    </select>
                    <select
                      value={auditFilters.tenantId}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, tenantId: e.target.value }))}
                      className="h-9 rounded-md border border-slate-200 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 min-w-[140px]"
                    >
                      <option value="">All schools</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      value={auditFilters.limit}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, limit: e.target.value }))}
                      className="h-9 rounded-md border border-slate-200 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="200">200 logs</option>
                      <option value="500">500 logs</option>
                      <option value="1000">1000 logs</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => loadAuditLogs()}>
                      Refresh
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <p className="text-slate-500">Loading...</p>
                ) : auditLogs.length === 0 ? (
                  <Card className="border-slate-200 dark:border-slate-700 p-12 text-center">
                    <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">No audit logs.</p>
                  </Card>
                ) : (
                  <Card className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Entity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-slate-500 text-sm whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                            <TableCell>{log.tenant_name || (log.tenant_id == null ? 'System' : '—')}</TableCell>
                            <TableCell>{log.username || '—'}</TableCell>
                            <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                            <TableCell className="text-slate-500">{log.entity_type} {log.entity_id && `#${log.entity_id}`}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
};

export default SuperAdminDashboard;
