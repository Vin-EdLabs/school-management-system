
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Bot, Calendar, Clock, GraduationCap, Menu, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveAcademicTerm } from '../../utils/feeCalculations';
import { ModeToggle } from '../ModeToggle';

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

  const getFirstName = () => {
    const displayName = (user as any)?.displayName;
    if (displayName && displayName.trim().length > 0) {
      return displayName.trim().split(' ')[0]; // Extract first name
    }
    return (user as any)?.staffId || user?.username; // Fallback to staff ID
  };

  return (
    <div className="relative flex items-center justify-between w-full">
      {/* Left: Mobile Toggle & Welcome Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => toggleSidebar()}
          aria-label="Toggle sidebar"
          className="md:hidden p-2 -ml-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-auto text-primary-foreground mx-auto" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
              {getWelcomeMessage()}, {getFirstName()}
            </h1>
            <p className="text-xs text-muted-foreground capitalize truncate font-medium">
              {user?.role?.replace('-', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Academic Term, Date & Time Section + AI button */}
      {/* Hidden on small screens; replaced by compact toggle below */}
      <div className="hidden lg:flex items-center space-x-6">
        <div className="flex items-center space-x-4 text-sm min-w-0 pr-2">
          {/* Current Academic Term */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/50 border border-border rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="text-foreground font-medium truncate max-w-[140px]" title={currentTerm}>{currentTerm}</span>
          </div>

          {/* Current Date */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/50 rounded-lg">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium truncate max-w-[220px]" title={formatDate(currentTime)}>{formatDate(currentTime)}</span>
          </div>

          {/* Current Time */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/50 rounded-lg">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-foreground font-medium truncate max-w-[120px]" title={formatTime(currentTime)}>{formatTime(currentTime)}</span>
          </div>
        </div>

        <ModeToggle />

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
      <div className="lg:hidden flex items-center space-x-2">
        <ModeToggle />
        <button
          ref={smallMenuButtonRef}
          onClick={() => setShowSmallMenu((s) => !s)}
          aria-expanded={showSmallMenu}
          aria-controls="mobile-header-panel"
          className="p-2 rounded-md hover:bg-secondary flex-shrink-0"
          title="Show header details"
        >
          <span className="sr-only">Show header details</span>
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v.01M12 12v.01M12 18v.01"></path></svg>
        </button>

        {showSmallMenu && (
          <div
            id="mobile-header-panel"
            ref={smallMenuRef}
            className="absolute right-3 top-14 z-50 w-72 bg-popover border border-border rounded-lg shadow-lg p-3"
          >
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2 px-2 py-1 bg-secondary/50 rounded">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-foreground font-medium">{currentTerm || '—'}</span>
              </div>

              <div className="flex items-center space-x-2 px-2 py-1 bg-secondary/50 rounded">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{formatDate(currentTime)}</span>
              </div>

              <div className="flex items-center space-x-2 px-2 py-1 bg-secondary/50 rounded">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-foreground">{formatTime(currentTime)}</span>
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
