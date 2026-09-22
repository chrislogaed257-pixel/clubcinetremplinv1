ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.profile_position_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_name text NOT NULL,
  rank_label text NOT NULL DEFAULT '',
  started_on date NOT NULL DEFAULT current_date,
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_position_history TO authenticated;
GRANT ALL ON public.profile_position_history TO service_role;
ALTER TABLE public.profile_position_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position history readable" ON public.profile_position_history
FOR SELECT TO authenticated USING (true);

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'reassign';