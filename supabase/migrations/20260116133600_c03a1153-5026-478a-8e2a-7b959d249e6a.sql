-- Create Telegram conversations table
CREATE TABLE IF NOT EXISTS public.telegram_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  sender_name TEXT,
  username TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Telegram messages table
CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.telegram_conversations(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Policies for telegram_conversations (service role only - webhook access)
CREATE POLICY "Service role can manage telegram_conversations"
ON public.telegram_conversations
FOR ALL
USING (true)
WITH CHECK (true);

-- Policies for telegram_messages (service role only - webhook access)
CREATE POLICY "Service role can manage telegram_messages"
ON public.telegram_messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_conversations_chat_id ON public.telegram_conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_conversation_id ON public.telegram_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created_at ON public.telegram_messages(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_telegram_conversations_updated_at
BEFORE UPDATE ON public.telegram_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();