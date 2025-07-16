
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Bot, Calendar, Clock } from 'lucide-react';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick }) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
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
    <header className="fixed top-0 right-0 left-0 z-50 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between h-full px-6">
        {/* Welcome Section */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {getWelcomeMessage()}, {user?.username || 'User'}!
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              {user?.role?.replace('-', ' ')} Dashboard
            </p>
          </div>
        </div>

        {/* Date & Time Section */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{formatDate(currentTime)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-foreground">{formatTime(currentTime)}</span>
            </div>
          </div>

          {/* AI Assistant Button */}
          {user?.role === 'finance' || user?.role === 'super-admin' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAiAssistantClick}
              className="flex items-center space-x-2"
            >
              <Bot className="w-4 h-4" />
              <span>AI Assistant</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                NEW
              </Badge>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
