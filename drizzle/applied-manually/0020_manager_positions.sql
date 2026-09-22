CREATE TABLE IF NOT EXISTS public.profile_manager_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, position_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_manager_positions TO authenticated;
GRANT ALL ON public.profile_manager_positions TO service_role;

ALTER TABLE public.profile_manager_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager positions readable" ON public.profile_manager_positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manager positions managed by producers" ON public.profile_manager_positions
  FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE TRIGGER profile_manager_positions_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_manager_positions
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();