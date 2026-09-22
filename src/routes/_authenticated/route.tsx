import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageError } from "@/components/PageError";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Une coupure réseau ne doit pas déconnecter : on réessaie avant d'y croire.
    let last: Awaited<ReturnType<typeof supabase.auth.getUser>> | null = null;
    for (let i = 0; i < 3; i++) {
      last = await supabase.auth.getUser();
      if (last.data.user) return { user: last.data.user };
      const message = last.error?.message ?? "";
      const offline = /fetch|network|timeout|failed/i.test(message);
      if (!offline) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
  errorComponent: PageError,
});
