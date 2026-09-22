-- Projet interne issu du vote : budget, modifications en attente d'approbation, phases notifiées.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vote_session_id uuid REFERENCES public.vote_sessions(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_vote_session_unique
  ON public.projects (vote_session_id) WHERE vote_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Divers',
  label text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_budget_lines TO authenticated;
GRANT ALL ON public.project_budget_lines TO service_role;
ALTER TABLE public.project_budget_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.project_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field text NOT NULL,
  field_label text NOT NULL DEFAULT '',
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  decision_comment text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.project_edits TO authenticated;
GRANT ALL ON public.project_edits TO service_role;
ALTER TABLE public.project_edits ENABLE ROW LEVEL SECURITY;

-- Droits : qui peut compléter la fiche d'un projet interne.
CREATE OR REPLACE FUNCTION public.can_edit_internal_project(_user uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_general_producer(_user)
     OR EXISTS (
        SELECT 1 FROM public.profile_positions pp
        JOIN public.positions po ON po.id = pp.position_id
        WHERE pp.profile_id = _user
          AND po.name IN ('Producteur général','Producteur délégué','Réalisateur','Scénariste','Régisseur général')
     )
     OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = _project AND (p.created_by = _user OR p.owner_profile_id = _user)
     )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project_budget(_user uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_edit_internal_project(_user, _project)
      OR public.has_position(_user, 'Comptable / Trésorier')
$$;

CREATE OR REPLACE FUNCTION public.can_approve_project(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_general_producer(_user)
      OR public.has_position(_user, 'Producteur délégué')
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_internal_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_project_budget(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_project(uuid) TO authenticated;

CREATE POLICY "budget lines readable" ON public.project_budget_lines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "budget lines writable" ON public.project_budget_lines
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_project_budget(auth.uid(), project_id));
CREATE POLICY "budget lines updatable" ON public.project_budget_lines
  FOR UPDATE TO authenticated USING (public.can_edit_project_budget(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_budget(auth.uid(), project_id));
CREATE POLICY "budget lines deletable" ON public.project_budget_lines
  FOR DELETE TO authenticated USING (public.can_edit_project_budget(auth.uid(), project_id));

CREATE POLICY "project edits readable" ON public.project_edits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "project edits proposable" ON public.project_edits
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_edit_internal_project(auth.uid(), project_id));
CREATE POLICY "project edits decidable" ON public.project_edits
  FOR UPDATE TO authenticated USING (public.can_approve_project(auth.uid()))
  WITH CHECK (public.can_approve_project(auth.uid()));

CREATE TRIGGER trg_change_log_budget AFTER INSERT OR UPDATE OR DELETE ON public.project_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();
CREATE TRIGGER trg_change_log_edits AFTER INSERT OR UPDATE OR DELETE ON public.project_edits
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();
CREATE TRIGGER trg_budget_updated BEFORE UPDATE ON public.project_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications : modification en attente d'approbation, puis décision.
CREATE OR REPLACE FUNCTION public.notify_project_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ptitle text;
BEGIN
  SELECT title INTO ptitle FROM public.projects WHERE id = NEW.project_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT pp.profile_id,
           'Modification à approuver',
           coalesce(ptitle,'Projet') || ' — ' || coalesce(nullif(NEW.field_label,''), NEW.field) || ' en attente d''approbation',
           '/idees'
    FROM public.profile_positions pp
    JOIN public.positions po ON po.id = pp.position_id
    WHERE po.name IN ('Producteur général','Producteur délégué');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.author_id,
      CASE WHEN NEW.status = 'approved' THEN 'Modification approuvée' ELSE 'Modification refusée' END,
      coalesce(ptitle,'Projet') || ' — ' || coalesce(nullif(NEW.field_label,''), NEW.field)
        || CASE WHEN NEW.decision_comment <> '' THEN ' : ' || NEW.decision_comment ELSE '' END,
      '/idees');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_project_edit AFTER INSERT OR UPDATE ON public.project_edits
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_edit();

-- Notification à chaque changement de phase : membres, mentors et bailleurs.
CREATE OR REPLACE FUNCTION public.notify_project_phase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pname text;
BEGIN
  IF NEW.phase_id IS DISTINCT FROM OLD.phase_id THEN
    SELECT name INTO pname FROM public.project_phases WHERE id = NEW.phase_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT p.id, 'Phase du projet mise à jour',
           NEW.title || ' est maintenant en phase : ' || coalesce(pname, '—'),
           '/idees'
    FROM public.profiles p WHERE p.active IS NOT FALSE;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_project_phase AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_phase();

-- Projet interne créé automatiquement à la clôture d'un vote.
CREATE OR REPLACE FUNCTION public.create_project_from_vote(_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  top_code text; top_votes bigint; second_votes bigint;
  vp record; stitle text; pid uuid; first_phase uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.projects WHERE vote_session_id = _session) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deja_cree');
  END IF;
  SELECT title INTO stitle FROM public.vote_sessions WHERE id = _session;

  SELECT project_code, cnt INTO top_code, top_votes
  FROM (SELECT project_code, count(*) cnt FROM public.vote_tallies WHERE session_id = _session GROUP BY project_code) t
  ORDER BY cnt DESC LIMIT 1;

  IF top_code IS NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT pp.profile_id, 'Vote sans gagnant',
           'Le vote « ' || coalesce(stitle,'') || ' » ne désigne aucun projet gagnant.', '/vote'
    FROM public.profile_positions pp JOIN public.positions po ON po.id = pp.position_id
    WHERE po.name = 'Producteur général';
    RETURN jsonb_build_object('ok', false, 'reason', 'aucun_gagnant');
  END IF;

  SELECT cnt INTO second_votes
  FROM (SELECT project_code, count(*) cnt FROM public.vote_tallies WHERE session_id = _session GROUP BY project_code) t
  WHERE project_code <> top_code ORDER BY cnt DESC LIMIT 1;

  IF second_votes IS NOT NULL AND second_votes = top_votes THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT pp.profile_id, 'Égalité au vote',
           'Le vote « ' || coalesce(stitle,'') || ' » se termine à égalité : aucun projet interne créé.', '/vote'
    FROM public.profile_positions pp JOIN public.positions po ON po.id = pp.position_id
    WHERE po.name = 'Producteur général';
    RETURN jsonb_build_object('ok', false, 'reason', 'egalite');
  END IF;

  SELECT * INTO vp FROM public.vote_projects WHERE session_id = _session AND code = top_code LIMIT 1;
  SELECT id INTO first_phase FROM public.project_phases WHERE active ORDER BY sort_order LIMIT 1;

  INSERT INTO public.projects (title, description, logline, status, state, phase_id, vote_session_id)
  VALUES (coalesce(nullif(vp.title,''), 'Projet ' || top_code),
          coalesce(vp.description,''), coalesce(vp.description,''),
          'Projet approuvé', 'En cours', first_phase, _session)
  RETURNING id INTO pid;

  INSERT INTO public.ideas (submitter_name, submitter_email, description, project_title,
                            presentation, logline, origin, project_id, status)
  VALUES ('Vote du club', '', coalesce(vp.description,''), coalesce(nullif(vp.title,''), 'Projet ' || top_code),
          'Projet retenu par le vote « ' || coalesce(stitle,'') || ' »', coalesce(vp.description,''),
          'interne', pid, 'Projet approuvé');

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.id, 'Nouveau projet interne',
         coalesce(nullif(vp.title,''), 'Projet ' || top_code) || ' est retenu par le vote et rejoint les projets du club.',
         '/idees'
  FROM public.profiles p WHERE p.active IS NOT FALSE;

  RETURN jsonb_build_object('ok', true, 'project_id', pid, 'code', top_code);
END $$;

GRANT EXECUTE ON FUNCTION public.create_project_from_vote(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_vote_closed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
    PERFORM public.create_project_from_vote(NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vote_closed AFTER UPDATE ON public.vote_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_vote_closed();