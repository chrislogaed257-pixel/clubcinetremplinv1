ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.project_phases(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'En cours';

CREATE OR REPLACE FUNCTION public.can_advance_project(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_supervisor(_user_id)
      OR public.has_position(_user_id,'Producteur général')
      OR public.has_position(_user_id,'Directeur de production')
$$;
REVOKE EXECUTE ON FUNCTION public.can_advance_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_advance_project(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_phase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_phase_id uuid REFERENCES public.project_phases(id),
  to_phase_id uuid REFERENCES public.project_phases(id),
  from_state text NOT NULL DEFAULT '',
  to_state text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_phase_history TO authenticated;
GRANT ALL ON public.project_phase_history TO service_role;
ALTER TABLE public.project_phase_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phase history readable" ON public.project_phase_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id));

CREATE POLICY "producers advance projects" ON public.projects FOR UPDATE TO authenticated
USING (public.can_advance_project(auth.uid()))
WITH CHECK (public.can_advance_project(auth.uid()));

CREATE POLICY "producers manage phases" ON public.project_phases FOR ALL TO authenticated
USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));

CREATE OR REPLACE FUNCTION public.guard_project_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NEW.state IN ('Terminé','Abandonné')
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général')) THEN
    RAISE EXCEPTION 'Seul le Producteur général peut terminer ou abandonner un projet.';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_project_state() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_project_state ON public.projects;
CREATE TRIGGER trg_guard_project_state BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_state();

CREATE OR REPLACE FUNCTION public.log_project_phase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text; pname text;
BEGIN
  IF NEW.phase_id IS NOT DISTINCT FROM OLD.phase_id AND NEW.state IS NOT DISTINCT FROM OLD.state THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.project_phase_history (project_id, from_phase_id, to_phase_id, from_state, to_state, changed_by)
  VALUES (NEW.id, OLD.phase_id, NEW.phase_id, coalesce(OLD.state,''), coalesce(NEW.state,''), auth.uid());

  SELECT name INTO pname FROM public.project_phases WHERE id = NEW.phase_id;
  msg := 'Projet « ' || NEW.title || ' » : ' ||
         coalesce('phase ' || pname, 'phase non définie') || ' · état ' || NEW.state;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT pm.profile_id, 'Avancement du projet', msg, '/dashboard'
  FROM public.project_members pm
  JOIN public.profiles pr ON pr.id = pm.profile_id
  WHERE pm.project_id = NEW.id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_project_phase() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_log_project_phase ON public.projects;
CREATE TRIGGER trg_log_project_phase AFTER UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_phase();