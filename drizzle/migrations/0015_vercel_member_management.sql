CREATE OR REPLACE FUNCTION public.admin_update_member_data(
  _id uuid,
  _email text,
  _full_name text,
  _role public.app_role,
  _likes text,
  _dislikes text,
  _role_description text,
  _positions jsonb,
  _managers uuid[],
  _projects uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos jsonb;
  first_name text;
  descr text;
BEGIN
  IF NOT public.is_admin_or_general_producer(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _id) THEN
    RAISE EXCEPTION 'Membre introuvable';
  END IF;

  descr := nullif(trim(coalesce(_role_description, '')), '');
  IF descr IS NULL THEN
    SELECT string_agg(name || ' : ' || description, E'\n\n')
      INTO descr
      FROM public.positions
     WHERE id IN (
       SELECT (x->>'positionId')::uuid
         FROM jsonb_array_elements(coalesce(_positions, '[]'::jsonb)) x
     )
       AND coalesce(trim(description), '') <> '';
  END IF;

  UPDATE public.profile_position_history h
     SET ended_on = current_date
   WHERE h.profile_id = _id
     AND h.ended_on IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements(coalesce(_positions, '[]'::jsonb)) x
         JOIN public.positions p ON p.id = (x->>'positionId')::uuid
        WHERE p.name = h.position_name
          AND coalesce(x->>'rank', '') = h.rank_label
     );

  FOR pos IN SELECT * FROM jsonb_array_elements(coalesce(_positions, '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM public.profile_position_history h
        JOIN public.positions p ON p.name = h.position_name
       WHERE h.profile_id = _id
         AND h.ended_on IS NULL
         AND p.id = (pos->>'positionId')::uuid
         AND h.rank_label = coalesce(pos->>'rank', '')
    ) THEN
      INSERT INTO public.profile_position_history(profile_id, position_name, rank_label)
      SELECT _id, name, coalesce(pos->>'rank', '')
        FROM public.positions
       WHERE id = (pos->>'positionId')::uuid;
    END IF;
  END LOOP;

  DELETE FROM public.profile_positions WHERE profile_id = _id;
  INSERT INTO public.profile_positions(profile_id, position_id, rank_label)
  SELECT _id, (x->>'positionId')::uuid, coalesce(x->>'rank', '')
    FROM jsonb_array_elements(coalesce(_positions, '[]'::jsonb)) x;

  DELETE FROM public.profile_managers WHERE profile_id = _id;
  INSERT INTO public.profile_managers(profile_id, manager_id)
  SELECT _id, m
    FROM unnest(coalesce(_managers, '{}'::uuid[])) m
   WHERE m <> _id;

  SELECT name INTO first_name
    FROM public.positions
   WHERE id = ((_positions->0)->>'positionId')::uuid;

  UPDATE public.profiles
     SET email = lower(trim(_email)),
         full_name = _full_name,
         position = coalesce(first_name, ''),
         manager_id = (SELECT m FROM unnest(coalesce(_managers, '{}'::uuid[])) m WHERE m <> _id LIMIT 1),
         likes = coalesce(_likes, ''),
         dislikes = coalesce(_dislikes, ''),
         role_description = coalesce(descr, '')
   WHERE id = _id;

  DELETE FROM public.user_roles WHERE user_id = _id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_id, _role);

  IF _role = 'mentor' THEN
    INSERT INTO public.conversations(kind, title, ref_id)
    VALUES ('mentor', 'Mentor — ' || _full_name, _id)
    ON CONFLICT (kind, ref_id) DO NOTHING;
  END IF;

  INSERT INTO public.project_members(project_id, profile_id, added_by, status)
  SELECT pr, _id, auth.uid(), 'pending'
    FROM unnest(coalesce(_projects, '{}'::uuid[])) pr
  ON CONFLICT (project_id, profile_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_member_data(uuid,text,text,public.app_role,text,text,text,jsonb,uuid[],uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_member_data(uuid,text,text,public.app_role,text,text,text,jsonb,uuid[],uuid[]) TO authenticated;