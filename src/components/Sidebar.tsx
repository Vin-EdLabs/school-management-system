import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Users,
  GraduationCap,
  School,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Calculator,
  FileText,
  Printer,
  ClipboardCheck,
  BookOpen
} from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { logout, hasAccess, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, requiredAccess: 'dashboard' },
    { id: 'financial-dashboard', label: 'Financial Dashboard', icon: Calculator, requiredAccess: 'financial-dashboard' },
    { id: 'teacher-dashboard', label: 'Teacher Dashboard', icon: BookOpen, requiredAccess: 'teacher-dashboard' },
    { id: 'students', label: 'Students', icon: Users, requiredAccess: 'students' },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap, requiredAccess: 'teachers' },
    { id: 'classes', label: 'Classes', icon: School, requiredAccess: 'classes' },
    { id: 'teacher-classes', label: 'My Classes', icon: School, requiredAccess: 'teacher-classes' },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, requiredAccess: 'attendance' },
    { id: 'grades', label: 'Grades', icon: BookOpen, requiredAccess: 'grades' },
    { id: 'fees', label: 'Fees Management', icon: CreditCard, requiredAccess: 'fees' },
    { id: 'income', label: 'Other Income', icon: TrendingUp, requiredAccess: 'income' },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown, requiredAccess: 'expenses' },
    { id: 'reports', label: 'Reports', icon: BarChart3, requiredAccess: 'reports' },
    { id: 'print-fee-status', label: 'Print Fee Status', icon: Printer, requiredAccess: 'print-fee-status' },
    { id: 'audit', label: 'Audit Logs', icon: FileText, requiredAccess: 'audit' },
  ];

  // Filter menu items based on role access
  const visibleMenuItems = menuItems.filter(item => hasAccess(item.requiredAccess));

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col h-full`}>
      {/* Header with TechNerve branding */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-800">Rosa Gardens</h1>
                <p className="text-xs text-gray-500">School Management</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
        {!isCollapsed && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                <span className="text-xs font-bold text-white">T</span>
              </div>
              <span className="text-xs text-gray-600 font-medium">Powered by TechNerve</span>
            </div>
            {user && (
              <div className="mt-2 text-xs text-gray-500">
                Logged in as: <span className="font-medium text-gray-700">{user.role.replace('-', ' ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="mt-4 px-2 flex-1 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? 'justify-center p-2' : 'justify-start'} mb-1 h-10 ${
                isActive 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              onClick={() => setActiveModule(item.id)}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 ${!isCollapsed ? 'mr-3' : ''}`} />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3" />}
                </>
              )}
            </Button>
          );
        })}

        {/* Settings - Available for all roles */}
        <Button
          variant={activeModule === 'settings' ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? 'justify-center p-2' : 'justify-start'} mb-1 h-10 ${
            activeModule === 'settings'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
          onClick={() => setActiveModule('settings')}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className={`w-4 h-4 ${!isCollapsed ? 'mr-3' : ''}`} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-sm">Settings</span>
              {activeModule === 'settings' && <ChevronRight className="w-3 h-3" />}
            </>
          )}
        </Button>
      </nav>

      {/* Fixed Logout Button at Bottom */}
      <div className="p-2 border-t border-gray-200 flex-shrink-0">
        <Button
          variant="ghost"
          className={`w-full ${isCollapsed ? 'justify-center p-2' : 'justify-start'} text-red-600 hover:text-red-700 hover:bg-red-50 h-10`}
          onClick={logout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className={`w-4 h-4 ${!isCollapsed ? 'mr-3' : ''}`} />
          {!isCollapsed && <span className="text-sm">Logout</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
