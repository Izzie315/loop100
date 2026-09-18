ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS answered_at timestamp with time zone;

CREATE POLICY "owner adds members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()));

ALTER TABLE public.group_notes REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;