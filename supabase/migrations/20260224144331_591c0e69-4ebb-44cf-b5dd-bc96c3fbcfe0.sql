
-- Create user_memories table for cross-platform memory
CREATE TABLE public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'web',
  platform_user_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- Service role can manage all memories (used by edge functions)
CREATE POLICY "Service role can manage user_memories"
  ON public.user_memories FOR ALL
  USING (true) WITH CHECK (true);

-- Index for fast lookups by platform + user
CREATE INDEX idx_user_memories_platform_user
  ON public.user_memories (platform, platform_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_memories_updated_at
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
