ALTER TABLE public.conversations DROP CONSTRAINT conversations_kind_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_kind_check
  CHECK (kind = ANY (ARRAY['general','team','category','project','leave','funder','mentor','direct']));