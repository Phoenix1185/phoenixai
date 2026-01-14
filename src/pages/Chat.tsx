import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/sidebar/AppSidebar';
import ChatInterface from '@/components/chat/ChatInterface';
import AuthModal from '@/components/auth/AuthModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import PhoenixLogo from '@/components/PhoenixLogo';

const Chat: React.FC = () => {
  const { conversationId } = useParams();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleConversationCreated = (id: string) => {
    navigate(`/chat/${id}`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full phoenix-rise-transition">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <PhoenixLogo size="sm" className="md:hidden" />
            </div>
            
            <div className="flex items-center gap-2">
              {!loading && !user && (
                <Button
                  onClick={() => setAuthModalOpen(true)}
                  className="gradient-phoenix text-primary-foreground"
                >
                  Sign In
                </Button>
              )}
              {user && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Chat Interface */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface 
              conversationId={conversationId} 
              onConversationCreated={handleConversationCreated} 
            />
          </div>
        </main>

        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </div>
    </SidebarProvider>
  );
};

export default Chat;
