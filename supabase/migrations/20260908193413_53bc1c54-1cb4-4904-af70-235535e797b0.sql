ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_kind text CHECK (media_kind IN ('photo','voice')),
  ADD COLUMN IF NOT EXISTS media_seconds integer;

ALTER TABLE public.notes ALTER COLUMN body SET DEFAULT '';