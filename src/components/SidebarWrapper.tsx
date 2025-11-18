
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
          <header className="sticky top-0 z-40 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
            <div className="flex items-center justify-between h-full px-6">
              {/* Left side: header content (sidebar rail toggle is on the sidebar itself) */}
              <div className="flex items-center gap-4">
                <MainHeader onAiAssistantClick={handleAiAssistantClick} />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="min-h-[calc(100vh-4rem)] bg-gray-50">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
