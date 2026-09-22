CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  meet_url TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE,
  public_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meetings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Réunions ouvertes visibles publiquement"
ON public.meetings FOR SELECT TO anon
USING (is_open);

CREATE POLICY "Membres voient les réunions"
ON public.meetings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Membres créent des réunions"
ON public.meetings FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Auteur ou production modifie"
ON public.meetings FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'));

CREATE POLICY "Auteur ou production supprime"
ON public.meetings FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_position(auth.uid(), 'Producteur général'));

CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meetings_token ON public.meetings (public_token);