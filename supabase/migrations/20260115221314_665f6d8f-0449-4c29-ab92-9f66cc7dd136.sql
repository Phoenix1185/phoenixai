-- Create knowledge base table for storing verified corrections
-- This applies to ALL users (global learning)
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_pattern TEXT NOT NULL,
  verified_answer TEXT NOT NULL,
  source_url TEXT,
  category TEXT DEFAULT 'general',
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT, -- Can be 'system', 'user_correction', or user ID
  UNIQUE(query_pattern)
);

-- Enable Row Level Security
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow read access to all (knowledge is global)
CREATE POLICY "Knowledge base is readable by all"
ON public.knowledge_base
FOR SELECT
USING (true);

-- Allow insert/update from service role (edge functions)
CREATE POLICY "Service role can manage knowledge base"
ON public.knowledge_base
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_knowledge_base_pattern ON public.knowledge_base USING gin(to_tsvector('english', query_pattern));
CREATE INDEX idx_knowledge_base_category ON public.knowledge_base(category);