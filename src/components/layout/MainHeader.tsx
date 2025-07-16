
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Bot, Calendar, Clock, User, GraduationCap } from 'lucide-react';
import { getActiveAcademicTerm } from '../../utils/feeCalculations';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick }) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTerm, setCurrentTerm] = useState('');

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
    <div className="flex items-center justify-between w-full">
      {/* Welcome Section */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {getWelcomeMessage()}, {user?.username}!
          </h1>
          <p className="text-sm text-gray-600 capitalize">
            {user?.role?.replace('-', ' ')} Dashboard
          </p>
        </div>
      </div>

      {/* Academic Term, Date & Time Section */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-4 text-sm">
          {/* Current Academic Term */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
            <GraduationCap className="w-4 h-4 text-purple-600" />
            <span className="text-purple-700 font-medium">{currentTerm}</span>
          </div>
          
          {/* Current Date */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700 font-medium">{formatDate(currentTime)}</span>
          </div>
          
          {/* Current Time */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-gray-700 font-medium">{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* AI Assistant Button */}
        {(user?.role === 'finance' || user?.role === 'super-admin') && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAiAssistantClick}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all"
          >
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="text-blue-700 font-medium">AI Assistant</span>
            <Badge variant="secondary" className="ml-1 text-xs bg-blue-100 text-blue-700">
              NEW
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
};

export default MainHeader;
