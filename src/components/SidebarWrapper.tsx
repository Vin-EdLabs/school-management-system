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
          <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 shadow-sm transition-all duration-300">
            <div className="flex h-full items-center gap-4 px-4 md:px-8">
              <SidebarTrigger className="h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all hover:scale-105 active:scale-95 shadow-sm" />
              <div className="h-6 w-px bg-gray-200" />
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
