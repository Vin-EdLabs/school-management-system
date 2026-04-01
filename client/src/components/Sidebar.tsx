<<<<<<< HEAD:src/components/Sidebar.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useSchool } from '../contexts/SchoolContext';
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
} from 'lucide-react';
import { resolveLogoUrl } from '../services/tenantService';
=======

import { } from '@/components/ui/badge';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  DollarSign,
  FileText,
  GraduationCap,
  Library,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet
} from 'lucide-react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const getMenuItems = (hasAccess: (permission: string) => boolean) => ({
  dashboard: [
<<<<<<< HEAD:src/components/Sidebar.tsx
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
  ],
  records: [
    ...(hasAccess('records') ? [{ id: 'records', label: 'Records', icon: Search }] : []),
  ],
=======
    ...(hasAccess('dashboard') ? [{
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    }] : []),
    ...(hasAccess('financial-dashboard') ? [{
      id: 'financial-dashboard',
      label: 'Financial Dashboard',
      icon: DollarSign,
    }] : []),
    ...(hasAccess('teacher-dashboard') ? [{
      id: 'teacher-dashboard',
      label: 'Dashboard',
      icon: GraduationCap,
    }] : []),
  ],

  academic: [
    ...(hasAccess('students') || hasAccess('students-view-only') ? [{
      id: 'students',
      label: 'Students',
      icon: Users,
    }] : []),
    ...(hasAccess('teachers') || hasAccess('teachers-view-only') ? [{
      id: 'teachers',
      label: 'Teachers',
      icon: GraduationCap,
    }] : []),
    ...(hasAccess('staff') || hasAccess('staff-view-only') ? [{
      id: 'staff',
      label: 'Staff',
      icon: Users,
    }] : []),
    ...(hasAccess('classes') ? [{
      id: 'classes',
      label: 'Classes',
      icon: BookOpen,
    }] : []),
    ...(hasAccess('schedules') ? [{
      id: 'schedules',
      label: 'Schedules',
      icon: Calendar,
    }] : []),
    ...(hasAccess('schedules') ? [{
      id: 'timetable',
      label: 'Timetable',
      icon: Calendar,
    }] : []),
    ...(hasAccess('calendar') ? [{
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
    }] : []),
    ...(hasAccess('subjects') ? [{
      id: 'subjects',
      label: 'Subjects',
      icon: Library,
    }] : []),
  ],

  teaching: [
    ...(hasAccess('teacher-classes') ? [{
      id: 'teacher-classes',
      label: 'My Classes',
      icon: BookOpen,
    }] : []),
    ...(hasAccess('attendance') ? [{
      id: 'attendance',
      label: 'Take Attendance',
      icon: UserCheck,
    }] : []),
    ...(hasAccess('attendance-reports') || hasAccess('attendance') ? [{
      id: 'attendance-reports',
      label: 'Attendance Reports',
      icon: BarChart3,
    }] : []),
    ...(hasAccess('grades') ? [{
      id: 'grades',
      label: 'Grades',
      icon: Award,
    }] : []),
  ],

  financial: [
    ...(hasAccess('fees') ? [{
      id: 'fees',
      label: 'Fees',
      icon: DollarSign,
    }] : []),
    ...(hasAccess('income') ? [{
      id: 'income',
      label: 'Income',
      icon: TrendingUp,
    }] : []),
    ...(hasAccess('expenses') ? [{
      id: 'expenses',
      label: 'Expenses',
      icon: TrendingDown,
    }] : []),
    ...(hasAccess('reports') ? [{
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
    }] : []),
    ...(hasAccess('print-fee-status') ? [{
      id: 'print-fee-status',
      label: 'Fee Status',
      icon: FileText,
    }] : []),
    ...(hasAccess('payroll') ? [{
      id: 'payroll',
      label: 'Payroll',
      icon: Wallet,
    }] : []),
  ],

>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
  system: [
    ...(hasAccess('support-chat') ? [{ id: 'support-chat', label: 'Support', icon: MessageCircle }] : []),
    ...(hasAccess('users') ? [{ id: 'users', label: 'Users', icon: UserCog }] : []),
    ...(hasAccess('settings') || hasAccess('settings-password-only') ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
    ...(hasAccess('audit') ? [{ id: 'audit', label: 'Audit Logs', icon: Shield }] : []),
  ],
<<<<<<< HEAD:src/components/Sidebar.tsx
=======

>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
  ai: [
    ...(hasAccess('ai-assistant') ? [{ id: 'ai-assistant', label: 'AI Assistant', icon: Bot, badge: 'New' }] : []),
  ],
});

