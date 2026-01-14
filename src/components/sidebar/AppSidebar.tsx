import React from 'react';
import { PlusCircle, Settings, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import PhoenixLogo from '@/components/PhoenixLogo';
import ChatHistory from './ChatHistory';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewChat = () => {
    navigate('/');
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <PhoenixLogo size="sm" />
          <SidebarTrigger className="text-sidebar-foreground hover:text-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent className="p-2">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start gap-3 gradient-phoenix text-primary-foreground hover:opacity-90"
            >
              <PlusCircle className="h-5 w-5" />
              New Chat
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <ChatHistory />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                'w-full cursor-pointer',
                location.pathname === '/settings' && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <button onClick={() => navigate('/settings')} className="flex items-center gap-3">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
