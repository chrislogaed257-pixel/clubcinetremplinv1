import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Chat } from "@/components/Chat";
import { useOrgContext, useUnread, positionNamesOf } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messagerie")({
  component: DirectMessagesPage,
});

type Participation = { conversation_id: string; profile_id: string };

function DirectMessagesPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const unread = useUnread(org.myId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const conversations = useQuery({
    queryKey: ["direct_conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, kind")
        .eq("kind", "direct")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; kind: string }[];
    },
  });

  const participants = useQuery({
    queryKey: ["conversation_participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("conversation_id, profile_id");
      if (error) throw error;
      return (data ?? []) as Participation[];
    },
  });

  /** Ouvre la conversation privée avec un membre, ou la crée si elle n'existe pas. */
  const open = useMutation({
    mutationFn: async (otherId: string) => {
      const { data, error } = await supabase.rpc("open_direct_conversation", {
        _other: otherId,
      });
      if (error || !data) throw new Error(error?.message ?? "Impossible d'ouvrir la conversation");
      return data as string;
    },
    onSuccess: (id) => {
      setOpenId(id);
      qc.invalidateQueries({ queryKey: ["direct_conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation_participants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const others = org.activeProfiles
    .filter((p) => p.id !== org.myId)
    .filter((p) => p.full_name.toLowerCase().includes(search.trim().toLowerCase()));

  const conversationOf = (otherId: string) => {
    const mineIds = (participants.data ?? [])
      .filter((p) => p.profile_id === org.myId)
      .map((p) => p.conversation_id);
    return (participants.data ?? []).find(
      (p) => p.profile_id === otherId && mineIds.includes(p.conversation_id),
    )?.conversation_id;
  };

  const openWith = openId
    ? (participants.data ?? []).find(
        (p) => p.conversation_id === openId && p.profile_id !== org.myId,
      )?.profile_id
    : undefined;

  return (
    <AppLayout title="💬 Messagerie">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Écrire à un membre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Rechercher un membre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[55vh] space-y-1 overflow-y-auto">
              {others.map((p) => {
                const convId = conversationOf(p.id);
                const count = convId ? (unread.byConversation[convId] ?? 0) : 0;
                return (
                  <Button
                    key={p.id}
                    variant={openId && convId === openId ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start py-2 text-left"
                    onClick={() => (convId ? setOpenId(convId) : open.mutate(p.id))}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {positionNamesOf(p.id, org.profilePositions, org.positions).join(" · ") ||
                          "Poste non défini"}
                      </span>
                    </span>
                    {count > 0 && <Badge className="ml-2">{count}</Badge>}
                  </Button>
                );
              })}
              {others.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun membre trouvé.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {openId ? (
            <>
              <p className="text-sm text-muted-foreground">
                Conversation avec {openWith ? org.profileName(openWith) : "un membre"}
              </p>
              <Chat conversationId={openId} />
            </>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                🎬 Choisissez un membre à gauche pour démarrer une conversation privée.
              </CardContent>
            </Card>
          )}
          {conversations.isError && (
            <p className="text-sm text-destructive">Impossible de charger les conversations.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
