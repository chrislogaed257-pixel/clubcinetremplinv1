CREATE TABLE public.app_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Général',
  description text NOT NULL DEFAULT '',
  child_explanation text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT '',
  how_to text NOT NULL DEFAULT '',
  owner_positions text[] NOT NULL DEFAULT '{}',
  collaborator_positions text[] NOT NULL DEFAULT '{}',
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'existante',
  needs_review boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_features TO authenticated;
GRANT ALL ON public.app_features TO service_role;
ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "features readable by members" ON public.app_features
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "features auto insert" ON public.app_features
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "features updated by general producer" ON public.app_features
  FOR UPDATE TO authenticated USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE TABLE public.app_feature_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid REFERENCES public.app_features(id) ON DELETE SET NULL,
  feature_name text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES public.profiles(id),
  guide_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.app_feature_changelog TO authenticated;
GRANT ALL ON public.app_feature_changelog TO service_role;
ALTER TABLE public.app_feature_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog readable by members" ON public.app_feature_changelog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "changelog auto insert" ON public.app_feature_changelog
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.pitch_settings (
  id text PRIMARY KEY,
  audience text NOT NULL DEFAULT '',
  hook text NOT NULL DEFAULT '',
  funder_message text NOT NULL DEFAULT '',
  member_message text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  free_text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

GRANT SELECT, INSERT, UPDATE ON public.pitch_settings TO authenticated;
GRANT ALL ON public.pitch_settings TO service_role;
ALTER TABLE public.pitch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pitch visible general producer" ON public.pitch_settings
  FOR SELECT TO authenticated USING (public.is_admin_or_general_producer(auth.uid()));
CREATE POLICY "pitch insert general producer" ON public.pitch_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_general_producer(auth.uid()));
CREATE POLICY "pitch update general producer" ON public.pitch_settings
  FOR UPDATE TO authenticated USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE TRIGGER app_features_change_log
  AFTER INSERT OR UPDATE ON public.app_features
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();

CREATE TRIGGER pitch_settings_change_log
  AFTER INSERT OR UPDATE ON public.pitch_settings
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();