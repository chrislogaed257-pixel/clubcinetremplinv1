import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Chat } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/discussion")({
  validateSearch: (search: Record<string, unknown>): { c?: string } =>
    typeof search['c'] === "string" ? { c: search['c'] as string } : {},
  component: ConversationsPage,
});

type Conversation = { id: string; kind: string; title: string; ref_id: string | null };

const kindLabel: Record<string, string> = {
  general: "Général",
  category: "Catégorie",
  team: "Équipe",
  project: "Projet",
  leave: "Congé",
  funder: "Bailleur",
  mentor: "Mentor",
};

function ConversationsPage() {
  const { c: initial } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(initial ?? null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("kind")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
  });

  const list = conversations.data ?? [];
  const current = list.find((c) => c.id === selected) ?? list.find((c) => c.kind === "general");

  return (
    <AppLayout title="Discussions">
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-1 p-3">
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune discussion accessible.</p>
            )}
            {list.map((c) => (
              <Button
                key={c.id}
                variant={current?.id === c.id ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-left"
                onClick={() => setSelected(c.id)}
              >
                <span className="truncate">
                  {c.title}
                  <span className="ml-1 text-[10px] opacity-70">({kindLabel[c.kind] ?? c.kind})</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div>
          {current ? (
            <>
              <p className="mb-2 text-sm font-medium">{current.title}</p>
              <Chat conversationId={current.id} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sélectionnez une discussion.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
