import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useMe, useProfiles } from "@/hooks/useProfile";
import { useManagerLinks } from "@/hooks/useOrg";
import { playConfirm } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { downloadTextPdf } from "@/lib/downloads";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rapports")({
  component: ReportsPage,
});

type Report = {
  id: string;
  author_id: string;
  recipient_id: string | null;
  title: string;
  content: string;
  link: string | null;
  status: "sent" | "read" | "validated";
  created_at: string;
};

type Comment = { id: string; report_id: string; author_id: string; content: string; link?: string | null };

const statusLabel = { sent: "Envoyé", read: "Lu", validated: "Validé" } as const;

/**
 * Carte de rapport définie au niveau du module : ainsi le champ « Réponse »
 * n'est pas recréé à chaque frappe et le curseur reste dans la zone de saisie.
 */
function ReportCard({
  r,
  canModerate,
  comments,
  name,
  onStatus,
  onComment,
}: {
  r: Report;
  canModerate: boolean;
  comments: Comment[];
  name: (id: string | null) => string;
  onStatus: (status: Report["status"]) => void;
  onComment: (content: string, link: string) => Promise<void> | void;
}) {
  const [answer, setAnswer] = useState("");
  const [answerLink, setAnswerLink] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAnswer() {
    if (!answer.trim()) {
      toast.error("Écrivez d'abord votre réponse.");
      return;
    }
    setBusy(true);
    try {
      await onComment(answer.trim(), answerLink.trim());
      setAnswer("");
      setAnswerLink("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto font-medium">{r.title}</p>
          <Badge variant={r.status === "validated" ? "default" : "secondary"}>
            {statusLabel[r.status]}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadTextPdf({
                title: r.title,
                subtitle: `${name(r.author_id)} vers ${name(r.recipient_id)} — ${new Date(r.created_at).toLocaleString("fr-FR")}`,
                fileName: `rapport-${r.title}`,
                blocks: [
                  { label: "Rapport", text: r.content },
                  ...(r.link ? [{ label: "Lien joint", text: r.link }] : []),
                  ...comments.map((c) => ({
                    label: `Réponse de ${name(c.author_id)}`,
                    text: c.link ? `${c.content}\n${c.link}` : c.content,
                  })),
                ],
              })
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Télécharger
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {name(r.author_id)} vers {name(r.recipient_id)} :{" "}
          {new Date(r.created_at).toLocaleString("fr-FR")}
        </p>
        <p className="whitespace-pre-wrap text-sm">{r.content}</p>
        {r.link && (
          <a href={r.link} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            Pièce jointe / lien
          </a>
        )}
        {comments.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            {comments.map((c) => (
              <p key={c.id} className="text-xs text-muted-foreground">
                <span className="text-foreground">{name(c.author_id)}</span> : {c.content}
                {c.link && (
                  <>
                    {" "}
                    <a href={c.link} target="_blank" rel="noreferrer" className="text-primary underline">
                      lien joint
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>
        )}
        {canModerate && (
          <div className="space-y-2 border-t border-border pt-2">
            <div className="space-y-1.5">
              <Label htmlFor={`answer-${r.id}`}>Réponse</Label>
              <Textarea
                id={`answer-${r.id}`}
                rows={3}
                placeholder="Écrivez votre réponse au rapport"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>
            <Input
              type="url"
              placeholder="Lien Google Drive ou site (optionnel)"
              value={answerLink}
              onChange={(e) => setAnswerLink(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void submitAnswer()}>
                Envoyer la réponse
              </Button>
              <Button size="sm" variant="outline" onClick={() => onStatus("validated")}>
                Approuver le rapport
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onStatus("read")}>
                Marquer lu
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsPage() {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [recipient, setRecipient] = useState("");
  const { data: links = [] } = useManagerLinks();

  const reports = useQuery({
    queryKey: ["reports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Report[];
    },
  });

  const comments = useQuery({
    queryKey: ["report_comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_comments")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const myManagers = links.filter((l) => l.profile_id === me?.userId).map((l) => l.manager_id);
  const myManagerId = recipient || myManagers[0] || me?.profile?.manager_id || null;

  const send = useMutation({
    mutationFn: async () => {
      if (!myManagerId) throw new Error("Choisissez le supérieur destinataire du rapport.");
      const { error } = await supabase.from("reports").insert({
        author_id: me!.userId,
        recipient_id: myManagerId,
        title,
        content,
        link: link || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setLink("");
      qc.invalidateQueries({ queryKey: ["reports"] });
      playConfirm();
      toast.success("Rapport envoyé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Report["status"] }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Rapport mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function addComment(reportId: string, content: string, link: string) {
    const { error } = await supabase.from("report_comments").insert({
      report_id: reportId,
      author_id: me!.userId,
      content,
      link: link || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["report_comments"] });
    playConfirm();
    toast.success("Réponse envoyée");
  }

  const name = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? "—";
  const all = reports.data ?? [];
  const mine = all.filter((r) => r.author_id === me?.userId);
  const received = all.filter((r) => r.author_id !== me?.userId);
  const commentsOf = (id: string) => (comments.data ?? []).filter((c) => c.report_id === id);

  return (
    <AppLayout title="Rapports">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Nouveau rapport</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>Destiné à</Label>
                {myManagers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun supérieur défini pour votre compte.
                  </p>
                ) : (
                  <Select value={myManagerId ?? ""} onValueChange={setRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le supérieur" />
                    </SelectTrigger>
                    <SelectContent>
                      {myManagers.map((id) => (
                        <SelectItem key={id} value={id}>
                          {name(id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt">Titre</Label>
                <Input id="rt" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc">Contenu</Label>
                <Textarea id="rc" rows={6} value={content} onChange={(e) => setContent(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rl">Lien (optionnel)</Label>
                <Input id="rl" type="url" value={link} onChange={(e) => setLink(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={send.isPending}>
                Envoyer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Tabs defaultValue="received">
          <TabsList>
            <TabsTrigger value="received">Rapports reçus ({received.length})</TabsTrigger>
            <TabsTrigger value="sent">Mes rapports ({mine.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="space-y-3">
            {received.length === 0 && <p className="text-sm text-muted-foreground">Aucun rapport reçu.</p>}
            {received.map((r) => (
              <ReportCard
                key={r.id}
                r={r}
                canModerate
                comments={commentsOf(r.id)}
                name={name}
                onStatus={(status) => setStatus.mutate({ id: r.id, status })}
                onComment={(c, l) => addComment(r.id, c, l)}
              />
            ))}
          </TabsContent>
          <TabsContent value="sent" className="space-y-3">
            {mine.length === 0 && <p className="text-sm text-muted-foreground">Aucun rapport envoyé.</p>}
            {mine.map((r) => (
              <ReportCard
                key={r.id}
                r={r}
                canModerate={false}
                comments={commentsOf(r.id)}
                name={name}
                onStatus={(status) => setStatus.mutate({ id: r.id, status })}
                onComment={(c, l) => addComment(r.id, c, l)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
