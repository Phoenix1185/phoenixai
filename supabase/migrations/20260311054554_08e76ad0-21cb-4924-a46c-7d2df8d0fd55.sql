
CREATE TABLE public.document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  platform TEXT NOT NULL DEFAULT 'web',
  platform_user_id TEXT,
  file_name TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  summary TEXT,
  conversation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document history"
ON public.document_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages document_history"
ON public.document_history FOR ALL TO public
USING (true) WITH CHECK (true);

CREATE INDEX idx_doc_history_lookup
ON public.document_history(platform, platform_user_id, file_name);

ALTER TABLE public.conversations ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;
