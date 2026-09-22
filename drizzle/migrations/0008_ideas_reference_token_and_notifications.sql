-- Chantier 2 & 3 : dossiers d'idées
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS response_drive_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS reference text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS public_token text;

UPDATE public.ideas SET public_token = replace(gen_random_uuid()::text,'-','') WHERE public_token IS NULL;
ALTER TABLE public.ideas ALTER COLUMN public_token SET DEFAULT replace(gen_random_uuid()::text,'-','');
CREATE UNIQUE INDEX IF NOT EXISTS ideas_public_token_key ON public.ideas(public_token);

-- Numéro de dossier CT-AAAA-NNN attribué à l'insertion.
CREATE OR REPLACE FUNCTION public.set_idea_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y text; n int;
BEGIN
  IF coalesce(NEW.reference,'') <> '' THEN RETURN NEW; END IF;
  y := to_char(coalesce(NEW.created_at, now()), 'YYYY');
  SELECT count(*) + 1 INTO n FROM public.ideas
   WHERE to_char(created_at,'YYYY') = y;
  NEW.reference := 'CT-' || y || '-' || lpad(n::text, 3, '0');
  IF coalesce(NEW.public_token,'') = '' THEN
    NEW.public_token := replace(gen_random_uuid()::text,'-','');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_idea_reference ON public.ideas;
CREATE TRIGGER trg_set_idea_reference BEFORE INSERT ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_idea_reference();

UPDATE public.ideas i SET reference = 'CT-' || to_char(i.created_at,'YYYY') || '-' || lpad(r.rn::text,3,'0')
FROM (SELECT id, row_number() OVER (PARTITION BY to_char(created_at,'YYYY') ORDER BY created_at) rn FROM public.ideas) r
WHERE r.id = i.id AND i.reference = '';

-- Suivi public en lecture seule, sans compte.
CREATE OR REPLACE FUNCTION public.idea_public_status(_token text)
RETURNS TABLE(reference text, project_title text, submitter_name text, status text,
              responded boolean, created_at timestamptz, votes_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.reference, i.project_title, i.submitter_name, i.status, i.responded, i.created_at,
         (SELECT count(*) FROM public.idea_votes v WHERE v.idea_id = i.id)
  FROM public.ideas i
  WHERE i.public_token = _token AND coalesce(_token,'') <> '';
$$;
GRANT EXECUTE ON FUNCTION public.idea_public_status(text) TO anon, authenticated;

-- Chantier 8 : notifications pour toutes les discussions (hors direct, déjà couvert)
CREATE OR REPLACE FUNCTION public.notify_conversation_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; title_txt text; who text;
BEGIN
  SELECT kind, title INTO k, title_txt FROM public.conversations WHERE id = NEW.conversation_id;
  IF k IS NULL OR k = 'direct' THEN RETURN NEW; END IF;
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.author_id;
  INSERT INTO public.notifications(user_id, title, body, link)
  SELECT p.id,
         'Nouveau message : ' || coalesce(title_txt,'discussion'),
         coalesce(who,'Un membre') || ' a écrit dans « ' || coalesce(title_txt,'discussion') || ' ».',
         '/discussion'
  FROM public.profiles p
  WHERE p.active AND p.id <> NEW.author_id
    AND public.can_access_conversation(p.id, NEW.conversation_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_conversation_message ON public.messages;
CREATE TRIGGER trg_conversation_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_message();

-- Mots de passe oubliés : les deux sens.
CREATE OR REPLACE FUNCTION public.notify_password_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.password_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.password_requests WHERE id = NEW.request_id;
  IF r.id IS NULL THEN RETURN NEW; END IF;
  IF NEW.from_member THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT p.id, 'Demande de mot de passe',
           r.requester_email || ' a écrit au sujet de son accès.', '/mot-de-passe'
    FROM public.profiles p
    WHERE p.active AND (
      public.has_role(p.id,'admin')
      OR public.has_position(p.id,'Producteur général')
      OR public.has_position(p.id,'Producteur délégué')
    );
  ELSE
    IF r.requester_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, link)
      VALUES (r.requester_id, 'Réponse à votre demande de mot de passe',
              'Un responsable vous a répondu.', '/mot-de-passe');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_password_message ON public.password_messages;
CREATE TRIGGER trg_password_message AFTER INSERT ON public.password_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_password_message();

-- Mentors : message du mentor et réponse du club.
CREATE OR REPLACE FUNCTION public.notify_mentor_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.mentor_invites%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.mentor_invites WHERE id = NEW.invite_id;
  IF NEW.from_mentor THEN
    INSERT INTO public.notifications(user_id, title, body, link)
    SELECT p.id, 'Message d''un mentor',
           coalesce(inv.full_name,'Un mentor') || ' a écrit au club.', '/mentors'
    FROM public.profiles p
    WHERE p.active AND (
      public.has_role(p.id,'admin')
      OR public.has_position(p.id,'Producteur général')
      OR public.has_position(p.id,'Producteur délégué')
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_mentor_message ON public.mentor_messages;
CREATE TRIGGER trg_mentor_message AFTER INSERT ON public.mentor_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_message();

-- Chantier 9 : configuration du comité, identité visuelle et rubriques du menu
CREATE TABLE IF NOT EXISTS public.role_config (
  key text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  positions text[] NOT NULL DEFAULT '{}',
  threshold integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.role_config TO authenticated, anon;
GRANT ALL ON public.role_config TO service_role;
ALTER TABLE public.role_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role config readable" ON public.role_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "general producer edits role config" ON public.role_config FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE TABLE IF NOT EXISTS public.menu_config (
  route text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_config TO authenticated;
GRANT ALL ON public.menu_config TO service_role;
ALTER TABLE public.menu_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu config readable" ON public.menu_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "general producer edits menu config" ON public.menu_config FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

DROP TRIGGER IF EXISTS trg_audit_role_config ON public.role_config;
CREATE TRIGGER trg_audit_role_config AFTER INSERT OR UPDATE ON public.role_config
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();
DROP TRIGGER IF EXISTS trg_audit_menu_config ON public.menu_config;
CREATE TRIGGER trg_audit_menu_config AFTER INSERT OR UPDATE ON public.menu_config
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();