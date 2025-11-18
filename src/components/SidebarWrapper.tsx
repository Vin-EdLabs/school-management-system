
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';
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
  children
}) => {
  const handleAiAssistantClick = () => {
    setActiveModule('ai-assistant');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />

        <SidebarInset className="flex-1">
          {/* Fixed Header with Sidebar Trigger */}
          <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm transition-[left] duration-150 md:peer-data-[state=expanded]:left-[var(--sidebar-width)] md:peer-data-[state=collapsed]:left-[var(--sidebar-width-icon)]">
            <div className="flex items-center justify-between h-full px-0 transition-transform duration-150 md:peer-data-[state=expanded]:translate-x-[calc(var(--sidebar-width)-var(--sidebar-width-icon))] md:peer-data-[state=collapsed]:translate-x-0">
              {/* Left side: header content (sidebar rail toggle is on the sidebar itself) */}
              <div className="flex items-center gap-4 w-full">
                <MainHeader onAiAssistantClick={handleAiAssistantClick} />
              </div>
            </div>
          </header>

          {/* Main content: add top padding for fixed header and left margin to avoid sidebar overlap */}
          <main className="min-h-[calc(100vh-4rem)] bg-gray-50 pt-16 transition-[margin] duration-150 md:peer-data-[state=expanded]:ml-[var(--sidebar-width)] md:peer-data-[state=collapsed]:ml-[var(--sidebar-width-icon)]">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
