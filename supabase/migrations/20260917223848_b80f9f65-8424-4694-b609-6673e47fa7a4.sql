ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_link text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decision_comment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS extension_due_date date,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE public.vote_sessions
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS mentor_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_snapshot jsonb;

ALTER TABLE public.casting_applications
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS neighborhood text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS spoken_language text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cinema_experience boolean,
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS response_sent_at timestamptz;

ALTER TABLE public.casting_calls
  ADD COLUMN IF NOT EXISTS selection_finalized_at timestamptz;

CREATE TABLE public.vote_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  token_fingerprint text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vote_security_events TO authenticated;
GRANT ALL ON public.vote_security_events TO service_role;
ALTER TABLE public.vote_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chief reads vote security events" ON public.vote_security_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'));

CREATE TABLE public.club_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  entity_id uuid,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_archives TO authenticated;
GRANT ALL ON public.club_archives TO service_role;
ALTER TABLE public.club_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read club archives" ON public.club_archives
FOR SELECT TO authenticated USING (true);
CREATE POLICY "chief manages club archives" ON public.club_archives
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'));

CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name text; project_name text;
BEGIN
  IF NEW.owner_id = auth.uid() THEN RETURN NEW; END IF;
  SELECT full_name INTO actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT title INTO project_name FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications(user_id, title, body, link)
  VALUES (NEW.owner_id, 'Tâche modifiée', coalesce(actor_name, 'Un responsable') || ' a modifié « ' || NEW.title || ' »' || CASE WHEN project_name IS NULL THEN '' ELSE ' pour le projet ' || project_name END || '.', '/taches?task=' || NEW.id::text);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_task_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_task_change() TO service_role;
DROP TRIGGER IF EXISTS trg_task_changed ON public.tasks;
CREATE TRIGGER trg_task_changed AFTER UPDATE OF title, description, due_date, estimated_duration, phase_id, project_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_change();

