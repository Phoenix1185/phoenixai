import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/sidebar/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { User, Brain, Palette, LogOut, Save, Loader2, ArrowLeft, Camera, Lock, Shield, Bell, Volume2 } from 'lucide-react';

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Preferences {
  preferred_style: 'formal' | 'casual' | 'witty';
  response_length: 'concise' | 'balanced' | 'detailed';
  expertise_level: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
  language: string;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<Profile>({ display_name: '', avatar_url: '' });
  const [preferences, setPreferences] = useState<Preferences>({
    preferred_style: 'casual',
    response_length: 'balanced',
    expertise_level: 'intermediate',
    interests: [],
    language: 'en',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newInterest, setNewInterest] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false);

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
        language: (prefsResult.data as { language?: string }).language || 'en',
      });
    }

    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', description: 'Please upload an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Image must be less than 2MB' });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      toast({ description: 'Avatar updated successfully' });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({ variant: 'destructive', description: 'Failed to upload avatar' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: profile.display_name })
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
        language: preferences.language,
      } as Record<string, unknown>)
      .eq('user_id', user.id);

    if (error) {
      toast({ variant: 'destructive', description: 'Failed to save preferences' });
    } else {
      toast({ description: 'Preferences saved successfully' });
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', description: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', description: 'Password must be at least 6 characters' });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ description: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
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

  const getInitials = () => {
    if (profile.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    return user.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full phoenix-rise-transition">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4">
            <SidebarTrigger className="md:hidden" />
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold font-['Poppins']">Settings</h1>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
            <div className="max-w-2xl mx-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Tabs defaultValue="profile" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-5 glass-card">
                    <TabsTrigger value="profile" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2">
                      <Brain className="h-4 w-4" />
                      <span className="hidden sm:inline">AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="voice" className="gap-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Voice</span>
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="hidden sm:inline">Security</span>
                    </TabsTrigger>
                    <TabsTrigger value="theme" className="gap-2">
                      <Palette className="h-4 w-4" />
                      <span className="hidden sm:inline">Theme</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="profile">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>Manage your personal information</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center gap-6">
                          <div className="relative">
                            <Avatar className="h-20 w-20">
                              <AvatarImage src={profile.avatar_url || undefined} />
                              <AvatarFallback className="gradient-phoenix text-primary-foreground text-xl">
                                {getInitials()}
                              </AvatarFallback>
                            </Avatar>
                            <Button
                              size="icon"
                              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingAvatar}
                            >
                              {uploadingAvatar ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Camera className="h-4 w-4" />
                              )}
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarUpload}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{profile.display_name || 'Set your name'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>

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

                        <Button onClick={saveProfile} disabled={saving} className="gradient-phoenix text-primary-foreground">
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
                        <CardDescription>Customize how Phoenix AI responds to you</CardDescription>
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
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
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
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
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
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="expert">Expert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Response Language</Label>
                          <Select
                            value={preferences.language}
                            onValueChange={(value: string) => 
                              setPreferences({ ...preferences, language: value })
                            }
                          >
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LANGUAGES.map(lang => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.flag} {lang.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>


                          <Label>Interests</Label>
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
                              <span key={interest} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm flex items-center gap-2">
                                {interest}
                                <button onClick={() => removeInterest(interest)} className="hover:text-destructive">×</button>
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button onClick={savePreferences} disabled={saving} className="gradient-phoenix text-primary-foreground">
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="mr-2 h-4 w-4" />
                          Save Preferences
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Voice Tab */}
                  <TabsContent value="voice">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Voice Settings</CardTitle>
                        <CardDescription>Configure voice input and output</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">Voice Input</p>
                            <p className="text-sm text-muted-foreground">Use microphone for hands-free input</p>
                          </div>
                          <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">Auto-Read Responses</p>
                            <p className="text-sm text-muted-foreground">Automatically read Phoenix's responses aloud</p>
                          </div>
                          <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Security Tab */}
                  <TabsContent value="security">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>Manage your account security</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="font-medium flex items-center gap-2">
                            <Lock className="h-4 w-4" /> Change Password
                          </h3>
                          <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                              className="bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Confirm Password</Label>
                            <Input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className="bg-background"
                            />
                          </div>
                          <Button onClick={changePassword} disabled={changingPassword || !newPassword}>
                            {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                          </Button>
                        </div>

                        <div className="border-t pt-6">
                          <div className="p-4 rounded-lg bg-muted/50 mb-4">
                            <p className="text-sm text-muted-foreground mb-2">Signed in as</p>
                            <p className="font-medium">{user.email}</p>
                          </div>
                          <Button variant="destructive" onClick={handleSignOut} className="w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Theme Tab */}
                  <TabsContent value="theme">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Theme</CardTitle>
                        <CardDescription>Choose your preferred appearance</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">Dark / Light Mode</p>
                            <p className="text-sm text-muted-foreground">Toggle with Phoenix Rise effect</p>
                          </div>
                          <ThemeToggle />
                        </div>
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
