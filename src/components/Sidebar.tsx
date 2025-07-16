
import React from 'react';
import { Button } from '@/components/ui/button';
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
  ClipboardList,
  Award,
  Bot,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { user, logout, hasAccess } = useAuth();

  const menuItems = [
    // Dashboard items
    ...(hasAccess('dashboard') ? [{
      id: 'dashboard',
      label: user?.role === 'administrator' ? 'Dashboard' : 'General Dashboard',
      icon: LayoutDashboard,
      category: 'Dashboard'
    }] : []),
    ...(hasAccess('financial-dashboard') ? [{
      id: 'financial-dashboard',
      label: 'Financial Dashboard',
      icon: DollarSign,
      category: 'Dashboard'
    }] : []),
    ...(hasAccess('teacher-dashboard') ? [{
      id: 'teacher-dashboard',
      label: 'Teacher Dashboard',
      icon: GraduationCap,
      category: 'Dashboard'
    }] : []),

    // AI Assistant
    ...(hasAccess('ai-assistant') ? [{
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      category: 'AI',
      badge: 'NEW'
    }] : []),

    // Academic Management
    ...(hasAccess('students') || hasAccess('students-view-only') ? [{
      id: 'students',
      label: 'Students',
      icon: Users,
      category: 'Academic'
    }] : []),
    ...(hasAccess('teachers') || hasAccess('teachers-view-only') ? [{
      id: 'teachers',
      label: 'Teachers',
      icon: GraduationCap,
      category: 'Academic'
    }] : []),
    ...(hasAccess('classes') ? [{
      id: 'classes',
      label: 'Classes',
      icon: BookOpen,
      category: 'Academic'
    }] : []),

    // Teacher specific
    ...(hasAccess('teacher-classes') ? [{
      id: 'teacher-classes',
      label: 'My Classes',
      icon: BookOpen,
      category: 'Teaching'
    }] : []),
    ...(hasAccess('attendance') ? [{
      id: 'attendance',
      label: 'Attendance',
      icon: UserCheck,
      category: 'Teaching'
    }] : []),
    ...(hasAccess('grades') ? [{
      id: 'grades',
      label: 'Grades',
      icon: Award,
      category: 'Teaching'
    }] : []),

    // Financial Management
    ...(hasAccess('fees') ? [{
      id: 'fees',
      label: 'Fees',
      icon: DollarSign,
      category: 'Financial'
    }] : []),
    ...(hasAccess('income') ? [{
      id: 'income',
      label: 'Income',
      icon: TrendingUp,
      category: 'Financial'
    }] : []),
    ...(hasAccess('expenses') ? [{
      id: 'expenses',
      label: 'Expenses',
      icon: TrendingDown,
      category: 'Financial'
    }] : []),
    ...(hasAccess('reports') ? [{
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      category: 'Financial'
    }] : []),
    ...(hasAccess('print-fee-status') ? [{
      id: 'print-fee-status',
      label: 'Fee Status',
      icon: FileText,
      category: 'Financial'
    }] : []),

    // System Management
    ...(hasAccess('settings') || hasAccess('settings-password-only') ? [{
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      category: 'System'
    }] : []),
    ...(hasAccess('audit') ? [{
      id: 'audit',
      label: 'Audit Logs',
      icon: Shield,
      category: 'System'
    }] : [])
  ];

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  const categoryOrder = ['Dashboard', 'AI', 'Academic', 'Teaching', 'Financial', 'System'];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">RG</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Rosa Gardens</h1>
            <p className="text-xs text-gray-500">School Management</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium text-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('-', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categoryOrder.map(category => {
          const items = groupedItems[category];
          if (!items || items.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {items.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeModule === item.id ? "default" : "ghost"}
                    className={`w-full justify-start text-left ${
                      activeModule === item.id 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveModule(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
