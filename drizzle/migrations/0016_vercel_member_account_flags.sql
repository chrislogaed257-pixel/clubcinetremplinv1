CREATE OR REPLACE FUNCTION public.admin_set_member_flags(
  _id uuid,
  _active boolean DEFAULT NULL,
  _must_change_password boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_general_producer(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF _id = auth.uid() AND _active IS FALSE THEN
    RAISE EXCEPTION 'Vous ne pouvez pas désactiver votre propre compte.';
  END IF;
  UPDATE public.profiles
     SET active = coalesce(_active, active),
         must_change_password = coalesce(_must_change_password, must_change_password)
   WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre introuvable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_member_flags(uuid,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_member_flags(uuid,boolean,boolean) TO authenticated;