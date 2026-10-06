ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS media jsonb;
ALTER TABLE public.group_notes ADD COLUMN IF NOT EXISTS media jsonb;