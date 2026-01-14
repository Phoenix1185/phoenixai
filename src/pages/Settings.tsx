import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/sidebar/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PhoenixLogo from '@/components/PhoenixLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { User, Brain, Palette, LogOut, Save, Loader2, ArrowLeft } from 'lucide-react';

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Preferences {
  preferred_style: 'formal' | 'casual' | 'witty';
  response_length: 'concise' | 'balanced' | 'detailed';
  expertise_level: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
}

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile>({ display_name: '', avatar_url: '' });
  const [preferences, setPreferences] = useState<Preferences>({
    preferred_style: 'casual',
    response_length: 'balanced',
    expertise_level: 'intermediate',
    interests: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;

    const [profileResult, prefsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileResult.data) {
      setProfile({
        display_name: profileResult.data.display_name,
        avatar_url: profileResult.data.avatar_url,
      });
    }

    if (prefsResult.data) {
      setPreferences({
        preferred_style: prefsResult.data.preferred_style || 'casual',
        response_length: prefsResult.data.response_length || 'balanced',
        expertise_level: prefsResult.data.expertise_level || 'intermediate',
        interests: prefsResult.data.interests || [],
      });
    }

    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ variant: 'destructive', description: 'Failed to save profile' });
    } else {
      toast({ description: 'Profile saved successfully' });
    }
    setSaving(false);
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('user_preferences')
      .update({
        preferred_style: preferences.preferred_style,
        response_length: preferences.response_length,
        expertise_level: preferences.expertise_level,
        interests: preferences.interests,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ variant: 'destructive', description: 'Failed to save preferences' });
    } else {
      toast({ description: 'Preferences saved successfully' });
    }
    setSaving(false);
  };

  const addInterest = () => {
    if (newInterest.trim() && !preferences.interests.includes(newInterest.trim())) {
      setPreferences({
        ...preferences,
        interests: [...preferences.interests, newInterest.trim()],
      });
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setPreferences({
      ...preferences,
      interests: preferences.interests.filter(i => i !== interest),
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full phoenix-rise-transition">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center px-4 gap-4">
            <SidebarTrigger className="md:hidden" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold font-['Poppins']">Settings</h1>
          </header>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
            <div className="max-w-2xl mx-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Tabs defaultValue="profile" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4 glass-card">
                    <TabsTrigger value="profile" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2">
                      <Brain className="h-4 w-4" />
                      <span className="hidden sm:inline">AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="theme" className="gap-2">
                      <Palette className="h-4 w-4" />
                      <span className="hidden sm:inline">Theme</span>
                    </TabsTrigger>
                    <TabsTrigger value="account" className="gap-2">
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Account</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="profile">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>
                          Manage your personal information
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Display Name</Label>
                          <Input
                            id="displayName"
                            value={profile.display_name || ''}
                            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                            placeholder="Your name"
                            className="bg-background"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            value={user.email || ''}
                            disabled
                            className="bg-muted"
                          />
                        </div>

                        <Button
                          onClick={saveProfile}
                          disabled={saving}
                          className="gradient-phoenix text-primary-foreground"
                        >
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="mr-2 h-4 w-4" />
                          Save Profile
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* AI Preferences Tab */}
                  <TabsContent value="ai">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>AI Preferences</CardTitle>
                        <CardDescription>
                          Customize how Phoenix AI responds to you
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>Communication Style</Label>
                          <Select
                            value={preferences.preferred_style}
                            onValueChange={(value: 'formal' | 'casual' | 'witty') => 
                              setPreferences({ ...preferences, preferred_style: value })
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="formal">Formal & Professional</SelectItem>
                              <SelectItem value="casual">Casual & Friendly</SelectItem>
                              <SelectItem value="witty">Witty & Playful</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Response Length</Label>
                          <Select
                            value={preferences.response_length}
                            onValueChange={(value: 'concise' | 'balanced' | 'detailed') => 
                              setPreferences({ ...preferences, response_length: value })
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="concise">Concise & Brief</SelectItem>
                              <SelectItem value="balanced">Balanced</SelectItem>
                              <SelectItem value="detailed">Detailed & Thorough</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Expertise Level</Label>
                          <Select
                            value={preferences.expertise_level}
                            onValueChange={(value: 'beginner' | 'intermediate' | 'expert') => 
                              setPreferences({ ...preferences, expertise_level: value })
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="expert">Expert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Interests (helps Phoenix give relevant suggestions)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newInterest}
                              onChange={(e) => setNewInterest(e.target.value)}
                              placeholder="Add an interest..."
                              className="bg-background"
                              onKeyDown={(e) => e.key === 'Enter' && addInterest()}
                            />
                            <Button onClick={addInterest} variant="secondary">Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {preferences.interests.map((interest) => (
                              <span
                                key={interest}
                                className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm flex items-center gap-2"
                              >
                                {interest}
                                <button
                                  onClick={() => removeInterest(interest)}
                                  className="hover:text-destructive"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          onClick={savePreferences}
                          disabled={saving}
                          className="gradient-phoenix text-primary-foreground"
                        >
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="mr-2 h-4 w-4" />
                          Save Preferences
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Theme Tab */}
                  <TabsContent value="theme">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Theme</CardTitle>
                        <CardDescription>
                          Choose your preferred appearance with Phoenix Rise animation
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">Dark / Light Mode</p>
                            <p className="text-sm text-muted-foreground">
                              Toggle with Phoenix Rise effect
                            </p>
                          </div>
                          <ThemeToggle />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Account Tab */}
                  <TabsContent value="account">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Account</CardTitle>
                        <CardDescription>
                          Manage your account settings
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-2">Signed in as</p>
                          <p className="font-medium">{user.email}</p>
                        </div>

                        <Button
                          variant="destructive"
                          onClick={handleSignOut}
                          className="w-full"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign Out
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
