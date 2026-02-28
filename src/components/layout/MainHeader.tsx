import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { Bot, User } from 'lucide-react';

interface MainHeaderProps {
  onAiAssistantClick?: () => void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ onAiAssistantClick }) => {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex items-center justify-between w-full gap-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-slate-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-800 truncate">
            {getGreeting()}, <span className="text-slate-600 font-medium">{user?.username}</span>
          </h1>
          <p className="text-sm text-slate-500 capitalize truncate">
            {user?.role?.replace('-', ' ')}
          </p>
        </div>
      </div>

      {(user?.role === 'finance' || user?.role === 'super-admin') && onAiAssistantClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAiAssistantClick}
          className="shrink-0 border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        >
          <Bot className="w-4 h-4 mr-2" />
          AI Assistant
        </Button>
      )}
    </div>
  );
};

export default MainHeader;
