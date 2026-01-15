-- Add preferred_language column to whatsapp_conversations for persistent language settings
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';