CREATE POLICY "Members upload their own note media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'note-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members read note media they authored or received"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'note-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.media_url = storage.objects.name AND n.addressee_id = auth.uid()
    )
  )
);

CREATE POLICY "Members remove their own note media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'note-media' AND (storage.foldername(name))[1] = auth.uid()::text);