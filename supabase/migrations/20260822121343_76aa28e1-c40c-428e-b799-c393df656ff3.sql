CREATE OR REPLACE FUNCTION public.lookup_by_number(_number text)
 RETURNS TABLE(id uuid, first_name text, last_name text, talkloop_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.talkloop_number
  FROM public.profiles p
  WHERE regexp_replace(p.talkloop_number, '\D', '', 'g') = regexp_replace(_number, '\D', '', 'g')
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_profiles_public(_ids uuid[])
 RETURNS TABLE(id uuid, first_name text, last_name text, talkloop_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF array_length(_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too many identifiers requested';
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.talkloop_number
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_by_number(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_public(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_by_number(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_profiles_public(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_by_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) TO authenticated;