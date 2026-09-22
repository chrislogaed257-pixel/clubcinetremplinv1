-- 1. Nouveaux rôles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'funder';

-- 2. Catégories du tableau de bord
CREATE TABLE public.position_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.position_categories TO authenticated;
GRANT ALL ON public.position_categories TO service_role;
ALTER TABLE public.position_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.position_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages categories" ON public.position_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.position_categories TO authenticated;

-- 3. Postes
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.position_categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions readable" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages positions" ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Postes d'un membre (plusieurs par membre, avec rang)
CREATE TABLE public.profile_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  rank_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, position_id, rank_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_positions TO authenticated;
GRANT ALL ON public.profile_positions TO service_role;
ALTER TABLE public.profile_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile positions readable" ON public.profile_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages profile positions" ON public.profile_positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Supérieurs directs multiples
CREATE TABLE public.profile_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, manager_id),
  CHECK (profile_id <> manager_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_managers TO authenticated;
GRANT ALL ON public.profile_managers TO service_role;
ALTER TABLE public.profile_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers readable" ON public.profile_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages hierarchy" ON public.profile_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Informations personnelles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS likes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dislikes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE POLICY "members update own profile info" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 7. Seed catégories
INSERT INTO public.position_categories (name, sort_order) VALUES
  ('Organisation', 1), ('Artistique', 2), ('Technique', 3), ('Autres', 4);

-- 8. Seed postes
INSERT INTO public.positions (name, sort_order, category_id)
SELECT v.name, v.ord, c.id
FROM (VALUES
  ('Producteur général',1,'Organisation'),
  ('Producteur délégué',2,'Organisation'),
  ('Producteur exécutif',3,'Organisation'),
  ('Directeur de production',4,'Organisation'),
  ('Administrateur de production',5,'Organisation'),
  ('Régisseur général',6,'Organisation'),
  ('Chargé des partenariats et du financement',7,'Organisation'),
  ('Comptable / Trésorier',8,'Organisation'),
  ('Auteur',9,'Artistique'),
  ('Scénariste',10,'Artistique'),
  ('Consultant scénario (Script-doctor)',11,'Artistique'),
  ('Directeur de casting',12,'Artistique'),
  ('Directeur d''acteurs',13,'Artistique'),
  ('Réalisateur',14,'Artistique'),
  ('Assistant réalisateur (1er AR)',15,'Artistique'),
  ('2e assistant réalisateur',16,'Artistique'),
  ('Scripte (script-continuité)',17,'Artistique'),
  ('Chef opérateur (Directeur de la photographie)',18,'Technique'),
  ('1er assistant caméra (point / focus)',19,'Technique'),
  ('2e assistant caméra / Clapman',20,'Technique'),
  ('Chef électricien / Électromachino (éclairagiste)',21,'Technique'),
  ('Machiniste',22,'Technique'),
  ('Ingénieur du son / Régisseur son',23,'Technique'),
  ('Perchman',24,'Technique'),
  ('Assistant son',25,'Technique'),
  ('Directeur artistique / Chef décorateur',26,'Artistique'),
  ('Accessoiriste',27,'Artistique'),
  ('Chef costumier / Styliste',28,'Artistique'),
  ('Chef maquilleur',29,'Artistique'),
  ('Coiffeur',30,'Artistique'),
  ('Gestionnaire de communication (Communication Manager)',31,'Autres'),
  ('Graphiste',32,'Autres'),
  ('Designer',33,'Autres'),
  ('Photographe de plateau',34,'Autres'),
  ('Vidéaste de making-of',35,'Autres'),
  ('Monteur (monteur image)',36,'Technique'),
  ('Étalonneur (colorist)',37,'Technique'),
  ('Monteur son / Sound designer',38,'Technique'),
  ('Mixeur son',39,'Technique'),
  ('Compositeur de musique originale',40,'Artistique'),
  ('Animateur / Infographiste VFX',41,'Technique'),
  ('Sous-titreur / Traducteur',42,'Technique'),
  ('Diffuseur',43,'Autres'),
  ('Distributeur',44,'Autres'),
  ('Chargé des festivals (Programmateur / Booking)',45,'Autres')
) AS v(name, ord, cat)
JOIN public.position_categories c ON c.name = v.cat;

-- 9. Reprise des données existantes
INSERT INTO public.positions (name, sort_order)
SELECT DISTINCT p.position, 100
FROM public.profiles p
WHERE btrim(p.position) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.positions po WHERE po.name = p.position);

INSERT INTO public.profile_positions (profile_id, position_id)
SELECT p.id, po.id FROM public.profiles p
JOIN public.positions po ON po.name = p.position
ON CONFLICT DO NOTHING;

INSERT INTO public.profile_managers (profile_id, manager_id)
SELECT p.id, p.manager_id FROM public.profiles p WHERE p.manager_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 10. Hiérarchie multi-supérieurs
CREATE OR REPLACE FUNCTION public.is_descendant(_ancestor uuid, _descendant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH RECURSIVE chain AS (
    SELECT pm.manager_id FROM public.profile_managers pm WHERE pm.profile_id = _descendant
    UNION
    SELECT pm.manager_id FROM public.profile_managers pm JOIN chain c ON pm.profile_id = c.manager_id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE manager_id = _ancestor)
$$;

-- 11. Poste occupé par un utilisateur
CREATE OR REPLACE FUNCTION public.has_position(_user_id uuid, _position text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_positions pp
    JOIN public.positions po ON po.id = pp.position_id
    WHERE pp.profile_id = _user_id AND po.name = _position
  )
$$;

-- 12. Horodatage
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.position_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();