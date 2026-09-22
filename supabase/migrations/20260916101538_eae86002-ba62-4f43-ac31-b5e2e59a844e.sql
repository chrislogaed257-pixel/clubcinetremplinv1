-- Passage automatique en projet approuvé
CREATE OR REPLACE FUNCTION public.handle_idea_votes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok int; new_project uuid; idea_row public.ideas%ROWTYPE;
BEGIN
  SELECT count(DISTINCT voter_position) INTO ok
  FROM public.idea_votes
  WHERE idea_id = NEW.idea_id AND decision = 'approved'
    AND voter_position IN ('Producteur général','Producteur délégué','Scénariste');

  IF ok >= 3 THEN
    SELECT * INTO idea_row FROM public.ideas WHERE id = NEW.idea_id;
    IF idea_row.status <> 'Projet approuvé' THEN
      UPDATE public.ideas SET status = 'Projet approuvé' WHERE id = NEW.idea_id;
      IF NOT EXISTS (SELECT 1 FROM public.projects WHERE idea_id = NEW.idea_id) THEN
        INSERT INTO public.projects (title, description, idea_id)
        VALUES (
          left(coalesce(idea_row.submitter_name,'Projet') || ' — ' || coalesce(idea_row.description,''), 120),
          coalesce(idea_row.description,''),
          NEW.idea_id
        ) RETURNING id INTO new_project;
        INSERT INTO public.conversations (kind, title, ref_id)
        VALUES ('project', 'Projet : ' || coalesce(idea_row.submitter_name,'sans titre'), new_project)
        ON CONFLICT (kind, ref_id) DO NOTHING;
      END IF;
    END IF;
  ELSIF (SELECT count(*) FROM public.idea_votes WHERE idea_id = NEW.idea_id AND decision = 'rejected') > 0 THEN
    UPDATE public.ideas SET status = 'Refusée' WHERE id = NEW.idea_id AND status <> 'Projet approuvé';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_idea_votes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_idea_votes AFTER INSERT OR UPDATE ON public.idea_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_idea_votes();

-- Discussion + alertes pour une demande de congé
CREATE OR REPLACE FUNCTION public.handle_new_leave()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE requester_name text;
BEGIN
  INSERT INTO public.conversations (kind, title, ref_id)
  VALUES ('leave', 'Congé', NEW.id) ON CONFLICT (kind, ref_id) DO NOTHING;

  SELECT full_name INTO requester_name FROM public.profiles WHERE id = NEW.requester_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT t.id,
         'Nouvelle demande de congé',
         coalesce(requester_name,'Un membre') || ' demande un congé du ' ||
           to_char(NEW.start_date,'DD/MM/YYYY') || ' au ' || to_char(NEW.return_date,'DD/MM/YYYY'),
         '/conges'
  FROM (
    SELECT ur.user_id AS id FROM public.user_roles ur WHERE ur.role = 'admin'
    UNION
    SELECT pp.profile_id FROM public.profile_positions pp
      JOIN public.positions po ON po.id = pp.position_id
      WHERE po.name IN ('Producteur général','Producteur délégué')
    UNION
    SELECT pm.manager_id FROM public.profile_managers pm WHERE pm.profile_id = NEW.requester_id
  ) t
  JOIN public.profiles p ON p.id = t.id
  WHERE t.id <> NEW.requester_id;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_leave() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_new_leave AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_leave();