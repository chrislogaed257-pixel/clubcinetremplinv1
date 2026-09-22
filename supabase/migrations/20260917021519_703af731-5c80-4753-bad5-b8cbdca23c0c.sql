ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logline text NOT NULL DEFAULT '';
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS validator_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

CREATE TABLE IF NOT EXISTS public.accounting_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.accounting_log TO authenticated;
GRANT ALL ON public.accounting_log TO service_role;
ALTER TABLE public.accounting_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounting log read" ON public.accounting_log FOR SELECT TO authenticated
  USING (public.can_manage_accounting(auth.uid()));
CREATE POLICY "accounting log write" ON public.accounting_log FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_accounting(auth.uid()) AND actor_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  role_title text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_supervisor(auth.uid())
         OR public.has_position(auth.uid(),'Producteur général')
         OR public.can_manage_accounting(auth.uid()));
CREATE POLICY "contracts manage" ON public.contracts FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.call_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  title text NOT NULL,
  service_date date NOT NULL,
  call_time text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  crew text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_sheets TO authenticated;
GRANT ALL ON public.call_sheets TO service_role;
ALTER TABLE public.call_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call sheets read" ON public.call_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "call sheets manage" ON public.call_sheets FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'));
CREATE TRIGGER trg_call_sheets_updated BEFORE UPDATE ON public.call_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'festival',
  deadline date,
  url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festivals TO authenticated;
GRANT ALL ON public.festivals TO service_role;
ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festivals read" ON public.festivals FOR SELECT TO authenticated USING (true);
CREATE POLICY "festivals manage" ON public.festivals FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));
CREATE TRIGGER trg_festivals_updated BEFORE UPDATE ON public.festivals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.mentor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  code text NOT NULL UNIQUE,
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_invites TO authenticated;
GRANT ALL ON public.mentor_invites TO service_role;
ALTER TABLE public.mentor_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor invites manage" ON public.mentor_invites FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));

CREATE TABLE IF NOT EXISTS public.vote_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  max_votes integer NOT NULL DEFAULT 2,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_sessions TO authenticated;
GRANT ALL ON public.vote_sessions TO service_role;
ALTER TABLE public.vote_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vote sessions read" ON public.vote_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "vote sessions manage" ON public.vote_sessions FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général'));
CREATE TRIGGER trg_vote_sessions_updated BEFORE UPDATE ON public.vote_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vote_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, voter_id, project_id)
);
GRANT SELECT, INSERT, DELETE ON public.vote_ballots TO authenticated;
GRANT ALL ON public.vote_ballots TO service_role;
ALTER TABLE public.vote_ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ballots read" ON public.vote_ballots FOR SELECT TO authenticated
  USING (voter_id = auth.uid());
CREATE POLICY "own ballots write" ON public.vote_ballots FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = session_id AND s.status = 'open')
    AND (SELECT count(*) FROM public.vote_ballots b WHERE b.session_id = vote_ballots.session_id AND b.voter_id = auth.uid())
        < (SELECT s.max_votes FROM public.vote_sessions s WHERE s.id = vote_ballots.session_id));
CREATE POLICY "own ballots delete" ON public.vote_ballots FOR DELETE TO authenticated
  USING (voter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = session_id AND s.status = 'open'));

CREATE OR REPLACE FUNCTION public.vote_results(_session uuid)
RETURNS TABLE (project_id uuid, votes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.project_id, count(*)::bigint
  FROM public.vote_ballots b
  JOIN public.vote_sessions s ON s.id = b.session_id
  WHERE b.session_id = _session
    AND (s.status = 'published'
         OR public.is_supervisor(auth.uid())
         OR public.has_position(auth.uid(),'Producteur général'))
  GROUP BY b.project_id
$$;
REVOKE EXECUTE ON FUNCTION public.vote_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_results(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.casting_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  public_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  is_open boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.casting_calls TO authenticated;
GRANT SELECT ON public.casting_calls TO anon;
GRANT ALL ON public.casting_calls TO service_role;
ALTER TABLE public.casting_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "casting calls public read" ON public.casting_calls FOR SELECT TO anon USING (is_open);
CREATE POLICY "casting calls read" ON public.casting_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "casting calls manage" ON public.casting_calls FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'));
CREATE TRIGGER trg_casting_calls_updated BEFORE UPDATE ON public.casting_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.casting_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.casting_calls(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  age text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.casting_applications TO authenticated;
GRANT INSERT ON public.casting_applications TO anon, authenticated;
GRANT ALL ON public.casting_applications TO service_role;
ALTER TABLE public.casting_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "casting apply" ON public.casting_applications FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.casting_calls c WHERE c.id = call_id AND c.is_open));
CREATE POLICY "casting read" ON public.casting_applications FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'));
CREATE POLICY "casting update" ON public.casting_applications FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.has_position(auth.uid(),'Producteur général')
         OR public.has_position(auth.uid(),'Directeur de production'))
  WITH CHECK (true);
CREATE TRIGGER trg_casting_apps_updated BEFORE UPDATE ON public.casting_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();