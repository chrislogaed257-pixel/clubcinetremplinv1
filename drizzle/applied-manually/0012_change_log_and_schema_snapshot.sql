-- Journal automatique de toutes les modifications + photographie de la structure de la base.

CREATE TABLE IF NOT EXISTS public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL DEFAULT '',
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id),
  source text NOT NULL DEFAULT 'application',
  summary text NOT NULL DEFAULT '',
  changed jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.change_log TO authenticated;
GRANT ALL ON public.change_log TO service_role;
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change log readable by producers"
ON public.change_log FOR SELECT TO authenticated
USING (public.is_admin_or_general_producer(auth.uid()));

CREATE INDEX IF NOT EXISTS change_log_created_idx ON public.change_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.db_schema_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  structure jsonb NOT NULL
);

GRANT SELECT ON public.db_schema_snapshot TO authenticated;
GRANT ALL ON public.db_schema_snapshot TO service_role;
ALTER TABLE public.db_schema_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schema snapshot readable by producers"
ON public.db_schema_snapshot FOR SELECT TO authenticated
USING (public.is_admin_or_general_producer(auth.uid()));

-- Retire les informations d'authentification avant enregistrement.
CREATE OR REPLACE FUNCTION public.mask_sensitive(_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT _row - 'access_code' - 'access_login' - 'public_token' - 'mentor_token'
              - 'password' - 'voter_token' - 'token_fingerprint' - 'code'
              - 'file_url' - 'result_snapshot'
$$;

CREATE OR REPLACE FUNCTION public.write_change_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  diff jsonb := '{}'::jsonb;
  k text;
  nv jsonb;
  ov jsonb;
  newrow jsonb;
  oldrow jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    oldrow := public.mask_sensitive(to_jsonb(OLD));
    INSERT INTO public.change_log (table_name, record_id, action, actor_id, summary, changed)
    VALUES (TG_TABLE_NAME, coalesce(oldrow->>'id',''), 'suppression', auth.uid(), 'Élément supprimé', oldrow);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    newrow := public.mask_sensitive(to_jsonb(NEW));
    INSERT INTO public.change_log (table_name, record_id, action, actor_id, summary, changed)
    VALUES (TG_TABLE_NAME, coalesce(newrow->>'id',''), 'ajout', auth.uid(), 'Élément ajouté', newrow);
    RETURN NEW;
  ELSE
    newrow := public.mask_sensitive(to_jsonb(NEW));
    oldrow := public.mask_sensitive(to_jsonb(OLD));
    FOR k, nv IN SELECT * FROM jsonb_each(newrow) LOOP
      ov := oldrow->k;
      IF ov IS DISTINCT FROM nv THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('avant', ov, 'apres', nv));
      END IF;
    END LOOP;
    IF diff <> '{}'::jsonb THEN
      INSERT INTO public.change_log (table_name, record_id, action, actor_id, summary, changed)
      VALUES (TG_TABLE_NAME, coalesce(newrow->>'id',''), 'modification', auth.uid(), 'Élément modifié', diff);
    END IF;
    RETURN NEW;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','positions','position_categories','profile_positions','profile_managers',
    'projects','ideas','tasks','reports','report_comments','expenses','contributions','funders',
    'contracts','festivals','call_sheets','casting_calls','casting_applications',
    'project_phases','project_statuses','expense_categories','teams','team_members',
    'leave_requests','vote_sessions','vote_projects','resources','meetings',
    'menu_config','role_config','app_settings','message_templates','form_fields','project_members'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_change_log ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_change_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_change_log()', t);
    END IF;
  END LOOP;
END $$;

-- Structure actuelle de la base (tables et colonnes).
CREATE OR REPLACE FUNCTION public.db_structure()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(x.table_name, x.cols), '{}'::jsonb)
  FROM (
    SELECT c.table_name,
           jsonb_agg(c.column_name || ' : ' || c.data_type ORDER BY c.ordinal_position) AS cols
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
    GROUP BY c.table_name
  ) x
$$;

-- Compare la structure actuelle avec la dernière photographie enregistrée.
CREATE OR REPLACE FUNCTION public.sync_schema_snapshot()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur jsonb; prev jsonb; n integer := 0; tname text;
BEGIN
  cur := public.db_structure();
  SELECT structure INTO prev FROM public.db_schema_snapshot ORDER BY captured_at DESC LIMIT 1;
  IF prev IS NULL THEN
    INSERT INTO public.db_schema_snapshot (structure) VALUES (cur);
    INSERT INTO public.change_log (table_name, action, source, summary, changed)
    VALUES ('(structure de la base)', 'ajout', 'modification de l''application',
            'Première photographie de la structure de la base', cur);
    RETURN 0;
  END IF;
  IF prev = cur THEN RETURN 0; END IF;
  FOR tname IN SELECT k FROM jsonb_object_keys(cur) k WHERE NOT (prev ? k) LOOP
    INSERT INTO public.change_log (table_name, action, source, summary, changed)
    VALUES (tname, 'ajout', 'modification de l''application', 'Nouvelle table ajoutée', cur->tname);
    n := n + 1;
  END LOOP;
  FOR tname IN SELECT k FROM jsonb_object_keys(prev) k WHERE NOT (cur ? k) LOOP
    INSERT INTO public.change_log (table_name, action, source, summary, changed)
    VALUES (tname, 'suppression', 'modification de l''application', 'Table retirée de la base', prev->tname);
    n := n + 1;
  END LOOP;
  FOR tname IN SELECT k FROM jsonb_object_keys(cur) k WHERE (prev ? k) AND (prev->k) <> (cur->k) LOOP
    INSERT INTO public.change_log (table_name, action, source, summary, changed)
    VALUES (tname, 'modification', 'modification de l''application', 'Colonnes modifiées',
            jsonb_build_object('avant', prev->tname, 'apres', cur->tname));
    n := n + 1;
  END LOOP;
  INSERT INTO public.db_schema_snapshot (structure) VALUES (cur);
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.db_structure() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_schema_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_sensitive(jsonb) TO authenticated;