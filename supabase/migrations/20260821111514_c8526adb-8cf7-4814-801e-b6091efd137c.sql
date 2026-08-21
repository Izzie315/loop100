ALTER TABLE public.messages RENAME TO notes;
ALTER TABLE public.notes RENAME COLUMN sender_id TO author_id;
ALTER TABLE public.notes RENAME COLUMN recipient_id TO addressee_id;
ALTER POLICY "read own messages" ON public.notes RENAME TO "read own notes";
ALTER POLICY "send messages" ON public.notes RENAME TO "create own notes";
ALTER POLICY "mark read" ON public.notes RENAME TO "mark note viewed";
ALTER TABLE public.call_signals RENAME COLUMN sender_id TO origin_id;
ALTER POLICY "send call signals" ON public.call_signals RENAME TO "create call signals";