import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCog,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Wallet,
  Settings,
  Shield,
  FileText,
  UserCheck,
  Search,
  Award,
  Bot,
  Calendar,
  LogOut,
  User,
  History,
  MessageCircle,
  BellRing,
  MessagesSquare,
  ClipboardList,
  Scale,
} from 'lucide-react';
import { resolveLogoUrl } from '../services/tenantService';
import {
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
  useSidebar,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const getMenuItems = (hasAccess: (permission: string) => boolean) => ({
  dashboard: [
    ...(hasAccess('dashboard') ? [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(hasAccess('financial-dashboard') ? [{ id: 'financial-dashboard', label: 'Financial', icon: DollarSign }] : []),
    ...(hasAccess('teacher-dashboard') ? [{ id: 'teacher-dashboard', label: 'My Dashboard', icon: GraduationCap }] : []),
  ],
  academic: [
    ...(hasAccess('students') || hasAccess('students-view-only') ? [{ id: 'students', label: 'Students', icon: Users }] : []),
    ...(hasAccess('teachers') || hasAccess('teachers-view-only') ? [{ id: 'teachers', label: 'Teachers', icon: GraduationCap }] : []),
    ...(hasAccess('classes') ? [{ id: 'classes', label: 'Classes', icon: BookOpen }] : []),
    ...(hasAccess('subjects') ? [{ id: 'subjects', label: 'Subjects', icon: BookOpen }] : []),
    ...(hasAccess('calendar') ? [{ id: 'calendar', label: 'Calendar', icon: Calendar }] : []),
  ],
  teaching: [
    ...(hasAccess('teacher-classes') ? [{ id: 'teacher-classes', label: 'My Classes', icon: BookOpen }] : []),
    ...(hasAccess('attendance') ? [{ id: 'attendance', label: 'Attendance', icon: UserCheck }] : []),
    ...(hasAccess('grades') ? [{ id: 'grades', label: 'Grades', icon: Award }] : []),
    ...(hasAccess('grades') ? [{ id: 'teacher-quizzes', label: 'Online assessments', icon: ClipboardList }] : []),
    ...(hasAccess('teacher-profile') ? [{ id: 'teacher-profile', label: 'My Profile', icon: User }] : []),
    ...(hasAccess('teacher-payment-history') ? [{ id: 'teacher-payment-history', label: 'Payment History', icon: History }] : []),
  ],
  financial: [
    ...(hasAccess('fees') ? [{ id: 'fees', label: 'Fees', icon: DollarSign }] : []),
    ...(hasAccess('income') ? [{ id: 'income', label: 'Income', icon: TrendingUp }] : []),
    ...(hasAccess('expenses') ? [{ id: 'expenses', label: 'Expenses', icon: TrendingDown }] : []),
    ...(hasAccess('payroll') ? [{ id: 'payroll', label: 'Payroll', icon: Wallet }] : []),
    ...(hasAccess('reports') ? [{ id: 'reports', label: 'Reports', icon: BarChart3 }] : []),
    ...(hasAccess('print-fee-status') ? [{ id: 'print-fee-status', label: 'Fee Status', icon: FileText }] : []),
    ...(hasAccess('manual-adjustments') ? [{ id: 'manual-adjustments', label: 'Balance overrides', icon: Scale }] : []),
  ],
  records: [
    ...(hasAccess('records') ? [{ id: 'records', label: 'Records', icon: Search }] : []),
  ],
  /** Previously sat with System; now placed here (where Settings group was). */
  announcements: [
    ...(hasAccess('push-notifications') ? [{ id: 'push-notifications', label: 'Push Notifications', icon: BellRing }] : []),
    ...(hasAccess('parent-desk') ? [{ id: 'parent-desk', label: 'Parent Desk', icon: MessagesSquare }] : []),
  ],
  ai: [
    ...(hasAccess('ai-assistant') ? [{ id: 'ai-assistant', label: 'AI Assistant', icon: Bot, badge: 'New' }] : []),
    ...(hasAccess('support-chat') ? [{ id: 'support-chat', label: 'Support Chat', icon: MessageCircle }] : []),
  ],
  /** Users, Settings, Audit — always last before footer. */
  system: [
    ...(hasAccess('users') ? [{ id: 'users', label: 'Users', icon: UserCog }] : []),
    ...(hasAccess('settings') || hasAccess('settings-password-only') ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
    ...(hasAccess('audit') ? [{ id: 'audit', label: 'Audit Logs', icon: Shield }] : []),
  ],
});

const MenuSection: React.FC<{
  items: { id: string; label: string; icon: React.ElementType; badge?: string }[];
  label: string;
  activeModule: string;
  setActiveModule: (module: string) => void;
  itemCounts?: Record<string, number>;
}> = ({ items, label, activeModule, setActiveModule, itemCounts }) => {
  const { isMobile, setOpenMobile } = useSidebar();

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.2em] px-3 mb-2 opacity-80 group-data-[collapsible=icon]:hidden">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {items.map((item) => {
            const unread = itemCounts?.[item.id] ?? 0;
            return (
            <SidebarMenuItem key={item.id} className="flex justify-center">
              <SidebarMenuButton
                isActive={activeModule === item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  if (isMobile) setOpenMobile(false);
                }}
                tooltip={item.label}
                className={cn(
                  "relative rounded-xl mx-auto w-[calc(100%-12px)] h-9 text-sidebar-foreground/70 transition-all duration-300 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0",
                  activeModule === item.id 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20" 
                    : "hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <span className="relative inline-flex shrink-0">
                  <item.icon className="h-[1.1rem] w-[1.1rem] opacity-80 group-data-[active=true]:opacity-100 transition-all duration-300 group-hover/menu-item:scale-110" />
                  {unread > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-sidebar">
                      {unread > 99 ? '99' : unread}
                    </span>
                  )}
                </span>
                <span className="font-bold text-sm group-data-[collapsible=icon]:hidden ml-3 flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className="truncate">{item.label}</span>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0 text-[10px] font-bold leading-5 text-destructive-foreground">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </span>
                {item.badge && !(activeModule === item.id) && (
                  <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 bg-sidebar-primary/20 text-sidebar-primary border-0 group-data-[collapsible=icon]:hidden">
                    {item.badge}
                  </Badge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeModule, setActiveModule }) => {
  const { logout, hasAccess, user } = useAuth();
  const { school } = useSchool();
  const { isMobile, setOpenMobile } = useSidebar();
  const { socket } = useSocket();
  const [parentDeskUnread, setParentDeskUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);

  const menuItems = getMenuItems(hasAccess);

  const refreshCommsBadges = useCallback(async () => {
    try {
      if (hasAccess('parent-desk')) {
        const d = await apiService.get<{ count: number }>('/messages/admin/unread-count');
        setParentDeskUnread(Number(d?.count ?? 0));
      } else {
        setParentDeskUnread(0);
      }
      if (hasAccess('support-chat')) {
        const s = await apiService.get<{ count: number }>('/support-chat/unread-count');
        setSupportUnread(Number(s?.count ?? 0));
      } else {
        setSupportUnread(0);
      }
    } catch {
      setParentDeskUnread(0);
      setSupportUnread(0);
    }
  }, [hasAccess]);

  useEffect(() => {
    if (!user) return;
    void refreshCommsBadges();
    const id = window.setInterval(() => void refreshCommsBadges(), 48000);
    return () => window.clearInterval(id);
  }, [user, refreshCommsBadges]);

  useEffect(() => {
    if (!socket) return;
    const onTenant = (evt: { entity?: string }) => {
      const e = String(evt?.entity || '');
      if (e === 'parent-desk' || e === 'support-chat') void refreshCommsBadges();
    };
    const onSupport = () => void refreshCommsBadges();
    socket.on('tenant-data-changed', onTenant);
    socket.on('new-support-message', onSupport);
    return () => {
      socket.off('tenant-data-changed', onTenant);
      socket.off('new-support-message', onSupport);
    };
  }, [socket, refreshCommsBadges]);

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl overflow-hidden print:hidden"
    >
      <SidebarHeader className="h-20 flex items-center justify-center border-b border-sidebar-border mb-4 px-2 overflow-hidden">
         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0 overflow-hidden">
           {school?.logo_url ? (
             <img 
               src={resolveLogoUrl(school.logo_url) || ''} 
               alt={school.name} 
               className="w-full h-full object-cover"
               onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
               }}
             />
           ) : null}
           <GraduationCap className={cn("w-6 h-6 text-white fallback-icon", school?.logo_url ? "hidden" : "")} />
         </div>
         <div className="ml-3 overflow-hidden transition-all duration-300 group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
             <h2 className="text-sm font-black text-sidebar-foreground uppercase tracking-tighter truncate">{school?.name || 'EDUNERVE'}</h2>
             <p className="text-[9px] text-sidebar-foreground/50 font-bold tracking-widest uppercase truncate opacity-70">Management System</p>
         </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain px-1 py-4 gap-4 bg-transparent outline-none border-none">
        <MenuSection items={menuItems.dashboard} label="Overview" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.academic} label="Academic Central" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.teaching} label="Teaching Room" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.financial} label="Financial Ops" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.records} label="Data Center" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection
          items={menuItems.announcements}
          label="Announcements & parent desk"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          itemCounts={{ 'parent-desk': parentDeskUnread }}
        />
        <SidebarSeparator className="bg-sidebar-border mx-4 my-2" />
        <MenuSection
          items={menuItems.ai}
          label="Innovation"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          itemCounts={{ 'support-chat': supportUnread }}
        />
        <MenuSection items={menuItems.system} label="System" activeModule={activeModule} setActiveModule={setActiveModule} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-4 bg-sidebar-accent/50">
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                logout();
              }}
              className="rounded-xl w-full h-10 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center"
              tooltip="Terminate Session"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-tight ml-3 group-data-[collapsible=icon]:hidden">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="p-3 bg-sidebar-accent/30 rounded-2xl border border-sidebar-border">
            <p className="text-[10px] text-sidebar-foreground/50 text-center font-medium leading-tight">
              Crafted with Excellence by <br />
              <span className="font-black text-sidebar-foreground uppercase tracking-widest text-[9px]">Technerve</span>
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
