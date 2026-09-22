CREATE TABLE IF NOT EXISTS public.email_settings (
  id text PRIMARY KEY DEFAULT 'default',
  mode text NOT NULL DEFAULT 'aucun',
  reply_to text NOT NULL DEFAULT '',
  sender_name text NOT NULL DEFAULT 'Club Ciné Tremplin',
  daily_limit integer NOT NULL DEFAULT 300,
  domain text NOT NULL DEFAULT '',
  domain_status text NOT NULL DEFAULT 'non_configure',
  domain_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_settings lecture membres" ON public.email_settings;
CREATE POLICY "email_settings lecture membres" ON public.email_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "email_settings ecriture producteur general" ON public.email_settings;
CREATE POLICY "email_settings ecriture producteur general" ON public.email_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

DROP POLICY IF EXISTS "email_settings maj producteur general" ON public.email_settings;
CREATE POLICY "email_settings maj producteur general" ON public.email_settings
  FOR UPDATE TO authenticated USING (public.is_admin_or_general_producer(auth.uid()))
  WITH CHECK (public.is_admin_or_general_producer(auth.uid()));

INSERT INTO public.email_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS reply_to text NOT NULL DEFAULT '';
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT '';
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS sent_manually_at timestamptz;

DROP TRIGGER IF EXISTS email_settings_change_log ON public.email_settings;
CREATE TRIGGER email_settings_change_log
  AFTER INSERT OR UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.write_change_log();