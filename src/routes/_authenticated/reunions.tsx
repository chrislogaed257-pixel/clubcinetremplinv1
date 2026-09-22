import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { downloadTextPdf } from "@/lib/downloads";
import { Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reunions")({
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  description: string;
  meet_url: string;
  starts_at: string | null;
  public_token: string;
  is_open: boolean;
  created_by: string | null;
};

function MeetingsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const canManageAll = org.isAdmin || org.has("Producteur général");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");

  const meetings = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const link = url.trim();
      if (!/^https?:\/\//.test(link)) throw new Error("Collez un lien de réunion valide (https).");
      const { error } = await supabase.from("meetings").insert({
        title: title.trim(),
        description: description.trim(),
        meet_url: link,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setUrl("");
      setStartsAt("");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Réunion créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (m: Meeting) => {
      const { error } = await supabase
        .from("meetings")
        .update({ is_open: !m.is_open })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (m: Meeting) => {
      const { error } = await supabase.from("meetings").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Réunion supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AppLayout title="Réunions vidéo">
      <div className="grid gap-4 md:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Nouvelle réunion</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="mt">Titre</Label>
                <Input id="mt" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms">Date et heure (facultatif)</Label>
                <Input
                  id="ms"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mu">Lien de la visioconférence</Label>
                <Input
                  id="mu"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline"
                >
                  <Video className="h-3.5 w-3.5" />
                  Ouvrir Google Meet et créer le lien
                </a>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md">Ordre du jour (facultatif)</Label>
                <Textarea
                  id="md"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Créer la réunion
              </Button>
              <p className="text-xs text-muted-foreground">
                Chaque réunion reçoit un lien d'accès libre : les personnes extérieures entrent
                directement, sans compte ni identifiant, et ne voient rien d'autre du club.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(meetings.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune réunion pour le moment.</p>
          )}
          {(meetings.data ?? []).map((m) => {
            const link = `${origin}/reunion/${m.public_token}`;
            const mine = canManageAll || m.created_by === org.myId;
            return (
              <Card key={m.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {m.is_open ? "Ouverte" : "Close"}
                    </span>
                    {m.starts_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.starts_at).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                  )}
                  <p className="break-all text-xs text-muted-foreground">{link}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={m.meet_url} target="_blank" rel="noreferrer">
                      <Button size="sm">
                        <Video className="mr-2 h-4 w-4" />
                        Rejoindre
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(link);
                        toast.success("Lien d'accès libre copié");
                      }}
                    >
                      Copier le lien d'accès libre
                    </Button>
                    {m.description && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadTextPdf({
                            title: `Compte rendu : ${m.title}`,
                            subtitle: m.starts_at
                              ? new Date(m.starts_at).toLocaleString("fr-FR")
                              : "Réunion du club",
                            fileName: `compte-rendu-${m.title}`,
                            blocks: [
                              { label: "Notes", text: m.description },
                              { label: "Lien d'accès", text: link },
                            ],
                          })
                        }
                      >
                        Télécharger le compte rendu (PDF)
                      </Button>
                    )}
                    {mine && (
                      <Button size="sm" variant="outline" onClick={() => toggle.mutate(m)}>
                        {m.is_open ? "Clôturer" : "Rouvrir"}
                      </Button>
                    )}
                    {mine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Supprimer cette réunion ?")) remove.mutate(m);
                        }}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
