CREATE TABLE IF NOT EXISTS public.position_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  route text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, route)
);

GRANT SELECT ON public.position_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_routes TO authenticated;
GRANT ALL ON public.position_routes TO service_role;

ALTER TABLE public.position_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "position_routes_select" ON public.position_routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "position_routes_write" ON public.position_routes
  FOR ALL TO authenticated
  USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

COMMENT ON TABLE public.position_routes IS 'Rubriques du menu autorisees pour chaque poste. Aucun enregistrement pour un poste = toutes les rubriques restent visibles.';