import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './Sidebar';
import MainHeader from './layout/MainHeader';

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
  const handleAiAssistantClick = () => {
    setActiveModule('ai-assistant');
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-slate-50/80 dark:bg-slate-950/80 overflow-hidden">
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />

        <SidebarInset className="flex-1 flex flex-col min-h-screen bg-transparent">
          <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm transition-all duration-300">
            <div className="flex h-full items-center gap-4 px-4 md:px-8">
              <SidebarTrigger className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:scale-105 active:scale-95 shadow-sm" />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <MainHeader onAiAssistantClick={handleAiAssistantClick} />
            </div>
          </header>

          <main className="flex-1 overflow-auto min-w-0">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
