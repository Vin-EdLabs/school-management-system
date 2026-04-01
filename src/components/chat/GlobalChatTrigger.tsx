import React from 'react';
import { Send, Globe } from 'lucide-react';

interface GlobalChatTriggerProps {
  onClick: () => void;
  isOpen: boolean;
  showOnboarding: boolean;
  onNextOnboarding: () => void;
}

const GlobalChatTrigger: React.FC<GlobalChatTriggerProps> = ({ 
  onClick, 
  isOpen, 
  showOnboarding, 
  onNextOnboarding 
}) => {
  if (isOpen) return null;

  return (
    <div className="fixed right-6 bottom-6 z-50 flex items-center">
      {/* Onboarding Step 1 */}
      {showOnboarding && (
        <div className="absolute bottom-20 right-0 bg-white text-slate-800 p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-100 w-64 animate-fade-in-scale">
          <div className="flex items-start gap-3 mb-3">
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-blue-600" />
             </div>
             <div>
                <p className="text-sm font-bold">Global Hub</p>
                <p className="text-xs text-slate-500 leading-relaxed">Connect and collaborate with staff from all institutions instantly.</p>
             </div>
          </div>
          <div className="flex items-center justify-between mt-4">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 1 of 3</span>
             <button 
                onClick={onNextOnboarding}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
             >
                Next
             </button>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute right-6 bottom-[-6px] w-3 h-3 bg-white border-b border-r border-slate-100 rotate-45" />
        </div>
      )}

      <button
        onClick={onClick}
        className="w-16 h-16 bg-[#0088cc] text-white rounded-full shadow-[0_10px_30px_rgba(0,136,204,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center relative group"
        title="Open Inter-School Chat"
      >
        <Send className="w-7 h-7 -rotate-45 -translate-y-0.5 translate-x-0.5" />
        <span className="absolute -top-1 -right-1 block w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse" />
      </button>
    </div>
  );
};

export default GlobalChatTrigger;
