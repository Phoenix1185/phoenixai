-- Add slug and sharing support to conversations
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_slug ON public.conversations (slug) WHERE slug IS NOT NULL;

-- Allow anyone to SELECT shared conversations (read-only)
CREATE POLICY "Anyone can view shared conversations"
  ON public.conversations
  FOR SELECT
  USING (is_shared = true);

-- Allow anyone to SELECT messages from shared conversations
CREATE POLICY "Anyone can view messages in shared conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_id AND c.is_shared = true
    )
  );