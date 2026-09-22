CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "general producer reads audit" ON public.audit_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général'));

CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text; eid uuid;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' AND NEW.active IS DISTINCT FROM OLD.active THEN
      d := CASE WHEN NEW.active THEN 'Compte réactivé : ' ELSE 'Compte désactivé : ' END || NEW.full_name;
    ELSIF TG_OP = 'INSERT' THEN
      d := 'Compte créé : ' || NEW.full_name;
    ELSE
      RETURN NEW;
    END IF;
    eid := NEW.id;
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    d := 'Rôle ' || COALESCE(NEW.role, OLD.role)::text || ' ' || CASE WHEN TG_OP='DELETE' THEN 'retiré' ELSE 'attribué' END;
    eid := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'profile_positions' THEN
    d := CASE WHEN TG_OP='DELETE' THEN 'Poste retiré' ELSE 'Poste attribué' END;
    eid := COALESCE(NEW.profile_id, OLD.profile_id);
  ELSIF TG_TABLE_NAME = 'profile_managers' THEN
    d := CASE WHEN TG_OP='DELETE' THEN 'Supérieur retiré' ELSE 'Supérieur ajouté' END;
    eid := COALESCE(NEW.profile_id, OLD.profile_id);
  ELSIF TG_TABLE_NAME = 'idea_votes' THEN
    d := 'Avis sur une idée : ' || NEW.decision;
    eid := NEW.idea_id;
  ELSIF TG_TABLE_NAME = 'leave_decisions' THEN
    d := 'Décision de congé : ' || NEW.decision;
    eid := NEW.leave_id;
  ELSIF TG_TABLE_NAME = 'casting_applications' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      d := 'Candidature casting : ' || NEW.status;
      eid := NEW.id;
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'vote_sessions' THEN
    IF TG_OP = 'INSERT' THEN d := 'Session de vote créée : ' || NEW.title;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN d := 'Session de vote ' || NEW.status || ' : ' || NEW.title;
    ELSE RETURN NEW; END IF;
    eid := NEW.id;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'UPDATE' AND (NEW.phase_id IS DISTINCT FROM OLD.phase_id OR NEW.state IS DISTINCT FROM OLD.state) THEN
      d := 'Projet « ' || NEW.title || ' » — état : ' || COALESCE(NEW.state,'');
      eid := NEW.id;
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'app_settings' THEN
    d := 'Réglage modifié : ' || COALESCE(NEW.key, OLD.key);
    eid := NULL;
  ELSIF TG_TABLE_NAME = 'project_phases' THEN
    d := 'Phases du projet modifiées';
    eid := NULL;
  ELSIF TG_TABLE_NAME = 'positions' THEN
    d := 'Liste des postes modifiée';
    eid := NULL;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, detail)
  SELECT auth.uid(), TG_OP, TG_TABLE_NAME, eid, d
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()) OR auth.uid() IS NULL;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.write_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_profile_positions ON public.profile_positions;
CREATE TRIGGER trg_audit_profile_positions AFTER INSERT OR DELETE ON public.profile_positions FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_profile_managers ON public.profile_managers;
CREATE TRIGGER trg_audit_profile_managers AFTER INSERT OR DELETE ON public.profile_managers FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_idea_votes ON public.idea_votes;
CREATE TRIGGER trg_audit_idea_votes AFTER INSERT ON public.idea_votes FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_leave_decisions ON public.leave_decisions;
CREATE TRIGGER trg_audit_leave_decisions AFTER INSERT ON public.leave_decisions FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_casting_applications ON public.casting_applications;
CREATE TRIGGER trg_audit_casting_applications AFTER UPDATE ON public.casting_applications FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_vote_sessions ON public.vote_sessions;
CREATE TRIGGER trg_audit_vote_sessions AFTER INSERT OR UPDATE ON public.vote_sessions FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_app_settings ON public.app_settings;
CREATE TRIGGER trg_audit_app_settings AFTER INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_project_phases ON public.project_phases;
CREATE TRIGGER trg_audit_project_phases AFTER INSERT OR UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_positions ON public.positions;
CREATE TRIGGER trg_audit_positions AFTER INSERT OR UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.write_audit();

INSERT INTO public.app_settings (key, value) VALUES ('decision_delay_days','3'), ('reminder_hours','24')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.send_pending_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE delay_days int; lead_hours int; n int := 0;
BEGIN
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key='decision_delay_days'),3) INTO delay_days;
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key='reminder_hours'),24) INTO lead_hours;

  WITH pending AS (
    SELECT i.id, i.submitter_name, i.created_at
    FROM public.ideas i
    WHERE i.status NOT IN ('Projet approuvé','Refusée')
      AND now() >= i.created_at + make_interval(days => delay_days) - make_interval(hours => lead_hours)
      AND now() < i.created_at + make_interval(days => delay_days)
  ), deciders AS (
    SELECT DISTINCT pp.profile_id AS uid FROM public.profile_positions pp
    JOIN public.positions po ON po.id = pp.position_id
    WHERE po.name IN ('Producteur général','Producteur délégué','Scénariste')
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT d.uid, 'Décision attendue', 'Une idée attend votre avis avant la fin du délai.', '/idees'
    FROM pending p CROSS JOIN deciders d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = d.uid AND n.title = 'Décision attendue'
        AND n.created_at > now() - make_interval(hours => lead_hours)
    )
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;

  WITH pending AS (
    SELECT l.id, l.requester_id, l.start_date FROM public.leave_requests l
    WHERE l.status = 'pending'
      AND now() >= (l.start_date::timestamptz - make_interval(hours => lead_hours))
      AND now() < l.start_date::timestamptz
  ), targets AS (
    SELECT DISTINCT p.id AS uid, l.id AS leave_id
    FROM pending l
    JOIN public.profiles p ON public.is_leave_validator(p.id, l.requester_id)
  )
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT t.uid, 'Congé en attente', 'Une demande de congé attend votre décision.', '/conges'
  FROM targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = t.uid AND n.title = 'Congé en attente'
      AND n.created_at > now() - make_interval(hours => lead_hours)
  );
  RETURN n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.send_pending_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_pending_reminders() TO authenticated, service_role;