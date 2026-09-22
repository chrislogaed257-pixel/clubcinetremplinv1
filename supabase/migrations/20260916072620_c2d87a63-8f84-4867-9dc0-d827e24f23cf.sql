-- ============ PHASES DE PROJET ============
CREATE TABLE public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phases readable" ON public.project_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages phases" ON public.project_phases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.project_phases (name, sort_order) VALUES
 ('Organisation du projet',1),('Financement du projet',2),('Planification du projet',3),
 ('Écriture',4),('Développement',5),('Préparation de casting',6),('Casting',7),
 ('Réalisation (Tournage)',8),('Préparation artistique',9),('Communication et visibilité',10),
 ('Post-production',11),('Soumission du projet',12),('Diffusion',13),('Distribution',14),('Social',15);

-- ============ STATUTS DE PROJET ============
CREATE TABLE public.project_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  advanced boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_statuses TO authenticated;
GRANT ALL ON public.project_statuses TO service_role;
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statuses readable" ON public.project_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages statuses" ON public.project_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.project_statuses (name, sort_order, advanced) VALUES
 ('Écriture',1,false),('Développement',2,false),('Préparation',3,false),('Tournage',4,false),
 ('Post-production',5,true),('Prêt à diffuser',6,true);

-- ============ TÂCHES : nouveaux champs ============
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_duration text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drive_link text,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============ ÉQUIPES ============
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  leader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_position(_user_id,'Producteur délégué')
$$;
REVOKE ALL ON FUNCTION public.is_supervisor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.in_team(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.leader_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = _team_id AND m.profile_id = _user_id)
      OR public.is_supervisor(_user_id)
