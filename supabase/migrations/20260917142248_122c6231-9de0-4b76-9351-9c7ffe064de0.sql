
-- 1. Attribution de tâches par un responsable
CREATE POLICY "supervisors assign tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.is_descendant(auth.uid(), owner_id)));
CREATE POLICY "assigner updates task" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (assigned_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 2. Lien Drive dans les réponses aux rapports
ALTER TABLE public.report_comments ADD COLUMN IF NOT EXISTS link text;

-- 3. Participants des conversations privées
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_participant(_user_id uuid, _conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants cp
                 WHERE cp.conversation_id = _conv AND cp.profile_id = _user_id)
$$;

CREATE POLICY "see my participations" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_participant(auth.uid(), conversation_id)
      OR public.has_role(auth.uid(),'admin')
      OR public.has_position(auth.uid(),'Producteur général'));
CREATE POLICY "add participants to my conversations" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (public.is_participant(auth.uid(), conversation_id) OR profile_id = auth.uid()
      OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "leave conversation" ON public.conversation_participants FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Les membres peuvent créer une conversation privée
CREATE POLICY "create direct conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (kind = 'direct');

CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id uuid, _conv uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k text; r uuid;
BEGIN
  SELECT kind, ref_id INTO k, r FROM public.conversations WHERE id = _conv;
  IF k IS NULL THEN RETURN false; END IF;
  IF k = 'direct' THEN
    RETURN public.is_participant(_user_id, _conv)
        OR public.has_role(_user_id,'admin')
        OR public.has_position(_user_id,'Producteur général');
  END IF;
  IF public.is_supervisor(_user_id) OR public.has_position(_user_id,'Producteur général') THEN RETURN true; END IF;
  IF k = 'general' THEN
    RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id);
  ELSIF k = 'team' THEN
    RETURN public.in_team(_user_id, r);
  ELSIF k = 'category' THEN
    RETURN EXISTS (SELECT 1 FROM public.profile_positions pp JOIN public.positions po ON po.id = pp.position_id
                   WHERE pp.profile_id = _user_id AND po.category_id = r);
  ELSIF k = 'project' THEN
    RETURN public.can_see_ideas(_user_id);
  ELSIF k = 'leave' THEN
    RETURN EXISTS (SELECT 1 FROM public.leave_requests l WHERE l.id = r
                   AND public.is_leave_validator(_user_id, l.requester_id));
  ELSIF k = 'funder' THEN
    RETURN EXISTS (SELECT 1 FROM public.funders f WHERE f.id = r AND f.user_id = _user_id);
  ELSIF k = 'mentor' THEN
    RETURN r = _user_id;
  END IF;
  RETURN false;
END; $function$;

-- 4. Messages non lus
CREATE TABLE public.conversation_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_reads TO authenticated;
GRANT ALL ON public.conversation_reads TO service_role;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads" ON public.conversation_reads FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "own reads insert" ON public.conversation_reads FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "own reads update" ON public.conversation_reads FOR UPDATE TO authenticated USING (profile_id = auth.uid());

-- 5. Alertes automatiques
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE giver text;
BEGIN
  IF NEW.assigned_by IS NOT NULL AND NEW.assigned_by <> NEW.owner_id THEN
    SELECT full_name INTO giver FROM public.profiles WHERE id = NEW.assigned_by;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.owner_id, 'Nouvelle tâche reçue',
            coalesce(giver,'Un responsable') || ' vous a confié : ' || NEW.title, '/taches');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_task_assigned AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.notify_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE author text;
BEGIN
  IF NEW.recipient_id IS NOT NULL AND NEW.recipient_id <> NEW.author_id THEN
    SELECT full_name INTO author FROM public.profiles WHERE id = NEW.author_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.recipient_id, 'Nouveau rapport reçu',
            coalesce(author,'Un membre') || ' : ' || NEW.title, '/rapports');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_report_created AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report();

CREATE OR REPLACE FUNCTION public.notify_report_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reports%ROWTYPE; who text;
BEGIN
  SELECT * INTO r FROM public.reports WHERE id = NEW.report_id;
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.author_id;
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT t.id, 'Réponse à un rapport',
         coalesce(who,'Un membre') || ' a répondu au rapport « ' || r.title || ' »', '/rapports'
  FROM (SELECT r.author_id AS id UNION SELECT r.recipient_id) t
  WHERE t.id IS NOT NULL AND t.id <> NEW.author_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_report_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_report_comment AFTER INSERT ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_comment();

CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; who text;
BEGIN
  SELECT kind INTO k FROM public.conversations WHERE id = NEW.conversation_id;
  IF k <> 'direct' THEN RETURN NEW; END IF;
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.author_id;
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT cp.profile_id, 'Nouveau message', coalesce(who,'Un membre') || ' vous a écrit.', '/messagerie'
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id AND cp.profile_id <> NEW.author_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_direct_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_direct_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();