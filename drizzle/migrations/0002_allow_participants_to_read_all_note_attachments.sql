ALTER POLICY "Members read note media they authored or received"
ON storage.objects TO authenticated
USING (
  bucket_id = 'note-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.notes n
      WHERE (n.author_id = auth.uid() OR n.addressee_id = auth.uid())
        AND (n.media_url = storage.objects.name
          OR n.media @> jsonb_build_array(jsonb_build_object('path', storage.objects.name)))
    )
    OR EXISTS (
      SELECT 1 FROM public.group_notes n
      WHERE public.is_group_member(n.group_id, auth.uid())
        AND (n.media_url = storage.objects.name
          OR n.media @> jsonb_build_array(jsonb_build_object('path', storage.objects.name)))
    )
  )
);