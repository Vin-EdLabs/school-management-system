
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
  X
} from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap },
    { id: 'classes', label: 'Classes', icon: School },
    { id: 'fees', label: 'Fees Management', icon: CreditCard },
    { id: 'income', label: 'Other Income', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out`}>
      {/* Header with TechNerve branding */}
      <div className="p-4 border-b border-gray-200">
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
          </div>
        )}
      </div>

      <nav className="mt-4 px-2">
        {menuItems.map((item) => {
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
      </nav>

      <div className="absolute bottom-4 left-2 right-2">
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
