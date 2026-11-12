create or replace function public.can_read_note_media(_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    split_part(_path,'/',1) = auth.uid()::text
    or exists (select 1 from public.notes n where (n.author_id = auth.uid() or n.addressee_id = auth.uid())
      and (n.media_url = _path or n.media @> jsonb_build_array(jsonb_build_object('path', _path))))
    or exists (select 1 from public.group_notes g where public.is_group_member(g.group_id, auth.uid())
      and (g.media_url = _path or g.media @> jsonb_build_array(jsonb_build_object('path', _path))))
  )
$$;
revoke execute on function public.can_read_note_media(text) from public, anon;
grant execute on function public.can_read_note_media(text) to authenticated;
drop policy if exists "Members read note media they authored or received" on storage.objects;
create policy "Members read note media they authored or received" on storage.objects
for select to authenticated using (bucket_id = 'note-media' and public.can_read_note_media(name));