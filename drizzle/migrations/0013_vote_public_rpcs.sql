CREATE OR REPLACE FUNCTION public.vote_session_payload(_s public.vote_sessions)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object('id',_s.id,'title',_s.title,'description',_s.description,'status',_s.status,
      'max_votes',_s.max_votes,'require_distinct',_s.require_distinct,'live_results',_s.live_results,
      'individual_codes',_s.individual_codes,'opened_at',_s.opened_at,'closed_at',_s.closed_at,'proclamation',_s.proclamation),
    'projects', COALESCE((SELECT jsonb_agg(jsonb_build_object('code',p.code,'title',p.title,'description',p.description) ORDER BY p.sort_order)
      FROM public.vote_projects p WHERE p.session_id = _s.id), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.vote_public_open(_token text, _login text DEFAULT NULL, _code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.vote_sessions;
BEGIN
  IF _login IS NOT NULL THEN
    SELECT * INTO s FROM vote_sessions WHERE access_login = trim(_login) AND access_code = trim(_code) LIMIT 1;
    IF s.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Identifiant ou code incorrect.'); END IF;
  ELSIF _token IS NOT NULL AND length(trim(_token)) >= 8 THEN
    SELECT * INTO s FROM vote_sessions WHERE public_token = trim(_token) OR mentor_token = trim(_token) LIMIT 1;
    IF s.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Ce lien de vote n''est pas valide.'); END IF;
  ELSE
    SELECT * INTO s FROM vote_sessions WHERE opened_at IS NOT NULL AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1;
    IF s.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Aucun vote n''est ouvert pour le moment.'); END IF;
  END IF;
  IF s.opened_at IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Le vote n''est pas encore ouvert.'); END IF;
  RETURN public.vote_session_payload(s);
END $$;

CREATE OR REPLACE FUNCTION public.vote_public_state(_session uuid, _token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('used', COALESCE((SELECT used FROM vote_quotas WHERE session_id=_session AND voter_token=_token),0),
    'votedCodes', COALESCE((SELECT to_jsonb(voted_codes) FROM vote_quotas WHERE session_id=_session AND voter_token=_token),'[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.vote_public_cast(_session uuid, _token text, _code text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.vote_sessions; q record; mx int;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN jsonb_build_object('ok',false,'error','Vote impossible pour le moment.'); END IF;
  SELECT * INTO s FROM vote_sessions WHERE id=_session;
  IF s.id IS NULL OR s.opened_at IS NULL OR s.closed_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','Le vote est fermé.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM vote_projects WHERE session_id=_session AND code=_code) THEN RETURN jsonb_build_object('ok',false,'error','Projet inconnu.'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_session::text || _token));
  SELECT used, voted_codes INTO q FROM vote_quotas WHERE session_id=_session AND voter_token=_token;
  mx := COALESCE(s.max_votes,2);
  IF COALESCE(q.used,0) >= mx THEN RETURN jsonb_build_object('ok',false,'error',format('Vous avez déjà utilisé vos %s voix pour ce vote.',mx)); END IF;
  IF s.require_distinct AND _code = ANY(COALESCE(q.voted_codes,'{}')) THEN RETURN jsonb_build_object('ok',false,'error','Vos voix doivent aller à des projets différents.'); END IF;
  INSERT INTO vote_quotas(session_id, voter_token, used, voted_codes) VALUES (_session,_token,1,ARRAY[_code])
  ON CONFLICT (session_id, voter_token) DO UPDATE SET used = vote_quotas.used + 1, voted_codes = vote_quotas.voted_codes || _code;
  INSERT INTO vote_tallies(session_id, project_code) VALUES (_session,_code);
  RETURN jsonb_build_object('ok',true) || public.vote_public_state(_session,_token);
END $$;

CREATE OR REPLACE FUNCTION public.vote_public_results(_session uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.vote_sessions; chief boolean;
BEGIN
  SELECT * INTO s FROM vote_sessions WHERE id=_session;
  IF s.id IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'visible',false); END IF;
  chief := auth.uid() IS NOT NULL AND public.is_admin_or_general_producer(auth.uid());
  IF NOT (s.closed_at IS NOT NULL OR COALESCE(s.live_results,false) OR chief) THEN
    RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'visible',false); END IF;
  RETURN jsonb_build_object('visible',true,
    'total',(SELECT count(*) FROM vote_tallies WHERE session_id=_session),
    'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('code',code,'votes',votes) ORDER BY votes DESC)
       FROM (SELECT project_code code, count(*) votes FROM vote_tallies WHERE session_id=_session GROUP BY 1) x),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.vote_producer_results(_session uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_general_producer(auth.uid()) THEN RAISE EXCEPTION 'Accès réservé au Producteur général.'; END IF;
  RETURN jsonb_build_object(
    'total',(SELECT count(*) FROM vote_tallies WHERE session_id=_session),
    'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',p.id,'votes',(SELECT count(*) FROM vote_tallies t WHERE t.session_id=_session AND t.project_code=p.code)))
       FROM vote_projects p WHERE p.session_id=_session),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.vote_session_payload(public.vote_sessions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vote_public_open(text,text,text), public.vote_public_state(uuid,text),
  public.vote_public_cast(uuid,text,text), public.vote_public_results(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vote_producer_results(uuid) TO authenticated;