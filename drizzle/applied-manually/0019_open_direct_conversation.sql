CREATE OR REPLACE FUNCTION public.open_direct_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
  _my_name text;
  _other_name text;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté.';
  END IF;
  IF _other IS NULL OR _other = _me THEN
    RAISE EXCEPTION 'Destinataire invalide.';
  END IF;

  SELECT cp.conversation_id INTO _conv
  FROM public.conversation_participants cp
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp.conversation_id AND cp2.profile_id = _other
  JOIN public.conversations c
    ON c.id = cp.conversation_id AND c.kind = 'direct'
  WHERE cp.profile_id = _me
  LIMIT 1;

  IF _conv IS NOT NULL THEN
    RETURN _conv;
  END IF;

  SELECT full_name INTO _my_name FROM public.profiles WHERE id = _me;
  SELECT full_name INTO _other_name FROM public.profiles WHERE id = _other;

  INSERT INTO public.conversations (kind, title)
  VALUES ('direct', coalesce(_my_name, 'Membre') || ' — ' || coalesce(_other_name, 'Membre'))
  RETURNING id INTO _conv;

  INSERT INTO public.conversation_participants (conversation_id, profile_id)
  VALUES (_conv, _me), (_conv, _other)
  ON CONFLICT DO NOTHING;

  RETURN _conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_direct_conversation(uuid) TO authenticated;