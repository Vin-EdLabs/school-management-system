import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
import { useActiveTerm } from '../contexts/ActiveTermContext';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';
import { ACTIVE_TERM_EXEMPT_MODULES } from './common/ActiveTermRequiredShell';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCog,
  GraduationCap,
  BookOpen,
  DollarSign,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Wallet,
  PiggyBank,
  Settings,
  Shield,
  FileText,
  ReceiptText,
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
  Landmark,
  ClipboardCheck,
  SlidersHorizontal,
  Cake,
  ChevronDown,
  Bus,
  Route,
  MapPin,
  IdCard,
  AlertTriangle,
  Clock,
  Crown,
  School,
  UserRoundSearch,
  QrCode,
  Flag,
  Globe,
} from 'lucide-react';
import { resolveLogoUrl } from '../services/tenantService';
import { headmasterHasTeachingAccess, isHeadmasterRole } from '../utils/headmasterPortal';
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useImpersonationOptional } from '../contexts/ImpersonationContext';
import BecomeUserPanel from './impersonation/BecomeUserPanel';

interface AppSidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const getHeadmasterMenuItems = (hasAccess: (permission: string) => boolean, userRole?: string, hasTeaching?: boolean) => ({
  myWork: [
    ...(hasAccess('headmaster-dashboard')
      ? [{ id: 'headmaster-dashboard', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
    ...(hasTeaching && hasAccess('teacher-classes')
      ? [{ id: 'teacher-classes', label: 'My Classes', icon: BookOpen }]
      : []),
    ...(hasTeaching && hasAccess('attendance') ? [{ id: 'attendance', label: 'My Attendance', icon: UserCheck }] : []),
    ...(hasTeaching && hasAccess('grades') ? [{ id: 'grades', label: 'My Grades', icon: Award }] : []),
    ...(hasTeaching && hasAccess('grades') ? [{ id: 'teacher-quizzes', label: 'My Assessments', icon: ClipboardList }] : []),
    ...(hasTeaching && hasAccess('my-staff-attendance')
      ? [{ id: 'my-staff-attendance', label: 'Staff Clock', icon: Clock }]
      : []),
    ...(hasAccess('teacher-profile') ? [{ id: 'teacher-profile', label: 'My Profile', icon: User }] : []),
  ],
  schoolOverview: [
    ...(hasAccess('headmaster-all-classes') ? [{ id: 'headmaster-all-classes', label: 'All Classes', icon: School }] : []),
    ...(hasAccess('headmaster-all-attendance')
      ? [{ id: 'headmaster-all-attendance', label: 'All Attendance', icon: ClipboardList }]
      : []),
    ...(hasAccess('headmaster-all-staff') ? [{ id: 'headmaster-all-staff', label: 'All Staff', icon: Users }] : []),
    ...(hasAccess('staff-attendance')
      ? [{ id: 'staff-attendance', label: 'Staff Attendance', icon: Clock }]
      : []),
    ...(hasAccess('complaints') ? [{ id: 'complaints', label: 'Complaints', icon: Flag }] : []),
    ...(hasAccess('students-view-only') ? [{ id: 'students', label: 'All Students', icon: Users }] : []),
    ...(hasAccess('headmaster-grades') ? [{ id: 'headmaster-grades', label: 'Grades & Reports', icon: Award }] : []),
    ...(hasAccess('print-fee-status') ? [{ id: 'print-fee-status', label: 'Fees Status', icon: FileText }] : []),
    ...(hasAccess('id-cards') ? [{ id: 'id-cards', label: 'ID Cards', icon: IdCard }] : []),
    ...(hasAccess('birthdays') ? [{ id: 'birthdays', label: 'Birthdays', icon: Cake }] : []),
    ...(hasAccess('records') ? [{ id: 'records', label: 'Records', icon: Search }] : []),
  ],
  communication: [
    ...(hasAccess('push-notifications') ? [{ id: 'push-notifications', label: 'Announcements', icon: BellRing }] : []),
    ...(hasAccess('parent-desk') ? [{ id: 'parent-desk', label: 'Parents Desk', icon: MessagesSquare }] : []),
    ...(hasAccess('calendar') ? [{ id: 'calendar', label: 'Calendar', icon: Calendar }] : []),
  ],
  management: [
    ...(hasAccess('settings') || hasAccess('settings-password-only')
      ? [{ id: 'settings', label: 'Settings', icon: Settings }]
      : []),
  ],
  configurations: [
    ...(hasAccess('grade-configuration') ? [{ id: 'grade-configuration', label: 'Grade Configuration', icon: GraduationCap }] : []),
  ],
});

const getMenuItems = (hasAccess: (permission: string) => boolean, userRole?: string) => ({
  dashboard: [
    ...(hasAccess('dashboard') ? [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(hasAccess('financial-dashboard')
      ? [{
        id: 'financial-dashboard',
        label: userRole === 'finance' ? 'Dashboard' : 'Financial',
        icon: userRole === 'finance' ? LayoutDashboard : DollarSign,
      }]
      : []),
    ...(hasAccess('teacher-dashboard') && userRole !== 'super-admin' && userRole !== 'administrator'
      ? [{ id: 'teacher-dashboard', label: 'My Dashboard', icon: GraduationCap }]
      : []),
    ...(hasAccess('website-management')
      ? [{ id: 'website-management', label: 'Website Management', icon: Globe }]
      : []),
  ],
  academic: [
    ...(hasAccess('students') || hasAccess('students-view-only') ? [{ id: 'students', label: 'Students', icon: Users }] : []),
    ...(hasAccess('teachers') || hasAccess('teachers-view-only') ? [{ id: 'teachers', label: 'Teachers', icon: GraduationCap }] : []),
    ...(hasAccess('teachers') || hasAccess('teachers-view-only') ? [{ id: 'other-staff', label: 'Other Staff', icon: UserCog }] : []),
    ...(hasAccess('classes') ? [{ id: 'classes', label: 'Classes', icon: BookOpen }] : []),
    ...(hasAccess('subjects') ? [{ id: 'subjects', label: 'Subjects', icon: BookOpen }] : []),
    ...(hasAccess('calendar') && userRole !== 'finance' ? [{ id: 'calendar', label: 'Calendar', icon: Calendar }] : []),
    ...(hasAccess('birthdays') ? [{ id: 'birthdays', label: 'Birthdays', icon: Cake }] : []),
    ...(hasAccess('id-cards') && userRole !== 'teacher'
      ? [{ id: 'id-cards', label: 'ID Cards', icon: IdCard }]
      : []),
    ...(hasAccess('id-cards') && userRole !== 'teacher'
      ? [{ id: 'id-cards-bulk-print', label: 'Bulk Print Cards', icon: IdCard }]
      : []),
    ...(hasAccess('lost-cards') ? [{ id: 'lost-cards', label: 'Lost Cards', icon: AlertTriangle }] : []),
    ...(hasAccess('reports') ? [{ id: 'academic-reports', label: 'Academic Report', icon: BarChart3 }] : []),
    ...(hasAccess('checkin-dashboard') ? [{ id: 'checkin-dashboard', label: 'Student Check-in', icon: UserCheck }] : []),
    ...(hasAccess('staff-attendance') ? [{ id: 'staff-attendance', label: 'Staff Attendance', icon: Clock }] : []),
    ...(hasAccess('complaints') ? [{ id: 'complaints', label: 'Complaints', icon: Flag }] : []),
  ],
  teaching: [
    ...(hasAccess('teacher-classes') ? [{ id: 'teacher-classes', label: 'My Classes', icon: BookOpen }] : []),
    ...(hasAccess('attendance') ? [{ id: 'attendance', label: 'Attendance', icon: UserCheck }] : []),
    ...(hasAccess('grades') ? [{ id: 'grades', label: 'Grades', icon: Award }] : []),
    ...(hasAccess('grades') ? [{ id: 'teacher-quizzes', label: 'Online assessments', icon: ClipboardList }] : []),
    ...(hasAccess('teacher-profile') ? [{ id: 'teacher-profile', label: 'My Profile', icon: User }] : []),
    ...(hasAccess('teacher-appointment-letters')
      ? [{ id: 'teacher-appointment-letters', label: 'Appointment Letters', icon: FileText }]
      : []),
    ...(hasAccess('teacher-payment-history') ? [{ id: 'teacher-payment-history', label: 'Payment History', icon: History }] : []),
    ...(hasAccess('checkin-staff') ? [{ id: 'checkin-staff', label: 'Student Check-in', icon: UserCheck }] : []),
    ...(hasAccess('my-staff-attendance')
      ? [{ id: 'my-staff-attendance', label: 'Staff Clock', icon: Clock }]
      : []),
    ...(hasAccess('my-complaints') ? [{ id: 'my-complaints', label: 'My Complaints', icon: Flag }] : []),
  ],
  financial: [
    ...(hasAccess('fees') ? [{ id: 'fees', label: 'Fees', icon: DollarSign }] : []),
    ...(hasAccess('daily-fees') || hasAccess('fees') ? [{ id: 'daily-fees', label: 'Daily Fees', icon: CalendarDays }] : []),
    ...(hasAccess('invoices') ? [{ id: 'invoices', label: 'Invoices', icon: FileText }] : []),
    ...(hasAccess('finance-statement') ? [{ id: 'finance-statement', label: 'Finance Statement', icon: FileText }] : []),
    ...(hasAccess('income') ? [{ id: 'income', label: 'Income', icon: TrendingUp }] : []),
    ...(hasAccess('expenses') ? [{ id: 'expenses', label: 'Expenses', icon: TrendingDown }] : []),
    ...(hasAccess('term-budget') ? [{ id: 'term-budget', label: 'Budget', icon: PiggyBank }] : []),
    ...(hasAccess('transactions') ? [{ id: 'transactions', label: 'Transactions', icon: ReceiptText }] : []),
    ...(hasAccess('payment-submissions') ? [{ id: 'payment-submissions', label: 'Payment Submissions', icon: ClipboardCheck }] : []),
    ...(hasAccess('cash-bank') ? [{ id: 'cash-bank', label: 'Cash & Bank', icon: Landmark }] : []),
    ...(hasAccess('payroll') ? [{ id: 'payroll', label: 'Payroll', icon: Wallet }] : []),
    ...(hasAccess('reports') ? [{ id: 'reports', label: 'Reports', icon: BarChart3 }] : []),
    ...(hasAccess('manual-adjustments') ? [{ id: 'manual-adjustments', label: 'Balance overrides', icon: Scale }] : []),
    ...(hasAccess('print-fee-status') ? [{ id: 'print-fee-status', label: 'Fee Status', icon: FileText }] : []),
    ...(hasAccess('calendar') && userRole === 'finance' ? [{ id: 'calendar', label: 'Calendar', icon: Calendar }] : []),
  ],
  records: [
    ...(hasAccess('records') ? [{ id: 'records', label: 'Records', icon: Search }] : []),
  ],
  /** Previously sat with System; now placed here (where Settings group was). */
  announcements: [
    ...(hasAccess('push-notifications') ? [{ id: 'push-notifications', label: 'Push Notifications', icon: BellRing }] : []),
    ...(hasAccess('parent-desk') ? [{ id: 'parent-desk', label: 'Parent Desk', icon: MessagesSquare }] : []),
    ...(hasAccess('messages') ? [{ id: 'messages', label: 'Messages', icon: MessageCircle }] : []),
  ],
  ai: [
    ...(hasAccess('ai-assistant') ? [{ id: 'ai-assistant', label: 'AI Assistant', icon: Bot, badge: 'New' }] : []),
    ...(hasAccess('support-chat') ? [{ id: 'support-chat', label: 'Support Chat', icon: MessageCircle }] : []),
  ],
  /** Configurations — payment accounts and future setup items. */
  configurations: [
    ...(hasAccess('payment-accounts') ? [{ id: 'payment-accounts', label: 'Payment Accounts', icon: SlidersHorizontal }] : []),
    ...(hasAccess('grade-configuration') ? [{ id: 'grade-configuration', label: 'Grade Configuration', icon: GraduationCap }] : []),
    ...(hasAccess('settings-full') ? [{ id: 'appointment-letter-settings', label: 'Appointment Letters', icon: FileText }] : []),
    ...(hasAccess('settings-full') ? [{ id: 'admission-letter-settings', label: 'Admission Letter', icon: FileText }] : []),
    ...(hasAccess('id-card-settings') ? [{ id: 'id-card-settings', label: 'ID Card Colors', icon: IdCard }] : []),
    ...(hasAccess('checkin-settings') ? [{ id: 'checkin-settings', label: 'Student QR Codes', icon: QrCode }] : []),
    ...(hasAccess('staff-attendance-settings')
      ? [{ id: 'staff-attendance-settings', label: 'Staff Clock Settings', icon: Clock }]
      : []),
  ],
  transport: [
    ...(hasAccess('transport-overview') ? [{ id: 'transport-overview', label: 'Overview', icon: LayoutDashboard }] : []),
    ...(hasAccess('transport-map') ? [{ id: 'transport-map', label: 'Live Map', icon: MapPin }] : []),
    ...(hasAccess('transport-routes') ? [{ id: 'transport-routes', label: 'Routes', icon: Route }] : []),
    ...(hasAccess('transport-vehicles') ? [{ id: 'transport-vehicles', label: 'Vehicles', icon: Bus }] : []),
    ...(hasAccess('transport-drivers') ? [{ id: 'transport-drivers', label: 'Drivers', icon: UserCheck }] : []),
    ...(hasAccess('transport-students') ? [{ id: 'transport-students', label: 'Students', icon: Users }] : []),
  ],
  /** Users, Settings, Audit — always last before footer. */
  system: [
    ...(hasAccess('users') ? [{ id: 'users', label: 'Users', icon: UserCog }] : []),
    ...(hasAccess('parent-accounts') ? [{ id: 'parent-accounts', label: 'Parent Accounts', icon: Users }] : []),
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
  markCommsRead: (moduleId: string) => Promise<void>;
  termNavigationBlocked: boolean;
  headmasterAccent?: boolean;
}> = ({ items, label, activeModule, setActiveModule, itemCounts, markCommsRead, termNavigationBlocked, headmasterAccent }) => {
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
                  onClick={async () => {
                    if (termNavigationBlocked && !ACTIVE_TERM_EXEMPT_MODULES.has(item.id)) {
                      toast({
                        title: 'Set your active term first',
                        description:
                          'Welcome! Please open Settings → Academic Terms and activate a term before using this feature.',
                      });
                      return;
                    }
                    if (item.id !== 'parent-desk' && item.id !== 'support-chat') {
                      await markCommsRead(item.id);
                    }
                    setActiveModule(item.id);

                    const schoolMatch = window.location.pathname.match(/^\/school\/[^/]+/);
                    const prefix = schoolMatch ? schoolMatch[0] : '';

                    if (item.id === 'transactions') {
                      window.history.pushState({}, '', `${prefix}/finance/transactions`);
                    } else if (item.id === 'daily-fees') {
                      window.history.pushState({}, '', `${prefix}/finance/daily-fees`);
                    } else {
                      // Remove any subpaths if navigating back to main modules
                      let base = window.location.pathname;
                      if (base.includes('/finance/transactions')) {
                        base = base.replace(/\/finance\/transactions\/?$/, '') || '/';
                      }
                      if (base.includes('/finance/daily-fees')) {
                        base = base.replace(/\/finance\/daily-fees\/?$/, '') || '/';
                      }
                      const subpaths = [
                        '/transport/map',
                        '/transport/routes',
                        '/transport/vehicles',
                        '/transport/drivers',
                        '/transport/students',
                        '/transport',
                      ];
                      for (const sub of subpaths) {
                        if (base.includes(sub)) {
                          base = base.replace(new RegExp(`${sub}\\/?$`), '') || '/';
                          break;
                        }
                      }
                      window.history.pushState({}, '', base);
                    }
                    if (isMobile) setOpenMobile(false);
                  }}
                  tooltip={item.label}
                  className={cn(
                    "readonly-allowed relative rounded-xl mx-auto w-[calc(100%-12px)] h-10 text-emerald-50/72 transition-all duration-300 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0 dark:h-9 dark:text-sidebar-foreground/70",
                    activeModule === item.id
                      ? headmasterAccent
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-400/25 ring-1 ring-white/15 before:absolute before:left-1 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white/80 dark:bg-amber-600 dark:bg-none dark:text-white dark:shadow-amber-500/20 dark:before:hidden"
                        : "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-400/25 ring-1 ring-white/15 before:absolute before:left-1 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white/80 dark:bg-sidebar-primary dark:bg-none dark:text-sidebar-primary-foreground dark:shadow-sidebar-primary/20 dark:before:hidden"
                      : "hover:bg-white/10 hover:text-white dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
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
                  <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden ml-3 flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    <span className="truncate">{item.label}</span>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0 text-[10px] font-bold leading-5 text-destructive-foreground">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </span>
                  {item.badge && !(activeModule === item.id) && (
                    <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 bg-emerald-300/20 text-emerald-50 border-0 group-data-[collapsible=icon]:hidden dark:bg-sidebar-primary/20 dark:text-sidebar-primary">
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

const CollapsibleMenuSection: React.FC<{
  items: { id: string; label: string; icon: React.ElementType; badge?: string }[];
  label: string;
  activeModule: string;
  setActiveModule: (module: string) => void;
  markCommsRead: (moduleId: string) => Promise<void>;
  termNavigationBlocked: boolean;
}> = ({ items, label, activeModule, setActiveModule, markCommsRead, termNavigationBlocked }) => {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const [isOpen, setIsOpen] = useState(true);
  const isCollapsed = state === 'collapsed';

  if (items.length === 0) return null;

  if (isCollapsed) {
    // In icon-only mode, render a single highlighted icon representing the transport module
    const activeChild = items.find(i => activeModule === i.id);
    const parentItem = items.find(i => i.id === 'transport-overview') || items[0];

    return (
      <SidebarGroup className="py-1 flex justify-center">
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              isActive={!!activeChild}
              onClick={async () => {
                await markCommsRead(parentItem.id);
                setActiveModule(parentItem.id);
                const schoolMatch = window.location.pathname.match(/^\/school\/[^/]+/);
                const prefix = schoolMatch ? schoolMatch[0] : '';
                window.history.pushState({}, '', `${prefix}/transport`);
                if (isMobile) setOpenMobile(false);
              }}
              tooltip="Transport Management"
              className={cn(
                "readonly-allowed relative rounded-xl mx-auto w-9 h-9 justify-center transition-all duration-300 dark:h-9 dark:text-sidebar-foreground/70",
                activeChild
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-400/25 ring-1 ring-white/15 dark:bg-sidebar-primary dark:text-sidebar-primary-foreground"
                  : "hover:bg-white/10 hover:text-white dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
              )}
            >
              <Bus className="h-[1.1rem] w-[1.1rem] opacity-80" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <SidebarGroup className="py-1">
        <SidebarGroupLabel className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-[0.2em] px-3 mb-1.5 opacity-80 cursor-pointer flex items-center justify-between w-full select-none" asChild>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-1 hover:text-white transition-colors">
            <span className="flex items-center gap-1.5">
              <Bus className="h-3.5 w-3.5 opacity-70" />
              <span>{label}</span>
            </span>
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0 ml-auto opacity-70", isOpen ? "rotate-0" : "-rotate-90")} />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="space-y-1 relative pl-3.5">
          {/* Guide Line */}
          <div className="absolute left-[18px] top-2 bottom-2 w-[1px] bg-white/10 dark:bg-sidebar-border/60" />

          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={async () => {
                        if (termNavigationBlocked && !ACTIVE_TERM_EXEMPT_MODULES.has(item.id)) {
                          toast({
                            title: 'Set your active term first',
                            description:
                              'Welcome! Please open Settings → Academic Terms and activate a term before using this feature.',
                          });
                          return;
                        }
                        await markCommsRead(item.id);
                        setActiveModule(item.id);

                        const schoolMatch = window.location.pathname.match(/^\/school\/[^/]+/);
                        const prefix = schoolMatch ? schoolMatch[0] : '';

                        if (item.id === 'transport-overview') {
                          window.history.pushState({}, '', `${prefix}/transport`);
                        } else if (item.id === 'transport-map') {
                          window.history.pushState({}, '', `${prefix}/transport/map`);
                        } else if (item.id === 'transport-routes') {
                          window.history.pushState({}, '', `${prefix}/transport/routes`);
                        } else if (item.id === 'transport-vehicles') {
                          window.history.pushState({}, '', `${prefix}/transport/vehicles`);
                        } else if (item.id === 'transport-drivers') {
                          window.history.pushState({}, '', `${prefix}/transport/drivers`);
                        } else if (item.id === 'transport-students') {
                          window.history.pushState({}, '', `${prefix}/transport/students`);
                        }
                        if (isMobile) setOpenMobile(false);
                      }}
                      tooltip={item.label}
                      className={cn(
                        "readonly-allowed relative rounded-lg w-full h-8.5 text-xs text-emerald-50/70 transition-all duration-200 dark:h-8 dark:text-sidebar-foreground/60",
                        isActive
                          ? "bg-white/10 text-white font-bold shadow-sm border border-white/5 dark:bg-sidebar-accent dark:text-sidebar-foreground"
                          : "hover:bg-white/5 hover:text-white dark:hover:bg-sidebar-accent/50 dark:hover:text-sidebar-foreground"
                      )}
                    >
                      <span className="relative inline-flex shrink-0">
                        <item.icon className="h-[1rem] w-[1rem] opacity-85" />
                      </span>
                      <span className="font-semibold group-data-[collapsible=icon]:hidden ml-2 flex min-w-0 flex-1 items-center gap-1.5 text-left">
                        <span className="truncate">{item.label}</span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeModule, setActiveModule }) => {
  const { logout, hasAccess, user, actsAsPrimaryAdmin, isPlatformSuperAdmin } = useAuth();
  const { hasActiveTerm, isLoading: activeTermLoading } = useActiveTerm();
  const termNavigationBlocked = !activeTermLoading && !hasActiveTerm;
  const { school } = useSchool();
  const { isMobile, setOpenMobile } = useSidebar();
  const { socket } = useSocket();
  const [parentDeskUnread, setParentDeskUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [paymentSubmissionsPending, setPaymentSubmissionsPending] = useState(0);
  const [becomeUserOpen, setBecomeUserOpen] = useState(false);
  const impersonation = useImpersonationOptional();
  const adminEligible =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonation_admin_eligible') === '1';
  const showBecomeUser =
    !impersonation?.isImpersonating &&
    !isHeadmasterRole(user?.role) &&
    !!(actsAsPrimaryAdmin || isPlatformSuperAdmin || adminEligible || user?.role === 'super-admin');

  const isHeadmaster = isHeadmasterRole(user?.role);
  const headmasterMenu = isHeadmaster
    ? getHeadmasterMenuItems(hasAccess, user?.role, headmasterHasTeachingAccess(user))
    : null;
  const menuItems = headmasterMenu ?? getMenuItems(hasAccess, user?.role);

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
      if (hasAccess('payment-submissions')) {
        const p = await apiService.get<{ count: number }>('/payment-submissions/pending-count');
        setPaymentSubmissionsPending(Number(p?.count ?? 0));
      } else {
        setPaymentSubmissionsPending(0);
      }
      if (hasAccess('messages')) {
        const { chatService } = await import('../services/chatService');
        const c = await chatService.listChannels();
        setMessagesUnread(Number(c?.total_unread ?? 0));
      } else {
        setMessagesUnread(0);
      }
    } catch {
      setParentDeskUnread(0);
      setSupportUnread(0);
      setPaymentSubmissionsPending(0);
      setMessagesUnread(0);
    }
  }, [hasAccess]);

  const markCommsRead = useCallback(async (moduleId: string) => {
    try {
      if (moduleId === 'payment-submissions') {
        // payment submissions marked read when reviewed
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshCommsBadges();
    const id = window.setInterval(() => void refreshCommsBadges(), 30000);
    return () => window.clearInterval(id);
  }, [user, refreshCommsBadges]);

  useEffect(() => {
    if (!socket) return;
    const onTenant = (evt: { entity?: string }) => {
      const e = String(evt?.entity || '');
      if (e === 'parent-desk' || e === 'support-chat' || e === 'payment-submission' || e === 'chat' || e === 'staff-notification') void refreshCommsBadges();
    };
    const onCountUpdate = () => void refreshCommsBadges();
    const onLocalRefresh = () => void refreshCommsBadges();
    socket.on('tenant-data-changed', onTenant);
    socket.on('new-support-message', onCountUpdate);
    socket.on('new-parent-message', onCountUpdate);
    socket.on('support-chat-read', onCountUpdate);
    window.addEventListener('comms-badges-refresh', onLocalRefresh);
    return () => {
      socket.off('tenant-data-changed', onTenant);
      socket.off('new-support-message', onCountUpdate);
      socket.off('new-parent-message', onCountUpdate);
      socket.off('support-chat-read', onCountUpdate);
      window.removeEventListener('comms-badges-refresh', onLocalRefresh);
    };
  }, [socket, refreshCommsBadges]);

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className={cn(
        'border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl overflow-hidden print:hidden',
        isHeadmaster ? 'shadow-amber-950/25' : 'shadow-emerald-950/20'
      )}
    >
      <SidebarHeader
        className={cn(
          'min-h-24 flex items-center justify-center border-b border-white/10 mb-3 px-3 py-4 overflow-hidden dark:min-h-24 dark:border-sidebar-border dark:bg-none',
          isHeadmaster
            ? 'bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.22),transparent_65%)]'
            : 'bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.22),transparent_65%)]'
        )}
      >
        <div className="w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shadow-xl shadow-emerald-950/25 shrink-0 overflow-hidden backdrop-blur dark:bg-gradient-to-br dark:from-indigo-500 dark:to-blue-600 dark:ring-0 dark:shadow-indigo-500/20">
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
        <div className="ml-3 min-w-0 flex-1 overflow-visible transition-all duration-300 group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
          {isHeadmaster ? (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 ring-1 ring-amber-400/30">
                <Crown className="h-3 w-3" />
                Headmaster
              </div>
              <h2 className="break-words text-sm font-black leading-tight text-white uppercase tracking-tight dark:text-sidebar-foreground">
                {school?.name || 'EDUNERVE'}
              </h2>
            </div>
          ) : (
            <h2 className="break-words text-sm font-black leading-tight text-white uppercase tracking-tight dark:text-sidebar-foreground">
              {school?.name || 'EDUNERVE'}
            </h2>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain px-1 py-3 gap-3 bg-transparent outline-none border-none">
        {isHeadmaster && headmasterMenu ? (
          <>
            <MenuSection items={headmasterMenu.myWork} label="My Work" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} headmasterAccent />
            <MenuSection items={headmasterMenu.schoolOverview} label="School Overview" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} headmasterAccent />
            <MenuSection items={headmasterMenu.communication} label="Communication" activeModule={activeModule} setActiveModule={setActiveModule} itemCounts={{ 'parent-desk': parentDeskUnread }} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} headmasterAccent />
            <MenuSection items={headmasterMenu.management} label="Management" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} headmasterAccent />
            <MenuSection items={headmasterMenu.configurations} label="Configurations" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} headmasterAccent />
          </>
        ) : (
          <>
        <MenuSection items={menuItems.dashboard} label="Overview" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection items={menuItems.academic} label="Academic Central" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection items={menuItems.teaching} label="Teaching Room" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection items={menuItems.financial} label="Financial Ops" activeModule={activeModule} setActiveModule={setActiveModule} itemCounts={{ 'payment-submissions': paymentSubmissionsPending }} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection items={menuItems.records} label="Data Center" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <CollapsibleMenuSection items={menuItems.transport} label="Transport Management" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection
          items={menuItems.announcements}
          label="Announcements & parent desk"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          itemCounts={{ 'parent-desk': parentDeskUnread, messages: messagesUnread }}
          markCommsRead={markCommsRead}
          termNavigationBlocked={termNavigationBlocked}
        />
        <SidebarSeparator className="bg-sidebar-border mx-4 my-2" />
        <MenuSection
          items={menuItems.ai}
          label="Innovation"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          itemCounts={{ 'support-chat': supportUnread }}
          markCommsRead={markCommsRead}
          termNavigationBlocked={termNavigationBlocked}
        />
        <MenuSection items={menuItems.configurations} label="Configurations" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
        <MenuSection items={menuItems.system} label="System" activeModule={activeModule} setActiveModule={setActiveModule} markCommsRead={markCommsRead} termNavigationBlocked={termNavigationBlocked} />
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3 space-y-4 bg-black/10 dark:border-sidebar-border dark:bg-sidebar-accent/50">
        <SidebarMenu>
          {showBecomeUser && (
            <SidebarMenuItem className="flex justify-center">
              <SidebarMenuButton
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                  setBecomeUserOpen(true);
                }}
                className="rounded-xl w-full h-10 text-amber-200/90 hover:text-amber-50 hover:bg-amber-500/15 transition-all group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center"
                tooltip="Become a User"
              >
                <UserRoundSearch className="h-4.5 w-4.5 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-tight ml-3 group-data-[collapsible=icon]:hidden">Become a User</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                if (impersonation?.isImpersonating) {
                  void impersonation.exitImpersonation();
                  return;
                }
                logout();
              }}
              className="rounded-xl w-full h-10 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center"
              tooltip={impersonation?.isImpersonating ? 'Exit impersonation' : 'Terminate Session'}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-tight ml-3 group-data-[collapsible=icon]:hidden">
                {impersonation?.isImpersonating ? 'Exit View' : 'Sign Out'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="p-3 bg-sidebar-accent/30 rounded-2xl border border-sidebar-border">
            <p className="text-[10px] text-sidebar-foreground/50 text-center font-medium leading-tight">
              Crafted with Excellence by <br />
              <span className="font-black text-sidebar-foreground uppercase tracking-widest text-[9px]">Scholarnerve</span>
            </p>
          </div>
        </div>
      </SidebarFooter>
      <BecomeUserPanel open={becomeUserOpen} onClose={() => setBecomeUserOpen(false)} />
    </Sidebar>
  );
};

export default AppSidebar;
