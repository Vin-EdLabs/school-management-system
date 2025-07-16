
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
          <MainHeader onAiAssistantClick={handleAiAssistantClick} />
          
          {/* Sidebar trigger bar - now below the main header */}
          <div className="flex h-14 items-center gap-2 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-16">
            <SidebarTrigger className="h-8 w-8" />
            <div className="flex-1" />
          </div>
          
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
