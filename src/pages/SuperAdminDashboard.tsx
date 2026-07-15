import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrandedLoading, BrandedLoadingScreen, isSplashGone } from '@/components/common/BrandedLoading';
import { PlatformAdminNoIndex } from '@/components/superadmin/PlatformAdminNoIndex';
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
  DialogBody,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  formDialogContentClass,
  formDialogContentWideClass,
  formDialogContentXWideClass,
  dialogTitleClass,
  dialogLabelClass,
  dialogSectionClass,
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
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useStaffPushSync } from '../hooks/useStaffPushSync';
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
  UserCheck,
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
  Activity,
  BarChart3,
  Megaphone,
  UserRoundSearch,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Settings,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import SuperAdminLoginForm from '../components/SuperAdminLoginForm';
import SupportModule from '../components/support/SupportModule';
import ChatBroadcastPanel from '../components/chat/ChatBroadcastPanel';
import SchoolWebsitesPanel from '@/components/superadmin/SchoolWebsitesPanel';
import { superAdminWebsiteService } from '@/services/schoolWebsiteService';
import SuperAdminSchoolChatModule from '../components/chat/SuperAdminSchoolChatModule';
import { resolveLogoUrl } from '../services/tenantService';
import { useTheme } from '../contexts/ThemeContext';
import PwaInstallButton from '../components/common/PwaInstallButton';
import SystemHealthModule from '../components/superadmin/SystemHealthModule';
import PlatformSettingsModule from '../components/superadmin/PlatformSettingsModule';
import GlobalAnnouncementsModule from '../components/superadmin/GlobalAnnouncementsModule';
import PlatformUsageModule from '../components/superadmin/PlatformUsageModule';
import SuperAdminFinanceWipeModule from '../components/superadmin/SuperAdminFinanceWipeModule';
import { SchoolProvider } from '../contexts/SchoolContext';
import { ImpersonationProvider } from '../contexts/ImpersonationContext';
import ImpersonationShell from '../components/impersonation/ImpersonationShell';
import { buildSuperAdminHandoffUrl } from '../utils/superAdminSessionHandoff';
import BecomeUserPanel from '../components/impersonation/BecomeUserPanel';
import StaffActionConfirmDialog from '../components/common/StaffActionConfirmDialog';

interface School {
  id: number;
  name: string;
  settings_school_name?: string | null;
  slug?: string;
  subdomain?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  subscription_status?: string;
  is_active?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

type SchoolEditForm = {
  id: number;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  adminUsername: string;
  adminEmail: string;
  adminFullName: string;
  adminPhone: string;
  adminNewPassword: string;
  logo_url?: string | null;
};

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
  entity_label?: string | null;
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

interface OnlineSession {
  socketId: string;
  userId: number;
  tenantId: number | null;
  tenantName: string;
  username: string;
  fullName?: string | null;
  role: string;
  connectedAt?: string | null;
  durationSeconds?: number | null;
}

type Section = 'schools' | 'usage' | 'visits' | 'tracker' | 'registrations' | 'audit' | 'super-admins' | 'support-chat' | 'school-general-chat' | 'chat-broadcast' | 'school-websites' | 'school-data' | 'system-health' | 'platform-settings' | 'announcements' | 'online-users' | 'removed-staff' | 'finance-wipe';

interface RemovedTeacher {
  id: number;
  tenant_id: number;
  full_name: string;
  staff_id?: string | null;
  deleted_at?: string | null;
  school_name?: string;
  school_slug?: string;
}

/** Normalize school name for reset confirmation (trim, collapse spaces, case-insensitive). */
function normalizeSchoolConfirmName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function schoolResetNameMatches(
  school: { name: string; settings_school_name?: string | null },
  typed: string
): boolean {
  const candidates = [school.name, school.settings_school_name].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0
  );
  const normalizedTyped = normalizeSchoolConfirmName(typed);
  if (!normalizedTyped) return false;
  return candidates.some((name) => normalizeSchoolConfirmName(name) === normalizedTyped);
}

