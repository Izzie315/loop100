alter table public.notes drop constraint notes_media_kind_check;
alter table public.notes add constraint notes_media_kind_check check (media_kind is null or media_kind in ('photo','voice','video'));