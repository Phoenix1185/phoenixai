import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import PhoenixLogo from '@/components/PhoenixLogo';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({ description: 'Welcome back!' });
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        toast({ description: 'Account created successfully!' });
      }
      onOpenChange(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        description: error.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-card">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <PhoenixLogo size="lg" showText={false} />
          </div>
          <DialogTitle className="text-2xl font-['Poppins']">
            {mode === 'signin' ? 'Welcome Back' : 'Join Phoenix AI'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="bg-background"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="bg-background"
            />
          </div>

          <Button
            type="submit"
            className="w-full gradient-phoenix text-primary-foreground"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === 'signin' ? (
              <>Don't have an account? <span className="text-primary">Sign up</span></>
            ) : (
              <>Already have an account? <span className="text-primary">Sign in</span></>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
