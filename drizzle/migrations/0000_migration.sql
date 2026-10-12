CREATE TABLE public.push_endpoints (
  endpoint text PRIMARY KEY,
  account_id uuid NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_endpoints TO authenticated;
GRANT ALL ON public.push_endpoints TO service_role;
ALTER TABLE public.push_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own endpoints read" ON public.push_endpoints FOR SELECT TO authenticated USING (auth.uid() = account_id);
CREATE POLICY "own endpoints add" ON public.push_endpoints FOR INSERT TO authenticated WITH CHECK (auth.uid() = account_id);
CREATE POLICY "own endpoints change" ON public.push_endpoints FOR UPDATE TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);
CREATE POLICY "own endpoints remove" ON public.push_endpoints FOR DELETE TO authenticated USING (auth.uid() = account_id);