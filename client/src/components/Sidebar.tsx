
import { } from '@/components/ui/badge';
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
import { useAuth } from '../contexts/AuthContext';

interface AppSidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

// Clean menu configuration for easy backend integration
const getMenuItems = (hasAccess: (permission: string) => boolean) => ({
  dashboard: [
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
      label: 'Teacher Dashboard',
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
  ],

  teaching: [
    ...(hasAccess('teacher-classes') ? [{
      id: 'teacher-classes',
      label: 'My Classes',
      icon: BookOpen,
    }] : []),
    ...(hasAccess('attendance') ? [{
      id: 'attendance',
      label: 'Attendance',
      icon: UserCheck,
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
    ...(hasAccess('staff-payroll') ? [{
      id: 'staff-payroll',
      label: 'Staff Payroll',
      icon: Wallet,
    }] : []),
    ...(hasAccess('payroll') ? [{
      id: 'payroll',
      label: 'Payroll Management',
      icon: BarChart3,
    }] : []),
  ],

  system: [
    ...(hasAccess('settings') || hasAccess('settings-password-only') ? [{
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    }] : []),
    ...(hasAccess('audit') ? [{
      id: 'audit',
      label: 'Audit Logs',
      icon: Shield,
    }] : []),
  ],

  ai: [
    ...(hasAccess('ai-assistant') ? [{
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      badge: 'NEW'
    }] : []),
  ]
});

const MenuSection: React.FC<{
  items: any[];
  label: string;
  activeModule: string;
  setActiveModule: (module: string) => void;
}> = ({ items, label, activeModule, setActiveModule }) => {
  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={activeModule === item.id}
                onClick={() => setActiveModule(item.id)}
                className="w-full"
                tooltip={item.label}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <SidebarMenuBadge>
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

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeModule, setActiveModule }) => {
  const { logout, hasAccess } = useAuth();
  const { state, toggleSidebar } = useSidebar();

  const menuItems = getMenuItems(hasAccess);

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-200 p-1">
        {/* Logo moved to top menu header; keep sidebar header minimal */}
        <div className="h-10" />
      </SidebarHeader>

      <SidebarContent className="px-1 py-4">
        <MenuSection
          items={menuItems.dashboard}
          label="Dashboard"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />
        <MenuSection
          items={menuItems.academic}
          label="Academic"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />
        <MenuSection
          items={menuItems.teaching}
          label="Teaching"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />
        <MenuSection
          items={menuItems.financial}
          label="Financial"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />
        <MenuSection
          items={menuItems.system}
          label="System"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />

        <SidebarSeparator className="my-2" />

        <MenuSection
          items={menuItems.ai}
          label="AI Tools"
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              tooltip="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="flex-1">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {state === "expanded" && (
          <div className="px-2 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Powered by <span className="font-semibold text-gray-700">Technerve</span>
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
