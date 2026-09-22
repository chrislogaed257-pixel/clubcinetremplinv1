-- 1. Journal des envois d'e-mails
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  section text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'en_attente',
  error text NOT NULL DEFAULT '',
  entity_id uuid,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log lecture producteur general" ON public.email_log
  FOR SELECT TO authenticated USING (public.is_admin_or_general_producer(auth.uid()));
CREATE POLICY "email_log ecriture membres" ON public.email_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "email_log mise a jour producteur general" ON public.email_log
  FOR UPDATE TO authenticated USING (public.is_admin_or_general_producer(auth.uid()));

-- 2. Etat "deja vu" propre a chaque personne
CREATE TABLE IF NOT EXISTS public.user_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section text NOT NULL,
  item_id text NOT NULL DEFAULT '',
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, section, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_seen TO authenticated;
GRANT ALL ON public.user_seen TO service_role;
ALTER TABLE public.user_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_seen lecture personnelle" ON public.user_seen
  FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "user_seen ecriture personnelle" ON public.user_seen
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "user_seen mise a jour personnelle" ON public.user_seen
  FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "user_seen suppression personnelle" ON public.user_seen
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- 3. Colonnes additives sur projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'interne';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'approuve';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deadline_note text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS author_profile_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS author_name text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS author_email text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS author_position text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS intention_note text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS directing_note text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logline_link text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS intention_link text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS directing_link text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS refusal_reason text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);

-- 4. Liens Google et corbeille sur ideas
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS presentation_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS logline_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS synopsis_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS intention_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS directing_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS script_link text NOT NULL DEFAULT '';
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS author_profile_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);

-- 5. Corbeille sur les autres contenus creables
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.project_budget_lines ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_budget_lines ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.call_sheets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.call_sheets ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);

-- 6. Comite d'etude des projets
CREATE OR REPLACE FUNCTION public.is_project_reviewer(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_general_producer(_user)
      OR public.has_position(_user, 'Producteur délégué')
      OR public.has_position(_user, 'Réalisateur')
      OR public.has_position(_user, 'Scénariste');
$$;

CREATE TABLE IF NOT EXISTS public.project_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  decision text NOT NULL DEFAULT 'a_revoir',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, reviewer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.project_reviews TO authenticated;
GRANT ALL ON public.project_reviews TO service_role;
ALTER TABLE public.project_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avis lecture comite" ON public.project_reviews
  FOR SELECT TO authenticated USING (public.is_project_reviewer(auth.uid()));
CREATE POLICY "avis ecriture comite" ON public.project_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_reviewer(auth.uid()) AND reviewer_id = auth.uid());
CREATE POLICY "avis mise a jour comite" ON public.project_reviews
  FOR UPDATE TO authenticated
  USING (public.is_project_reviewer(auth.uid()) AND reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- 7. Budget previsionnel : postes autorises elargis
CREATE OR REPLACE FUNCTION public.can_edit_budget_extended(_user uuid, _project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_edit_project_budget(_user, _project)
      OR public.has_position(_user, 'Accessoiriste')
      OR public.has_position(_user, 'Régisseur général')
      OR public.has_position(_user, 'Directeur artistique / Chef décorateur')
      OR public.has_position(_user, 'Chef opérateur (Directeur de la photographie)')
      OR public.has_position(_user, 'Réalisateur')
      OR public.has_position(_user, 'Scénariste')
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = _project
          AND (p.created_by = _user OR p.owner_profile_id = _user OR p.author_profile_id = _user)
      );
$$;
CREATE POLICY "budget previsionnel lecture club" ON public.project_budget_lines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "budget previsionnel ecriture elargie" ON public.project_budget_lines
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_budget_extended(auth.uid(), project_id));
CREATE POLICY "budget previsionnel modification elargie" ON public.project_budget_lines
  FOR UPDATE TO authenticated USING (public.can_edit_budget_extended(auth.uid(), project_id));
CREATE POLICY "budget previsionnel retrait elargi" ON public.project_budget_lines
  FOR DELETE TO authenticated USING (public.can_edit_budget_extended(auth.uid(), project_id));

-- 8. Suppression reversible : chaque createur peut retirer ce qu'il a cree
CREATE POLICY "projets corbeille createur" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_general_producer(auth.uid())
    OR created_by = auth.uid() OR owner_profile_id = auth.uid() OR author_profile_id = auth.uid()
  );
CREATE POLICY "idees corbeille createur" ON public.ideas
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR author_profile_id = auth.uid());
CREATE POLICY "messages corbeille auteur" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "ressources corbeille auteur" ON public.resources
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "depenses corbeille auteur" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "festivals corbeille auteur" ON public.festivals
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "feuilles corbeille auteur" ON public.call_sheets
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "contrats corbeille auteur" ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()) OR created_by = auth.uid());

-- 9. Journal automatique des nouveautes
CREATE TRIGGER project_reviews_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.project_reviews
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();
CREATE TRIGGER email_log_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.email_log
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();