import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileJson, FileType } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ConversationExportProps {
  messages: Message[];
  title?: string;
}

const ConversationExport: React.FC<ConversationExportProps> = ({ messages, title = 'Phoenix Chat' }) => {
  const { toast } = useToast();

  const exportAsText = () => {
    const header = `=== ${title} ===\nExported from Phoenix AI on ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
    const body = messages.map(m => {
      const role = m.role === 'user' ? '👤 You' : '🔥 Phoenix';
      const time = new Date(m.created_at).toLocaleTimeString();
      return `[${time}] ${role}:\n${m.content}\n`;
    }).join('\n');
    downloadFile(`${header}${body}`, `${title.replace(/\s+/g, '_')}.txt`, 'text/plain');
  };

  const exportAsJson = () => {
    const data = {
      title,
      exported_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      })),
    };
    downloadFile(JSON.stringify(data, null, 2), `${title.replace(/\s+/g, '_')}.json`, 'application/json');
  };

  const exportAsMarkdown = () => {
    const header = `# ${title}\n\n*Exported from Phoenix AI on ${new Date().toLocaleString()}*\n\n---\n\n`;
    const body = messages.map(m => {
      const role = m.role === 'user' ? '**You**' : '**Phoenix AI** 🔥';
      return `### ${role}\n\n${m.content}\n`;
    }).join('\n---\n\n');
    downloadFile(`${header}${body}`, `${title.replace(/\s+/g, '_')}.md`, 'text/markdown');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ description: `Exported as ${filename}` });
  };

  if (messages.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsText}>
          <FileText className="h-4 w-4 mr-2" /> Export as Text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJson}>
          <FileJson className="h-4 w-4 mr-2" /> Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsMarkdown}>
          <FileType className="h-4 w-4 mr-2" /> Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ConversationExport;
