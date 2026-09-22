import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Msg = { id: string; from_mentor: boolean; content: string; created_at: string };

/**
 * Discussion entre un mentor invité et la personne du club qui l'a invité.
 * Côté club : envoi, mise en pause, clôture et suppression de la discussion.
 */
export function MentorThread({
  inviteId,
  status,
  myId,
  mentorName,
}: {
  inviteId: string;
  status: string;
  myId: string;
  mentorName: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const messages = useQuery({
    queryKey: ["mentor_messages", inviteId],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_messages")
        .select("id, from_mentor, content, created_at")
        .eq("invite_id", inviteId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content) throw new Error("Votre message est vide.");
      const { error } = await supabase
        .from("mentor_messages")
        .insert({ invite_id: inviteId, from_mentor: false, author_id: myId, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["mentor_messages", inviteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("mentor_invites")
        .update({ status: next })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor_invites"] });
      toast.success("État de la discussion mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("mentor_messages").delete().eq("invite_id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor_messages", inviteId] });
      toast.success("Discussion supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = messages.data ?? [];

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted-foreground">
          Discussion avec {mentorName} : état {status === "active" ? "active" : status === "paused" ? "en pause" : "clôturée"}
        </p>
        {status !== "active" && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate("active")}>
            Réactiver
          </Button>
        )}
        {status === "active" && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate("paused")}>
            Mettre en pause
          </Button>
        )}
        {status !== "closed" && (
          <Button size="sm" variant="outline" onClick={() => setStatus.mutate("closed")}>
            Clôturer
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm("Supprimer tous les messages de cette discussion ?")) clear.mutate();
          }}
        >
          Supprimer
        </Button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
        )}
        {list.map((m) => (
          <div
            key={m.id}
            className={`rounded px-3 py-2 text-sm ${
              m.from_mentor ? "bg-secondary" : "bg-primary/10"
            }`}
          >
            <p className="text-xs text-muted-foreground">
              {m.from_mentor ? mentorName || "Mentor invité" : "Club"} :{" "}
              {new Date(m.created_at).toLocaleString("fr-FR")}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire au mentor"
        />
        <Button type="submit" size="sm" disabled={send.isPending || text.trim().length === 0}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