$$;
REVOKE ALL ON FUNCTION public.in_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_team(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "teams visible to members" ON public.teams FOR SELECT TO authenticated
  USING (public.in_team(auth.uid(), id));
CREATE POLICY "leader creates team" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (leader_id = auth.uid() OR public.is_supervisor(auth.uid()));
CREATE POLICY "leader updates team" ON public.teams FOR UPDATE TO authenticated
  USING (leader_id = auth.uid() OR public.is_supervisor(auth.uid()))
  WITH CHECK (leader_id = auth.uid() OR public.is_supervisor(auth.uid()));
CREATE POLICY "leader deletes team" ON public.teams FOR DELETE TO authenticated
  USING (leader_id = auth.uid() OR public.is_supervisor(auth.uid()));

CREATE POLICY "team members visible" ON public.team_members FOR SELECT TO authenticated
  USING (public.in_team(auth.uid(), team_id));
CREATE POLICY "leader manages team members" ON public.team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND (t.leader_id = auth.uid() OR public.is_supervisor(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND (t.leader_id = auth.uid() OR public.is_supervisor(auth.uid()))));

-- ============ IDÉES ============
CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_name text NOT NULL,
  submitter_email text NOT NULL,
  description text NOT NULL,
  file_url text,
  drive_link text,
  status text NOT NULL DEFAULT 'En attente de validation',
  responded boolean NOT NULL DEFAULT false,
  responded_at timestamptz,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_vote_ideas(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id,'admin')
      OR public.has_position(_user_id,'Producteur général')
      OR public.has_position(_user_id,'Producteur délégué')
      OR public.has_position(_user_id,'Scénariste')
$$;
CREATE OR REPLACE FUNCTION public.can_see_ideas(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_vote_ideas(_user_id) OR public.has_position(_user_id,'Directeur de production')
$$;
REVOKE ALL ON FUNCTION public.can_vote_ideas(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_ideas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_vote_ideas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_ideas(uuid) TO authenticated, service_role;

CREATE POLICY "ideas visible to committee" ON public.ideas FOR SELECT TO authenticated
  USING (public.can_see_ideas(auth.uid()));
CREATE POLICY "committee updates ideas" ON public.ideas FOR UPDATE TO authenticated
  USING (public.can_vote_ideas(auth.uid())) WITH CHECK (public.can_vote_ideas(auth.uid()));

CREATE TABLE public.idea_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voter_position text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment text NOT NULL CHECK (btrim(comment) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, voter_id, voter_position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_votes TO authenticated;
GRANT ALL ON public.idea_votes TO service_role;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes visible to committee" ON public.idea_votes FOR SELECT TO authenticated
  USING (public.can_see_ideas(auth.uid()));
CREATE POLICY "committee votes" ON public.idea_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid() AND public.can_vote_ideas(auth.uid()));
CREATE POLICY "committee updates own vote" ON public.idea_votes FOR UPDATE TO authenticated
  USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());

-- ============ PROJETS ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  idea_id uuid REFERENCES public.ideas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Écriture',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects visible" ON public.projects FOR SELECT TO authenticated
  USING (
    NOT public.has_role(auth.uid(),'mentor')
    OR EXISTS (SELECT 1 FROM public.project_statuses s WHERE s.name = projects.status AND s.advanced)
  );
CREATE POLICY "admin manages projects" ON public.projects FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

-- ============ CONGÉS ============
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  return_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_leave_validator(_user_id uuid, _requester uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_supervisor(_user_id)
      OR public.has_position(_user_id,'Producteur général')
      OR EXISTS (SELECT 1 FROM public.profile_managers pm WHERE pm.profile_id = _requester AND pm.manager_id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.is_leave_validator(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_leave_validator(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "leaves visible" ON public.leave_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_leave_validator(auth.uid(), requester_id));
CREATE POLICY "create own leave" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "validators update leave" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.is_leave_validator(auth.uid(), requester_id))
  WITH CHECK (public.is_leave_validator(auth.uid(), requester_id));
CREATE POLICY "delete own pending leave" ON public.leave_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending');

CREATE TABLE public.leave_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  decider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_id, decider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_decisions TO authenticated;
GRANT ALL ON public.leave_decisions TO service_role;
ALTER TABLE public.leave_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave decisions visible" ON public.leave_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leave_requests l WHERE l.id = leave_id
    AND (l.requester_id = auth.uid() OR public.is_leave_validator(auth.uid(), l.requester_id))));
CREATE POLICY "validators decide" ON public.leave_decisions FOR INSERT TO authenticated
  WITH CHECK (decider_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leave_requests l
    WHERE l.id = leave_id AND public.is_leave_validator(auth.uid(), l.requester_id)));
CREATE POLICY "validators update decision" ON public.leave_decisions FOR UPDATE TO authenticated
  USING (decider_id = auth.uid()) WITH CHECK (decider_id = auth.uid());

-- ============ COMPTABILITÉ ============
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phase, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense categories readable" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages expense categories" ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.expense_categories (phase, name, sort_order) VALUES
 ('Pré-production','Écriture & scénario',1),('Pré-production','Repérages',2),('Pré-production','Casting',3),
 ('Pré-production','Autorisations de tournage',4),('Pré-production','Location de matériel en amont',5),
 ('Production / Tournage','Location matériel technique : caméra, son, lumière',1),
 ('Production / Tournage','Transport',2),('Production / Tournage','Restauration de l''équipe',3),
 ('Production / Tournage','Hébergement',4),('Production / Tournage','Cachets acteurs / figurants',5),
 ('Production / Tournage','Décor',6),('Production / Tournage','Costumes',7),
 ('Production / Tournage','Maquillage',8),('Production / Tournage','Sécurité',9),
 ('Post-production','Montage',1),('Post-production','Étalonnage',2),('Post-production','Mixage / son',3),
 ('Post-production','Musique originale',4),('Post-production','Effets visuels / animation',5),
 ('Post-production','Sous-titrage / traduction',6),
 ('Communication & diffusion','Supports de communication : affiches, visuels',1),
 ('Communication & diffusion','Frais d''inscription aux festivals',2),
 ('Communication & diffusion','Déplacement pour un festival',3),
 ('Communication & diffusion','Organisation d''une projection',4),
 ('Administratif & général','Frais bancaires',1),('Administratif & général','Papeterie / fournitures',2),
 ('Administratif & général','Assurance',3),('Administratif & général','Frais juridiques / contrats',4),
 ('Administratif & général','Divers / imprévus',5),
 ('Autre','Autre',1);

CREATE TABLE public.funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  relation_member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_ref text NOT NULL DEFAULT '',
  extended_access boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid NOT NULL REFERENCES public.funders(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  contributed_on date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(14,2) NOT NULL,
  spent_on date NOT NULL DEFAULT current_date,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  subcategory text NOT NULL DEFAULT '',
  funder_id uuid REFERENCES public.funders(id) ON DELETE SET NULL,
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.funders TO service_role;
GRANT ALL ON public.contributions TO service_role;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.funders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_accounting(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_supervisor(_user_id)
      OR public.has_position(_user_id,'Producteur général')
      OR public.has_position(_user_id,'Comptable / Trésorier')
$$;
CREATE OR REPLACE FUNCTION public.funder_can_see(_user_id uuid, _funder uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.funders f WHERE f.id = _funder AND f.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.funders f WHERE f.user_id = _user_id AND f.extended_access)
$$;
REVOKE ALL ON FUNCTION public.can_manage_accounting(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.funder_can_see(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_accounting(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.funder_can_see(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "funders visible" ON public.funders FOR SELECT TO authenticated
  USING (public.can_manage_accounting(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "accounting manages funders" ON public.funders FOR ALL TO authenticated
  USING (public.can_manage_accounting(auth.uid())) WITH CHECK (public.can_manage_accounting(auth.uid()));

CREATE POLICY "contributions visible" ON public.contributions FOR SELECT TO authenticated
  USING (public.can_manage_accounting(auth.uid()) OR public.funder_can_see(auth.uid(), funder_id));
CREATE POLICY "accounting manages contributions" ON public.contributions FOR ALL TO authenticated
  USING (public.can_manage_accounting(auth.uid())) WITH CHECK (public.can_manage_accounting(auth.uid()));

CREATE POLICY "expenses visible" ON public.expenses FOR SELECT TO authenticated
  USING (public.can_manage_accounting(auth.uid())
      OR (funder_id IS NOT NULL AND public.funder_can_see(auth.uid(), funder_id)));
CREATE POLICY "accounting manages expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.can_manage_accounting(auth.uid())) WITH CHECK (public.can_manage_accounting(auth.uid()));

-- ============ DISCUSSIONS ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('general','team','category','project','leave','funder','mentor')),
  title text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id uuid, _conv uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text; r uuid;
BEGIN
  SELECT kind, ref_id INTO k, r FROM public.conversations WHERE id = _conv;
  IF k IS NULL THEN RETURN false; END IF;
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
END; $$;
REVOKE ALL ON FUNCTION public.can_access_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "conversations visible" ON public.conversations FOR SELECT TO authenticated
  USING (public.can_access_conversation(auth.uid(), id));
CREATE POLICY "supervisors manage conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

INSERT INTO public.conversations (kind, title) VALUES ('general','Discussion générale');
INSERT INTO public.conversations (kind, title, ref_id)
SELECT 'category', 'Discussion ' || c.name, c.id FROM public.position_categories c;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS drive_link text;
UPDATE public.messages SET conversation_id = (SELECT id FROM public.conversations WHERE kind='general')
WHERE conversation_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

DROP POLICY IF EXISTS "members read messages" ON public.messages;
DROP POLICY IF EXISTS "members send messages" ON public.messages;
CREATE POLICY "read messages of my conversations" ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_conversation(auth.uid(), conversation_id));
CREATE POLICY "send messages to my conversations" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_conversation(auth.uid(), conversation_id));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Horodatage
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ideas_updated BEFORE UPDATE ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_funders_updated BEFORE UPDATE ON public.funders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();