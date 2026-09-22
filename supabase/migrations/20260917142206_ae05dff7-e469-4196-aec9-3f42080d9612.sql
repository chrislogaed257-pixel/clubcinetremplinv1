
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'member',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read project members" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "self or supervisors write" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général') OR profile_id = auth.uid());
CREATE POLICY "self or supervisors update" ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général') OR profile_id = auth.uid());
CREATE POLICY "supervisors delete" ON public.project_members FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));

CREATE TABLE public.message_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read templates" ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "producers update templates" ON public.message_templates FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.message_templates (key, label, subject, body) VALUES
 ('welcome','Email de bienvenue d''un nouveau membre','Bienvenue dans Ciné Tremplin',
  E'Bonjour {{nom}},\n\nBienvenue dans Ciné Tremplin ! Nous sommes heureux de t''accueillir au poste de {{poste}}.\n\nVoici tes identifiants de connexion :\nEmail : {{email}}\nMot de passe provisoire : {{mot_de_passe}}\n\nAccès à l''application : {{lien}}\n\nOn apprend, on tourne, on décolle.\nL''équipe du Club Ciné Tremplin'),
 ('new_member_manager','Alerte aux supérieurs d''un nouveau membre','Un nouveau membre rejoint votre équipe',
  E'Bonjour {{nom_superieur}},\n\n{{nom}} rejoint votre équipe au poste de {{poste}}.\n\nL''équipe du Club Ciné Tremplin'),
 ('idea_approved','Réponse à une idée approuvée','Votre idée a été retenue',
  E'Bonjour {{nom}},\n\nQuelle bonne nouvelle : votre idée a été retenue par le comité du Club Ciné Tremplin. Nous revenons vers vous très vite pour la suite.\n\nMerci pour votre confiance,\nL''équipe du Club Ciné Tremplin'),
 ('idea_rejected','Réponse à une idée non retenue','Votre idée n''a pas été retenue cette fois',
  E'Bonjour {{nom}},\n\nMerci beaucoup pour votre idée. Après lecture attentive, elle n''a pas été retenue cette fois-ci, mais nous vous encourageons vivement à nous en proposer d''autres.\n\nAvec toute notre reconnaissance,\nL''équipe du Club Ciné Tremplin'),
 ('password_reply','Réponse à une demande de mot de passe','Votre accès au Club Ciné Tremplin',
  E'Bonjour {{nom}},\n\nVoici de quoi retrouver votre accès à l''application.\n\nÀ très vite,\n{{nom_producteur}}');

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général'));
CREATE POLICY "admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général'));
INSERT INTO public.app_settings (key, value) VALUES ('confirmation_sound','on');

CREATE TABLE public.password_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email text NOT NULL,
  requester_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_position text NOT NULL,
  status text NOT NULL DEFAULT 'ouverte',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.password_requests TO authenticated;
GRANT ALL ON public.password_requests TO service_role;
ALTER TABLE public.password_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "producers read password requests" ON public.password_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général') OR public.has_position(auth.uid(),'Producteur délégué'));
CREATE POLICY "producers update password requests" ON public.password_requests FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général') OR public.has_position(auth.uid(),'Producteur délégué'));
CREATE TRIGGER trg_password_requests_updated BEFORE UPDATE ON public.password_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.password_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.password_requests(id) ON DELETE CASCADE,
  from_member boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.password_messages TO authenticated;
GRANT ALL ON public.password_messages TO service_role;
ALTER TABLE public.password_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read password messages" ON public.password_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.password_requests r WHERE r.id = request_id
    AND (r.requester_id = auth.uid() OR public.is_supervisor(auth.uid())
         OR public.has_position(auth.uid(),'Producteur général') OR public.has_position(auth.uid(),'Producteur délégué'))));
CREATE POLICY "write password messages" ON public.password_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.password_requests r WHERE r.id = request_id
    AND (r.requester_id = auth.uid() OR public.is_supervisor(auth.uid())
         OR public.has_position(auth.uid(),'Producteur général') OR public.has_position(auth.uid(),'Producteur délégué'))));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_description text NOT NULL DEFAULT '';