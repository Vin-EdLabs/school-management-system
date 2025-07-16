
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
        
        {/* Main Header - Fixed */}
        <MainHeader onAiAssistantClick={handleAiAssistantClick} />
        
        <SidebarInset className="flex-1">          
          {/* Main content with top margin to account for fixed header */}
          <main className="pt-16 min-h-screen bg-gray-50">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default SidebarWrapper;
