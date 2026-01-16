-- Phase 1: Upgrade knowledge_base table with TTL support
ALTER TABLE public.knowledge_base 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS fetch_source TEXT DEFAULT 'web_search',
  ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT false;

-- Add constraint for confidence values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_base_confidence_check'
  ) THEN
    ALTER TABLE public.knowledge_base 
      ADD CONSTRAINT knowledge_base_confidence_check 
      CHECK (confidence IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Create index for expired entries cleanup
CREATE INDEX IF NOT EXISTS idx_knowledge_base_expires_at ON public.knowledge_base (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_is_expired ON public.knowledge_base (is_expired) WHERE is_expired = true;

-- Phase 2: Create learning_patterns table for behavioral patterns only
CREATE TABLE IF NOT EXISTS public.learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'formatting', 'clarification', 'tool_usage', 
    'hallucination_prevention', 'prompt_refinement', 'error_handling'
  )),
  pattern_description TEXT NOT NULL,
  trigger_context TEXT,
  improvement_applied TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  effectiveness_score NUMERIC(3,2) DEFAULT 0.80,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on learning_patterns
ALTER TABLE public.learning_patterns ENABLE ROW LEVEL SECURITY;

-- Learning patterns are readable by all (global patterns)
CREATE POLICY "Learning patterns readable by all" 
  ON public.learning_patterns FOR SELECT USING (true);

-- Service role can manage learning patterns  
CREATE POLICY "Service role manages learning patterns" 
  ON public.learning_patterns FOR ALL 
  USING (true) WITH CHECK (true);

-- Create trigger for updated_at on learning_patterns
CREATE TRIGGER update_learning_patterns_updated_at
  BEFORE UPDATE ON public.learning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for learning_patterns
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON public.learning_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_usage ON public.learning_patterns (usage_count DESC);