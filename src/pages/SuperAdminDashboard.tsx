import React, { useState, useEffect, useCallback } from 'react';
import { BrandedLoading, BrandedLoadingScreen } from '@/components/common/BrandedLoading';
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
import { useSocket } from '../contexts/SocketContext';
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
  Zap,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import SuperAdminLoginForm from '../components/SuperAdminLoginForm';
import SupportModule from '../components/support/SupportModule';
import { resolveLogoUrl } from '../services/tenantService';
import { useTheme } from '../contexts/ThemeContext';
import PwaInstallButton from '../components/common/PwaInstallButton';

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

type Section = 'schools' | 'registrations' | 'audit' | 'super-admins' | 'support-chat';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [section, setSection] = useState<Section>('schools');
  const [supportInboxUnread, setSupportInboxUnread] = useState(0);
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.role === 'super-admin') loadData();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'audit') loadAuditLogs();
  }, [auditFilters.action, auditFilters.tenantId, auditFilters.limit, section]);

  const refreshSupportInboxUnread = useCallback(async () => {
    if (user?.role !== 'super-admin') return;
    try {
      const r = await apiService.get<{ count: number }>('/support-chat/unread-count');
      setSupportInboxUnread(Number(r?.count ?? 0));
    } catch {
      setSupportInboxUnread(0);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    void refreshSupportInboxUnread();
    const id = window.setInterval(() => void refreshSupportInboxUnread(), 45000);
    return () => window.clearInterval(id);
  }, [user?.role, refreshSupportInboxUnread]);

  useEffect(() => {
    if (!socket || user?.role !== 'super-admin') return;
    const onNew = (msg: { is_from_superadmin?: boolean }) => {
      if (msg && msg.is_from_superadmin === false) void refreshSupportInboxUnread();
    };
    const onTenant = (evt: { entity?: string }) => {
      if (String(evt?.entity || '') === 'support-chat') void refreshSupportInboxUnread();
    };
    socket.on('new-support-message', onNew);
    socket.on('tenant-data-changed', onTenant);
    return () => {
      socket.off('new-support-message', onNew);
      socket.off('tenant-data-changed', onTenant);
    };
  }, [socket, user?.role, refreshSupportInboxUnread]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'support-chat') void refreshSupportInboxUnread();
  }, [section, user?.role, refreshSupportInboxUnread]);

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

  const openSchool = (school: School | { id: number; slug?: string }) => {
    apiService.setTenantContext(school.id);
    localStorage.setItem('currentSchoolId', school.id.toString());
    const path = school.slug ? `/sch/${school.slug}` : `/school/${school.id}`;
    navigate(path);
  };

  const loginUrl = (school: School | { id: number; slug?: string }) => {
    const path = school.slug ? `/sch/${school.slug}` : `/school/${school.id}`;
    return `${window.location.origin}${path}`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (authLoading) return <BrandedLoadingScreen label="Loading…" />;
  if (!user || user.role !== 'super-admin') return <SuperAdminLoginForm />;

  const mainItems = [
    { id: 'schools' as Section, label: 'Schools', icon: Building2 },
    { id: 'registrations' as Section, label: 'Registration Requests', icon: ClipboardList },
    { id: 'support-chat' as Section, label: 'Support Chat', icon: MessageCircle },
  ];
  const systemItems = [
    { id: 'super-admins' as Section, label: 'Super Admins', icon: UserPlus },
    { id: 'audit' as Section, label: 'Audit Logs', icon: Shield },
  ];

  return (
    <div className={darkMode ? 'dark' : ''}>
      <SidebarProvider>
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl">
          <SidebarHeader className="border-b border-slate-200/80 dark:border-slate-800 px-6 py-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-700 shadow-lg shadow-indigo-500/20 border border-white/10">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="font-black text-slate-900 dark:text-white truncate text-lg tracking-tight font-outfit">SCHOLARNERVE</h1>
                <p className="text-[10px] font-bold text-slate-500/60 truncate uppercase tracking-widest">Super Admin Core</p>
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
                        {id === 'support-chat' && supportInboxUnread > 0 && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                            {supportInboxUnread > 99 ? '99+' : supportInboxUnread}
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
              {section === 'support-chat' && 'Support Chat'}
            </h2>
            <div className="flex-1" />
            <PwaInstallButton
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={toggleTheme}
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
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* Dashboard Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Institutions', value: schools.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Active Schools', value: schools.filter(s => s.is_active).length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Pending Requests', value: registrations.filter(r => r.status === 'pending').length, icon: ClipboardList, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Growth', value: '+12%', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                  ].map((stat, i) => (
                    <Card key={i} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm overflow-hidden group hover:border-indigo-500/30 transition-all">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                          <h4 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">{stat.value}</h4>
                        </div>
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", stat.bg)}>
                          <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {createdSchool && (
                  <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-sm overflow-hidden animate-in zoom-in duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-outfit">
                        <Sparkles className="w-5 h-5" />
                        Infrastructure Initialized
                      </CardTitle>
                      <p className="text-emerald-700 dark:text-emerald-400 text-xs">A new academic workspace has been successfully provisioned.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs font-medium">
                        <div className="flex justify-between py-1 border-b border-emerald-100 dark:border-emerald-900/50">
                          <span className="text-slate-500">Access Point:</span>
                          <code className="text-indigo-600 dark:text-indigo-400">{loginUrl(createdSchool)}</code>
                        </div>
                        <div className="flex justify-between py-1 border-b border-emerald-100 dark:border-emerald-900/50">
                          <span className="text-slate-500">Root Identity:</span>
                          <code className="text-slate-900 dark:text-slate-100">{createdSchool.username}</code>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={() => openSchool(createdSchool)} className="bg-emerald-600 hover:bg-emerald-700 h-10 px-6 rounded-xl font-bold text-xs uppercase tracking-wider">
                          <ExternalLink className="w-3.5 h-3.5 mr-2" />
                          Launch Workspace
                        </Button>
                        <Button variant="ghost" onClick={() => setCreatedSchool(null)} className="h-10 text-xs font-bold uppercase tracking-wider">Dismiss</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Institutional Hub</h3>
                      <p className="text-sm text-slate-500 font-medium">Coordinate and manage registered educational entities.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          placeholder="Search institutions..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium"
                        />
                      </div>
                      <Button onClick={() => setShowCreate(!showCreate)} className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                        <Plus className="w-4 h-4 mr-2" />
                        Add School
                      </Button>
                    </div>
                  </div>

                  {showCreate && (
                    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
                      <CardHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <CardTitle className="text-lg font-black font-outfit">Provision New School</CardTitle>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Automated Admin Onboarding Enabled</p>
                      </CardHeader>
                      <CardContent className="p-6">
                        <form onSubmit={handleCreateSchool} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Entity Branding</Label>
                              <Input value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} className="h-12 rounded-xl" placeholder="Full Institutional Name" required />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Network Slug</Label>
                              <Input value={newSchool.slug} onChange={(e) => setNewSchool({ ...newSchool, slug: e.target.value })} className="h-12 rounded-xl" placeholder="e.g. st-marys" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Username</Label>
                              <Input value={newSchool.adminUsername} onChange={(e) => setNewSchool({ ...newSchool, adminUsername: e.target.value })} className="h-12 rounded-xl" placeholder="root_admin" required />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Password</Label>
                              <Input type="password" value={newSchool.adminPassword} onChange={(e) => setNewSchool({ ...newSchool, adminPassword: e.target.value })} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Primary Email</Label>
                              <Input type="email" value={newSchool.adminEmail} onChange={(e) => setNewSchool({ ...newSchool, adminEmail: e.target.value })} className="h-12 rounded-xl" placeholder="admin@example.com" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Asset: Logo</Label>
                              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-indigo-500 file:text-white" />
                            </div>
                          </div>
                          <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
                            <Button type="submit" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">Provision Workspace</Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {loading ? (
                    <BrandedLoading label="Synchronizing core…" className="py-20" />
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {schools
                        .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toString().includes(searchQuery))
                        .map((school) => (
                        <Card key={school.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-500/50 transition-all group overflow-hidden shadow-sm hover:shadow-xl">
                          <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
                              {/* Logo & ID Badge */}
                              <div className="relative shrink-0">
                                <div 
                                  className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 shadow-inner group-hover:scale-105 transition-transform duration-500"
                                >
                                  {school.logo_url ? (
                                    <img src={resolveLogoUrl(school.logo_url)!} alt="" className="w-full h-full object-contain p-2" />
                                  ) : (
                                    <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-white dark:border-slate-900 shadow-lg">
                                  #{school.id}
                                </div>
                              </div>

                              {/* Info Content */}
                              <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <h4 className="font-black text-xl text-slate-900 dark:text-white font-outfit tracking-tight truncate">
                                    {school.name}
                                  </h4>
                                  <Badge 
                                    className={cn(
                                      "w-fit mx-auto sm:mx-0 font-black text-[10px] uppercase tracking-wider px-2 py-0.5",
                                      school.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none' : 'bg-red-500/10 text-red-600 border border-red-500/20 shadow-none'
                                    )}
                                  >
                                    {school.is_active ? 'Active' : 'Offline'}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 text-slate-500">
                                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    <Globe className="w-3 h-3 text-indigo-500" />
                                    {school.slug || 'no-slug'}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                    Enterprise
                                  </div>
                                </div>
                              </div>

                              {/* Action Group */}
                              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                <Dialog open={!!editSchool && editSchool.id === school.id} onOpenChange={(o) => !o && setEditSchool(null)}>
                                  <Button variant="outline" size="sm" onClick={() => setEditSchool({ ...school })} className="h-10 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <Pencil className="w-3.5 h-3.5 mr-2" />
                                    Settings
                                  </Button>
                                  <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
                                    <DialogHeader>
                                      <DialogTitle className="text-2xl font-black font-outfit">Institutional Parameters</DialogTitle>
                                      <DialogDescription className="text-xs font-medium">Modify core identity and aesthetic configurations for {school.name}.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdateSchool} className="space-y-6 pt-4">
                                      {editSchool && (
                                        <>
                                          <div className="grid gap-6">
                                            <div className="space-y-2">
                                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Formal Identity</Label>
                                              <Input value={editSchool.name} onChange={(e) => setEditSchool({ ...editSchool, name: e.target.value })} className="h-12 rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Brand Mark (Logo)</Label>
                                              <Input type="file" accept="image/*" onChange={(e) => setEditLogoFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-indigo-500 file:text-white" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Color</Label>
                                                <Input type="color" value={editSchool.primary_color || '#2563eb'} onChange={(e) => setEditSchool({ ...editSchool, primary_color: e.target.value })} className="h-12 rounded-xl p-1 cursor-pointer" />
                                              </div>
                                              <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secondary Color</Label>
                                                <Input type="color" value={editSchool.secondary_color || '#7c3aed'} onChange={(e) => setEditSchool({ ...editSchool, secondary_color: e.target.value })} className="h-12 rounded-xl p-1 cursor-pointer" />
                                              </div>
                                            </div>
                                          </div>
                                          <DialogFooter className="gap-2">
                                            <Button type="button" variant="ghost" onClick={() => setEditSchool(null)} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white h-12 px-8">Save Configuration</Button>
                                          </DialogFooter>
                                        </>
                                      )}
                                    </form>
                                  </DialogContent>
                                </Dialog>

                                <Dialog open={!!resetSchool && resetSchool.id === school.id} onOpenChange={(o) => { if (!o) { setResetSchool(null); setNewPassword(''); } }}>
                                  <Button variant="outline" size="sm" onClick={() => setResetSchool(school)} className="h-10 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <KeyRound className="w-3.5 h-3.5 mr-2" />
                                    Access
                                  </Button>
                                  <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <DialogHeader>
                                      <DialogTitle className="text-2xl font-black font-outfit">Credential Override</DialogTitle>
                                      <DialogDescription className="text-xs font-medium">Initialize a master password reset for {school.name}'s administrative console.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleResetPassword} className="space-y-6 pt-4">
                                      <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emergency Password (6+ Chars)</Label>
                                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                                      </div>
                                      <DialogFooter>
                                        <Button type="button" variant="ghost" onClick={() => setResetSchool(null)} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                                        <Button type="submit" className="bg-red-600 hover:bg-red-700 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white h-12 px-8">Confirm Override</Button>
                                      </DialogFooter>
                                    </form>
                                  </DialogContent>
                                </Dialog>

                                <Button size="sm" variant="ghost" onClick={() => toggleActive(school)} className={cn("h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest", school.is_active ? 'text-red-500 hover:bg-red-500/10' : 'text-emerald-500 hover:bg-emerald-500/10')}>
                                  {school.is_active ? <PowerOff className="w-3.5 h-3.5 mr-2" /> : <Power className="w-3.5 h-3.5 mr-2" />}
                                  {school.is_active ? 'Off' : 'On'}
                                </Button>
                                
                                <Button size="sm" onClick={() => openSchool(school)} className="h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest hover:opacity-90 shadow-lg shadow-slate-900/10 transition-all">
                                  <ArrowRight className="w-3.5 h-3.5 mr-2" />
                                  Launch
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {schools.length === 0 && (
                        <Card className="col-span-full border-dashed border-2 border-slate-200 dark:border-slate-800 p-20 text-center bg-slate-50/50 dark:bg-slate-900/20">
                          <Building2 className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-6" />
                          <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">Zero Entities Detected</h3>
                          <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto">Establish your first institutional anchor to begin system management.</p>
                          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-105">
                            Initialize First School
                          </Button>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'registrations' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Onboarding Requests</h3>
                    <p className="text-sm text-slate-500 font-medium">Verify and approve new institutional registrations.</p>
                  </div>
                </div>

                {loading ? (
                  <BrandedLoading label="Syncing requests…" className="py-20" />
                ) : registrations.length === 0 ? (
                  <Card className="border-slate-200 dark:border-slate-800 p-20 text-center bg-white dark:bg-slate-900/50">
                    <ClipboardList className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-6" />
                    <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">Queue Empty</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">All institutional registration requests have been processed.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {registrations.map((r) => (
                      <Card key={r.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden hover:border-indigo-500/30 transition-all shadow-sm">
                        <CardContent className="p-0">
                          <div className="flex flex-col lg:flex-row items-stretch">
                            {/* Entity Identifier */}
                            <div className="p-6 lg:w-72 bg-slate-50/50 dark:bg-slate-800/30 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Institutional Entity</p>
                                <h4 className="font-black text-lg text-slate-900 dark:text-white font-outfit tracking-tight leading-tight mb-2">{r.school_name}</h4>
                                <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'approved' ? 'default' : r.status === 'contacted' ? 'outline' : 'destructive'} className="font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
                                  {r.status}
                                </Badge>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <p className="text-[10px] font-bold text-slate-500/60 uppercase tracking-widest">Request Date</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatDate(r.created_at)}</p>
                              </div>
                            </div>

                            {/* Core Info */}
                            <div className="flex-1 p-6 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Lead Administrator</p>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                      <User className="w-4 h-4 text-indigo-500" />
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">{r.admin_name}</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Contact Details</p>
                                  <div className="space-y-2">
                                    <a href={`mailto:${r.email}`} className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                                      <Mail className="w-3.5 h-3.5" />
                                      {r.email}
                                    </a>
                                    {r.phone && (
                                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                        <Phone className="w-3.5 h-3.5" />
                                        {r.phone}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {r.message && (
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Entity Message</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">"{r.message}"</p>
                                </div>
                              )}

                              {r.internal_note && (
                                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1">Internal Protocol Note</p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.internal_note}</p>
                                </div>
                              )}

                              {r.status === 'approved' && r.generated_password && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <p className="text-xs font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-widest">Provisioning Credentials</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Root ID</p>
                                      <code className="block bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs">admin</code>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Security Token</p>
                                      <code className="block bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs">{r.generated_password}</code>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => openSchool({ id: r.tenant_id!, slug: r.school_slug! })}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-emerald-500/10"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                    Access Command Center
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Actions Vertical Bar */}
                            <div className="p-6 lg:w-48 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-row lg:flex-col gap-2 justify-center lg:justify-start">
                              <Button
                                variant="outline"
                                className="flex-1 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest"
                                onClick={() => { setNoteReg(r); setInternalNote(r.internal_note || ''); }}
                              >
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                Protocols
                              </Button>
                              <Button
                                variant="ghost"
                                className="flex-1 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10"
                                onClick={() => handleDeleteRegistration(r.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Expunge
                              </Button>
                              
                              {r.status === 'pending' && (
                                <div className="hidden lg:flex flex-col gap-2 mt-auto w-full">
                                  <Button onClick={() => updateRegistrationStatus(r.id, 'contacted')} className="w-full h-10 rounded-xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest bg-indigo-500/5 hover:bg-indigo-500/10">Contact</Button>
                                  <Button onClick={() => updateRegistrationStatus(r.id, 'approved')} className="w-full h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest">Authorize</Button>
                                  <Button onClick={() => updateRegistrationStatus(r.id, 'rejected')} className="w-full h-10 rounded-xl text-red-500 hover:bg-red-500/10 font-bold text-[10px] uppercase tracking-widest border border-red-500/10">Reject</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Dialog open={!!noteReg} onOpenChange={(o) => { if (!o) { setNoteReg(null); setInternalNote(''); } }}>
                  <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black font-outfit">Internal Protocol Note</DialogTitle>
                      <DialogDescription className="text-xs font-medium">Append administrative context for {noteReg?.school_name}.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={saveInternalNote} className="space-y-4 pt-4">
                      <textarea
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        className="w-full min-h-[120px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Detail the current status or required actions..."
                        rows={4}
                      />
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { setNoteReg(null); setInternalNote(''); }} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white h-11 px-8 shadow-lg shadow-indigo-500/10">Commit Note</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {section === 'super-admins' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Access Control</h3>
                    <p className="text-sm text-slate-500 font-medium">Manage root-level administrative privileges.</p>
                  </div>
                  <Button onClick={() => setShowCreateSuperAdmin(!showCreateSuperAdmin)} className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                    <UserPlus className="w-4 h-4 mr-2" />
                    New Super Admin
                  </Button>
                </div>

                {showCreateSuperAdmin && (
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
                    <CardHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <CardTitle className="text-lg font-black font-outfit">Initialize Privilege Account</CardTitle>
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Root System Access Enabled</p>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleCreateSuperAdmin} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Account Identity</Label>
                            <Input value={newSuperAdmin.username} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, username: e.target.value })} className="h-12 rounded-xl" placeholder="Username" required />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Access Token (Password)</Label>
                            <Input type="password" value={newSuperAdmin.password} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, password: e.target.value })} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Formal Name</Label>
                            <Input value={newSuperAdmin.fullName} onChange={(e) => setNewSuperAdmin({ ...newSuperAdmin, fullName: e.target.value })} className="h-12 rounded-xl" placeholder="Full Name" />
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                          <Button type="button" variant="ghost" onClick={() => setShowCreateSuperAdmin(false)} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
                          <Button type="submit" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-xs uppercase tracking-widest text-white">Create Account</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900/50 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow className="border-slate-200 dark:border-slate-800">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Identity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Legal Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Channels</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Protocol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {superAdmins.map((sa) => (
                        <TableRow key={sa.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <TableCell className="font-bold text-slate-900 dark:text-white py-4">{sa.username}</TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-400 font-medium">{sa.full_name || '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-200">{sa.email || '—'}</span>
                              <span className="text-[10px] font-medium text-slate-500">{sa.phone || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <Dialog open={!!resetSuperAdmin && resetSuperAdmin.id === sa.id} onOpenChange={(o) => { if (!o) { setResetSuperAdmin(null); setSuperAdminNewPass(''); } }}>
                              <Button variant="outline" size="sm" onClick={() => setResetSuperAdmin({ id: sa.id, username: sa.username })} className="h-9 rounded-lg border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest">
                                <KeyRound className="w-3.5 h-3.5 mr-2" />
                                Reset
                              </Button>
                              <DialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <DialogHeader>
                                  <DialogTitle className="text-2xl font-black font-outfit">Credential Override</DialogTitle>
                                  <DialogDescription className="text-xs font-medium">Update the access token for {resetSuperAdmin?.username}.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleResetSuperAdminPassword} className="space-y-6 pt-4">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Access Token</Label>
                                    <Input type="password" value={superAdminNewPass} onChange={(e) => setSuperAdminNewPass(e.target.value)} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                                  </div>
                                  <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => { setResetSuperAdmin(null); setSuperAdminNewPass(''); }} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white h-11 px-8">Confirm Update</Button>
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
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                      <User className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-4" />
                      <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">No Privileged Accounts Found</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {section === 'audit' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Security Audit</h3>
                    <p className="text-sm text-slate-500 font-medium">Complete forensic record of system-wide operations.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Protocol: ALL</option>
                      <option value="LOGIN">LOGIN</option>
                      <option value="LOGOUT">LOGOUT</option>
                      <option value="CREATE">CREATE</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <select
                      value={auditFilters.tenantId}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, tenantId: e.target.value }))}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[160px]"
                    >
                      <option value="">Entity: ALL</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                      ))}
                    </select>
                    <Button variant="outline" size="sm" onClick={() => loadAuditLogs()} className="h-10 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest px-6">
                      Sync Logs
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <BrandedLoading label="Parsing forensics…" className="py-20" />
                ) : auditLogs.length === 0 ? (
                  <Card className="border-slate-200 dark:border-slate-800 p-20 text-center bg-white dark:bg-slate-900/50">
                    <Shield className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-6" />
                    <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">Clean Record</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">No auditable activity has been logged for the current filter set.</p>
                  </Card>
                ) : (
                  <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900/50 backdrop-blur-sm">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <TableRow className="border-slate-200 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Timestamp</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Entity Context</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Principal</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Operation</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Resource Target</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <TableCell className="text-slate-500 text-[10px] font-bold whitespace-nowrap py-4">{formatDate(log.created_at)}</TableCell>
                            <TableCell className="font-bold text-slate-900 dark:text-slate-100">{log.tenant_name || (log.tenant_id == null ? 'SYSTEM_ROOT' : '—')}</TableCell>
                            <TableCell className="font-medium text-slate-600 dark:text-slate-400">{log.username || 'ANONYMOUS'}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "font-black text-[9px] uppercase tracking-widest px-2 py-0.5 shadow-none",
                                log.action === 'DELETE' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                                log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                                'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                              )}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                              {log.entity_type} {log.entity_id && <span className="text-indigo-500">#{log.entity_id}</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            )}


            {section === 'support-chat' && (
              <div className="animate-in fade-in duration-700 h-full">
                <SupportModule />
              </div>
            )}
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
};

export default SuperAdminDashboard;
