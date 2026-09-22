ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS synopsis text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS synopsis_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS script_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS script_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS budget_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS budget_link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS project_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS presentation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitter_job text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS synopsis text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS treatment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intention_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS directing_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS script_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'externe',
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.mentor_invites
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE public.mentor_invites
SET public_token = encode(gen_random_bytes(12), 'hex')
WHERE public_token IS NULL;

ALTER TABLE public.mentor_invites
  ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(12), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS mentor_invites_public_token_key
  ON public.mentor_invites (public_token);

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.mentor_invites(id) ON DELETE CASCADE,
  from_mentor boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_messages_select" ON public.mentor_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_position(auth.uid(), 'Producteur général')
    OR EXISTS (
      SELECT 1 FROM public.mentor_invites mi
      WHERE mi.id = mentor_messages.invite_id AND mi.created_by = auth.uid()
    )
  );

CREATE POLICY "mentor_messages_insert" ON public.mentor_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND from_mentor = false
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_position(auth.uid(), 'Producteur général')
      OR EXISTS (
        SELECT 1 FROM public.mentor_invites mi
        WHERE mi.id = mentor_messages.invite_id AND mi.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "mentor_messages_delete" ON public.mentor_messages
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_position(auth.uid(), 'Producteur général')
    OR EXISTS (
      SELECT 1 FROM public.mentor_invites mi
      WHERE mi.id = mentor_messages.invite_id AND mi.created_by = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mentor_messages_invite ON public.mentor_messages (invite_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_project ON public.ideas (project_id);