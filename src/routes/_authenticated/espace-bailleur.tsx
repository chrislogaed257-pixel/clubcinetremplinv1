import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext, positionNamesOf } from "@/hooks/useOrg";
import { Chat, useConversation } from "@/components/Chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/espace-bailleur")({
  component: FunderSpace,
});

function FunderSpace() {
  const org = useOrgContext();

  const funders = useQuery({
    queryKey: ["my-funders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funders").select("*");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; user_id: string | null }[];
    },
  });
  const mine = (funders.data ?? []).find((f) => f.user_id === org.myId) ?? funders.data?.[0];

  const contributions = useQuery({
    queryKey: ["my-contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .order("contributed_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        funder_id: string;
        project_id: string | null;
        amount: number;
        contributed_on: string;
        note: string;
      }[];
    },
  });

  const expenses = useQuery({
    queryKey: ["my-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        amount: number;
        spent_on: string;
        project_id: string | null;
        description: string;
      }[];
    },
  });

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title");
      if (error) throw error;
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const conv = useConversation("funder", mine?.id ?? null);
  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.title ?? "—";

  const total = (contributions.data ?? []).reduce((s, c) => s + Number(c.amount), 0);

  return (
    <AppLayout title="Mon espace bailleur">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mes contributions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Total : {total.toLocaleString("fr-FR")}</p>
            {(contributions.data ?? []).map((c) => (
              <p key={c.id} className="text-xs text-muted-foreground">
                {new Date(c.contributed_on).toLocaleDateString("fr-FR")} ·{" "}
                {Number(c.amount).toLocaleString("fr-FR")} · {projectName(c.project_id)}
                {c.note ? ` · ${c.note}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dépenses financées par mes fonds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(expenses.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Aucune dépense reliée pour l'instant.</p>
            )}
            {(expenses.data ?? []).map((x) => (
              <p key={x.id} className="text-xs text-muted-foreground">
                {new Date(x.spent_on).toLocaleDateString("fr-FR")} ·{" "}
                {Number(x.amount).toLocaleString("fr-FR")} · {projectName(x.project_id)} ·{" "}
                {x.description}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Membres impliqués</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {org.profiles.map((p) => (
              <p key={p.id} className="text-xs text-muted-foreground">
                {p.full_name} —{" "}
                {positionNamesOf(p.id, org.profilePositions, org.positions).join(" · ") || "—"}
              </p>
            ))}
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium">
            Discussion avec le Producteur général et le Producteur délégué
          </p>
          {conv.data ? (
            <Chat conversationId={conv.data.id} />
          ) : (
            <p className="text-sm text-muted-foreground">Discussion non encore ouverte.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
