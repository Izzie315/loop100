ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';

CREATE POLICY "author deletes own notes"
ON public.notes FOR DELETE TO authenticated
USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "mark note viewed" ON public.notes;

CREATE POLICY "author edits own notes"
ON public.notes FOR UPDATE TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "participant updates note state"
ON public.notes FOR UPDATE TO authenticated
USING (auth.uid() = addressee_id)
WITH CHECK (auth.uid() = addressee_id);