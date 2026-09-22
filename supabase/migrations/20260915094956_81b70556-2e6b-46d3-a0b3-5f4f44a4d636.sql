CREATE TYPE public.app_role AS ENUM ('admin','member');
CREATE TYPE public.task_status AS ENUM ('todo','doing','done');
CREATE TYPE public.report_status AS ENUM ('sent','read','validated');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_descendant(_ancestor UUID, _descendant UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE chain AS (
    SELECT id, manager_id FROM public.profiles WHERE id = _descendant
    UNION ALL
    SELECT p.id, p.manager_id FROM public.profiles p JOIN chain c ON p.id = c.manager_id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE manager_id = _ancestor)
$$;

CREATE OR REPLACE FUNCTION public.can_view_user(_viewer UUID, _target UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _target
      OR public.has_role(_viewer, 'admin')
      OR public.is_descendant(_viewer, _target)
$$;

CREATE POLICY "profiles readable by members" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles readable by members" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date DATE,
  status public.task_status NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view tasks in my scope" ON public.tasks FOR SELECT TO authenticated
  USING (public.can_view_user(auth.uid(), owner_id));
CREATE POLICY "manage own tasks" ON public.tasks FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  link TEXT,
  status public.report_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view reports in my scope" ON public.reports FOR SELECT TO authenticated
  USING (public.can_view_user(auth.uid(), author_id) OR recipient_id = auth.uid());
CREATE POLICY "create own reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "author edits own reports" ON public.reports FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "author deletes own reports" ON public.reports FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "supervisor updates report status" ON public.reports FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_descendant(auth.uid(), author_id))
  WITH CHECK (recipient_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_descendant(auth.uid(), author_id));

CREATE TABLE public.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_comments TO authenticated;
GRANT ALL ON public.report_comments TO service_role;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view comments of visible reports" ON public.report_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id
    AND (public.can_view_user(auth.uid(), r.author_id) OR r.recipient_id = auth.uid())));
CREATE POLICY "comment on visible reports" ON public.report_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id
    AND (public.can_view_user(auth.uid(), r.author_id) OR r.recipient_id = auth.uid())));
CREATE POLICY "delete own comments" ON public.report_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Général',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read resources" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "members add resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors manage resources" ON public.resources FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors delete resources" ON public.resources FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "authors delete messages" ON public.messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE INDEX idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX idx_reports_author ON public.reports(author_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);