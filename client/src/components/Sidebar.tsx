
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
  activePath: string;
}> = ({ items, label, activePath }) => {
  const navigate = useNavigate();

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
                isActive={activePath === `/${item.id}` || (activePath === '/dashboard' && item.id === 'dashboard')}
                onClick={() => navigate(`/${item.id}`)}
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

export const AppSidebar: React.FC = () => {
  const { logout, hasAccess } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();

  const activePath = location.pathname;

  const menuItems = getMenuItems(hasAccess);

  return (
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              tooltip="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="flex-1">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {state === "expanded" && (
          <div className="px-2 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Powered by <span className="font-semibold text-foreground">Technerve</span>
              <img src="/technerve.jpg" alt="tech nerve icon" className="w-6 h-6 inline rounded" />
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
