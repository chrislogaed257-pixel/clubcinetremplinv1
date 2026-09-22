ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.profile_position_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_name text NOT NULL,
  rank_label text NOT NULL DEFAULT '',
  started_on date NOT NULL DEFAULT current_date,
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_position_history TO authenticated;
GRANT ALL ON public.profile_position_history TO service_role;
ALTER TABLE public.profile_position_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position history readable" ON public.profile_position_history
FOR SELECT TO authenticated USING (true);

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'reassign';

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