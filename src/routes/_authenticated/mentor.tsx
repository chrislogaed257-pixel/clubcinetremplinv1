import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Chat, useConversation } from "@/components/Chat";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/mentor")({
  component: MentorPage,
});

function MentorPage() {
  const org = useOrgContext();
  const conv = useConversation("mentor", org.myId || null);

  const projects = useQuery({
    queryKey: ["projects", "mentor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; description: string; status: string }[];
    },
  });

  const feedback = useQuery({
    queryKey: ["mentor_feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_feedback")
        .select("id, mentor_name, content, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        mentor_name: string;
        content: string;
        created_at: string;
      }[];
    },
  });

  return (
    <AppLayout title="Espace mentor">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vous voyez uniquement les projets arrivés à un stade avancé.
        </p>
        {(projects.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun projet à un stade avancé.</p>
        )}
        {(projects.data ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <span className="mt-1 inline-block rounded bg-secondary px-2 py-0.5 text-xs">
                {p.status}
              </span>
            </CardContent>
          </Card>
        ))}

        <div className="space-y-2">
          <p className="text-sm font-medium">Retours des mentors externes (accès libre)</p>
          {(feedback.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun retour pour le moment.</p>
          )}
          {(feedback.data ?? []).map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-1 p-4">
                <p className="text-sm font-medium">{f.mentor_name}</p>
                <p className="text-sm text-muted-foreground">{f.content}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("fr-FR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

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
