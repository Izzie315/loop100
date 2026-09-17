CREATE TABLE public.note_reactions (
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_reactions TO authenticated;
GRANT ALL ON public.note_reactions TO service_role;

ALTER TABLE public.note_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read reactions" ON public.note_reactions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.notes n
  WHERE n.id = note_reactions.note_id
    AND (n.author_id = auth.uid() OR n.addressee_id = auth.uid())
));

CREATE POLICY "participants add reactions" ON public.note_reactions
FOR INSERT TO authenticated
WITH CHECK (
  account_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.id = note_reactions.note_id
      AND (n.author_id = auth.uid() OR n.addressee_id = auth.uid())
  )
);

CREATE POLICY "own reaction update" ON public.note_reactions
FOR UPDATE TO authenticated
USING (account_id = auth.uid())
WITH CHECK (account_id = auth.uid());

CREATE POLICY "own reaction delete" ON public.note_reactions
FOR DELETE TO authenticated
USING (account_id = auth.uid());