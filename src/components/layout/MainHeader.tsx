
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Bot, Calendar, Clock, GraduationCap, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveAcademicTerm } from '../../utils/feeCalculations';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick }) => {
  const { user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTerm, setCurrentTerm] = useState('');
  const [showSmallMenu, setShowSmallMenu] = useState(false);
  const smallMenuRef = React.useRef<HTMLDivElement | null>(null);
  const smallMenuButtonRef = React.useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update current term from settings
  useEffect(() => {
    const updateCurrentTerm = () => {
      setCurrentTerm(getActiveAcademicTerm());
    };

    // Initial load
    updateCurrentTerm();

    // Listen for localStorage changes (when settings are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'academicTerms' || e.key === 'academicSettings') {
        updateCurrentTerm();
      }
    };

    // Listen for custom events when settings change within the same tab
    const handleSettingsChange = () => {
      updateCurrentTerm();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('academicSettingsChanged', handleSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('academicSettingsChanged', handleSettingsChange);
    };
  }, []);

  // Close small screen menu when clicking outside or pressing Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!showSmallMenu) return;
      if (smallMenuRef.current && smallMenuButtonRef.current) {
        if (!smallMenuRef.current.contains(target) && !smallMenuButtonRef.current.contains(target)) {
          setShowSmallMenu(false);
        }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSmallMenu(false);
    };

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSmallMenu]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getWelcomeMessage = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="relative flex items-center justify-between w-full">
      {/* Left: Logo (when sidebar collapsed) + Welcome Section */}
      <div className="flex items-center space-x-4">
        {/* Logo block visually attached to the sidebar; fixed to top-left and matches sidebar width */}
        <div className="hidden md:block">
          <div className={`relative z-20 flex items-center h-16 rounded-r-lg bg-sidebar border-r border-sidebar-border shadow-sm pr-10 ${state === 'collapsed' ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'}`}>
            <button
              onClick={() => toggleSidebar()}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              className="flex items-center gap-3 ml-1"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">RG</span>
              </div>
              <div className={state === 'collapsed' ? 'hidden' : 'hidden sm:block text-sidebar-foreground'}>
                <span className="font-semibold">Rosa Gardens</span>
              </div>
            </button>
          </div>
        </div>

        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-auto text-white mx-auto" />
        </div>
        <div className="min-w-0">
          <h1
            className="text-lg font-semibold text-gray-900 truncate"
            title={`${getWelcomeMessage()}, ${user?.username}`}
          >
            {getWelcomeMessage()}, {user?.username}!
          </h1>
          <p
            className="text-sm text-gray-600 capitalize truncate"
            title={`${user?.role?.replace('-', ' ')} Dashboard`}
          >
            {user?.role?.replace('-', ' ')} Dashboard
          </p>
        </div>
      </div>

      {/* Right: Academic Term, Date & Time Section + AI button */}
      {/* Hidden on small screens; replaced by compact toggle below */}
      <div className="hidden lg:flex items-center space-x-6">
        <div className="flex items-center space-x-4 text-sm min-w-0">
          {/* Current Academic Term */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
            <GraduationCap className="w-4 h-4 text-purple-600" />
            <span className="text-purple-700 font-medium truncate max-w-[140px]" title={currentTerm}>{currentTerm}</span>
          </div>

          {/* Current Date */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700 font-medium truncate max-w-[220px]" title={formatDate(currentTime)}>{formatDate(currentTime)}</span>
          </div>

          {/* Current Time */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-gray-700 font-medium truncate max-w-[120px]" title={formatTime(currentTime)}>{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* AI Assistant Button */}
        {(user?.role === 'finance' || user?.role === 'super-admin') && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAiAssistantClick}
            className="flex-shrink-0 flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all"
          >
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-blue-700 font-medium truncate" title="AI Assistant">AI Assistant</span>
            <Badge variant="secondary" className="ml-1 text-xs bg-blue-100 text-blue-700">
              NEW
            </Badge>
          </Button>
        )}
      </div>

      {/* Small screen compact toggle: visible on small screens only */}
      <div className="lg:hidden flex items-center">
        <button
          ref={smallMenuButtonRef}
          onClick={() => setShowSmallMenu((s) => !s)}
          aria-expanded={showSmallMenu}
          aria-controls="mobile-header-panel"
          className="p-2 rounded-md hover:bg-gray-100 flex-shrink-0"
          title="Show header details"
        >
          <span className="sr-only">Show header details</span>
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v.01M12 12v.01M12 18v.01"></path></svg>
        </button>

        {showSmallMenu && (
          <div
            id="mobile-header-panel"
            ref={smallMenuRef}
            className="absolute right-3 top-14 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
          >
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2 px-2 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 rounded">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span className="text-purple-700 font-medium">{currentTerm || '—'}</span>
              </div>

              <div className="flex items-center space-x-2 px-2 py-1 bg-gray-50 rounded">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{formatDate(currentTime)}</span>
              </div>

              <div className="flex items-center space-x-2 px-2 py-1 bg-gray-50 rounded">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="font-mono text-gray-700">{formatTime(currentTime)}</span>
              </div>

              {(user?.role === 'finance' || user?.role === 'super-admin') && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSmallMenu(false);
                      onAiAssistantClick?.();
                    }}
                    className="w-full flex items-center justify-center space-x-2"
                  >
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-700 font-medium">AI Assistant</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainHeader;
