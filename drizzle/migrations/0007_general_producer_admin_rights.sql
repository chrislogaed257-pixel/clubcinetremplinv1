CREATE OR REPLACE FUNCTION public.is_admin_or_general_producer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_position(_user_id, 'Producteur général');
$$;

CREATE POLICY "general producer manages profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE POLICY "general producer manages position categories"
  ON public.position_categories FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE POLICY "general producer manages positions"
  ON public.positions FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE POLICY "general producer manages profile positions"
  ON public.profile_positions FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

CREATE POLICY "general producer manages profile managers"
  ON public.profile_managers FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;