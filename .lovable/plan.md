

# Plan: Document History & Platform-Wide Enhancements

## 1. Document History Feature

### Database Changes
- Create a `document_history` table to store analyzed documents with metadata:
  - `id`, `user_id` (nullable for WhatsApp/Telegram), `platform`, `platform_user_id`, `file_name`, `extracted_text` (truncated to 25K chars), `summary` (AI-generated short summary), `conversation_id`, `created_at`
  - RLS: authenticated users can read their own; service role manages all
- Add an index on `(platform, platform_user_id, file_name)` for fast lookups by name

### Backend Changes (phoenix-core.ts + webhooks + document-analyze)
- Add `saveDocumentToHistory()` and `searchDocumentHistory()` functions to `phoenix-core.ts`
- After every document analysis (web, WhatsApp, Telegram), save the extracted text + a short AI summary to `document_history`
- Add detection in `phoenix-core.ts` for document reference commands like "refer to [filename]", "what did [filename] say about...", "from the document [name]"
- When detected, fetch matching documents from `document_history` and inject their content into the AI context
- Update `document-analyze/index.ts` to save results after analysis
- Update `whatsapp-webhook` and `ultramsg-webhook` to save documents after analysis
- Update `telegram-webhook` to support document analysis (currently missing) and save to history

### Web UI Changes
- No major UI changes needed -- document references work naturally through chat input ("what did my resume say about...")

## 2. Advanced Updates Across the Platform

### A. Telegram Document Analysis Support
- Add document message handling to `telegram-webhook/index.ts` (download file via Telegram Bot API, extract text, respond with analysis)
- Support the same file types as WhatsApp (PDF, DOCX, TXT, code files)
- Support multi-document comparison using the same `pending_documents` buffer

### B. Smarter Model Routing
- Update `selectModel()` in `phoenix-core.ts` to use `openai/gpt-5.2` for document analysis and comparison tasks
- Add document-related patterns to trigger the reasoning model

### C. Improved Error Resilience
- Add try/catch wrappers around all webhook document processing to prevent crashes from malformed files
- Add timeout handling (30s) for document extraction API calls
- Return user-friendly error messages instead of failing silently

### D. Chat Message Search (Web)
- Add a search endpoint or query in `ChatInterface.tsx` that searches message content across conversations
- This helps users find which conversation mentioned a specific document or topic

### E. Conversation Pinning
- Add a `is_pinned` boolean column to `conversations` table
- Update `ChatHistory.tsx` sidebar to show pinned conversations at the top with a pin/unpin button
- Useful for keeping important document-related conversations accessible

### F. Quick Document Re-analyze
- In `ChatInterface.tsx`, when displaying document analysis results, add a "Ask follow-up" quick action that pre-fills the input with "Regarding [filename], "
- Makes it easy to reference previously analyzed documents

### G. Enhanced System Prompt for Document Context
- When `document_history` entries exist for a user, inject a brief list of previously analyzed document names into the system prompt so the AI knows what's available to reference

## Technical Details

### New Table Schema
```sql
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

-- Authenticated users see their own docs
CREATE POLICY "Users can view own document history"
ON public.document_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Service role manages all (for webhooks)
CREATE POLICY "Service role manages document_history"
ON public.document_history FOR ALL TO public
USING (true) WITH CHECK (true);

CREATE INDEX idx_doc_history_lookup
ON public.document_history(platform, platform_user_id, file_name);

ALTER TABLE public.conversations ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;
```

### Files to Create/Edit
- **Create**: Migration SQL for `document_history` table + `is_pinned` column
- **Edit**: `supabase/functions/_shared/phoenix-core.ts` -- add `saveDocumentToHistory()`, `searchDocumentHistory()`, document reference detection
- **Edit**: `supabase/functions/document-analyze/index.ts` -- save to history after analysis
- **Edit**: `supabase/functions/whatsapp-webhook/index.ts` -- save to history after document processing
- **Edit**: `supabase/functions/ultramsg-webhook/index.ts` -- save to history after document processing  
- **Edit**: `supabase/functions/telegram-webhook/index.ts` -- add document analysis + save to history
- **Edit**: `supabase/functions/phoenix-chat/index.ts` -- detect document references, inject history context
- **Edit**: `src/components/sidebar/ChatHistory.tsx` -- add pin/unpin button, sort pinned first
- **Edit**: `src/components/chat/ChatInterface.tsx` -- add document follow-up quick action

