import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/hooks/useProfile";
import { markConversationRead } from "@/hooks/useOrg";
import { playConfirm } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export type Message = {
  id: string;
  author_id: string;
  content: string;
  drive_link: string | null;
  created_at: string;
};

/** Retrouve (ou crée côté base si autorisé) la discussion d'un type donné. */
export function useConversation(kind: string, refId?: string | null) {
  return useQuery({
    queryKey: ["conversation", kind, refId ?? null],
    queryFn: async () => {
      let q = supabase.from("conversations").select("*").eq("kind", kind);
      q = refId ? q.eq("ref_id", refId) : q.is("ref_id", null);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as { id: string; title: string; kind: string } | null;
    },
  });
}

export function Chat({ conversationId }: { conversationId: string | undefined }) {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [drive, setDrive] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // Repère "vu" : dernière lecture des autres participants.
  const reads = useQuery({
    queryKey: ["conversation-reads", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_reads")
        .select("profile_id, last_read_at")
        .eq("conversation_id", conversationId!);
      if (error) throw error;
      return (data ?? []) as { profile_id: string; last_read_at: string }[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["conversation-reads", conversationId] });
          const row = payload.new as { author_id?: string } | null;
          if (payload.eventType === "INSERT" && row?.author_id !== me?.userId) playConfirm();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, conversationId, me?.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  // Marque la discussion comme lue dès qu'elle est ouverte ou qu'un message arrive.
  useEffect(() => {
    if (!conversationId || !me?.userId) return;
    void markConversationRead(conversationId, me.userId).then(() =>
      qc.invalidateQueries({ queryKey: ["unread"] }),
    );
  }, [conversationId, me?.userId, messages.data, qc]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      const link = drive.trim();
      if (!content && !link) return;
      const { error } = await supabase.from("messages").insert({
        author_id: me!.userId,
        conversation_id: conversationId!,
        content,
        drive_link: link || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setDrive("");
      playConfirm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const name = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "Membre";
  const list = messages.data ?? [];
  const seenUntil = (reads.data ?? [])
    .filter((r) => r.profile_id !== me?.userId)
    .map((r) => new Date(r.last_read_at).getTime())
    .reduce((a, b) => Math.max(a, b), 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="h-[55vh] space-y-3 overflow-y-auto pr-1">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
          )}
          {list.map((m) => {
            const mine = m.author_id === me?.userId;
            return (
              <div key={m.id} className="space-y-1">
                {m.content && (
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-secondary text-foreground"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-xs font-medium opacity-80">{name(m.author_id)}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleString("fr-FR")}
                        {mine &&
                          (seenUntil >= new Date(m.created_at).getTime() ? (
                            <CheckCheck className="h-3 w-3" aria-label="Vu" />
                          ) : (
                            <Check className="h-3 w-3" aria-label="Envoyé" />
                          ))}
                      </p>
                    </div>
                  </div>
                )}
                {m.drive_link && (
                  <div className="flex justify-center">
                    <a
                      href={m.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[90%] truncate rounded-lg bg-blue-500/10 px-3 py-2 text-center text-sm font-medium text-blue-400 underline underline-offset-2"
                    >
                      {name(m.author_id)} a partagé un lien : {m.drive_link}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Votre message"
              maxLength={2000}
            />
            <Button type="submit" disabled={send.isPending || !conversationId}>
              Envoyer
            </Button>
          </div>
          <Input
            value={drive}
            onChange={(e) => setDrive(e.target.value)}
            placeholder="Coller un lien Google Drive (optionnel)"
            type="url"
          />
        </form>
      </CardContent>
    </Card>
  );
}