const MenuSection: React.FC<{
  items: { id: string; label: string; icon: React.ElementType; badge?: string }[];
  label: string;
  activePath: string;
}> = ({ items, label, activePath }) => {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-3">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
<<<<<<< HEAD:src/components/Sidebar.tsx
                isActive={activeModule === item.id}
                onClick={() => setActiveModule(item.id)}
                className="rounded-lg mx-2 text-slate-200 data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=true]:shadow-sm hover:bg-slate-700/70 hover:text-white transition-colors"
=======
                isActive={activePath === `/${item.id}` || (activePath === '/dashboard' && item.id === 'dashboard')}
                onClick={() => navigate(`/${item.id}`)}
                className="w-full"
                tooltip={item.label}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
<<<<<<< HEAD:src/components/Sidebar.tsx
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-0">
=======
                  <SidebarMenuBadge>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
                    {item.badge}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export const AppSidebar: React.FC = () => {
  const { logout, hasAccess } = useAuth();
<<<<<<< HEAD:src/components/Sidebar.tsx
  const { school, schoolId } = useSchool();
  const schoolName = school?.name ?? (schoolId ? 'School' : 'Select School');
  const schoolLogo = resolveLogoUrl(school?.logo_url ?? null);
  const primaryColor = school?.primary_color ?? '#0f172a';
=======
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();

  const activePath = location.pathname;
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx

  const menuItems = getMenuItems(hasAccess);

  return (
<<<<<<< HEAD:src/components/Sidebar.tsx
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-slate-700/60 bg-slate-900 text-slate-200"
    >
      <SidebarHeader className="border-b border-slate-700/80 px-4 py-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-slate-600/50 bg-slate-800"
            style={{ backgroundColor: primaryColor }}
          >
            {schoolLogo ? (
              <img src={schoolLogo} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <GraduationCap className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="font-semibold text-white truncate text-base tracking-tight" title={schoolName}>
              {schoolName}
            </h1>
            <p className="text-xs text-slate-400 truncate">TECHNERVE</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 gap-6 flex flex-col overflow-y-auto scrollbar-hide">
        <MenuSection items={menuItems.dashboard} label="Overview" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.academic} label="Academic" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.teaching} label="Teaching" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.financial} label="Finance" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.records} label="Records" activeModule={activeModule} setActiveModule={setActiveModule} />
        <MenuSection items={menuItems.system} label="System" activeModule={activeModule} setActiveModule={setActiveModule} />
        <SidebarSeparator className="bg-slate-700/60 mx-2" />
        <MenuSection items={menuItems.ai} label="Tools" activeModule={activeModule} setActiveModule={setActiveModule} />
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-700/80 p-2">
=======
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-border shadow-sm">
      <SidebarHeader
        className="border-b border-border h-16 flex justify-center items-center px-2 cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
        onClick={() => toggleSidebar()}
      >
        <div className="flex items-center justify-center w-full overflow-hidden">
          <div className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-primary/10 rounded-md">
            <img src="/rosa.png" alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          {state === "expanded" && (
            <span className="font-bold text-lg text-primary tracking-tight whitespace-nowrap ml-3">
              Rosa Gardens
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-4">
        <MenuSection
          items={menuItems.dashboard}
          label="Dashboard"
          activePath={activePath}
        />
        <MenuSection
          items={menuItems.academic}
          label="Academic"
          activePath={activePath}
        />
        <MenuSection
          items={menuItems.teaching}
          label="Teaching"
          activePath={activePath}
        />
        <MenuSection
          items={menuItems.financial}
          label="Financial"
          activePath={activePath}
        />
        <MenuSection
          items={menuItems.system}
          label="System"
          activePath={activePath}
        />

        <SidebarSeparator className="my-2" />

        <MenuSection
          items={menuItems.ai}
          label="AI Tools"
          activePath={activePath}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
<<<<<<< HEAD:src/components/Sidebar.tsx
              className="rounded-lg mx-2 text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
=======
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              tooltip="Logout"
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
            >
              <LogOut className="h-4 w-4" />
              <span className="flex-1">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
<<<<<<< HEAD:src/components/Sidebar.tsx
        <div className="px-4 py-3 border-t border-slate-700/60">
          <p className="text-[11px] text-slate-400 text-center">Powered by <span className="font-semibold text-slate-300">TECHNERVE</span></p>
        </div>
=======

        {state === "expanded" && (
          <div className="px-2 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Powered by <span className="font-semibold text-foreground">Technerve</span>
              <img src="/technerve.jpg" alt="tech nerve icon" className="w-6 h-6 inline rounded" />
            </p>
          </div>
        )}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/components/Sidebar.tsx
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
