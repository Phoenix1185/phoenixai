-- Add language preference to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Add common language options comment for reference
COMMENT ON COLUMN public.user_preferences.language IS 'User preferred language: en, es, fr, de, pt, zh, ja, ar, hi, ru';