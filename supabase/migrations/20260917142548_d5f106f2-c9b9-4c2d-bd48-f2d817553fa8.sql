ALTER TABLE public.vote_sessions
  ADD COLUMN IF NOT EXISTS access_login text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS proclamation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS require_distinct boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_results boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS individual_codes boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.vote_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_projects TO authenticated;
GRANT ALL ON public.vote_projects TO service_role;
ALTER TABLE public.vote_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read vote projects" ON public.vote_projects
FOR SELECT TO authenticated USING (true);
CREATE POLICY "producers manage vote projects" ON public.vote_projects
FOR ALL TO authenticated
USING (
  (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  AND EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = session_id AND s.opened_at IS NULL)
)
WITH CHECK (
  (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  AND EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = session_id AND s.opened_at IS NULL)
);

CREATE TABLE IF NOT EXISTS public.vote_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  voter_token text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  voted_codes text[] NOT NULL DEFAULT '{}',
  UNIQUE (session_id, voter_token)
);
REVOKE ALL ON public.vote_quotas FROM anon, authenticated;
GRANT ALL ON public.vote_quotas TO service_role;
ALTER TABLE public.vote_quotas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vote_tallies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  project_code text NOT NULL
);
REVOKE ALL ON public.vote_tallies FROM anon, authenticated;
GRANT ALL ON public.vote_tallies TO service_role;
ALTER TABLE public.vote_tallies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vote_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  code text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  UNIQUE (session_id, code)
);
GRANT SELECT ON public.vote_access_codes TO authenticated;
GRANT ALL ON public.vote_access_codes TO service_role;
ALTER TABLE public.vote_access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "producers read voter codes" ON public.vote_access_codes
FOR SELECT TO authenticated
USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));