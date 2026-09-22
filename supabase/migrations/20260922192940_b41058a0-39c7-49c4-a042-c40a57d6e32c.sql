ALTER TABLE public.group_notes
  ALTER COLUMN body SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_kind text,
  ADD COLUMN IF NOT EXISTS media_seconds integer;

DROP POLICY IF EXISTS "author edits group notes" ON public.group_notes;
CREATE POLICY "author edits group notes" ON public.group_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "member hides group notes" ON public.group_notes;
CREATE POLICY "member hides group notes" ON public.group_notes FOR UPDATE TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "author deletes group notes" ON public.group_notes;
CREATE POLICY "author deletes group notes" ON public.group_notes FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.group_note_reactions (
  note_id uuid NOT NULL REFERENCES public.group_notes(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_note_reactions TO authenticated;
GRANT ALL ON public.group_note_reactions TO service_role;
ALTER TABLE public.group_note_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read group reactions" ON public.group_note_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_notes n WHERE n.id = note_id AND public.is_group_member(n.group_id, auth.uid())));

CREATE POLICY "members add group reactions" ON public.group_note_reactions FOR INSERT TO authenticated
WITH CHECK (account_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_notes n WHERE n.id = note_id AND public.is_group_member(n.group_id, auth.uid())));

CREATE POLICY "own group reaction update" ON public.group_note_reactions FOR UPDATE TO authenticated
USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE POLICY "own group reaction delete" ON public.group_note_reactions FOR DELETE TO authenticated
USING (account_id = auth.uid());

ALTER TABLE public.group_note_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_note_reactions;