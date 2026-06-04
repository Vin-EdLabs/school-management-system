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
import { Switch } from '@/components/ui/switch';
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
  Download,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle,
  Trash2,
  Zap,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  DollarSign,
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
  generated_username?: string;
  generated_password?: string;
  school_slug?: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  tenant_id?: number | null;
  user_id?: number | null;
  username?: string;
  user_full_name?: string;
  tenant_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  module?: string;
  status?: string;
  summary?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown> | string | null;
  before_values?: Record<string, unknown> | string | null;
  after_values?: Record<string, unknown> | string | null;
  created_at: string;
}

interface TrackerUser {
  id: number;
  username: string;
  email?: string | null;
  role: string;
  full_name?: string | null;
  display_name?: string | null;
  activity_count: number;
  last_activity_at?: string | null;
  finance_activity_count: number;
}

type Section = 'schools' | 'visits' | 'tracker' | 'registrations' | 'audit' | 'super-admins' | 'support-chat' | 'school-data';

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
  const [landingVisitors, setLandingVisitors] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<{ id: number; name: string; slug: string; username: string; password: string } | null>(null);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [resetSchool, setResetSchool] = useState<School | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [auditFilters, setAuditFilters] = useState({ tenantId: '', action: '', status: '', module: '', search: '', startDate: '', endDate: '', limit: '500' });
  const [auditSuperAdminOnly, setAuditSuperAdminOnly] = useState(true);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [trackerSchoolSearch, setTrackerSchoolSearch] = useState('');
  const [selectedTrackerSchoolId, setSelectedTrackerSchoolId] = useState('');
  const [trackerUsers, setTrackerUsers] = useState<TrackerUser[]>([]);
  const [selectedTrackerUserId, setSelectedTrackerUserId] = useState('');
  const [trackerTimeline, setTrackerTimeline] = useState<AuditLog[]>([]);
  const [trackerOrder, setTrackerOrder] = useState<'desc' | 'asc'>('desc');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerLoading, setTrackerLoading] = useState(false);
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
  const [showNewSchoolPassword, setShowNewSchoolPassword] = useState(false);
  const [visibleRegistrationPasswords, setVisibleRegistrationPasswords] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDataSchoolId, setSelectedDataSchoolId] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [dataActionLoading, setDataActionLoading] = useState(false);
  const displayName = user?.fullName?.trim() || user?.username || '';

  useEffect(() => {
    if (user?.role === 'super-admin') loadData();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'audit') loadAuditLogs();
  }, [
    auditFilters.tenantId,
    auditFilters.action,
    auditFilters.status,
    auditFilters.module,
    auditFilters.search,
    auditFilters.startDate,
    auditFilters.endDate,
    auditFilters.limit,
    auditSuperAdminOnly,
    section,
    user?.role,
  ]);

  useEffect(() => {
    if (user?.role !== 'super-admin' || section !== 'tracker') return;
    const targetSchoolId = selectedTrackerSchoolId || schools[0]?.id?.toString() || '';
    if (targetSchoolId && targetSchoolId !== selectedTrackerSchoolId) {
      setSelectedTrackerSchoolId(targetSchoolId);
      return;
    }
    if (targetSchoolId) void loadTrackerUsers(targetSchoolId);
  }, [section, user?.role, selectedTrackerSchoolId, schools.length]);

  useEffect(() => {
    if (user?.role !== 'super-admin' || section !== 'tracker' || !selectedTrackerSchoolId || !selectedTrackerUserId) return;
    void loadTrackerTimeline();
  }, [section, user?.role, selectedTrackerSchoolId, selectedTrackerUserId, trackerOrder, trackerSearch]);

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

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    void loadVisitStats();
    const id = window.setInterval(() => void loadVisitStats(), 30000);
    return () => window.clearInterval(id);
  }, [user?.role]);

  const loadAuditLogs = async () => {
    const params = new URLSearchParams();
    if (auditFilters.limit) params.set('limit', auditFilters.limit);
    if (auditFilters.tenantId) params.set('tenantId', auditFilters.tenantId);
    if (auditFilters.action) params.set('action', auditFilters.action);
    if (auditFilters.status) params.set('status', auditFilters.status);
    if (auditSuperAdminOnly) {
      params.set('module', 'superadmin');
    } else if (auditFilters.module) {
      params.set('module', auditFilters.module);
    }
    if (auditFilters.search) params.set('search', auditFilters.search);
    if (auditFilters.startDate && auditFilters.endDate) {
      params.set('startDate', auditFilters.startDate);
      params.set('endDate', auditFilters.endDate);
    }
    const res = await apiService.get<AuditLog[]>(`/audit/all?${params}`);
    setAuditLogs(Array.isArray(res) ? res : []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [schoolsList, regs, admins, visitStats] = await Promise.all([
        apiService.get<School[]>('/schools'),
        apiService.get<Registration[]>('/school-registrations'),
        apiService.get<Array<{ id: number; username: string; email?: string; full_name?: string; phone?: string }>>('/schools/super-admins').catch(() => []),
        apiService.get<{ landingVisitors: number }>('/stats/visits').catch(() => ({ landingVisitors: 0 })),
      ]);
      setSchools(Array.isArray(schoolsList) ? schoolsList : []);
      setRegistrations(Array.isArray(regs) ? regs : []);
      setSuperAdmins(Array.isArray(admins) ? admins : []);
      setLandingVisitors(Number(visitStats?.landingVisitors ?? 0));
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

  const loadVisitStats = async () => {
    try {
      const stats = await apiService.get<{ landingVisitors: number }>('/stats/visits');
      setLandingVisitors(Number(stats?.landingVisitors ?? 0));
    } catch {
      setLandingVisitors(0);
    }
  };

  const loadTrackerUsers = async (tenantId = selectedTrackerSchoolId) => {
    if (!tenantId) return;
    setTrackerLoading(true);
    try {
      const users = await apiService.get<TrackerUser[]>(`/audit/super-admin/tracker/users?tenantId=${encodeURIComponent(tenantId)}`);
      const list = Array.isArray(users) ? users : [];
      setTrackerUsers(list);
      setSelectedTrackerUserId((current) => current && list.some((u) => String(u.id) === current) ? current : (list[0]?.id?.toString() || ''));
    } catch {
      setTrackerUsers([]);
      setSelectedTrackerUserId('');
      setTrackerTimeline([]);
    } finally {
      setTrackerLoading(false);
    }
  };

  const loadTrackerTimeline = async () => {
    if (!selectedTrackerSchoolId || !selectedTrackerUserId) return;
    setTrackerLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId: selectedTrackerSchoolId,
        userId: selectedTrackerUserId,
        order: trackerOrder,
        limit: '500',
      });
      if (trackerSearch.trim()) params.set('search', trackerSearch.trim());
      const logs = await apiService.get<AuditLog[]>(`/audit/super-admin/tracker/timeline?${params}`);
      setTrackerTimeline(Array.isArray(logs) ? logs : []);
    } catch {
      setTrackerTimeline([]);
    } finally {
      setTrackerLoading(false);
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
      setShowNewSchoolPassword(false);
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

  const getSubdomainUrl = (slug: string) => {
    const hostname = window.location.hostname.toLowerCase();
    const protocol = window.location.protocol; // http: or https:
    
    // Local development options (e.g., localhost:8080 or lvh.me:8080)
    if (hostname.includes('localhost') || hostname === '127.0.0.1' || hostname === '::1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${slug}.localhost${port}`;
    }
    
    if (hostname.endsWith('.lvh.me')) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${slug}.lvh.me${port}`;
    }

    // Render domain resolution: tenant.scholarnerve.onrender.com
    if (hostname.endsWith('.onrender.com')) {
      const baseDomain = hostname.replace(/^[a-z0-9-]+\./, ''); // Strip any existing subdomain
      return `${protocol}//${slug}.${baseDomain}`;
    }

    // Production apex custom domain: tenant.scholarnerve.com
    const baseDomain = hostname.includes('scholarnerve.com') ? 'scholarnerve.com' : hostname.replace(/^[a-z0-9-]+\./, '');
    return `${protocol}//${slug}.${baseDomain}`;
  };

  const openSchool = (school: School | { id: number; slug?: string }) => {
    apiService.setTenantContext(school.id);
    localStorage.setItem('currentSchoolId', school.id.toString());
    if (school.slug) {
      const url = getSubdomainUrl(school.slug);
      window.open(url, '_blank');
    } else {
      const path = `/school/${school.id}`;
      navigate(path);
    }
  };

  const loginUrl = (school: School | { id: number; slug?: string }) => {
    if (school.slug) {
      return getSubdomainUrl(school.slug);
    }
    return `${window.location.origin}/school/${school.id}`;
  };

  const selectedDataSchool = schools.find((s) => String(s.id) === selectedDataSchoolId) || schools[0] || null;

  const downloadJson = (payload: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSuperAdminBackup = async () => {
    if (!selectedDataSchool) {
      toast({ title: 'Select a school first', variant: 'destructive' });
      return;
    }
    setDataActionLoading(true);
    try {
      const backup = await apiService.get<any>(`/schools/${selectedDataSchool.id}/backup`);
      const safeName = selectedDataSchool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      downloadJson(backup, `${safeName || 'school'}_backup_${new Date().toISOString().split('T')[0]}.json`);
      toast({ title: 'Backup created', description: `${selectedDataSchool.name} backup downloaded.` });
    } catch (err: any) {
      toast({ title: 'Backup failed', description: err?.message || 'Could not create backup', variant: 'destructive' });
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleSuperAdminResetData = async () => {
    if (!selectedDataSchool) {
      toast({ title: 'Select a school first', variant: 'destructive' });
      return;
    }
    if (resetConfirm !== 'RESET') {
      toast({ title: 'Confirmation required', description: 'Type RESET to continue.', variant: 'destructive' });
      return;
    }
    setDataActionLoading(true);
    try {
      await apiService.post(`/schools/${selectedDataSchool.id}/reset-data`, { confirm: 'RESET' });
      toast({ title: 'School data reset', description: `${selectedDataSchool.name} has been reset.` });
      setResetConfirm('');
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err?.message || 'Could not reset school data', variant: 'destructive' });
    } finally {
      setDataActionLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (authLoading) return <BrandedLoadingScreen label="Loading…" />;
  if (!user || user.role !== 'super-admin') return <SuperAdminLoginForm />;

  const moduleTone = (module?: string, action?: string, entityType?: string) => {
    const value = `${module || ''} ${action || ''} ${entityType || ''}`.toLowerCase();
    if (/finance|payment|fee|invoice|income|expense|payroll|salary|ledger|arrears|discount|adjust/.test(value)) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (/student|teacher|class|grade|attendance|subject|academic/.test(value)) return 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    if (/login|logout|auth|password|lock|security|failed/.test(value)) return 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300';
    if (/setting|school|tenant|admin|user|permission/.test(value)) return 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300';
    return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  const isFinanceAudit = (log: AuditLog) => /finance|payment|fee|invoice|income|expense|payroll|salary|ledger|arrears|discount|adjust/i.test(
    `${log.module || ''} ${log.action || ''} ${log.entity_type || ''}`
  );

  const filteredTrackerSchools = schools.filter((school) => {
    const q = trackerSchoolSearch.trim().toLowerCase();
    return !q || school.name.toLowerCase().includes(q) || String(school.id).includes(q) || String(school.slug || '').toLowerCase().includes(q);
  });

  const selectedTrackerSchool = schools.find((s) => String(s.id) === selectedTrackerSchoolId) || null;
  const selectedTrackerUser = trackerUsers.find((u) => String(u.id) === selectedTrackerUserId) || null;
  const timelineGroups = trackerTimeline.reduce<Record<string, AuditLog[]>>((groups, log) => {
    const key = new Date(log.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    groups[key] = groups[key] || [];
    groups[key].push(log);
    return groups;
  }, {});

  const mainItems = [
    { id: 'schools' as Section, label: 'Schools', icon: Building2 },
    { id: 'visits' as Section, label: 'Visitor Analytics', icon: Globe },
    { id: 'tracker' as Section, label: 'Tracker', icon: ShieldCheck },
    { id: 'school-data' as Section, label: 'School Data', icon: FileText },
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
              {section === 'visits' && 'Visitor Analytics'}
              {section === 'tracker' && 'Tracker'}
              {section === 'school-data' && 'School Data Management'}
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
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{displayName}</span>
            </div>
          </header>

          <div className="flex-1 p-6 overflow-auto">
            {section === 'schools' && (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* Dashboard Stats Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Institutions', value: schools.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Active Schools', value: schools.filter(s => s.is_active).length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Pending Requests', value: registrations.filter(r => r.status === 'pending').length, icon: ClipboardList, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Landing Visitors', value: landingVisitors, icon: Globe, color: 'text-teal-500', bg: 'bg-teal-500/10' },
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
                        <CardTitle className="text-lg font-black font-outfit">Create School Workspace</CardTitle>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Set up the school profile and primary administrator account.</p>
                      </CardHeader>
                      <CardContent className="p-6">
                        <form onSubmit={handleCreateSchool} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">School Name</Label>
                              <Input value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} className="h-12 rounded-xl" placeholder="e.g. Light Preparatory School" required />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Portal Address</Label>
                              <Input value={newSchool.slug} onChange={(e) => setNewSchool({ ...newSchool, slug: e.target.value })} className="h-12 rounded-xl" placeholder="e.g. light-preparatory" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Login Username</Label>
                              <Input value={newSchool.adminUsername} onChange={(e) => setNewSchool({ ...newSchool, adminUsername: e.target.value })} className="h-12 rounded-xl" placeholder="root_admin" required />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Temporary Password</Label>
                              <div className="relative">
                                <Input
                                  type={showNewSchoolPassword ? 'text' : 'password'}
                                  value={newSchool.adminPassword}
                                  onChange={(e) => setNewSchool({ ...newSchool, adminPassword: e.target.value })}
                                  className="h-12 rounded-xl pr-12"
                                  placeholder="Minimum 6 characters"
                                  required
                                  minLength={6}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewSchoolPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                                  aria-label={showNewSchoolPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showNewSchoolPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Email</Label>
                              <Input type="email" value={newSchool.adminEmail} onChange={(e) => setNewSchool({ ...newSchool, adminEmail: e.target.value })} className="h-12 rounded-xl" placeholder="admin@school.com" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">School Logo</Label>
                              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-indigo-500 file:text-white" />
                            </div>
                          </div>
                          <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
                            <Button type="submit" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">Create School</Button>
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
                                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Portal Address</Label>
                                              <Input value={editSchool.slug || ''} onChange={(e) => setEditSchool({ ...editSchool, slug: e.target.value, subdomain: e.target.value })} className="h-12 rounded-xl font-mono text-sm" placeholder="e.g. st-marys" />
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

            {section === 'visits' && (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        <Globe className="h-3.5 w-3.5" />
                        Landing Page Traffic
                      </div>
                      <h3 className="font-outfit text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        Unique Visitor Analytics
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                        Each browser is counted once using a persistent local visitor ID. Refreshes and repeat visits do not create duplicate counts.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => loadVisitStats()}
                      className="h-11 rounded-xl border-slate-200 font-bold text-[10px] uppercase tracking-widest dark:border-slate-800"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm md:col-span-2">
                    <CardContent className="p-8">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Total Unique Landing Visitors</p>
                      <div className="mt-5 flex items-end gap-4">
                        <p className="font-outfit text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                          {landingVisitors.toLocaleString()}
                        </p>
                        <Badge className="mb-2 border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-none">
                          Browser unique
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        Data source: <code className="rounded-md bg-white px-2 py-1 text-xs dark:bg-slate-950">POST /api/visit</code>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <CardContent className="space-y-4 p-6">
                      {[
                        ['Route tracked', '/'],
                        ['Page type', 'Landing'],
                        ['Duplicate rule', '1 browser = 1 visit'],
                        ['Refresh cadence', '30 seconds'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {section === 'tracker' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="absolute right-0 top-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Deep Activity Monitoring
                      </div>
                      <h3 className="font-outfit text-3xl font-black tracking-tight text-slate-900 dark:text-white">School User Tracker</h3>
                      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                        Search a school, select a user, then review every captured action in a chronological timeline with finance actions highlighted.
                      </p>
                    </div>
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[520px]">
                      <Input
                        value={trackerSchoolSearch}
                        onChange={(e) => setTrackerSchoolSearch(e.target.value)}
                        placeholder="Search school..."
                        className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                      />
                      <select
                        value={selectedTrackerSchoolId}
                        onChange={(e) => {
                          setSelectedTrackerSchoolId(e.target.value);
                          setSelectedTrackerUserId('');
                          setTrackerTimeline([]);
                        }}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      >
                        <option value="">Select school</option>
                        {filteredTrackerSchools.map((school) => (
                          <option key={school.id} value={school.id}>
                            #{school.id} - {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Users in School', value: trackerUsers.length, tone: 'text-blue-500' },
                    { label: 'Timeline Events', value: trackerTimeline.length, tone: 'text-slate-900 dark:text-white' },
                    { label: 'Finance Events', value: trackerTimeline.filter(isFinanceAudit).length, tone: 'text-emerald-500' },
                    { label: 'Selected School', value: selectedTrackerSchool ? `#${selectedTrackerSchool.id}` : '-', tone: 'text-purple-500' },
                  ].map((stat) => (
                    <Card key={stat.label} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                      <CardContent className="p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                        <p className={cn('mt-2 font-outfit text-3xl font-black', stat.tone)}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <CardHeader>
                      <CardTitle className="font-outfit text-lg font-black">Users</CardTitle>
                      <p className="text-xs font-medium text-slate-500">
                        {selectedTrackerSchool ? selectedTrackerSchool.name : 'Select a school to load users.'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {trackerLoading && trackerUsers.length === 0 ? (
                        <BrandedLoading label="Loading users..." className="py-10" />
                      ) : trackerUsers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                          <User className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No users found</p>
                        </div>
                      ) : (
                        trackerUsers.map((trackedUser) => (
                          <button
                            key={trackedUser.id}
                            type="button"
                            onClick={() => setSelectedTrackerUserId(String(trackedUser.id))}
                            className={cn(
                              'w-full rounded-2xl border p-4 text-left transition-all',
                              String(trackedUser.id) === selectedTrackerUserId
                                ? 'border-emerald-500/30 bg-emerald-500/10 shadow-sm'
                                : 'border-slate-200 bg-slate-50 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:border-slate-800 dark:bg-slate-950/40'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                                  {trackedUser.display_name || trackedUser.full_name || trackedUser.username}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">@{trackedUser.username} · {trackedUser.role}</p>
                              </div>
                              {trackedUser.finance_activity_count > 0 && (
                                <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black text-emerald-600 shadow-none">
                                  Finance
                                </Badge>
                              )}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>{trackedUser.activity_count || 0} actions</span>
                              <span className="text-right">{trackedUser.last_activity_at ? new Date(trackedUser.last_activity_at).toLocaleDateString() : 'No activity'}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <CardHeader className="space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardTitle className="font-outfit text-lg font-black">Activity Timeline</CardTitle>
                          <p className="text-xs font-medium text-slate-500">
                            {selectedTrackerUser ? `${selectedTrackerUser.display_name || selectedTrackerUser.username}'s full captured activity` : 'Select a user to view their timeline.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            value={trackerSearch}
                            onChange={(e) => setTrackerSearch(e.target.value)}
                            placeholder="Search timeline..."
                            className="h-10 w-full rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950 sm:w-56"
                          />
                          <Button
                            variant="outline"
                            onClick={() => setTrackerOrder((order) => order === 'desc' ? 'asc' : 'desc')}
                            className="h-10 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest dark:border-slate-800"
                          >
                            {trackerOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => loadTrackerTimeline()}
                            disabled={!selectedTrackerUserId}
                            className="h-10 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest dark:border-slate-800"
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!selectedTrackerUserId ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 p-16 text-center dark:border-slate-800">
                          <Shield className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
                          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Choose a user to begin tracking</p>
                        </div>
                      ) : trackerLoading && trackerTimeline.length === 0 ? (
                        <BrandedLoading label="Building timeline..." className="py-16" />
                      ) : trackerTimeline.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 p-16 text-center dark:border-slate-800">
                          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
                          <p className="text-sm font-black uppercase tracking-widest text-slate-400">No activity captured for this user</p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {Object.entries(timelineGroups).map(([day, logs]) => (
                            <div key={day} className="space-y-3">
                              <div className="sticky top-0 z-[1] rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                                {day}
                              </div>
                              <div className="relative space-y-3 pl-5 before:absolute before:left-1.5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                                {logs.map((log) => {
                                  const finance = isFinanceAudit(log);
                                  return (
                                    <div key={log.id} className={cn('relative rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950/40', finance ? 'border-emerald-500/30' : 'border-slate-200 dark:border-slate-800')}>
                                      <span className={cn('absolute -left-[1.15rem] top-5 h-3 w-3 rounded-full ring-4', finance ? 'bg-emerald-500 ring-emerald-500/15' : 'bg-slate-300 ring-slate-100 dark:bg-slate-600 dark:ring-slate-900')} />
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                          <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-none', moduleTone(log.module, log.action, log.entity_type))}>
                                              {log.module || 'general'}
                                            </Badge>
                                            {finance && (
                                              <Badge className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 shadow-none">
                                                Finance Priority
                                              </Badge>
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                                          </div>
                                          <h4 className="font-black text-slate-900 dark:text-white">{log.summary || log.action}</h4>
                                          <p className="mt-1 text-xs font-medium text-slate-500">
                                            {log.action.replace(/_/g, ' ')} · {log.entity_type || 'record'}{log.entity_id ? ` #${log.entity_id}` : ''}
                                          </p>
                                          {(log.before_values || log.after_values) && (
                                            <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                              <pre className="max-h-32 overflow-auto rounded-xl bg-red-500/5 p-3 text-[10px] text-red-700 dark:text-red-300">{JSON.stringify(log.before_values || {}, null, 2)}</pre>
                                              <pre className="max-h-32 overflow-auto rounded-xl bg-emerald-500/5 p-3 text-[10px] text-emerald-700 dark:text-emerald-300">{JSON.stringify(log.after_values || {}, null, 2)}</pre>
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-[150px] text-xs font-medium text-slate-500 lg:text-right">
                                          {log.ip_address && <p>IP: <span className="font-mono">{log.ip_address}</span></p>}
                                          {log.user_agent && <p className="mt-1 line-clamp-2">Device: {log.user_agent}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {section === 'school-data' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">School Data Management</h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Select one school, create full backups, validate import files, or reset that school's operational data.
                  </p>
                </div>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-black font-outfit">Target School</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">School</Label>
                      <select
                        value={selectedDataSchool?.id ? String(selectedDataSchool.id) : ''}
                        onChange={(e) => setSelectedDataSchoolId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      >
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            #{school.id} - {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedDataSchool && (
                      <Badge className={cn(
                        'w-fit font-black text-[10px] uppercase tracking-wider px-3 py-1',
                        selectedDataSchool.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'
                      )}>
                        {selectedDataSchool.is_active ? 'Active' : 'Offline'}
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-black font-outfit">
                        <Download className="w-4 h-4 text-blue-500" />
                        Full Backup
                      </CardTitle>
                      <p className="text-xs text-slate-500">Download a tenant-scoped JSON backup for the selected school.</p>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleSuperAdminBackup} disabled={!selectedDataSchool || dataActionLoading} className="w-full h-10 rounded-xl font-bold text-xs uppercase tracking-widest">
                        {dataActionLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Create Backup
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-black font-outfit">
                        <Upload className="w-4 h-4 text-amber-500" />
                        Import Data
                      </CardTitle>
                      <p className="text-xs text-slate-500">Super Admin only. Select a file for validation before any restore workflow.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".json,.csv,.xlsx,.xls"
                          disabled={!selectedDataSchool}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            toast({
                              title: 'Import file selected',
                              description: `${file.name} is ready for review. Restore/import processing requires a controlled backend workflow.`,
                            });
                            e.target.value = '';
                          }}
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-black font-outfit text-red-700 dark:text-red-300">
                        <Trash2 className="w-4 h-4" />
                        Reset School Data
                      </CardTitle>
                      <p className="text-xs text-red-600/80 dark:text-red-300/80">
                        Clears operational records for the selected school. Users and school identity remain.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        value={resetConfirm}
                        onChange={(e) => setResetConfirm(e.target.value)}
                        placeholder="Type RESET to confirm"
                        className="h-10 rounded-xl bg-white dark:bg-slate-950"
                      />
                      <Button
                        variant="destructive"
                        onClick={handleSuperAdminResetData}
                        disabled={!selectedDataSchool || dataActionLoading || resetConfirm !== 'RESET'}
                        className="w-full h-10 rounded-xl font-bold text-xs uppercase tracking-widest"
                      >
                        {dataActionLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Reset Selected School
                      </Button>
                    </CardContent>
                  </Card>
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
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">School Request</p>
                                <h4 className="font-black text-lg text-slate-900 dark:text-white font-outfit tracking-tight leading-tight mb-2">{r.school_name}</h4>
                                <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'approved' ? 'default' : r.status === 'contacted' ? 'outline' : 'destructive'} className="font-black text-[9px] uppercase tracking-wider px-2 py-0.5">
                                  {r.status}
                                </Badge>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <p className="text-[10px] font-bold text-slate-500/60 uppercase tracking-widest">Submitted On</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatDate(r.created_at)}</p>
                              </div>
                            </div>

                            {/* Core Info */}
                            <div className="flex-1 p-6 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">School Contact Person</p>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                      <User className="w-4 h-4 text-indigo-500" />
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">{r.admin_name}</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Email & Phone</p>
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
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Registration Details</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">"{r.message}"</p>
                                </div>
                              )}

                              {r.internal_note && (
                                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1">Internal Review Note</p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.internal_note}</p>
                                </div>
                              )}

                              {r.status === 'approved' && r.generated_password && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                  <p className="text-xs font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-widest">School Login Credentials</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Admin Username</p>
                                      <code className="block bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs">{r.generated_username || 'admin'}</code>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Temporary Password</p>
                                      <div className="relative">
                                        <code className="block bg-white dark:bg-slate-900 px-3 py-2 pr-10 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                          {visibleRegistrationPasswords[r.id] ? r.generated_password : '••••••••••'}
                                        </code>
                                        <button
                                          type="button"
                                          onClick={() => setVisibleRegistrationPasswords((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                                          aria-label={visibleRegistrationPasswords[r.id] ? 'Hide generated password' : 'Show generated password'}
                                        >
                                          {visibleRegistrationPasswords[r.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => openSchool({ id: r.tenant_id!, slug: r.school_slug! })}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-emerald-500/10"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                    Open School Dashboard
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
                                Add Note
                              </Button>
                              <Button
                                variant="ghost"
                                className="flex-1 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10"
                                onClick={() => handleDeleteRegistration(r.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete
                              </Button>
                              
                              {r.status === 'pending' && (
                                <div className="hidden lg:flex flex-col gap-2 mt-auto w-full">
                                  <Button onClick={() => updateRegistrationStatus(r.id, 'contacted')} className="w-full h-10 rounded-xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest bg-indigo-500/5 hover:bg-indigo-500/10">Mark Contacted</Button>
                                  <Button onClick={() => updateRegistrationStatus(r.id, 'approved')} className="w-full h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest">Approve & Create</Button>
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
                      <DialogTitle className="text-xl font-black font-outfit">Internal Review Note</DialogTitle>
                      <DialogDescription className="text-xs font-medium">Add administrative context for {noteReg?.school_name}.</DialogDescription>
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
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Global Audit Monitor</h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Starts with Super Admin portal and login activity. Turn the scope off to search all schools.
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 md:w-auto md:grid-cols-3 xl:grid-cols-4">
                    <div className="flex h-10 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Super Admin Portal</p>
                      </div>
                      <Switch
                        checked={auditSuperAdminOnly}
                        onCheckedChange={(v) => setAuditSuperAdminOnly(v)}
                        className="data-[state=checked]:!bg-emerald-500 data-[state=unchecked]:!bg-red-500"
                      />
                    </div>
                    <Input
                      value={auditFilters.search}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, search: e.target.value }))}
                      placeholder="Search user, summary, details..."
                      className="h-10 w-full md:w-64 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                    />
                    <select
                      value={auditFilters.tenantId}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, tenantId: e.target.value }))}
                      disabled={auditSuperAdminOnly}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">School: ALL</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                      ))}
                    </select>
                    <select
                      value={auditFilters.module}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, module: e.target.value }))}
                      disabled={auditSuperAdminOnly}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Module: ALL</option>
                      <option value="finance">Finance</option>
                      <option value="academics">Academics</option>
                      <option value="administration">Administration</option>
                      <option value="settings">Settings</option>
                      <option value="security">Security</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    <select
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Action: ALL</option>
                      <option value="LOGIN">Login</option>
                      <option value="LOGOUT">Logout</option>
                      <option value="CREATE">Create</option>
                      <option value="UPDATE">Update</option>
                      <option value="DELETE">Delete</option>
                      <option value="FEE_STRUCTURE_CREATE">Fee Create</option>
                      <option value="FEE_STRUCTURE_UPDATE">Fee Update</option>
                      <option value="INCOME_CREATE">Income Create</option>
                      <option value="EXPENSE_CREATE">Expense Create</option>
                      <option value="SALARY_PAYMENT">Salary Payment</option>
                    </select>
                    <select
                      value={auditFilters.status}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, status: e.target.value }))}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Status: ALL</option>
                      <option value="success">SUCCESS</option>
                      <option value="failed">FAILED</option>
                    </select>
                    <Input
                      type="date"
                      value={auditFilters.startDate}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, startDate: e.target.value }))}
                      className="h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                    />
                    <Input
                      type="date"
                      value={auditFilters.endDate}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, endDate: e.target.value }))}
                      className="h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                    />
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
                    <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">No Audit Events</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">No system activity matches the current filter set.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Total Events', value: auditLogs.length, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-500/10' },
                        { label: 'Finance Events', value: auditLogs.filter(isFinanceAudit).length, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                        { label: 'Failed Events', value: auditLogs.filter((l) => l.status === 'failed' || l.action.includes('FAILED')).length, color: 'text-red-500', bg: 'bg-red-500/10' },
                        { label: 'Active Schools', value: new Set(auditLogs.map((l) => l.tenant_id).filter(Boolean)).size, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                      ].map((stat) => (
                        <Card key={stat.label} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                          <CardContent className="p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                            <p className={cn("mt-2 text-3xl font-black font-outfit", stat.color)}>{stat.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
                            <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">When</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Action</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">User</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">School</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Module</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Target</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">IP</TableHead>
                              <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditLogs.map((log) => {
                              const failed = log.status === 'failed' || log.action.includes('FAILED') || log.action.includes('BLOCKED');
                              const finance = isFinanceAudit(log);
                              const principal = log.user_full_name || log.username || (log.action === 'SUPER_ADMIN_PORTAL_VISIT' ? 'Visitor / not signed in' : 'Unknown username');
                              return (
                                <TableRow
                                  key={log.id}
                                  onClick={() => setSelectedAuditLog(log)}
                                  className={cn(
                                    'cursor-pointer border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                                    finance && 'bg-emerald-500/[0.03]'
                                  )}
                                >
                                  <TableCell className="whitespace-nowrap text-xs font-medium text-slate-500">{formatDate(log.created_at)}</TableCell>
                                  <TableCell className="min-w-[190px]">
                                    <div className="flex items-center gap-2">
                                      <span className={cn('h-2.5 w-2.5 rounded-full', failed ? 'bg-red-500' : finance ? 'bg-emerald-500' : 'bg-blue-500')} />
                                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        {log.action.replace(/^SUPER_ADMIN_/, '').replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <p className="mt-1 line-clamp-1 max-w-[360px] text-xs text-slate-500">{log.summary || log.action}</p>
                                  </TableCell>
                                  <TableCell className="min-w-[160px] text-sm font-bold text-slate-700 dark:text-slate-200">{principal}</TableCell>
                                  <TableCell className="min-w-[150px] text-sm text-slate-500">{log.tenant_name || (auditSuperAdminOnly ? 'Super Admin Portal' : 'Platform')}</TableCell>
                                  <TableCell>
                                    <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-none', moduleTone(log.module, log.action, log.entity_type))}>
                                      {log.module || 'general'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {log.entity_type || 'SYSTEM'}{log.entity_id ? ` #${log.entity_id}` : ''}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-mono text-xs text-slate-500">{log.ip_address || '-'}</TableCell>
                                  <TableCell>
                                    <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-none', failed ? 'border-red-500/20 bg-red-500/10 text-red-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600')}>
                                      {log.status || 'success'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}

            <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-900">
                <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left dark:border-slate-800">
                  <DialogTitle className="font-outfit text-2xl font-black">Audit Event Details</DialogTitle>
                  <DialogDescription className="text-xs font-medium">
                    Full event context, actor, device, target record, and captured values.
                  </DialogDescription>
                </DialogHeader>
                {selectedAuditLog && (
                  <div className="max-h-[calc(90vh-110px)] overflow-y-auto p-6">
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-none', moduleTone(selectedAuditLog.module, selectedAuditLog.action, selectedAuditLog.entity_type))}>
                        {selectedAuditLog.module || 'general'}
                      </Badge>
                      {isFinanceAudit(selectedAuditLog) && (
                        <Badge className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 shadow-none">
                          Finance Priority
                        </Badge>
                      )}
                      <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow-none', selectedAuditLog.status === 'failed' ? 'border-red-500/20 bg-red-500/10 text-red-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600')}>
                        {selectedAuditLog.status || 'success'}
                      </Badge>
                    </div>

                    <h3 className="font-outfit text-xl font-black text-slate-900 dark:text-white">
                      {selectedAuditLog.summary || selectedAuditLog.action.replace(/_/g, ' ')}
                    </h3>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {[
                        ['Time', formatDate(selectedAuditLog.created_at)],
                        ['Action', selectedAuditLog.action.replace(/^SUPER_ADMIN_/, '').replace(/_/g, ' ')],
                        ['User', selectedAuditLog.user_full_name || selectedAuditLog.username || 'Visitor / not signed in'],
                        ['School', selectedAuditLog.tenant_name || (selectedAuditLog.module === 'superadmin' ? 'Super Admin Portal' : 'Platform')],
                        ['Target', `${selectedAuditLog.entity_type || 'SYSTEM'}${selectedAuditLog.entity_id ? ` #${selectedAuditLog.entity_id}` : ''}`],
                        ['IP Address', selectedAuditLog.ip_address || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                          <p className="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
                        </div>
                      ))}
                    </div>

                    {selectedAuditLog.user_agent && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Device / Browser</p>
                        <p className="mt-1 break-words font-mono text-xs text-slate-600 dark:text-slate-300">{selectedAuditLog.user_agent}</p>
                      </div>
                    )}

                    <div className="mt-5 grid gap-4">
                      {[
                        ['Details', selectedAuditLog.details],
                        ['Before Values', selectedAuditLog.before_values],
                        ['After Values', selectedAuditLog.after_values],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-950 p-4 dark:border-slate-800">
                          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">{String(label)}</p>
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-100">
                            {value ? JSON.stringify(value, null, 2) : 'No data captured'}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>


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
