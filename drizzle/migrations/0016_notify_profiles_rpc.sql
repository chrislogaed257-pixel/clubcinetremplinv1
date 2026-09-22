CREATE OR REPLACE FUNCTION public.notify_profiles(_ids uuid[], _title text, _body text, _link text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.id, _title, _body, NULLIF(_link, '')
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_leader_ids()
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id
  FROM public.profiles p
  WHERE p.active
    AND (
      public.is_admin_or_general_producer(p.id)
      OR public.has_position(p.id, 'Producteur délégué')
      OR public.has_position(p.id, 'Réalisateur')
      OR public.has_position(p.id, 'Scénariste')
    );
$$;

GRANT EXECUTE ON FUNCTION public.notify_profiles(uuid[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_leader_ids() TO authenticated;