CREATE OR REPLACE FUNCTION public.handle_team_member_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE leader uuid; who text; team_name text;
BEGIN
  SELECT t.leader_id, t.name INTO leader, team_name FROM public.teams t WHERE t.id = OLD.team_id;
  UPDATE public.tasks SET status = 'reassign'::task_status
  WHERE owner_id = OLD.profile_id AND status <> 'done'::task_status;
  SELECT full_name INTO who FROM public.profiles WHERE id = OLD.profile_id;
  IF leader IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (leader, 'Tâches à réattribuer',
            coalesce(who,'Un membre') || ' a quitté l''équipe ' || coalesce(team_name,'') ||
            '. Ses tâches en cours sont à réattribuer.', '/taches');
  END IF;
  RETURN OLD;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_team_member_removed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_team_member_removed ON public.team_members;
CREATE TRIGGER trg_team_member_removed AFTER DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.handle_team_member_removed();