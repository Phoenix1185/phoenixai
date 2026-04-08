import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, Plus, Copy, Trash2, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_minute: number;
  total_requests: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'phx_';
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const ApiKeysManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setKeys(data as unknown as ApiKey[]);
    }
    setLoading(false);
  };

  const createKey = async () => {
    if (!user || !newKeyName.trim()) return;
    setCreating(true);

    try {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 12);

      const { error } = await supabase.from('api_keys').insert({
        user_id: user.id,
        name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: ['chat'],
        rate_limit_per_minute: 60,
      } as any);

      if (error) throw error;

      setShowNewKey(rawKey);
      setNewKeyName('');
      setShowCreateForm(false);
      fetchKeys();
      toast({ description: 'API key created! Copy it now — it won\'t be shown again.' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message || 'Failed to create key' });
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (!error) {
      setKeys(keys.filter(k => k.id !== id));
      toast({ description: 'API key deleted' });
    }
  };

  const toggleKey = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !active } as any)
      .eq('id', id);
    if (!error) {
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: !active } : k));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Copied to clipboard' });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> API Keys
            </CardTitle>
            <CardDescription>Manage your API keys for programmatic access to Phoenix AI</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/docs/api')}>
            <ExternalLink className="h-4 w-4 mr-1" /> API Docs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New key reveal */}
        {showNewKey && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
            <p className="text-sm font-medium text-primary">🔑 Your new API key (copy it now!):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background p-2 rounded font-mono break-all">{showNewKey}</code>
              <Button size="icon" variant="ghost" onClick={() => copyToClipboard(showNewKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">This key will not be shown again. Store it securely.</p>
            <Button size="sm" variant="outline" onClick={() => setShowNewKey(null)}>Done</Button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm ? (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>Key Name</Label>
              <Input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g. My App, Production"
                className="bg-background"
              />
            </div>
            <Button onClick={createKey} disabled={creating || !newKeyName.trim()} className="gradient-phoenix text-primary-foreground">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button onClick={() => setShowCreateForm(true)} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Create New API Key
          </Button>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(key => (
              <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{key.name}</span>
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <code>{key.key_prefix}...{'*'.repeat(8)}</code>
                    <span>{key.total_requests.toLocaleString()} requests</span>
                    {key.last_used_at && (
                      <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggleKey(key.id, key.is_active)} title={key.is_active ? "Disable" : "Enable"}>
                    {key.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteKey(key.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApiKeysManager;
