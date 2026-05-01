import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { Bot, User, Clock, Calendar, Moon, Sun } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex items-center justify-between w-full h-full gap-6">
      {/* Welcome Section */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
            {getGreeting()}, <span className="text-indigo-600 dark:text-indigo-400">{user?.username}</span>
          </h1>
          <div className="flex items-center gap-2">
             <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider rounded border border-indigo-100/50 dark:border-indigo-900 shadow-sm">
              {user?.role?.replace('-', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section: Time and Actions */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-3">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2 shadow-sm">
            <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatDate(currentTime)}</span>
          </div>
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2 shadow-sm">
            <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300 w-[90px] text-center">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/50"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {(user?.role === 'finance' || user?.role === 'super-admin') && onAiAssistantClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAiAssistantClick}
              className="shrink-0 bg-gradient-to-r from-blue-50 to-indigo-100 hover:from-blue-100 hover:to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 h-10 px-4 font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Bot className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
              AI Assistant
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainHeader;

