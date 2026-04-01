import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppSidebar } from '../Sidebar';
import MainHeader from './MainHeader';

const DashboardLayout: React.FC = () => {
    const navigate = useNavigate();

    const handleAiAssistantClick = () => {
        navigate('/ai-assistant');
    };

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background transition-colors duration-200">
                <AppSidebar />

                <SidebarInset className="flex-1 w-full flex flex-col min-w-0 bg-background">
                    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6 transition-colors duration-200">
                        <MainHeader onAiAssistantClick={handleAiAssistantClick} />
                    </header>

                    <main className="flex-1 p-4 sm:p-6 lg:p-8">
                        <div className="mx-auto max-w-7xl w-full">
                            <Outlet />
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};

export default DashboardLayout;
