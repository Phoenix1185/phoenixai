
-- API Keys table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{chat}',
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  total_requests integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own keys" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keys" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own keys" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages api_keys" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API Usage Logs table
CREATE TABLE public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  response_time_ms integer,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs" ON public.api_usage_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_keys WHERE api_keys.id = api_usage_logs.api_key_id AND api_keys.user_id = auth.uid()));
CREATE POLICY "Service role manages usage_logs" ON public.api_usage_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_usage_logs_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX idx_api_usage_logs_created ON public.api_usage_logs(created_at);
