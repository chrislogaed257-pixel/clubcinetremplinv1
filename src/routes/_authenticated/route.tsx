import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageError } from "@/components/PageError";
import { PageLoading } from "@/components/PageLoading";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // La session peut encore être en cours de restauration (aperçu, onglet
    // rouvert) : on attend qu'un jeton soit disponible avant de charger la
    // rubrique, sinon les appels serveur partent sans authentification.
    for (let i = 0; i < 5; i++) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) break;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }

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
  pendingComponent: PageLoading,
  errorComponent: PageError,
});
