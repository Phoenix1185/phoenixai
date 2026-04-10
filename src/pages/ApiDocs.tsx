import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Copy, Zap, BookOpen, Code, Terminal, Play, Loader2, CheckCircle, AlertTriangle, Heart } from 'lucide-react';
import PhoenixLogo from '@/components/PhoenixLogo';
import { useToast } from '@/hooks/use-toast';

const API_BASE = 'https://ixohndnnrivfmaxecpkt.supabase.co/functions/v1/phoenix-api';

const ApiPlayground: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('Hello Phoenix!');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [endpoint, setEndpoint] = useState('/v1/chat');
  const [imagePrompt, setImagePrompt] = useState('A beautiful sunset over mountains');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const { toast } = useToast();

  const tryIt = async () => {
    if (!apiKey.startsWith('phx_')) {
      toast({ variant: 'destructive', description: 'Enter a valid API key starting with phx_' });
      return;
    }
    setLoading(true);
    setResponse('');
    setStatusCode(null);

    try {
      const isPost = endpoint === '/v1/chat' || endpoint === '/v1/images';
      let reqBody: any = undefined;
      if (endpoint === '/v1/chat') reqBody = { message, model };
      else if (endpoint === '/v1/images') reqBody = { prompt: imagePrompt };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: isPost ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        ...(isPost ? { body: JSON.stringify(reqBody) } : {}),
      });
      setStatusCode(res.status);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResponse(`Network Error: ${err.message}\n\nThis usually means the API server is unreachable. Check your internet connection.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" /> API Playground
        </CardTitle>
        <CardDescription>Test the API directly from your browser</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="phx_your_api_key" className="font-mono text-sm bg-background" type="password" />
          </div>
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Select value={endpoint} onValueChange={setEndpoint}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="/v1/chat">POST /v1/chat</SelectItem>
                <SelectItem value="/v1/images">POST /v1/images</SelectItem>
                <SelectItem value="/v1/models">GET /v1/models</SelectItem>
                <SelectItem value="/v1/usage">GET /v1/usage</SelectItem>
                <SelectItem value="/v1/health">GET /v1/health</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {endpoint === '/v1/chat' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} className="bg-background" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                  <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  <SelectItem value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro</SelectItem>
                  <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                  <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                  <SelectItem value="openai/gpt-5.2">GPT-5.2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {endpoint === '/v1/images' && (
          <div className="space-y-2">
            <Label>Image Prompt</Label>
            <Textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} className="bg-background" rows={2} placeholder="Describe the image you want to generate..." />
          </div>
        )}

        <Button onClick={tryIt} disabled={loading || !apiKey} className="gradient-phoenix text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {loading ? 'Sending...' : 'Send Request'}
        </Button>

        {response && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Response</Label>
              {statusCode && (
                <Badge variant={statusCode < 300 ? "default" : "destructive"} className="text-xs">
                  {statusCode < 300 ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {statusCode}
                </Badge>
              )}
            </div>
            <pre className="bg-muted/80 rounded-lg p-4 overflow-x-auto text-sm font-mono max-h-[400px] overflow-y-auto whitespace-pre-wrap">{response}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ApiDocs: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Copied!' });
  };

  const CodeBlock = ({ code, language = 'bash' }: { code: string; language?: string }) => (
    <div className="relative group">
      <pre className="bg-muted/80 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
        onClick={() => copy(code)}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center gap-4 h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PhoenixLogo size="sm" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold font-['Poppins']">API Documentation</h1>
          </div>
          <Badge variant="outline" className="font-mono">v1.0</Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Intro */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold font-['Poppins']">
            Phoenix AI <span className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">API</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Integrate Phoenix AI into your apps. Send messages, choose models, and build AI-powered experiences.
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge className="gap-1"><Zap className="h-3 w-3" /> REST API</Badge>
            <Badge className="gap-1"><BookOpen className="h-3 w-3" /> JSON Responses</Badge>
            <Badge className="gap-1"><Code className="h-3 w-3" /> 6 AI Models</Badge>
          </div>
        </div>

        {/* Base URL */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={API_BASE} />
            <p className="text-xs text-muted-foreground mt-2">All endpoints are relative to this base URL.</p>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" /> Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">1</Badge>
                <p className="text-sm text-muted-foreground">Go to <strong>Settings → API Keys</strong> and create a new API key</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">2</Badge>
                <p className="text-sm text-muted-foreground">Copy the key (starts with <code className="bg-muted px-1 rounded">phx_</code>) — it's shown only once</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">3</Badge>
                <p className="text-sm text-muted-foreground">Make your first request:</p>
              </div>
            </div>
            <CodeBlock code={`curl -X POST ${API_BASE}/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: phx_your_api_key_here" \\
  -d '{"message": "Hello Phoenix!"}'`} />
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              All requests require an API key. Send it in one of these headers:
            </p>
            <CodeBlock code={`# Option 1: x-api-key header (recommended)
x-api-key: phx_your_api_key_here

# Option 2: Authorization header
Authorization: Bearer phx_your_api_key_here`} />
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
              <p className="font-medium text-primary mb-1">⚡ Important</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Keys always start with <code className="bg-muted px-1 rounded">phx_</code></li>
                <li>Keys are shown <strong>only once</strong> when created — store them securely</li>
                <li>You can deactivate or delete keys anytime in Settings</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Endpoints</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="chat" className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="health">Health</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary">POST</Badge>
                  <code className="text-sm font-mono">/v1/chat</code>
                </div>
                <p className="text-sm text-muted-foreground">Send a message and get an AI response.</p>
                
                <h4 className="font-medium text-sm mt-4">Request Body</h4>
                <div className="bg-muted/50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left p-3">Field</th><th className="text-left p-3">Type</th><th className="text-left p-3">Required</th><th className="text-left p-3">Description</th></tr></thead>
                    <tbody>
                      <tr className="border-b"><td className="p-3 font-mono text-xs">message</td><td className="p-3">string</td><td className="p-3">✅</td><td className="p-3">Your message (max 32,000 chars)</td></tr>
                      <tr className="border-b"><td className="p-3 font-mono text-xs">model</td><td className="p-3">string</td><td className="p-3">❌</td><td className="p-3">AI model (default: google/gemini-2.5-flash)</td></tr>
                      <tr><td className="p-3 font-mono text-xs">system_prompt</td><td className="p-3">string</td><td className="p-3">❌</td><td className="p-3">Custom system prompt to guide AI behavior</td></tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="font-medium text-sm mt-4">Example</h4>
                <CodeBlock code={`// Request
POST /v1/chat
{
  "message": "Explain quantum computing simply",
  "model": "google/gemini-2.5-flash"
}

// Response (200 OK)
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "model": "google/gemini-2.5-flash",
  "message": "Quantum computing uses quantum bits...",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 200,
    "total_tokens": 215
  },
  "created_at": "2026-04-10T12:00:00.000Z"
}`} language="json" />
              </TabsContent>

              <TabsContent value="models" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">GET</Badge>
                  <code className="text-sm font-mono">/v1/models</code>
                </div>
                <p className="text-sm text-muted-foreground">List all available AI models.</p>
                <CodeBlock code={`// Response (200 OK)
{
  "models": [
    { "id": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash", "description": "Fast & balanced", "default": true },
    { "id": "google/gemini-2.5-pro", "name": "Gemini 2.5 Pro", "description": "Best for complex reasoning" },
    { "id": "google/gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite", "description": "Fastest, cheapest" },
    { "id": "openai/gpt-5-mini", "name": "GPT-5 Mini", "description": "Strong reasoning, lower cost" },
    { "id": "openai/gpt-5", "name": "GPT-5", "description": "Most capable, higher cost" },
    { "id": "openai/gpt-5-nano", "name": "GPT-5 Nano", "description": "Ultra-fast, cost-effective" }
  ]
}`} language="json" />
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">GET</Badge>
                  <code className="text-sm font-mono">/v1/usage</code>
                </div>
                <p className="text-sm text-muted-foreground">View your API usage statistics and recent request logs.</p>
                <CodeBlock code={`// Response (200 OK)
{
  "key_name": "My App",
  "total_requests": 142,
  "total_tokens_used": 28500,
  "rate_limit_per_minute": 60,
  "last_used": "2026-04-10T11:30:00.000Z",
  "recent_logs": [
    {
      "endpoint": "/v1/chat",
      "status_code": 200,
      "tokens_used": 215,
      "response_time_ms": 1200,
      "created_at": "2026-04-10T11:30:00.000Z"
    }
  ]
}`} language="json" />
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">GET</Badge>
                  <code className="text-sm font-mono">/v1/health</code>
                </div>
                <p className="text-sm text-muted-foreground">Check if the API is up and running.</p>
                <CodeBlock code={`// Response (200 OK)
{
  "status": "ok",
  "timestamp": "2026-04-10T12:00:00.000Z",
  "version": "1.0.0"
}`} language="json" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Rate Limits & Errors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle>Rate Limits</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Default: <strong>60 requests/minute</strong> per API key.</p>
              <p className="text-sm text-muted-foreground">When exceeded, you'll receive:</p>
              <CodeBlock code={`{
  "error": "Rate limit exceeded",
  "limit": 60,
  "retry_after_seconds": 60
}`} language="json" />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>400</code><span className="text-muted-foreground">Bad request / invalid params</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>401</code><span className="text-muted-foreground">Invalid or missing API key</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>403</code><span className="text-muted-foreground">Key lacks permission</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>404</code><span className="text-muted-foreground">Unknown endpoint</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>405</code><span className="text-muted-foreground">Wrong HTTP method</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>429</code><span className="text-muted-foreground">Rate limit exceeded</span></div>
                <div className="flex justify-between p-2 rounded bg-muted/50"><code>500</code><span className="text-muted-foreground">Internal server error</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Code Examples */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Code Examples</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="python" className="space-y-4">
              <TabsList>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="node">Node.js</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
              </TabsList>

              <TabsContent value="python">
                <CodeBlock code={`import requests

API_KEY = "phx_your_api_key"
BASE = "${API_BASE}"

# Send a chat message
resp = requests.post(
    f"{BASE}/v1/chat",
    headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
    json={
        "message": "What is machine learning?",
        "model": "google/gemini-2.5-flash"
    }
)

data = resp.json()
if resp.ok:
    print(data["message"])
    print(f"Tokens used: {data['usage']['total_tokens']}")
else:
    print(f"Error {resp.status_code}: {data['error']}")`} language="python" />
              </TabsContent>

              <TabsContent value="node">
                <CodeBlock code={`const API_KEY = "phx_your_api_key";
const BASE = "${API_BASE}";

// Send a chat message
const resp = await fetch(\`\${BASE}/v1/chat\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
  body: JSON.stringify({
    message: "What is machine learning?",
    model: "google/gemini-2.5-flash",
  }),
});

const data = await resp.json();
if (resp.ok) {
  console.log(data.message);
  console.log("Tokens:", data.usage.total_tokens);
} else {
  console.error("Error:", data.error);
}`} language="javascript" />
              </TabsContent>

              <TabsContent value="curl">
                <CodeBlock code={`# Chat
curl -X POST ${API_BASE}/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: phx_your_api_key" \\
  -d '{"message": "What is machine learning?"}'

# List models
curl ${API_BASE}/v1/models \\
  -H "x-api-key: phx_your_api_key"

# Check usage
curl ${API_BASE}/v1/usage \\
  -H "x-api-key: phx_your_api_key"

# Health check
curl ${API_BASE}/v1/health \\
  -H "x-api-key: phx_your_api_key"`} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Playground */}
        <ApiPlayground />

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-1">Built with <Heart className="h-3 w-3 text-primary" /> by Phoenix AI</p>
        </div>
      </main>
    </div>
  );
};

export default ApiDocs;