function schoolResetDisplayName(school: { name: string; settings_school_name?: string | null }): string {
  const settingsName = school.settings_school_name?.trim();
  if (settingsName && normalizeSchoolConfirmName(settingsName) !== normalizeSchoolConfirmName(school.name)) {
    return `${school.name} (or ${settingsName})`;
  }
  return school.name;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading, isPlatformSuperAdmin } = useAuth();
  const { socket } = useSocket();
  useStaffPushSync();
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [section, setSection] = useState<Section>('schools');
  const [supportInboxUnread, setSupportInboxUnread] = useState(0);
  const [websiteEnablePending, setWebsiteEnablePending] = useState(0);
  const [schools, setSchools] = useState<School[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [landingVisitors, setLandingVisitors] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<{ id: number; name: string; slug: string; username: string; password: string } | null>(null);
  const [editForm, setEditForm] = useState<SchoolEditForm | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<School | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showArchivedSchools, setShowArchivedSchools] = useState(false);
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
  const [onlineSessions, setOnlineSessions] = useState<OnlineSession[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineSearch, setOnlineSearch] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineLastUpdated, setOnlineLastUpdated] = useState<string | null>(null);
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
  const [becomeUserOpen, setBecomeUserOpen] = useState(false);
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
  const [dataActionLoading, setDataActionLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [removedTeachers, setRemovedTeachers] = useState<RemovedTeacher[]>([]);
  const [removedLoading, setRemovedLoading] = useState(false);
  const [permanentDeletingId, setPermanentDeletingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [removedAction, setRemovedAction] = useState<{
    row: RemovedTeacher;
    action: 'restore' | 'permanent';
  } | null>(null);
  const [removedActionLoading, setRemovedActionLoading] = useState(false);
  const [importValidation, setImportValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats: Record<string, number>;
    schoolName?: string;
    sourceTenantId?: number;
    total_records?: number;
    manifest?: {
      tenant_name?: string;
      created_at?: string;
      total_records?: number;
      table_counts?: Record<string, number>;
    };
  } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [restoreUnderstand, setRestoreUnderstand] = useState(false);
  const [resetSchoolNameConfirm, setResetSchoolNameConfirm] = useState('');
  const [selectedSchoolDetail, setSelectedSchoolDetail] = useState<School | null>(null);
  const [schoolOverview, setSchoolOverview] = useState<{
    stats?: Record<string, number>;
    primary_admin?: { username?: string; email?: string; full_name?: string; phone?: string };
    school_settings?: Record<string, unknown>;
  } | null>(null);
  const [schoolOverviewLoading, setSchoolOverviewLoading] = useState(false);
  const displayName = user?.fullName?.trim() || user?.username || '';

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    apiService.clearTenantContext();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'super-admin') loadData();
  }, [user]);

  useEffect(() => {
    if (schools.length === 0) return;
    const hasValidSelection = schools.some((s) => String(s.id) === selectedDataSchoolId);
    if (!hasValidSelection) {
      setSelectedDataSchoolId(String(schools[0].id));
    }
  }, [schools, selectedDataSchoolId]);

  useEffect(() => {
    setResetSchoolNameConfirm('');
    setImportFile(null);
    setImportValidation(null);
    setRestoreUnderstand(false);
  }, [selectedDataSchoolId]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'removed-staff') void loadRemovedTeachers();
  }, [section, user?.role]);

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

  useEffect(() => {
    if (user?.role !== 'super-admin' || section !== 'online-users') return;
    void loadOnlineSessions();
    const id = window.setInterval(() => void loadOnlineSessions(), 10000);
    return () => window.clearInterval(id);
  }, [section, user?.role]);

  useEffect(() => {
    if (!socket || user?.role !== 'super-admin') return;
    const onOnlineUpdate = () => {
      if (section === 'online-users') {
        void loadOnlineSessions();
      }
    };
    socket.on('super-admin-online-users-updated', onOnlineUpdate);
    return () => {
      socket.off('super-admin-online-users-updated', onOnlineUpdate);
    };
  }, [socket, user?.role, section]);

  const refreshSupportInboxUnread = useCallback(async () => {
    if (user?.role !== 'super-admin') return;
    try {
      const r = await apiService.get<{ count: number }>('/support-chat/unread-count', {
        skipTenant: true,
        skipTenantHeaders: true,
      });
      setSupportInboxUnread(Number(r?.count ?? 0));
    } catch {
      setSupportInboxUnread(0);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    void refreshSupportInboxUnread();
    const id = window.setInterval(() => void refreshSupportInboxUnread(), 60000);
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
    socket.on('support-chat-read', onTenant);
    return () => {
      socket.off('new-support-message', onNew);
      socket.off('tenant-data-changed', onTenant);
      socket.off('support-chat-read', onTenant);
    };
  }, [socket, user?.role, refreshSupportInboxUnread]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'support-chat') void refreshSupportInboxUnread();
  }, [section, user?.role, refreshSupportInboxUnread]);

  const refreshWebsiteEnablePending = useCallback(async () => {
    if (user?.role !== 'super-admin') return;
    try {
      const data = await superAdminWebsiteService.list();
      const count = Number(
        data.stats?.pending_enable_requests ?? data.enable_requests?.length ?? 0
      );
      setWebsiteEnablePending(count);
    } catch {
      setWebsiteEnablePending(0);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    void refreshWebsiteEnablePending();
    const id = window.setInterval(() => void refreshWebsiteEnablePending(), 60000);
    return () => window.clearInterval(id);
  }, [user?.role, refreshWebsiteEnablePending]);

  useEffect(() => {
    if (!socket || user?.role !== 'super-admin') return;
    const onEnableRequest = (payload: { schoolName?: string; message?: string }) => {
      void refreshWebsiteEnablePending();
      toast({
        title: 'Website activation request',
        description: payload.schoolName
          ? `${payload.schoolName}: ${String(payload.message || '').slice(0, 120)}`
          : String(payload.message || 'A school requested the website feature.'),
      });
    };
    const onTenant = (evt: { entity?: string }) => {
      if (String(evt?.entity || '') === 'website-enable-request') void refreshWebsiteEnablePending();
    };
    socket.on('website-enable-request', onEnableRequest);
    socket.on('tenant-data-changed', onTenant);
    return () => {
      socket.off('website-enable-request', onEnableRequest);
      socket.off('tenant-data-changed', onTenant);
    };
  }, [socket, user?.role, refreshWebsiteEnablePending]);

  useEffect(() => {
    if (user?.role === 'super-admin' && section === 'school-websites') void refreshWebsiteEnablePending();
  }, [section, user?.role, refreshWebsiteEnablePending]);

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    const onRefresh = () => void refreshSupportInboxUnread();
    window.addEventListener('comms-badges-refresh', onRefresh);
    return () => window.removeEventListener('comms-badges-refresh', onRefresh);
  }, [user?.role, refreshSupportInboxUnread]);

  useEffect(() => {
    if (user?.role !== 'super-admin') return;
    void loadVisitStats();
    const id = window.setInterval(() => void loadVisitStats(), 60000);
    return () => window.clearInterval(id);
  }, [user?.role]);

  const loadAuditLogs = async () => {
    try {
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
    } catch (err: unknown) {
      console.warn('Audit logs load failed:', err);
      setAuditLogs([]);
      if (section === 'audit') {
        toast({
          title: 'Audit load failed',
          description: err instanceof Error ? err.message : 'Could not load audit logs',
          variant: 'destructive',
        });
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [schoolsList, regs, admins, visitStats] = await Promise.all([
        apiService.get<School[]>('/schools', { skipTenant: true }),
        apiService.get<Registration[]>('/school-registrations', { skipTenant: true }).catch(() => []),
        apiService.get<Array<{ id: number; username: string; email?: string; full_name?: string; phone?: string }>>('/schools/super-admins', { skipTenant: true }).catch(() => []),
        apiService.get<{ landingVisitors: number }>('/stats/visits', { skipTenant: true }).catch(() => ({ landingVisitors: 0 })),
      ]);
      setSchools(Array.isArray(schoolsList) ? schoolsList : []);
      setRegistrations(Array.isArray(regs) ? regs : []);
      setSuperAdmins(Array.isArray(admins) ? admins : []);
      setLandingVisitors(Number(visitStats?.landingVisitors ?? 0));
    } catch (err: unknown) {
      console.error('Super admin loadData failed:', err);
      toast({
        title: 'Failed to load schools',
        description: err instanceof Error ? err.message : 'Could not load tenant list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSchools = async () => {
    try {
      const list = await apiService.get<School[]>('/schools', { skipTenant: true });
      setSchools(Array.isArray(list) ? list : []);
    } catch {
      setSchools([]);
    }
  };

  const loadRemovedTeachers = async () => {
    setRemovedLoading(true);
    try {
      const list = await apiService.get<RemovedTeacher[]>('/schools/removed-teachers');
      setRemovedTeachers(Array.isArray(list) ? list : []);
    } catch {
      setRemovedTeachers([]);
      toast({ title: 'Failed to load removed staff', variant: 'destructive' });
    } finally {
      setRemovedLoading(false);
    }
  };

  const executeRemovedStaffAction = async () => {
    if (!removedAction) return;
    const { row, action } = removedAction;
    setRemovedActionLoading(true);
    if (action === 'permanent') setPermanentDeletingId(row.id);
    else setRestoringId(row.id);
    try {
      if (action === 'permanent') {
        await apiService.post(`/schools/removed-teachers/${row.id}/permanent-delete`, {
          tenantId: row.tenant_id,
        });
        toast({ title: 'Permanently deleted', description: 'Record hidden from all admin views.' });
      } else {
        await apiService.post(`/schools/removed-teachers/${row.id}/restore`, {
          tenantId: row.tenant_id,
        });
        toast({
          title: 'Restored to school',
          description: `${row.full_name || 'Teacher'} is visible in school lists again. Update their profile if needed.`,
        });
      }
      setRemovedAction(null);
      await loadRemovedTeachers();
    } catch (e: unknown) {
      toast({
        title: action === 'permanent' ? 'Delete failed' : 'Restore failed',
        description: e instanceof Error ? e.message : 'Action could not be completed',
        variant: 'destructive',
      });
    } finally {
      setRemovedActionLoading(false);
      setPermanentDeletingId(null);
      setRestoringId(null);
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

  const loadOnlineSessions = async () => {
    setOnlineLoading(true);
    setOnlineError(null);
    try {
      const sessions = await apiService.get<OnlineSession[]>('/super-admin/live-users', { skipTenant: true });
      setOnlineSessions(Array.isArray(sessions) ? sessions : []);
      setOnlineLastUpdated(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load live users';
      setOnlineError(msg);
      setOnlineSessions([]);
    } finally {
      setOnlineLoading(false);
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
      }, { skipTenant: true });
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
    if (!editForm) return;
    try {
      await apiService.put(
        `/schools/${editForm.id}`,
        {
          name: editForm.name,
          slug: editForm.slug,
          subdomain: editForm.slug,
          primary_color: editForm.primary_color,
          secondary_color: editForm.secondary_color,
          adminUsername: editForm.adminUsername,
          adminEmail: editForm.adminEmail || null,
          adminFullName: editForm.adminFullName || null,
          adminPhone: editForm.adminPhone || null,
          adminNewPassword: editForm.adminNewPassword || undefined,
        },
        { skipTenant: true, skipTenantHeaders: true }
      );
      if (editLogoFile) {
        const formData = new FormData();
        formData.append('logo', editLogoFile);
        const token = localStorage.getItem('authToken');
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        await fetch(`${base}/schools/${editForm.id}/logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      toast({ title: 'School updated successfully!' });
      setEditForm(null);
      setEditLogoFile(null);
      setShowEditAdminPassword(false);
      loadSchools();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update school', variant: 'destructive' });
    }
  };

  const openEditSchool = async (school: School) => {
    setEditFormLoading(true);
    setEditLogoFile(null);
    setShowEditAdminPassword(false);
    try {
      const overview = await apiService.get<{
        primary_admin?: { username?: string; email?: string; full_name?: string; phone?: string };
      }>(`/schools/${school.id}/overview`, { skipTenant: true });
      setEditForm({
        id: school.id,
        name: school.name,
        slug: school.slug || school.subdomain || '',
        primary_color: school.primary_color || '#2563eb',
        secondary_color: school.secondary_color || '#7c3aed',
        logo_url: school.logo_url ?? null,
        adminUsername: overview.primary_admin?.username || '',
        adminEmail: overview.primary_admin?.email || '',
        adminFullName: overview.primary_admin?.full_name || '',
        adminPhone: overview.primary_admin?.phone || '',
        adminNewPassword: '',
      });
    } catch (err: unknown) {
      toast({
        title: 'Could not load school details',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setEditFormLoading(false);
    }
  };

  const handleArchiveSchool = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await apiService.post(`/schools/${archiveTarget.id}/archive`, {}, { skipTenant: true, skipTenantHeaders: true });
      toast({
        title: `${archiveTarget.name} archived`,
        description: 'Removed from login and hidden from this list. Turn on Show archived to view it again.',
      });
      setArchiveTarget(null);
      setShowArchivedSchools(false);
      loadSchools();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to archive school', variant: 'destructive' });
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestoreSchool = async (school: School) => {
    try {
      await apiService.post(`/schools/${school.id}/restore`, {}, { skipTenant: true, skipTenantHeaders: true });
      toast({ title: `${school.name} restored`, description: 'School is active and visible on login again.' });
      loadSchools();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to restore school', variant: 'destructive' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSchool || !newPassword || newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post(`/schools/${resetSchool.id}/reset-password`, { newPassword }, { skipTenant: true, skipTenantHeaders: true });
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
        await apiService.post(`/schools/${school.id}/deactivate`, {}, { skipTenant: true, skipTenantHeaders: true });
        toast({ title: 'School suspended' });
      } else {
        await apiService.post(`/schools/${school.id}/activate`, {}, { skipTenant: true, skipTenantHeaders: true });
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
    if (school.slug) {
      const baseUrl = getSubdomainUrl(school.slug);
      const token = localStorage.getItem('authToken');
      const url = token ? buildSuperAdminHandoffUrl(baseUrl, token) : baseUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const path = `/school/${school.id}`;
      window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer');
    }
  };

  const loginUrl = (school: School | { id: number; slug?: string }) => {
    if (school.slug) {
      return getSubdomainUrl(school.slug);
    }
    return `${window.location.origin}/school/${school.id}`;
  };

  const selectedDataSchool = schools.find((s) => String(s.id) === selectedDataSchoolId) || null;
  const resetSchoolNameMatches = selectedDataSchool
    ? schoolResetNameMatches(selectedDataSchool, resetSchoolNameConfirm)
    : false;

  const growthStat = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const recent = schools.filter((s) => {
      if (!s.created_at) return false;
      return now - new Date(s.created_at).getTime() <= thirtyDays;
    }).length;
    const previous = schools.filter((s) => {
      if (!s.created_at) return false;
      const age = now - new Date(s.created_at).getTime();
      return age > thirtyDays && age <= thirtyDays * 2;
    }).length;
    if (previous === 0) {
      return recent > 0 ? `+${recent} new` : '0%';
    }
    const pct = Math.round(((recent - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }, [schools]);

  const visibleSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return schools.filter((school) => {
      if (!showArchivedSchools && school.archived_at) return false;
      if (!q) return true;
      return (
        school.name.toLowerCase().includes(q) ||
        String(school.id).includes(q) ||
        String(school.slug || '').toLowerCase().includes(q)
      );
    });
  }, [schools, searchQuery, showArchivedSchools]);

  const archivedSchoolCount = useMemo(
    () => schools.filter((school) => school.archived_at).length,
    [schools]
  );

  const createLogoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );

  const editLogoFilePreview = useMemo(
    () => (editLogoFile ? URL.createObjectURL(editLogoFile) : null),
    [editLogoFile]
  );

  useEffect(() => {
    return () => {
      if (createLogoPreview) URL.revokeObjectURL(createLogoPreview);
    };
  }, [createLogoPreview]);

  useEffect(() => {
    return () => {
      if (editLogoFilePreview) URL.revokeObjectURL(editLogoFilePreview);
    };
  }, [editLogoFilePreview]);

  const editLogoPreview =
    editLogoFilePreview ?? (editForm?.logo_url ? resolveLogoUrl(editForm.logo_url) : null);

  const openSchoolDetail = async (school: School) => {
    setSelectedSchoolDetail(school);
    setSchoolOverview(null);
    setSchoolOverviewLoading(true);
    try {
      const overview = await apiService.get<{
        stats?: Record<string, number>;
        primary_admin?: { username?: string; email?: string; full_name?: string; phone?: string };
        school_settings?: Record<string, unknown>;
      }>(`/schools/${school.id}/overview`, { skipTenant: true });
      setSchoolOverview(overview);
    } catch (err: unknown) {
      toast({
        title: 'Could not load school details',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setSchoolOverviewLoading(false);
    }
  };

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

  const formatOnlineDuration = (seconds: number | null | undefined): string => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `Online for ${days} day${days === 1 ? '' : 's'}`;
    if (hrs > 0) return `Online for ${hrs} hour${hrs === 1 ? '' : 's'}`;
    if (mins > 0) return `Online for ${mins} minute${mins === 1 ? '' : 's'}`;
    return `Online for ${seconds} second${seconds === 1 ? '' : 's'}`;
  };

  const filteredOnlineSessions = onlineSessions.filter((session) => {
    const term = onlineSearch.trim().toLowerCase();
    if (!term) return true;
    return [session.username, session.fullName ?? '', session.role, session.tenantName, session.socketId]
      .some((value) => value.toLowerCase().includes(term));
  });

  const uniqueOnlineUsers = Array.from(new Set(onlineSessions.map((session) => session.userId))).length;

  const handleSchoolBackup = async (school: School) => {
    setDataActionLoading(true);
    try {
      const backup = await apiService.get<any>(`/super-admin/tenants/${school.id}/backup`);
      const safeName = (school.slug || school.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      downloadJson(backup, `scholarnerve_backup_${safeName || 'school'}_${new Date().toISOString().split('T')[0]}.json`);
      toast({
        title: 'Backup created',
        description: `${school.name}: ${backup.manifest?.total_records ?? 0} records exported.`,
      });
    } catch (err: any) {
      toast({ title: 'Backup failed', description: err?.message || 'Could not create backup', variant: 'destructive' });
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleSuperAdminBackup = async () => {
    if (!selectedDataSchool) {
      toast({ title: 'Select a school first', variant: 'destructive' });
      return;
    }
    await handleSchoolBackup(selectedDataSchool);
  };

  const handleSuperAdminResetData = async () => {
    const target = selectedDataSchool;
    if (!target) {
      toast({ title: 'Select a school first', variant: 'destructive' });
      return;
    }
    if (!schoolResetNameMatches(target, resetSchoolNameConfirm)) {
      toast({
        title: 'Confirmation required',
        description: `Type the school name exactly as shown: "${schoolResetDisplayName(target)}"`,
        variant: 'destructive',
      });
      return;
    }
    setDataActionLoading(true);
    try {
      await apiService.post(
        `/super-admin/tenants/${target.id}/reset`,
        { confirmation: `RESET_TENANT_${target.id}` },
        { skipTenant: true }
      );
      toast({
        title: 'School data reset',
        description: `${target.name} operational data has been cleared. Refresh the school dashboard to see changes.`,
      });
      setResetSchoolNameConfirm('');
      await loadSchools();
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err?.message || 'Could not reset school data', variant: 'destructive' });
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleImportFileSelect = async (file: File | null) => {
    const target = selectedDataSchool;
    setImportFile(file);
    setImportValidation(null);
    setRestoreUnderstand(false);
    if (!file || !target) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      toast({ title: 'Invalid file', description: 'Select a JSON backup file exported from ScholarNerve.', variant: 'destructive' });
      setImportFile(null);
      return;
    }

    setDataActionLoading(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      const validation = await apiService.postForm<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        stats: Record<string, number>;
        schoolName?: string;
        sourceTenantId?: number;
        total_records?: number;
        manifest?: {
          tenant_name?: string;
          created_at?: string;
          total_records?: number;
          table_counts?: Record<string, number>;
        };
      }>(`/super-admin/tenants/${target.id}/validate-backup`, form, { skipTenant: true });
      setImportValidation(validation);
      if (validation.valid) {
        setShowImportDialog(true);
        toast({
          title: 'Backup validated',
          description: validation.warnings.length
            ? `${validation.warnings.length} warning(s) — review before restoring.`
            : 'File looks good. Confirm restore to replace all data.',
        });
      } else {
        toast({
          title: 'Validation failed',
          description: validation.errors.join(' ') || 'This backup file cannot be restored.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Validation failed', description: err?.message || 'Could not validate backup file', variant: 'destructive' });
      setImportFile(null);
    } finally {
      setDataActionLoading(false);
    }
  };

  const handleSuperAdminImport = async () => {
    const target = selectedDataSchool;
    if (!target || !importFile) {
      toast({ title: 'Select a school and backup file first', variant: 'destructive' });
      return;
    }
    if (!restoreUnderstand) {
      toast({ title: 'Confirmation required', description: 'Check the box to confirm you understand this will replace all data.', variant: 'destructive' });
      return;
    }
    setDataActionLoading(true);
    try {
      const form = new FormData();
      form.append('backup', importFile);
      const result = await apiService.postForm<{
        success: boolean;
        message: string;
        total_records?: number;
        restored?: Record<string, number>;
      }>(`/super-admin/tenants/${target.id}/restore`, form, { skipTenant: true });
      toast({
        title: 'Restore complete',
        description: result.message || `${target.name}: ${result.total_records ?? 0} record(s) restored.`,
      });
      setShowImportDialog(false);
      setImportFile(null);
      setImportValidation(null);
      setRestoreUnderstand(false);
    } catch (err: any) {
      toast({ title: 'Restore failed', description: err?.message || 'Could not restore school data', variant: 'destructive' });
    } finally {
      setDataActionLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (authLoading) {
    return (
      <>
        <PlatformAdminNoIndex />
        {isSplashGone() ? <BrandedLoadingScreen label="Loading…" active={authLoading} /> : null}
      </>
    );
  }
  if (!user || user.role !== 'super-admin') {
    return (
      <>
        <PlatformAdminNoIndex />
        <SuperAdminLoginForm />
      </>
    );
  }

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
    { id: 'usage' as Section, label: 'Usage', icon: BarChart3 },
    { id: 'announcements' as Section, label: 'Announcements', icon: Megaphone },
    { id: 'visits' as Section, label: 'Visitor Analytics', icon: Globe },
    { id: 'online-users' as Section, label: 'Online Users', icon: UserCheck },
    { id: 'tracker' as Section, label: 'Tracker', icon: ShieldCheck },
    { id: 'school-data' as Section, label: 'School Data', icon: FileText },
    { id: 'registrations' as Section, label: 'Registration Requests', icon: ClipboardList },
    { id: 'support-chat' as Section, label: 'Support Chat', icon: MessageCircle },
    { id: 'school-general-chat' as Section, label: 'School General Chat', icon: Globe },
    { id: 'chat-broadcast' as Section, label: 'School Broadcast', icon: Megaphone },
    { id: 'school-websites' as Section, label: 'School Websites', icon: Globe },
  ];
  const systemItems = [
    { id: 'platform-settings' as Section, label: 'Platform Settings', icon: Settings },
    { id: 'finance-wipe' as Section, label: 'Finance Config', icon: Trash2 },
    { id: 'removed-staff' as Section, label: 'Removed Staff', icon: UserRoundSearch },
    { id: 'system-health' as Section, label: 'System Health', icon: Activity },
    { id: 'super-admins' as Section, label: 'Super Admins', icon: UserPlus },
    { id: 'audit' as Section, label: 'Audit Logs', icon: Shield },
  ];

  return (
    <>
      <PlatformAdminNoIndex />
      <SchoolProvider schoolIdFromUrl={null}>
      <ImpersonationProvider returnModule="super-admin">
        <ImpersonationShell>
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
                        {id === 'school-websites' && websiteEnablePending > 0 && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                            {websiteEnablePending > 99 ? '99+' : websiteEnablePending}
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
              {isPlatformSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setBecomeUserOpen(true)}
                    className="rounded-xl mx-2 text-amber-600/90 hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
                  >
                    <UserRoundSearch className="h-4 w-4" />
                    <span>Become a User</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
              {section === 'usage' && 'Platform Usage'}
              {section === 'announcements' && 'Global Announcements'}
              {section === 'visits' && 'Visitor Analytics'}
              {section === 'online-users' && 'Online Users / Active Sessions'}
              {section === 'tracker' && 'Tracker'}
              {section === 'school-data' && 'School Data Management'}
              {section === 'registrations' && 'Registration Requests'}
              {section === 'super-admins' && 'Super Admins'}
              {section === 'audit' && 'Audit Logs'}
              {section === 'system-health' && 'System Health / Errors'}
              {section === 'platform-settings' && 'Platform Settings'}
              {section === 'finance-wipe' && 'Finance Configuration'}
              {section === 'removed-staff' && 'Removed Staff'}
              {section === 'school-general-chat' && 'School General Chat'}
              {section === 'chat-broadcast' && 'School Broadcast'}
              {section === 'school-websites' && (
                <>
                  School Websites
                  {websiteEnablePending > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {websiteEnablePending > 99 ? '99+' : websiteEnablePending}
                    </span>
                  )}
                </>
              )}
              {section === 'announcements' && 'Global Announcements'}
              {section === 'support-chat' && (
                <>
                  Support Chat
                  {supportInboxUnread > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {supportInboxUnread > 99 ? '99+' : supportInboxUnread}
                    </span>
                  )}
                </>
              )}
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
                    { label: 'Growth (30d)', value: growthStat, icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
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
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        <Switch checked={showArchivedSchools} onCheckedChange={setShowArchivedSchools} />
                        Show archived
                      </label>
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
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Portal Address (unique URL)</Label>
                              <Input value={newSchool.slug} onChange={(e) => setNewSchool({ ...newSchool, slug: e.target.value })} className="h-12 rounded-xl font-mono" placeholder="e.g. hope-academy-kumasi" />
                              <p className="text-[11px] text-slate-500 leading-snug">
                                Must be unique for login links. School names can repeat — use a different URL for each school (e.g. hope-kumasi vs hope-tema).
                              </p>
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
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">School Logo</Label>
                              <div className="flex items-start gap-4">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                  {createLogoPreview ? (
                                    <img src={createLogoPreview} alt="Logo preview" className="h-full w-full object-contain p-2" />
                                  ) : (
                                    <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                    className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-[10px] file:font-bold file:text-white"
                                  />
                                  {logoFile && (
                                    <p className="truncate text-xs font-medium text-slate-500">{logoFile.name}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setLogoFile(null); }} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
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
                      {visibleSchools.map((school) => (
                        <Card
                          key={school.id}
                          className={cn(
                            'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-500/50 transition-all group overflow-hidden shadow-sm hover:shadow-xl cursor-pointer',
                            school.archived_at && 'opacity-80 border-dashed'
                          )}
                          onClick={() => void openSchoolDetail(school)}
                        >
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
                                      school.archived_at
                                        ? 'bg-slate-500/10 text-slate-600 border border-slate-500/20 shadow-none'
                                        : school.is_active
                                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none'
                                          : 'bg-red-500/10 text-red-600 border border-red-500/20 shadow-none'
                                    )}
                                  >
                                    {school.archived_at ? 'Archived' : school.is_active ? 'Active' : 'Suspended'}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 text-slate-500">
                                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    <Globe className="w-3 h-3 text-indigo-500" />
                                    {school.slug || 'no-slug'}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                    {school.subscription_status || 'active'}
                                  </div>
                                  {school.created_at && (
                                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                      Since {new Date(school.created_at).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Click card for full details</p>
                              </div>

                              {/* Action Group */}
                              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void openEditSchool(school)}
                                  disabled={editFormLoading}
                                  className="h-10 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-2" />
                                  Edit
                                </Button>

                                <Button variant="outline" size="sm" onClick={() => setResetSchool(school)} className="h-10 rounded-xl border-emerald-200/80 dark:border-emerald-900/40 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                                  <KeyRound className="w-3.5 h-3.5 mr-2" />
                                  Access
                                </Button>

                                {school.archived_at ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleRestoreSchool(school)}
                                    className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-emerald-600 hover:bg-emerald-500/10"
                                  >
                                    <ArchiveRestore className="w-3.5 h-3.5 mr-2" />
                                    Restore
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleActive(school)}
                                      className={cn(
                                        'h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest',
                                        school.is_active ? 'text-amber-600 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                                      )}
                                    >
                                      {school.is_active ? <PowerOff className="w-3.5 h-3.5 mr-2" /> : <Power className="w-3.5 h-3.5 mr-2" />}
                                      {school.is_active ? 'Suspend' : 'Activate'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setArchiveTarget(school)}
                                      className="h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10"
                                    >
                                      <Archive className="w-3.5 h-3.5 mr-2" />
                                      Archive
                                    </Button>
                                  </>
                                )}
                                
                                <Button size="sm" onClick={() => openSchool(school)} disabled={!!school.archived_at} className="h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest hover:opacity-90 shadow-lg shadow-slate-900/10 transition-all disabled:opacity-40">
                                  <ArrowRight className="w-3.5 h-3.5 mr-2" />
                                  Launch
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {visibleSchools.length === 0 && (
                        <Card className="col-span-full border-dashed border-2 border-slate-200 dark:border-slate-800 p-20 text-center bg-slate-50/50 dark:bg-slate-900/20">
                          <Building2 className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-6" />
                          {!showArchivedSchools && archivedSchoolCount > 0 && schools.length > 0 ? (
                            <>
                              <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">Archived Schools Hidden</h3>
                              <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">
                                {archivedSchoolCount} archived school{archivedSchoolCount === 1 ? '' : 's'} {archivedSchoolCount === 1 ? 'is' : 'are'} hidden. Turn on <span className="font-semibold text-emerald-700 dark:text-emerald-400">Show archived</span> to view and restore them.
                              </p>
                              <Button onClick={() => setShowArchivedSchools(true)} variant="primaryAction" className="h-12 px-10 rounded-xl font-bold text-[10px] uppercase tracking-widest">
                                Show Archived Schools
                              </Button>
                            </>
                          ) : (
                            <>
                              <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 font-outfit uppercase tracking-tight">Zero Entities Detected</h3>
                              <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto">Establish your first institutional anchor to begin system management.</p>
                              <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-10 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-105">
                                Initialize First School
                              </Button>
                            </>
                          )}
                        </Card>
                      )}
                    </div>
                  )}
                </div>

                <Dialog open={!!editForm} onOpenChange={(open) => { if (!open) { setEditForm(null); setEditLogoFile(null); setShowEditAdminPassword(false); } }}>
                  <DialogContent className={formDialogContentWideClass}>
                    <DialogHeader className={detailDialogHeaderClass}>
                      <DialogTitle className={dialogTitleClass}>Edit School</DialogTitle>
                      <DialogDescription className="text-sm">
                        Update school identity, portal URL, branding, and primary administrator. Changes apply immediately — even while users are online.
                      </DialogDescription>
                    </DialogHeader>
                    {editForm && (
                      <form onSubmit={handleUpdateSchool} className="flex min-h-0 flex-1 flex-col">
                        <DialogBody className={`${detailDialogBodyClass} space-y-6`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          <div className="space-y-2">
                            <Label className={dialogLabelClass}>School Name</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-12 rounded-xl" required />
                          </div>
                          <div className="space-y-2">
                            <Label className={dialogLabelClass}>Portal Address</Label>
                            <Input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} className="h-12 rounded-xl font-mono" placeholder="e.g. hope-academy" required />
                          </div>
                          <div className="space-y-2 md:col-span-2 lg:col-span-3">
                            <Label className={dialogLabelClass}>School Logo</Label>
                            <div className="flex items-start gap-4">
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                {editLogoPreview ? (
                                  <img src={editLogoPreview} alt="Logo preview" className="h-full w-full object-contain p-2" />
                                ) : (
                                  <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setEditLogoFile(e.target.files?.[0] || null)}
                                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-[10px] file:font-bold file:text-white"
                                />
                                {editLogoFile ? (
                                  <p className="truncate text-xs font-medium text-slate-500">{editLogoFile.name}</p>
                                ) : editForm.logo_url ? (
                                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Current school logo</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className={dialogLabelClass}>Primary Color</Label>
                            <Input type="color" value={editForm.primary_color} onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })} className="h-12 rounded-xl p-1 cursor-pointer" />
                          </div>
                          <div className="space-y-2">
                            <Label className={dialogLabelClass}>Secondary Color</Label>
                            <Input type="color" value={editForm.secondary_color} onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })} className="h-12 rounded-xl p-1 cursor-pointer" />
                          </div>
                        </div>

                        <div className={dialogSectionClass}>
                          <p className={dialogLabelClass}>Primary Administrator</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <Label className={dialogLabelClass}>Admin Username</Label>
                              <Input value={editForm.adminUsername} onChange={(e) => setEditForm({ ...editForm, adminUsername: e.target.value })} className="h-12 rounded-xl" required />
                            </div>
                            <div className="space-y-2">
                              <Label className={dialogLabelClass}>Admin Full Name</Label>
                              <Input value={editForm.adminFullName} onChange={(e) => setEditForm({ ...editForm, adminFullName: e.target.value })} className="h-12 rounded-xl" placeholder="Head of school" />
                            </div>
                            <div className="space-y-2">
                              <Label className={dialogLabelClass}>Admin Email</Label>
                              <Input type="email" value={editForm.adminEmail} onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })} className="h-12 rounded-xl" placeholder="admin@school.com" />
                            </div>
                            <div className="space-y-2">
                              <Label className={dialogLabelClass}>Admin Phone</Label>
                              <Input value={editForm.adminPhone} onChange={(e) => setEditForm({ ...editForm, adminPhone: e.target.value })} className="h-12 rounded-xl" placeholder="+233..." />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label className={dialogLabelClass}>New Password (optional)</Label>
                              <div className="relative">
                                <Input
                                  type={showEditAdminPassword ? 'text' : 'password'}
                                  value={editForm.adminNewPassword}
                                  onChange={(e) => setEditForm({ ...editForm, adminNewPassword: e.target.value })}
                                  className="h-12 rounded-xl pr-12"
                                  placeholder="Leave blank to keep current password"
                                  minLength={6}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEditAdminPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  aria-label={showEditAdminPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showEditAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        </DialogBody>
                        <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                          <Button type="button" variant="ghost" onClick={() => setEditForm(null)} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                          <Button type="submit" variant="primaryAction" className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-12 px-8">Save Changes</Button>
                        </DialogFooter>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={!!resetSchool} onOpenChange={(o) => { if (!o) { setResetSchool(null); setNewPassword(''); } }}>
                  <DialogContent className={formDialogContentClass}>
                    <DialogHeader className={detailDialogHeaderClass}>
                      <DialogTitle className={dialogTitleClass}>Credential Override</DialogTitle>
                      <DialogDescription className="text-sm">
                        Initialize a master password reset for {resetSchool?.name}&apos;s administrative console.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleResetPassword} className="flex min-h-0 flex-1 flex-col">
                      <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
                        <div className="space-y-2">
                          <Label className={dialogLabelClass}>Emergency Password (6+ chars)</Label>
                          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                        </div>
                      </DialogBody>
                      <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                        <Button type="button" variant="ghost" onClick={() => setResetSchool(null)} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                        <Button type="submit" variant="destructive" className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-12 px-8">Confirm Override</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
                  <DialogContent className={formDialogContentClass}>
                    <DialogHeader className={detailDialogHeaderClass}>
                      <DialogTitle className={dialogTitleClass}>Archive {archiveTarget?.name}?</DialogTitle>
                      <DialogDescription>
                        The school will be removed from login and hidden from parents and staff. All data is kept — you can restore it later from this dashboard.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                      <Button type="button" variant="ghost" onClick={() => setArchiveTarget(null)} className="rounded-xl">Cancel</Button>
                      <Button type="button" variant="destructive" disabled={archiveLoading} onClick={() => void handleArchiveSchool()} className="rounded-xl">
                        {archiveLoading ? 'Archiving…' : 'Archive School'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!selectedSchoolDetail} onOpenChange={(open) => { if (!open) { setSelectedSchoolDetail(null); setSchoolOverview(null); } }}>
                  <DialogContent className={detailDialogContentWideClass}>
                    <DialogHeader className={detailDialogHeaderClass}>
                      <DialogTitle className={`${dialogTitleClass} flex items-center gap-3 pr-0`}>
                        {selectedSchoolDetail?.logo_url ? (
                          <img src={resolveLogoUrl(selectedSchoolDetail.logo_url)!} alt="" className="w-12 h-12 shrink-0 rounded-xl object-contain border border-emerald-200/80" />
                        ) : (
                          <Building2 className="w-8 h-8 shrink-0 text-emerald-600" />
                        )}
                        <span className="min-w-0 break-words">{selectedSchoolDetail?.name}</span>
                      </DialogTitle>
                      <DialogDescription>
                        Tenant #{selectedSchoolDetail?.id} ·{' '}
                        {selectedSchoolDetail?.archived_at
                          ? 'Archived'
                          : selectedSchoolDetail?.is_active
                            ? 'Active'
                            : 'Suspended'}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className={`${detailDialogBodyClass} space-y-5 text-sm`}>
                    {schoolOverviewLoading ? (
                      <BrandedLoading label="Loading school details…" className="py-10" />
                    ) : (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Students', value: schoolOverview?.stats?.students ?? '—', icon: GraduationCap },
                            { label: 'Teachers', value: schoolOverview?.stats?.teachers ?? '—', icon: User },
                            { label: 'Staff', value: schoolOverview?.stats?.other_staff ?? '—', icon: User },
                            { label: 'Classes', value: schoolOverview?.stats?.classes ?? '—', icon: Building2 },
                            { label: 'Users', value: schoolOverview?.stats?.users ?? '—', icon: Shield },
                            { label: 'Payments', value: schoolOverview?.stats?.payments ?? '—', icon: DollarSign },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50">
                              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <item.icon className="w-3.5 h-3.5" />
                                {item.label}
                              </div>
                              <p className="text-xl font-black text-slate-900 dark:text-white">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Portal & Identity</p>
                          <p><span className="text-slate-500">Slug:</span> <code className="text-emerald-700 dark:text-emerald-400">{selectedSchoolDetail?.slug || '—'}</code></p>
                          <p><span className="text-slate-500">Portal URL:</span>{' '}
                            <a href={selectedSchoolDetail ? loginUrl(selectedSchoolDetail) : '#'} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-400 break-all">
                              {selectedSchoolDetail ? loginUrl(selectedSchoolDetail) : '—'}
                            </a>
                          </p>
                          <p><span className="text-slate-500">Subscription:</span> {selectedSchoolDetail?.subscription_status || 'active'}</p>
                          <p><span className="text-slate-500">Created:</span> {selectedSchoolDetail?.created_at ? new Date(selectedSchoolDetail.created_at).toLocaleString() : '—'}</p>
                          <p><span className="text-slate-500">Updated:</span> {selectedSchoolDetail?.updated_at ? new Date(selectedSchoolDetail.updated_at).toLocaleString() : '—'}</p>
                        </div>

                        {schoolOverview?.primary_admin && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Primary Administrator</p>
                            <p><span className="text-slate-500">Name:</span> {schoolOverview.primary_admin.full_name || '—'}</p>
                            <p><span className="text-slate-500">Username:</span> <code>{schoolOverview.primary_admin.username}</code></p>
                            <p><span className="text-slate-500">Email:</span> {schoolOverview.primary_admin.email || '—'}</p>
                            <p><span className="text-slate-500">Phone:</span> {schoolOverview.primary_admin.phone || '—'}</p>
                          </div>
                        )}

                        {schoolOverview?.school_settings && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">School Settings</p>
                            <p><span className="text-slate-500">Academic year:</span> {String(schoolOverview.school_settings.current_year || '—')}</p>
                            <p><span className="text-slate-500">Current term:</span> {String(schoolOverview.school_settings.current_term || '—')}</p>
                            <p><span className="text-slate-500">Contact:</span> {String(schoolOverview.school_settings.phone_number || schoolOverview.school_settings.contact_phone || '—')}</p>
                            <p><span className="text-slate-500">Address:</span> {String(schoolOverview.school_settings.physical_address || '—')}</p>
                          </div>
                        )}
                      </div>
                    )}
                    </DialogBody>
                    <DialogFooter className={`${detailDialogFooterClass} flex-wrap`}>
                      <Button variant="outline" onClick={() => setSelectedSchoolDetail(null)}>Close</Button>
                      {selectedSchoolDetail && !selectedSchoolDetail.archived_at && (
                        <Button onClick={() => openSchool(selectedSchoolDetail)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Launch Portal
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {section === 'usage' && (
              <div className="animate-in fade-in duration-700">
                <PlatformUsageModule />
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
                                            {log.action.replace(/_/g, ' ')} · {log.entity_label || log.summary?.split(' — ').slice(1).join(' — ') || (log.entity_type || 'record').replace(/_/g, ' ')}
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

            {section === 'online-users' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="absolute right-0 top-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-slate-900/5 blur-3xl dark:bg-slate-50/10" />
                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <UserCheck className="h-3.5 w-3.5" />
                        Active Sessions Overview
                      </div>
                      <h3 className="font-outfit text-3xl font-black tracking-tight text-slate-900 dark:text-white">Online Users</h3>
                      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                        See staff/admin/teacher/finance sessions currently connected across the entire platform. Parent portal logins are excluded.
                      </p>
                    </div>
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[560px]">
                      <Input
                        value={onlineSearch}
                        onChange={(e) => setOnlineSearch(e.target.value)}
                        placeholder="Search by name, username, role, or school..."
                        className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                      />
                      <div className="flex items-center gap-2 h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                        <span className="text-slate-500">Updated:</span>
                        <span>{onlineLastUpdated ? new Date(onlineLastUpdated).toLocaleTimeString() : 'Never'}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void loadOnlineSessions()}
                          className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-widest"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {onlineError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-semibold">Could not refresh live users</p>
                    <p className="mt-1 text-xs opacity-90">{onlineError}</p>
                    <p className="mt-2 text-xs opacity-80">
                      If you use an ad blocker, allow this site — some blockers flag URLs containing &quot;audit&quot; or tracking paths.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Online Sessions', value: onlineSessions.length, tone: 'text-blue-500' },
                    { label: 'Distinct Users', value: uniqueOnlineUsers, tone: 'text-emerald-500' },
                    { label: 'Search Filter', value: onlineSearch ? 'Active' : 'None', tone: 'text-slate-900 dark:text-white' },
                    { label: 'Auto-refresh', value: 'Every 10s', tone: 'text-purple-500' },
                  ].map((stat) => (
                    <Card key={stat.label} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                      <CardContent className="p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                        <p className={cn('mt-2 font-outfit text-3xl font-black', stat.tone)}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="font-outfit text-lg font-black">Active User Sessions</CardTitle>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Each open session is shown separately so concurrent device logins are visible.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Realtime update</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Parent accounts excluded</span>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {onlineLoading ? (
                      <BrandedLoading label="Loading online users..." className="py-16" />
                    ) : filteredOnlineSessions.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 p-20 text-center dark:border-slate-800">
                        <User className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">No active staff/admin sessions found</p>
                        <p className="mt-2 text-xs text-slate-500">Try refreshing or wait for the next auto-update.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                          <TableRow>
                            <TableHead>Full name</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>School / Tenant</TableHead>
                            <TableHead>Online duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOnlineSessions.map((session) => (
                            <TableRow key={session.socketId} className="hover:bg-slate-50 dark:hover:bg-slate-950/80">
                              <TableCell>{session.fullName || '—'}</TableCell>
                              <TableCell>{session.username}</TableCell>
                              <TableCell className="capitalize">{session.role.replace('-', ' ')}</TableCell>
                              <TableCell>{session.tenantName}</TableCell>
                              <TableCell>{formatOnlineDuration(session.durationSeconds)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
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
                    <CardContent className="space-y-3">
                      <Input
                        type="file"
                        accept=".json,application/json"
                        disabled={!selectedDataSchool || dataActionLoading}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          void handleImportFileSelect(file);
                          e.target.value = '';
                        }}
                        className="h-10 rounded-xl"
                      />
                      {importFile && (
                        <p className="text-xs text-slate-500 truncate">
                          Selected: <span className="font-semibold text-slate-700 dark:text-slate-200">{importFile.name}</span>
                        </p>
                      )}
                      {importValidation?.valid && (
                        <Button
                          onClick={() => setShowImportDialog(true)}
                          disabled={!selectedDataSchool || dataActionLoading}
                          className="w-full h-10 rounded-xl font-bold text-xs uppercase tracking-widest"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Restore Backup
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Dialog open={showImportDialog} onOpenChange={(open) => {
                    setShowImportDialog(open);
                    if (!open) {
                      setRestoreUnderstand(false);
                    }
                  }}>
                    <DialogContent className={formDialogContentClass}>
                      <DialogHeader className={detailDialogHeaderClass}>
                        <DialogTitle className={dialogTitleClass}>Restore School Backup</DialogTitle>
                        <DialogDescription className="text-sm">
                          This replaces all data for {selectedDataSchool?.name}. A safety backup of the current state is saved on the server first.
                        </DialogDescription>
                      </DialogHeader>
                      {importValidation && (
                        <DialogBody className={`${detailDialogBodyClass} space-y-3 text-xs`}>
                          <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">Backup details</p>
                            <p>School: <span className="font-semibold">{importValidation.manifest?.tenant_name || importValidation.schoolName || '—'}</span></p>
                            <p>Backup date: <span className="font-semibold">{importValidation.manifest?.created_at ? new Date(importValidation.manifest.created_at).toLocaleString() : '—'}</span></p>
                            <p>Total records: <span className="font-semibold">{importValidation.manifest?.total_records ?? importValidation.total_records ?? '—'}</span></p>
                          </div>
                          {importValidation.warnings.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                              <p className="font-bold uppercase tracking-wider mb-1">Warnings</p>
                              <ul className="list-disc pl-4 space-y-1">
                                {importValidation.warnings.map((w) => <li key={w}>{w}</li>)}
                              </ul>
                            </div>
                          )}
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 max-h-40 overflow-y-auto">
                            <p className="font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">Table breakdown</p>
                            <div className="grid grid-cols-2 gap-1 text-slate-500">
                              {Object.entries(importValidation.manifest?.table_counts || importValidation.stats)
                                .filter(([, count]) => count > 0)
                                .slice(0, 16)
                                .map(([table, count]) => (
                                  <span key={table}>{table}: {count}</span>
                                ))}
                            </div>
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <Checkbox
                              checked={restoreUnderstand}
                              onCheckedChange={(v) => setRestoreUnderstand(v === true)}
                            />
                            <span className="text-slate-600 dark:text-slate-300 leading-relaxed">
                              I understand this will replace all current data for this school with the backup contents.
                            </span>
                          </label>
                        </DialogBody>
                      )}
                      <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                        <Button variant="outline" onClick={() => setShowImportDialog(false)} className="rounded-xl">
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSuperAdminImport}
                          disabled={dataActionLoading || !restoreUnderstand}
                          variant="primaryAction"
                          className="rounded-xl font-bold"
                        >
                          {dataActionLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          Restore Backup
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

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
                      <p className="text-xs text-red-600/90 dark:text-red-300/90">
                        This will permanently delete ALL data for{' '}
                        <span className="font-semibold">{selectedDataSchool?.name || 'the selected school'}</span>.
                        Type the school name below to confirm.
                      </p>
                      {selectedDataSchool && (
                        <p className="rounded-lg border border-red-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-red-900/50 dark:bg-slate-950/60 dark:text-slate-200">
                          Type exactly:{' '}
                          <span className="font-mono font-semibold text-red-700 dark:text-red-300">
                            {schoolResetDisplayName(selectedDataSchool)}
                          </span>
                        </p>
                      )}
                      <Input
                        value={resetSchoolNameConfirm}
                        onChange={(e) => setResetSchoolNameConfirm(e.target.value)}
                        placeholder={selectedDataSchool?.name || 'School name'}
                        autoComplete="off"
                        spellCheck={false}
                        className="h-10 rounded-xl bg-white dark:bg-slate-950"
                      />
                      {resetSchoolNameConfirm.trim().length > 0 && (
                        <p
                          className={cn(
                            'text-xs font-medium',
                            resetSchoolNameMatches ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          )}
                        >
                          {resetSchoolNameMatches
                            ? 'School name matches — you can reset now.'
                            : 'Name does not match yet. Check spelling and spacing.'}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Code: RESET_TENANT_{selectedDataSchool?.id}
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() => void handleSuperAdminResetData()}
                        disabled={!selectedDataSchool || dataActionLoading || !resetSchoolNameMatches}
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
                  <DialogContent className={formDialogContentClass}>
                    <DialogHeader className={detailDialogHeaderClass}>
                      <DialogTitle className={dialogTitleClass}>Internal Review Note</DialogTitle>
                      <DialogDescription className="text-sm">Add administrative context for {noteReg?.school_name}.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={saveInternalNote} className="flex min-h-0 flex-1 flex-col">
                      <DialogBody className={detailDialogBodyClass}>
                      <textarea
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        className="w-full min-h-[120px] rounded-2xl border border-emerald-200/80 bg-emerald-50/30 px-4 py-3 text-sm text-slate-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Detail the current status or required actions..."
                        rows={4}
                      />
                      </DialogBody>
                      <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                        <Button type="button" variant="ghost" onClick={() => { setNoteReg(null); setInternalNote(''); }} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                        <Button type="submit" variant="primaryAction" className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-11 px-8">Commit Note</Button>
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
                            <Button variant="outline" size="sm" onClick={() => setResetSuperAdmin({ id: sa.id, username: sa.username })} className="h-9 rounded-lg border-emerald-200/80 dark:border-emerald-900/40 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                              <KeyRound className="w-3.5 h-3.5 mr-2" />
                              Reset
                            </Button>
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

            {section === 'system-health' && (
              <SystemHealthModule schools={schools} />
            )}

            {section === 'platform-settings' && (
              <PlatformSettingsModule />
            )}

            {section === 'finance-wipe' && (
              <SuperAdminFinanceWipeModule schools={schools} />
            )}

            {section === 'removed-staff' && (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Removed Staff</h3>
                    <p className="text-sm text-slate-500 font-medium max-w-2xl">
                      Teachers soft-deleted by school admins. Restore them to a school or permanently delete — salary records are never modified.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadRemovedTeachers()} disabled={removedLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${removedLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {removedLoading ? (
                      <div className="py-16 text-center text-muted-foreground">Loading removed staff…</div>
                    ) : removedTeachers.length === 0 ? (
                      <div className="py-16 text-center text-muted-foreground">No soft-removed teachers across schools.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>School</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Staff ID</TableHead>
                              <TableHead>Removed</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {removedTeachers.map((row) => (
                              <TableRow key={`${row.tenant_id}-${row.id}`}>
                                <TableCell className="font-medium">{row.school_name || `School #${row.tenant_id}`}</TableCell>
                                <TableCell>{row.full_name || 'Unknown'}</TableCell>
                                <TableCell className="font-mono text-sm">{row.staff_id || '—'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {row.deleted_at ? new Date(row.deleted_at).toLocaleString() : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2 flex-wrap">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={restoringId === row.id || permanentDeletingId === row.id}
                                      onClick={() => setRemovedAction({ row, action: 'restore' })}
                                    >
                                      {restoringId === row.id ? (
                                        'Restoring…'
                                      ) : (
                                        <>
                                          <RotateCcw className="h-4 w-4 mr-1" />
                                          Restore
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      disabled={permanentDeletingId === row.id || restoringId === row.id}
                                      onClick={() => setRemovedAction({ row, action: 'permanent' })}
                                    >
                                      {permanentDeletingId === row.id ? 'Deleting…' : 'Permanent delete'}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {section === 'announcements' && (
              <GlobalAnnouncementsModule schools={schools} />
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
                                    {log.entity_label || log.summary?.split(' — ').slice(1).join(' — ') || (log.entity_type || 'SYSTEM').replace(/_/g, ' ')}
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

            <Dialog open={!!resetSuperAdmin} onOpenChange={(o) => { if (!o) { setResetSuperAdmin(null); setSuperAdminNewPass(''); } }}>
              <DialogContent className={formDialogContentClass}>
                <DialogHeader className={detailDialogHeaderClass}>
                  <DialogTitle className={dialogTitleClass}>Credential Override</DialogTitle>
                  <DialogDescription className="text-sm">Update the access token for {resetSuperAdmin?.username}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleResetSuperAdminPassword} className="flex min-h-0 flex-1 flex-col">
                  <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
                    <div className="space-y-2">
                      <Label className={dialogLabelClass}>New Access Token</Label>
                      <Input type="password" value={superAdminNewPass} onChange={(e) => setSuperAdminNewPass(e.target.value)} className="h-12 rounded-xl" placeholder="••••••••" required minLength={6} />
                    </div>
                  </DialogBody>
                  <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
                    <Button type="button" variant="ghost" onClick={() => { setResetSuperAdmin(null); setSuperAdminNewPass(''); }} className="rounded-xl font-bold text-[10px] uppercase tracking-widest">Cancel</Button>
                    <Button type="submit" variant="primaryAction" className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-11 px-8">Confirm Update</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
              <DialogContent className={formDialogContentXWideClass}>
                <DialogHeader className={detailDialogHeaderClass}>
                  <DialogTitle className={dialogTitleClass}>Audit Event Details</DialogTitle>
                  <DialogDescription className="text-sm">
                    Full event context, actor, device, target record, and captured values.
                  </DialogDescription>
                </DialogHeader>
                {selectedAuditLog && (
                  <DialogBody className={`${detailDialogBodyClass} space-y-5`}>
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
                        ['Target', selectedAuditLog.entity_label || selectedAuditLog.summary?.split(' — ').slice(1).join(' — ') || (selectedAuditLog.entity_type || 'SYSTEM').replace(/_/g, ' ')],
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
                  </DialogBody>
                )}
              </DialogContent>
            </Dialog>


            {section === 'support-chat' && (
              <div className="animate-in fade-in duration-700 h-full">
                <SupportModule />
              </div>
            )}

            {section === 'school-general-chat' && (
              <div className="animate-in fade-in duration-700 h-full">
                <SuperAdminSchoolChatModule />
              </div>
            )}

            {section === 'chat-broadcast' && (
              <div className="animate-in fade-in duration-700 p-4 md:p-6">
                <ChatBroadcastPanel />
              </div>
            )}

            {section === 'school-websites' && (
              <div className="animate-in fade-in duration-700">
                <SchoolWebsitesPanel onPendingCountChange={setWebsiteEnablePending} />
              </div>
            )}
          </div>
        </main>
      </SidebarProvider>
          </div>
        </ImpersonationShell>
        <BecomeUserPanel open={becomeUserOpen} onClose={() => setBecomeUserOpen(false)} />
        <StaffActionConfirmDialog
          open={!!removedAction}
          onOpenChange={(open) => {
            if (!open && !removedActionLoading) setRemovedAction(null);
          }}
          action={removedAction?.action === 'restore' ? 'restore' : removedAction ? 'permanent' : null}
          staffName={removedAction?.row.full_name || 'Unknown'}
          staffId={removedAction?.row.staff_id || undefined}
          schoolName={removedAction?.row.school_name}
          staffType="teacher"
          loading={removedActionLoading}
          onConfirm={() => void executeRemovedStaffAction()}
        />
      </ImpersonationProvider>
    </SchoolProvider>
    </>
  );
};

export default SuperAdminDashboard;
