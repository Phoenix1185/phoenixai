
CREATE TABLE public.pending_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'whatsapp',
  file_name TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pending_documents"
ON public.pending_documents
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Auto-cleanup old pending docs (older than 5 minutes)
CREATE INDEX idx_pending_documents_chat_created ON public.pending_documents(chat_id, created_at DESC);
