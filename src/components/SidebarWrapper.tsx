import React, { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { AppSidebar } from './Sidebar';
import MainHeader from './layout/MainHeader';
import { MobileChatShellProvider } from '@/contexts/MobileChatShellContext';
import BecomeUserPanel from './impersonation/BecomeUserPanel';

interface SidebarWrapperProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  children: React.ReactNode;
}

const SidebarWrapper: React.FC<SidebarWrapperProps> = ({
  activeModule,
  setActiveModule,
  children,
}) => {
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [becomeUserOpen, setBecomeUserOpen] = useState(false);
  const handleAiAssistantClick = () => {
    setActiveModule('ai-assistant');
  };

  useEffect(() => {
    if (activeModule !== 'messages') setMobileChatOpen(false);
  }, [activeModule]);

  return (
    <SidebarProvider>
      <MobileChatShellProvider setMobileChatOpen={setMobileChatOpen}>
      <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(20,108,67,0.10),transparent_28%)] dark:bg-slate-950/80 dark:bg-none">
        <AppSidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          onOpenBecomeUser={() => setBecomeUserOpen(true)}
        />

        <SidebarInset className="flex-1 flex flex-col min-h-0 h-full bg-transparent">
          <header
            className={cn(
              'sticky top-0 z-40 m-3 mb-0 h-16 shrink-0 rounded-2xl border border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all duration-300 pt-[env(safe-area-inset-top)] print:hidden dark:m-0 dark:h-14 dark:rounded-none dark:border-slate-800/80 dark:bg-slate-900/95 dark:shadow-sm dark:backdrop-blur-sm sm:h-16',
              mobileChatOpen && 'max-lg:hidden'
            )}
          >
            <div className="flex h-full min-h-[3.25rem] sm:min-h-0 items-center gap-2 sm:gap-4 px-3 sm:px-4 md:px-8">
              <SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition-all hover:scale-105 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 touch-manipulation dark:h-9 dark:w-9 dark:rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" />
              <div className="hidden h-6 w-px bg-slate-200/80 dark:bg-slate-800 sm:block" />
              <MainHeader
                activeModule={activeModule}
                setActiveModule={setActiveModule}
                onAiAssistantClick={handleAiAssistantClick}
              />
            </div>
          </header>

          <main
            className={
              activeModule === 'messages'
                ? 'flex flex-1 flex-col min-h-0 overflow-hidden min-w-0 overscroll-none pb-0'
                : 'flex-1 overflow-x-hidden overflow-y-auto min-w-0 overscroll-y-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]'
            }
          >
            {children}
          </main>
        </SidebarInset>
      </div>
      </MobileChatShellProvider>
      <BecomeUserPanel open={becomeUserOpen} onClose={() => setBecomeUserOpen(false)} />
    </SidebarProvider>
  );
};

export default SidebarWrapper;
