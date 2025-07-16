
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Settings, 
  Shield, 
  FileText,
  UserCheck,
  Award,
  Bot,
  LogOut
} from 'lucide-react';
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

export const AppSidebar: React.FC<AppSidebarProps> = ({ activeModule, setActiveModule }) => {
  const { user, logout, hasAccess } = useAuth();
  const { state } = useSidebar();

  const dashboardItems = [
    ...(hasAccess('dashboard') ? [{
      id: 'dashboard',
      label: user?.role === 'administrator' ? 'Dashboard' : 'General Dashboard',
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
  ];

  const academicItems = [
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
  ];

  const teachingItems = [
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
  ];

  const financialItems = [
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
  ];

  const systemItems = [
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
  ];

  const aiItems = [
    ...(hasAccess('ai-assistant') ? [{
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      badge: 'NEW'
    }] : []),
  ];

  const renderMenuGroup = (items: any[], label: string) => {
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
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center space-x-3 p-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">RG</span>
          </div>
          {state === "expanded" && (
            <div className="min-w-0">
              <h1 className="font-bold text-foreground truncate">Rosa Gardens</h1>
              <p className="text-xs text-muted-foreground truncate">School Management</p>
            </div>
          )}
        </div>

        {state === "expanded" && (
          <div className="flex items-center space-x-3 p-2 border-t border-border">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
              <span className="text-muted-foreground font-medium text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize truncate">
                {user?.role?.replace('-', ' ')}
              </p>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {renderMenuGroup(dashboardItems, 'Dashboard')}
        {renderMenuGroup(academicItems, 'Academic')}
        {renderMenuGroup(teachingItems, 'Teaching')}
        {renderMenuGroup(financialItems, 'Financial')}
        {renderMenuGroup(systemItems, 'System')}
        
        <SidebarSeparator className="my-2" />
        
        {renderMenuGroup(aiItems, 'AI Tools')}
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {state === "expanded" && (
          <div className="px-2 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Powered by <span className="font-semibold text-foreground">Technver</span>
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
