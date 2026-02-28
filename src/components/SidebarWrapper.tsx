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
    <SidebarProvider
      style={
        {
          '--sidebar-background': '222 47% 11%',
          '--sidebar-foreground': '210 40% 80%',
          '--sidebar-accent': '222 47% 18%',
          '--sidebar-accent-foreground': '0 0% 100%',
          '--sidebar-border': '222 47% 18%',
        } as React.CSSProperties
      }
    >
      <div className="flex min-h-screen w-full bg-slate-50/80">
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />

        <SidebarInset className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex h-full items-center gap-4 px-4 md:px-6">
              <SidebarTrigger className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600" />
              <div className="h-5 w-px bg-slate-200" />
              <MainHeader onAiAssistantClick={handleAiAssistantClick} />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
