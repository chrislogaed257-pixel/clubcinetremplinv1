import { PublicBrand } from "@/components/PublicBrand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  mentorMessageToClub,
  mentorProjects,
  mentorSendMessage,
  mentorThread,
} from "@/lib/mentors.functions";


export const Route = createFileRoute("/mentor-espace")({
  validateSearch: (search: Record<string, unknown>): { t?: string } =>
    typeof search['t'] === "string" ? { t: search['t'] as string } : {},
  component: MentorOpenSpace,
  head: () => ({
    meta: [
      { title: "Espace mentor en accès libre : Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Consultez les projets du Club Ciné Tremplin et laissez votre retour de mentor, sans compte ni identifiant.",
      },
      { property: "og:title", content: "Espace mentor en accès libre : Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Accès libre pour les mentors externes du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type P = {
  id: string;
  title: string;
  description: string;
  status: string;
  logline: string;
  phase: string;
};

type Msg = { id: string; from_mentor: boolean; content: string; created_at: string };

function MentorOpenSpace() {
  const { t: token } = Route.useSearch();
  const [projects, setProjects] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [thread, setThread] = useState<{
    invite: { id: string; full_name: string; status: string } | null;
    inviter: { full_name: string; position: string } | null;
    messages: Msg[];
  } | null>(null);
  const [chat, setChat] = useState("");
  const [sending, setSending] = useState(false);

  const loadThread = useCallback(async () => {
    if (!token) return;
    const res = await mentorThread({ data: { token } });
    setThread(res);
  }, [token]);

  useEffect(() => {
    void (async () => {
      const res = await mentorProjects();
      setProjects(res.projects);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    void loadThread();
    if (!token) return;
    const id = setInterval(() => void loadThread(), 20000);
    return () => clearInterval(id);
  }, [loadThread, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("mentor_feedback").insert({
      mentor_name: name.trim() || thread?.invite?.full_name || "Mentor externe",
      project_id: projectId || null,
      content: content.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Envoi impossible pour le moment.");
      return;
    }
    setDone(true);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!token || chat.trim().length === 0) return;
    setSending(true);
    try {
      await mentorSendMessage({ data: { token, content: chat.trim() } });
      setChat("");
      await loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    }
    setSending(false);
  }

  const invite = thread?.invite ?? null;
  const statusLabel =
    invite?.status === "paused"
      ? "en pause"
      : invite?.status === "closed"
        ? "clôturée"
        : "ouverte";

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <PublicBrand className="justify-start" />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Espace mentor : Club Ciné Tremplin</h1>
        <p className="text-sm text-muted-foreground">
          Accès libre : aucun compte, aucun identifiant, aucune adresse email n'est demandé.
        </p>
      </header>

      {token && invite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Échange avec {thread?.inviter?.full_name ?? "votre contact au club"}
              {thread?.inviter?.position ? ` : ${thread.inviter.position}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Discussion {statusLabel}.</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(thread?.messages ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
              )}
              {(thread?.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`rounded px-3 py-2 text-sm ${
                    m.from_mentor ? "bg-primary/10" : "bg-secondary"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">
                    {m.from_mentor ? "Vous" : thread?.inviter?.full_name || "Le club"} :{" "}
                    {new Date(m.created_at).toLocaleString("fr-FR")}
                  </p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
            {invite.status === "active" ? (
              <form className="space-y-2" onSubmit={sendChat}>
                <Textarea
                  rows={3}
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="Votre message"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={sending || chat.trim().length === 0}>
                    Envoyer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={sending || chat.trim().length === 0}
                    onClick={async () => {
                      if (!token) return;
                      setSending(true);
                      try {
                        await mentorMessageToClub({ data: { token, content: chat.trim() } });
                        setChat("");
                        await loadThread();
                        toast.success("Message transmis au club.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Envoi impossible.");
                      }
                      setSending(false);
                    }}
                  >
                    Écrire au club
                  </Button>
                </div>

              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                La discussion est {statusLabel} par le club : vous ne pouvez plus écrire.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {token && thread && !invite && (
        <p className="text-sm text-muted-foreground">
          Ce lien d'échange n'est plus valable, mais vous pouvez laisser votre retour ci-dessous.
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Chargement des projets...</p>}

      {!loading && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun projet à présenter pour le moment.</p>
      )}

      {projects.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-1 p-4">
            <p className="font-medium">{p.title}</p>
            {p.logline && <p className="text-sm italic">{p.logline}</p>}
            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            <div className="flex flex-wrap gap-2">
              <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs">{p.status}</span>
              <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {p.phase}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}


      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Votre retour de mentor</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Merci pour votre retour.</p>
              <p className="text-muted-foreground">
                Votre message a été transmis à la production. Vous pouvez quitter cette page.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDone(false);
                    setContent("");
                  }}
                >
                  Écrire un autre retour
                </Button>
                <Link to="/">
                  <Button>Quitter</Button>
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="mn">Votre nom (facultatif)</Label>
                <Input id="mn" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp">Projet concerné (facultatif)</Label>
                <select
                  id="mp"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Retour général</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc">Votre message</Label>
                <Textarea
                  id="mc"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy || content.trim().length === 0}>
                Envoyer mon retour
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
