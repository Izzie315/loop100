CREATE OR REPLACE FUNCTION public.search_profiles_by_name(_query text)
RETURNS TABLE(id uuid, first_name text, last_name text, talkloop_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.talkloop_number
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(trim(_query)) >= 2
    AND p.id <> auth.uid()
    AND (p.first_name || ' ' || p.last_name) ILIKE '%' || replace(replace(replace(trim(_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ORDER BY p.first_name, p.last_name
  LIMIT 10
$$;
REVOKE EXECUTE ON FUNCTION public.search_profiles_by_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_name(text) TO authenticated;