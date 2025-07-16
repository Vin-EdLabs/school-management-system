
import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './Sidebar';

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
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />
        <SidebarInset className="flex-1">
          <header className="flex h-14 items-center gap-2 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="h-8 w-8" />
            <div className="flex-1" />
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
