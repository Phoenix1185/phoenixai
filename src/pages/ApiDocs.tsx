import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, Zap, BookOpen, Code, Terminal } from 'lucide-react';
import PhoenixLogo from '@/components/PhoenixLogo';
import { useToast } from '@/hooks/use-toast';

const ApiDocs: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const baseUrl = `${window.location.origin.replace('localhost:8080', 'ixohndnnrivfmaxecpkt.supabase.co')}/functions/v1/phoenix-api`;
  const apiBase = 'https://ixohndnnrivfmaxecpkt.supabase.co/functions/v1/phoenix-api';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Copied!' });
  };

  const CodeBlock = ({ code, language = 'bash' }: { code: string; language?: string }) => (
    <div className="relative group">
      <pre className="bg-muted/80 rounded-lg p-4 overflow-x-auto text-sm font-mono">
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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center gap-4 h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PhoenixLogo size="sm" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold font-['Poppins']">API Documentation</h1>
          </div>
          <Badge variant="outline" className="font-mono">v1</Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Intro */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold font-['Poppins']">
            Phoenix AI <span className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">API</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Integrate Phoenix AI into your applications. Send messages, get intelligent responses, and build amazing AI-powered experiences.
          </p>
          <div className="flex gap-3">
            <Badge className="gap-1"><Zap className="h-3 w-3" /> Fast</Badge>
            <Badge className="gap-1"><BookOpen className="h-3 w-3" /> REST API</Badge>
            <Badge className="gap-1"><Code className="h-3 w-3" /> JSON</Badge>
          </div>
        </div>

        {/* Quick Start */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" /> Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">1. Create an API key in Settings → API Keys</p>
            <p className="text-sm text-muted-foreground">2. Make your first request:</p>
            <CodeBlock code={`curl -X POST ${apiBase}/v1/chat \\
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
              All requests require an API key. Include it as a header:
            </p>
            <CodeBlock code={`x-api-key: phx_your_api_key_here
# or
Authorization: Bearer phx_your_api_key_here`} />
            <p className="text-sm text-muted-foreground">
              API keys start with <code className="bg-muted px-1 rounded">phx_</code>. Get yours from Settings → API Keys.
            </p>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Endpoints</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="chat" className="space-y-4">
              <TabsList>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
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
                      <tr className="border-b"><td className="p-3 font-mono text-xs">message</td><td className="p-3">string</td><td className="p-3">✅</td><td className="p-3">Your message to Phoenix AI</td></tr>
                      <tr className="border-b"><td className="p-3 font-mono text-xs">model</td><td className="p-3">string</td><td className="p-3">❌</td><td className="p-3">AI model to use (default: gemini-2.5-flash)</td></tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="font-medium text-sm mt-4">Example Request</h4>
                <CodeBlock code={`fetch("${apiBase}/v1/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "phx_your_api_key"
  },
  body: JSON.stringify({
    message: "Explain quantum computing in simple terms",
    model: "google/gemini-2.5-flash"
  })
})`} language="javascript" />

                <h4 className="font-medium text-sm mt-4">Example Response</h4>
                <CodeBlock code={`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "model": "google/gemini-2.5-flash",
  "message": "Quantum computing uses quantum bits...",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 200,
    "total_tokens": 215
  },
  "created_at": "2026-04-08T12:00:00.000Z"
}`} language="json" />
              </TabsContent>

              <TabsContent value="models" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">GET</Badge>
                  <code className="text-sm font-mono">/v1/models</code>
                </div>
                <p className="text-sm text-muted-foreground">List available AI models.</p>
                <CodeBlock code={`curl ${apiBase}/v1/models \\
  -H "x-api-key: phx_your_api_key"`} />
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">GET</Badge>
                  <code className="text-sm font-mono">/v1/usage</code>
                </div>
                <p className="text-sm text-muted-foreground">View your API usage statistics and recent logs.</p>
                <CodeBlock code={`curl ${apiBase}/v1/usage \\
  -H "x-api-key: phx_your_api_key"`} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Rate Limits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Default: <strong>60 requests/minute</strong> per API key.</p>
            <p className="text-sm text-muted-foreground">If exceeded, you'll receive a <code className="bg-muted px-1 rounded">429</code> status code.</p>
          </CardContent>
        </Card>

        {/* SDKs */}
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
BASE_URL = "${apiBase}"

response = requests.post(
    f"{BASE_URL}/v1/chat",
    headers={
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
    },
    json={"message": "What is machine learning?"}
)

data = response.json()
print(data["message"])`} language="python" />
              </TabsContent>

              <TabsContent value="node">
                <CodeBlock code={`const API_KEY = "phx_your_api_key";
const BASE_URL = "${apiBase}";

const response = await fetch(\`\${BASE_URL}/v1/chat\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
  body: JSON.stringify({ message: "What is machine learning?" }),
});

const data = await response.json();
console.log(data.message);`} language="javascript" />
              </TabsContent>

              <TabsContent value="curl">
                <CodeBlock code={`curl -X POST ${apiBase}/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: phx_your_api_key" \\
  -d '{"message": "What is machine learning?"}'`} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Errors */}
        <Card className="glass-card">
          <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3">Code</th><th className="text-left p-3">Meaning</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="p-3 font-mono">400</td><td className="p-3">Bad request — missing or invalid parameters</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">401</td><td className="p-3">Unauthorized — invalid or missing API key</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">403</td><td className="p-3">Forbidden — key lacks required permission</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">404</td><td className="p-3">Not found — unknown endpoint</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">429</td><td className="p-3">Rate limit exceeded</td></tr>
                  <tr><td className="p-3 font-mono">500</td><td className="p-3">Internal server error</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocs;
