DROP POLICY IF EXISTS "browse groups" ON public.groups;
CREATE POLICY "read own groups" ON public.groups FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_group_member(id, auth.uid()));