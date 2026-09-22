CREATE TABLE IF NOT EXISTS public.mentor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mentor_feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_feedback TO authenticated;
GRANT ALL ON public.mentor_feedback TO service_role;

ALTER TABLE public.mentor_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can leave mentor feedback" ON public.mentor_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (char_length(btrim(content)) > 0);
CREATE POLICY "members read mentor feedback" ON public.mentor_feedback
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "production deletes mentor feedback" ON public.mentor_feedback
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_position(auth.uid(),'Producteur général'));

CREATE TRIGGER update_mentor_feedback_updated_at BEFORE UPDATE ON public.mentor_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mentor_feedback_project ON public.mentor_feedback(project_id);