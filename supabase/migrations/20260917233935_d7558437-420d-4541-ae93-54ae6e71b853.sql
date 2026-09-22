CREATE TABLE IF NOT EXISTS public.form_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, field_key)
);

GRANT SELECT ON public.form_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form fields public read" ON public.form_fields FOR SELECT TO anon USING (active);
CREATE POLICY "form fields read" ON public.form_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "form fields manage" ON public.form_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_position(auth.uid(), 'Producteur général'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_position(auth.uid(), 'Producteur général'));

CREATE TRIGGER form_fields_updated_at BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.call_sheets ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.casting_applications ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vote_sessions
SET public_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_token IS NULL OR public_token = '';