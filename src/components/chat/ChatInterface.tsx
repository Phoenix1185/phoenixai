import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, X, ChevronUp, ChevronDown, Square, FileText } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import StreamingIndicator from './StreamingIndicator';
import QuickActions from './QuickActions';
import PhoenixLoader from './PhoenixLoader';
import PhoenixBootAnimation from './PhoenixBootAnimation';
import ImageGenerationLoader from './ImageGenerationLoader';
import ControlsPanel from './ControlsPanel';
import ModelSelector, { type ModelSpeed } from './ModelSelector';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: number;
  created_at: string;
}

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phoenix-chat`;
const DOC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-analyze`;
const MAX_CONTEXT_MESSAGES = 15;

// Retry-capable fetch with exponential backoff
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 2,
  backoff = 1000
): Promise<Response> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
      const mergedSignal = options.signal;

      const resp = await fetch(url, {
        ...options,
        signal: mergedSignal || controller.signal,
      });
      clearTimeout(timeout);
      return resp;
    } catch (err: any) {
      if (err.name === 'AbortError' && options.signal?.aborted) throw err; // user cancelled
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, backoff * (attempt + 1)));
    }
  }
  throw new Error('Failed to fetch after retries');
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  conversationId, 
  onConversationCreated 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ file: File; preview: string } | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<{ file: File; name: string }[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showBootAnimation, setShowBootAnimation] = useState(false);
  const [showExtraControls, setShowExtraControls] = useState(false);
  const [modelSpeed, setModelSpeed] = useState<ModelSpeed>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Get display name from user metadata
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  // Voice hooks
  const { 
    isListening, 
    isSupported: voiceInputSupported, 
    startListening, 
    stopListening 
  } = useVoiceInput({
    onResult: (transcript) => {
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    },
    onError: (error) => {
      toast({ variant: 'destructive', description: error });
    },
  });

  const { 
    isSpeaking, 
    isSupported: voiceOutputSupported, 
    speak, 
    stop: stopSpeaking 
  } = useVoiceOutput();

  useEffect(() => {
    if (conversationId && user) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const streamChat = useCallback(async (
    chatMessages: { role: string; content: string | any[] }[],
    onDelta: (deltaText: string) => void,
    onDone: (fullText: string) => void,
    imageUrl?: string,
    imagePrompt?: string,
    signal?: AbortSignal
  ) => {
    const body: any = { 
      messages: chatMessages,
      userId: user?.id,
      conversationId,
      userName: displayName,
      modelSpeed,
    };

    if (imageUrl) {
      body.imageUrl = imageUrl;
      body.imagePrompt = imagePrompt;
    }

    const resp = await fetchWithRetry(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 429) {
        toast({ variant: 'destructive', description: 'Rate limit exceeded. Please wait a moment.' });
      } else if (resp.status === 402) {
        toast({ variant: 'destructive', description: 'AI credits depleted. Please add credits.' });
      }
      throw new Error(errorData.error || 'Failed to start stream');
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            onDelta(content);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            onDelta(content);
          }
        } catch { /* ignore */ }
      }
    }

    onDone(fullContent);
  }, [user?.id, conversationId, toast, displayName, modelSpeed]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', description: 'Please upload an image file.' });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Image must be under 10MB.' });
      return;
    }

    const preview = URL.createObjectURL(file);
    setUploadedImage({ file, preview });
    
    // Focus textarea so user can add a prompt
    textareaRef.current?.focus();
  };

  const removeUploadedImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage.preview);
      setUploadedImage(null);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowedTypes = [
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown', 'text/html',
      'application/json', 'application/xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const allowedExts = /\.(pdf|txt|md|csv|json|xml|html|doc|docx|py|js|ts|java|cpp|c|go|rs|rb|sql|yaml|yml|toml|log|sh)$/i;

    const validFiles: { file: File; name: string }[] = [];
    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type) && !allowedExts.test(file.name)) {
        toast({ variant: 'destructive', description: `Unsupported file: ${file.name}` });
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast({ variant: 'destructive', description: `${file.name} exceeds 20MB limit.` });
        continue;
      }
      validFiles.push({ file, name: file.name });
    }

    if (validFiles.length > 0) {
      setUploadedDocuments(prev => {
        const combined = [...prev, ...validFiles];
        if (combined.length > 5) {
          toast({ variant: 'destructive', description: 'Maximum 5 documents at once.' });
          return combined.slice(0, 5);
        }
        return combined;
      });
    }
    // Reset input so same files can be re-selected
    e.target.value = '';
    textareaRef.current?.focus();
  };

  const removeUploadedDocument = (index: number) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !uploadedImage && uploadedDocuments.length === 0) || isLoading || !user) return;

    // Stop voice input if active
    if (isListening) {
      stopListening();
    }

    const userMessage = input.trim();
    const hasImage = !!uploadedImage;
    const hasDocuments = uploadedDocuments.length > 0;
    let imageBase64: string | undefined;
    let documentsData: { content: string; name: string; type: string }[] = [];

    if (uploadedImage) {
      imageBase64 = await fileToBase64(uploadedImage.file);
    }

    if (hasDocuments) {
      for (const doc of uploadedDocuments) {
        const isTextBased = /\.(txt|md|csv|json|xml|html|css|js|ts|py|java|cpp|c|go|rs|rb|sql|yaml|yml|toml|log|sh)$/i.test(doc.name);
        if (isTextBased) {
          const textContent = await readFileAsText(doc.file);
          documentsData.push({ content: textContent, name: doc.name, type: 'text' });
        } else {
          const base64 = await fileToBase64(doc.file);
          documentsData.push({ content: base64, name: doc.name, type: doc.file.type });
        }
      }
    }

    setInput('');
    removeUploadedImage();
    setUploadedDocuments([]);
    setIsLoading(true);

    let currentConversationId = conversationId;

    // Create new conversation if needed
    if (!currentConversationId) {
      const title = userMessage || (hasDocuments ? `📄 ${documentsData.map(d => d.name).join(', ')}` : hasImage ? 'Image conversation' : 'New chat');
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title.slice(0, 50) + (title.length > 50 ? '...' : ''),
        })
        .select()
        .single();

      if (newConv) {
        currentConversationId = newConv.id;
        onConversationCreated?.(newConv.id);
      }
    }

    // Create display message
    let displayContent = userMessage;
    if (hasImage && imageBase64) {
      const imageMarkdown = `\n\n![Uploaded Image](${imageBase64})`;
      displayContent = `${userMessage || 'Sent an image'}${imageMarkdown}`;
    }
    if (hasDocuments && documentsData.length > 0) {
      const docNames = documentsData.map(d => `📄 **${d.name}**`).join('\n');
      displayContent = `${userMessage || (documentsData.length > 1 ? 'Compare these documents' : 'Analyze this document')}\n\n${docNames}`;
    }

    // Add user message
    const tempUserMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // Save user message to database
    if (currentConversationId) {
      const { data: savedUserMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversationId,
          user_id: user.id,
          role: 'user',
          content: displayContent,
        })
        .select()
        .single();

      if (savedUserMsg) {
        setMessages(prev => 
          prev.map(m => m.id === tempUserMessage.id ? savedUserMsg as Message : m)
        );
      }
    }

    // Check if this looks like an image generation request
    const isImageGenRequest = !hasDocuments && /generate|create|make|draw|design|paint|imagine|visualize|illustrate/i.test(userMessage) &&
      /image|picture|photo|art|artwork|illustration|graphic|logo|banner/i.test(userMessage);

    // Show boot animation for first message in conversation
    if (messages.length === 0 && !showBootAnimation) {
      setShowBootAnimation(true);
    }

    // Start streaming
    setIsStreaming(true);
    if (isImageGenRequest) {
      setIsGeneratingImage(true);
    }
    let assistantContent = '';

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      if (assistantContent.length > 0) {
        setIsGeneratingImage(false);
      }
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id.startsWith('stream-')) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: 'stream-' + Date.now(),
          role: 'assistant' as const,
          content: assistantContent,
          created_at: new Date().toISOString(),
        }];
      });
    };

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      if (hasDocuments && documentsData.length > 0) {
        // Use document-analyze endpoint (supports single + multi-doc)
        const resp = await fetchWithRetry(DOC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            documents: documentsData,
            prompt: userMessage || (documentsData.length > 1
              ? 'Compare these documents and highlight key similarities and differences.'
              : 'Analyze this document and provide a comprehensive summary.'),
            userId: user?.id,
            conversationId: currentConversationId,
            userName: displayName,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          throw new Error(errorData.error || 'Document analysis failed');
        }

        // Stream the response same way as chat
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch { 
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }

        // Save assistant message
        setIsStreaming(false);
        setIsLoading(false);
        setShowBootAnimation(false);
        abortControllerRef.current = null;

        if (currentConversationId && assistantContent) {
          const { data: savedAssistantMsg } = await supabase
            .from('messages')
            .insert({
              conversation_id: currentConversationId,
              user_id: user.id,
              role: 'assistant',
              content: assistantContent,
            })
            .select()
            .single();

          if (savedAssistantMsg) {
            setMessages(prev =>
              prev.map(m => m.id.startsWith('stream-') ? savedAssistantMsg as Message : m)
            );
          }

          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentConversationId);
        }
      } else {
        // Normal chat flow
        const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
        const chatHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));
        chatHistory.push({ role: 'user', content: userMessage || 'Please analyze this image.' });

        await streamChat(
          chatHistory,
          updateAssistant,
          async (fullText: string) => {
            setIsStreaming(false);
            setIsLoading(false);
            setIsGeneratingImage(false);
            setShowBootAnimation(false);
            abortControllerRef.current = null;
            if (autoSpeak && voiceOutputSupported && fullText) {
              const plainText = fullText
                .replace(/```[\s\S]*?```/g, 'code block')
                .replace(/[*_`#]/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
              speak(plainText);
            }

            if (currentConversationId && fullText) {
              const { data: savedAssistantMsg } = await supabase
                .from('messages')
                .insert({
                  conversation_id: currentConversationId,
                  user_id: user.id,
                  role: 'assistant',
                  content: fullText,
                })
                .select()
                .single();

              if (savedAssistantMsg) {
                setMessages(prev =>
                  prev.map(m => m.id.startsWith('stream-') ? savedAssistantMsg as Message : m)
                );
              }

              await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentConversationId);
            }
          },
          imageBase64,
          userMessage,
          abortControllerRef.current.signal
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Streaming cancelled by user');
        setIsStreaming(false);
        setIsLoading(false);
        setIsGeneratingImage(false);
        setShowBootAnimation(false);
        abortControllerRef.current = null;
        return;
      }
      
      console.error('Streaming error:', error);
      const isNetworkError = error.message === 'Failed to fetch' || error.message?.includes('NetworkError') || error.message?.includes('fetch');
      const friendlyMessage = isNetworkError
        ? "Network connection issue — please check your internet and try again."
        : error.message || 'Something went wrong. Please try again.';
      
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: `⚠️ ${friendlyMessage}`,
        created_at: new Date().toISOString(),
      }]);
      setIsStreaming(false);
      setIsLoading(false);
      setIsGeneratingImage(false);
      setShowBootAnimation(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleRating = async (messageId: string, rating: number, feedbackText?: string) => {
    if (!user || messageId.startsWith('temp-') || messageId.startsWith('error-') || messageId.startsWith('stream-')) return;

    await supabase
      .from('messages')
      .update({ rating })
      .eq('id', messageId);

    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, rating } : m)
    );

    await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        message_id: messageId,
        feedback_type: rating === 1 ? 'positive' : 'negative',
        feedback_text: feedbackText || null,
      });
  };

  const handleSpeakMessage = (content: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const plainText = content
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/[*_`#]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      speak(plainText);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!user || !conversationId || isLoading) return;

    // Find the message index
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Remove this message and all subsequent messages from UI
    const messagesBeforeEdit = messages.slice(0, msgIndex);
    setMessages(messagesBeforeEdit);

    // Delete the edited message and all following from DB
    const messagesToDelete = messages.slice(msgIndex);
    for (const msg of messagesToDelete) {
      if (!msg.id.startsWith('temp-') && !msg.id.startsWith('stream-') && !msg.id.startsWith('error-')) {
        await supabase.from('messages').delete().eq('id', msg.id);
      }
    }

    // Set the edited text as input and submit
    setInput(newContent);
    // Use a small delay to let state update, then submit
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }, 100);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-4">
            <PhoenixLoader size="lg" animate={false} />
            <h2 className="text-2xl font-bold mb-2 font-['Poppins'] mt-6">
              Welcome{displayName !== 'User' ? `, ${displayName}` : ''} to <span className="text-primary">Phoenix AI</span>
            </h2>
            <p className="text-muted-foreground max-w-md mb-2">
              Your intelligent assistant with live web search. Just ask naturally – 
              no commands needed!
            </p>
            <p className="text-xs text-muted-foreground mb-8">
              Created by <span className="text-primary">IYANU</span> & Phoenix Team
            </p>
            
            <QuickActions onSelect={handleQuickAction} />
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Boot animation for first message */}
            {showBootAnimation && messages.length === 1 && (
              <PhoenixBootAnimation 
                userName={displayName !== 'User' ? displayName : undefined}
                onComplete={() => setShowBootAnimation(false)}
              />
            )}
            
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onRate={(rating, feedbackText) => { handleRating(message.id, rating, feedbackText); }}
                onSpeak={voiceOutputSupported ? handleSpeakMessage : undefined}
                onEdit={handleEditMessage}
                isSpeaking={isSpeaking}
                isStreaming={isStreaming && message.id.startsWith('stream-')}
              />
            ))}
            
            {/* Image generation loader */}
            {isGeneratingImage && (
              <div className="flex justify-start gap-3">
                <div className="w-8 h-8 rounded-lg gradient-phoenix flex items-center justify-center shrink-0 shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary-foreground animate-pulse">
                    <path d="M12 2C12 2 9 6 9 10C9 14 12 16 12 16C12 16 15 14 15 10C15 6 12 2 12 2Z" fill="currentColor" />
                  </svg>
                </div>
                <ImageGenerationLoader />
              </div>
            )}
            
            {isLoading && !isStreaming && !isGeneratingImage && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area - FIXED at bottom */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,0px)] border-t border-border bg-background/95 backdrop-blur-sm p-4 z-50">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* File previews */}
          {uploadedImage && (
            <div className="relative inline-block mb-3">
              <img 
                src={uploadedImage.preview} 
                alt="Upload preview" 
                className="h-20 w-20 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={removeUploadedImage}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {uploadedDocuments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedDocuments.map((doc, index) => (
                <div key={index} className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm truncate max-w-[200px]">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => removeUploadedDocument(index)}
                    className="bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/80 transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative glass-card rounded-2xl">
            {/* Controls panel - positioned ABOVE the input */}
            <AnimatePresence>
              {showExtraControls && (
                <ControlsPanel
                  onImageUpload={() => fileInputRef.current?.click()}
                  onDocumentUpload={() => docInputRef.current?.click()}
                  onToggleVoice={toggleVoiceInput}
                  isListening={isListening}
                  voiceInputSupported={voiceInputSupported}
                  disabled={!user}
                  isLoading={isLoading}
                />
              )}
            </AnimatePresence>
            
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={user ? (uploadedDocuments.length > 0 ? `Ask about ${uploadedDocuments.map(d => d.name).join(', ')}...` : uploadedImage ? "Describe what to do with this image..." : "Ask Phoenix anything... (Ctrl+Enter to send)") : "Sign in to start chatting..."}
              disabled={!user || isLoading}
              className="min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent pr-24 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              ref={docInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.doc,.docx,.py,.js,.ts,.java,.cpp,.c,.go,.rs,.rb,.sql,.yaml,.yml,.toml,.log,.sh"
              onChange={handleDocumentUpload}
              className="hidden"
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* Toggle extra controls button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowExtraControls(!showExtraControls)}
                    disabled={!user}
                    className="h-10 w-10 rounded-xl transition-all"
                  >
                    {showExtraControls ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showExtraControls ? 'Hide tools' : 'Show tools'}</p>
                </TooltipContent>
              </Tooltip>

              {/* Cancel/Stop button when streaming */}
              {isLoading || isStreaming ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={handleCancel}
                      className="h-10 w-10 rounded-xl transition-all"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop generating</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={(!input.trim() && !uploadedImage && uploadedDocuments.length === 0) || !user}
                  className={cn(
                    'h-10 w-10 rounded-xl transition-all',
                    (input.trim() || uploadedImage || uploadedDocuments.length > 0) ? 'gradient-phoenix text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {isStreaming ? (
              <StreamingIndicator text="Phoenix is typing..." />
            ) : (
              <div className="flex items-center gap-2">
                <ModelSelector value={modelSpeed} onChange={setModelSpeed} disabled={isLoading} />
                <span className="text-muted-foreground">•</span>
                <Sparkles className="h-3 w-3 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Live web search • {voiceInputSupported ? 'Voice' : ''} • Image
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