CREATE OR REPLACE FUNCTION public.submit_task_result(_task uuid, _link text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tasks%ROWTYPE; rid uuid; sender text; pname text;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task FOR UPDATE;
  IF t.id IS NULL OR t.owner_id <> auth.uid() OR t.assigned_by IS NULL THEN RAISE EXCEPTION 'Tâche inaccessible'; END IF;
  IF trim(coalesce(_link,'')) = '' THEN RAISE EXCEPTION 'Un lien de rendu est obligatoire'; END IF;
  UPDATE public.tasks SET received_at = coalesce(received_at, now()), submission_link = trim(_link), submitted_at = now(), status = 'done' WHERE id = _task;
  SELECT full_name INTO sender FROM public.profiles WHERE id = auth.uid();
  SELECT title INTO pname FROM public.projects WHERE id = t.project_id;
  INSERT INTO public.reports(author_id, recipient_id, title, content, link, task_id, project_id)
  VALUES (auth.uid(), t.assigned_by, 'Rendu : ' || t.title, 'Rendu de la tâche « ' || t.title || ' »' || CASE WHEN pname IS NULL THEN '' ELSE ' pour le projet ' || pname END || '.', trim(_link), t.id, t.project_id)
  RETURNING id INTO rid;
  INSERT INTO public.notifications(user_id, title, body, link)
  VALUES (t.assigned_by, 'Rendu de tâche reçu', coalesce(sender,'Un membre') || ' a remis son travail' || CASE WHEN pname IS NULL THEN '' ELSE ' pour le projet ' || pname END || '.', '/rapports?report=' || rid::text);
  RETURN rid;
END; $$;
REVOKE ALL ON FUNCTION public.submit_task_result(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_task_result(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_task_report(_report uuid, _decision text, _comment text, _extension date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reports%ROWTYPE; pname text; decider text;
BEGIN
  SELECT * INTO r FROM public.reports WHERE id = _report FOR UPDATE;
  IF r.id IS NULL OR NOT (r.recipient_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général')) THEN RAISE EXCEPTION 'Rapport inaccessible'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Décision invalide'; END IF;
  IF trim(coalesce(_comment,'')) = '' THEN RAISE EXCEPTION 'Un commentaire est obligatoire'; END IF;
  UPDATE public.reports SET decision = _decision, decision_comment = trim(_comment), extension_due_date = _extension, decided_at = now(), status = CASE WHEN _decision='approved' THEN 'validated'::public.report_status ELSE 'read'::public.report_status END WHERE id = _report;
  IF r.task_id IS NOT NULL AND _decision = 'rejected' THEN
    UPDATE public.tasks SET status = 'todo', due_date = coalesce(_extension, due_date), submitted_at = NULL WHERE id = r.task_id;
  END IF;
  SELECT title INTO pname FROM public.projects WHERE id = r.project_id;
  SELECT full_name INTO decider FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications(user_id, title, body, link)
  VALUES (r.author_id, CASE WHEN _decision='approved' THEN 'Rapport approuvé' ELSE 'Rapport refusé' END, coalesce(decider,'Votre supérieur') || ' a répondu' || CASE WHEN pname IS NULL THEN '' ELSE ' pour le projet ' || pname END || ' : ' || trim(_comment), '/rapports?report=' || r.id::text);
END; $$;
REVOKE ALL ON FUNCTION public.decide_task_report(uuid,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_task_report(uuid,text,text,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_leave_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text;
BEGIN
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.decider_id;
  INSERT INTO public.notifications(user_id,title,body,link)
  SELECT l.requester_id, CASE WHEN NEW.decision='approved' THEN 'Congé approuvé' ELSE 'Congé refusé' END, coalesce(who,'Votre supérieur') || ' : ' || NEW.comment, '/conges?leave=' || NEW.leave_id::text
  FROM public.leave_requests l WHERE l.id = NEW.leave_id;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_leave_decision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_leave_decision() TO service_role;
DROP TRIGGER IF EXISTS trg_leave_decision_notify ON public.leave_decisions;
CREATE TRIGGER trg_leave_decision_notify AFTER INSERT OR UPDATE ON public.leave_decisions
FOR EACH ROW EXECUTE FUNCTION public.notify_leave_decision();

CREATE OR REPLACE FUNCTION public.notify_casting_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE call_title text;
BEGIN
  SELECT title INTO call_title FROM public.casting_calls WHERE id = NEW.call_id;
  INSERT INTO public.notifications(user_id,title,body,link)
  SELECT DISTINCT p.id, 'Nouvelle candidature casting', NEW.full_name || ' a candidaté pour ' || coalesce(call_title,'un projet') || '.', '/casting?application=' || NEW.id::text
  FROM public.profiles p
  WHERE p.active AND (
    public.has_role(p.id,'admin') OR public.has_position(p.id,'Producteur général') OR public.has_position(p.id,'Producteur délégué') OR public.has_position(p.id,'Directeur de casting') OR public.has_position(p.id,'Réalisateur')
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_casting_application() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_casting_application() TO service_role;
DROP TRIGGER IF EXISTS trg_casting_application_notify ON public.casting_applications;
CREATE TRIGGER trg_casting_application_notify AFTER INSERT ON public.casting_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_casting_application();

CREATE OR REPLACE FUNCTION public.cast_anonymous_vote(_session uuid, _token text, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.vote_sessions%ROWTYPE; q public.vote_quotas%ROWTYPE; fingerprint text; next_codes text[];
BEGIN
  fingerprint := md5(_session::text || ':' || _token);
  SELECT * INTO s FROM public.vote_sessions WHERE id = _session FOR SHARE;
  IF s.id IS NULL OR s.opened_at IS NULL OR s.closed_at IS NOT NULL THEN
    INSERT INTO public.vote_security_events(session_id,event_type,token_fingerprint,detail) VALUES (_session,'closed_attempt',fingerprint,'Vote fermé');
    RETURN jsonb_build_object('ok',false,'error','Le vote est fermé.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vote_projects WHERE session_id=_session AND code=_code) THEN RETURN jsonb_build_object('ok',false,'error','Projet inconnu.'); END IF;
  INSERT INTO public.vote_quotas(session_id,voter_token,used,voted_codes) VALUES (_session,_token,0,ARRAY[]::text[]) ON CONFLICT (session_id,voter_token) DO NOTHING;
  SELECT * INTO q FROM public.vote_quotas WHERE session_id=_session AND voter_token=_token FOR UPDATE;
  IF q.used >= s.max_votes THEN
    INSERT INTO public.vote_security_events(session_id,event_type,token_fingerprint,detail) VALUES (_session,'quota_blocked',fingerprint,'Quota atteint');
    RETURN jsonb_build_object('ok',false,'error','Toutes les voix ont déjà été utilisées.');
  END IF;
  IF s.require_distinct AND _code = ANY(q.voted_codes) THEN
    INSERT INTO public.vote_security_events(session_id,event_type,token_fingerprint,detail) VALUES (_session,'duplicate_blocked',fingerprint,'Projet déjà choisi');
    RETURN jsonb_build_object('ok',false,'error','Les voix doivent aller à des projets différents.');
  END IF;
  next_codes := array_append(q.voted_codes,_code);
  UPDATE public.vote_quotas SET used=q.used+1,voted_codes=next_codes WHERE id=q.id;
  INSERT INTO public.vote_tallies(session_id,project_code) VALUES (_session,_code);
  RETURN jsonb_build_object('ok',true,'used',q.used+1,'votedCodes',to_jsonb(next_codes));
END; $$;
REVOKE ALL ON FUNCTION public.cast_anonymous_vote(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_anonymous_vote(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_vote_session(_session uuid, _proclamation text, _snapshot jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.vote_sessions%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général')) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT * INTO s FROM public.vote_sessions WHERE id=_session FOR UPDATE;
  IF s.id IS NULL OR s.opened_at IS NULL THEN RAISE EXCEPTION 'Session invalide'; END IF;
  UPDATE public.vote_sessions SET proclamation=trim(_proclamation), closed_at=coalesce(closed_at,now()), status='published', archived_at=now(), result_snapshot=_snapshot WHERE id=_session;
  INSERT INTO public.club_archives(category,title,entity_id,snapshot,created_by)
  VALUES ('vote',s.title,s.id,_snapshot,auth.uid())
  ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.archive_vote_session(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_vote_session(uuid,text,jsonb) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_reports_task_id ON public.reports(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_vote_security_session ON public.vote_security_events(session_id,created_at);
CREATE INDEX IF NOT EXISTS idx_club_archives_category ON public.club_archives(category,created_at);