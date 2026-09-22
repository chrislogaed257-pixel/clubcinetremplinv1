import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { useMe } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PickerInput } from "@/components/PickerInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clubLeaderIds, isValidLink, notifyProfiles } from "@/lib/club-email";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nouveau-projet")({
  component: NewProjectPage,
  head: () => ({
    meta: [
      { title: "Déposer un projet — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Formulaire de dépôt d'un projet de film par un membre du Club Ciné Tremplin : titre, logline, synopsis, note d'intention, note du réalisateur et scénario.",
      },
      { property: "og:title", content: "Déposer un projet — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Déposez votre projet de film au Club Ciné Tremplin et suivez son étude.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SECTIONS = [
  { key: "logline", label: "Logline", link: "logline_link" },
  { key: "synopsis", label: "Synopsis", link: "synopsis_link" },
  { key: "intention_note", label: "Note d'intention", link: "intention_link" },
  { key: "directing_note", label: "Note du réalisateur", link: "directing_link" },
  { key: "script_title", label: "Scénario", link: "script_link" },
] as const;

function NewProjectPage() {
  const org = useOrgContext();
  const { data: me } = useMe();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [author, setAuthor] = useState({
    name: me?.profile?.full_name ?? "",
    email: me?.profile?.email ?? "",
    position: org.myBasePositions[0] ?? "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Le titre du projet est obligatoire.");
      if (!author.name.trim() || !author.email.trim())
        throw new Error("Le nom et l'adresse e-mail de l'auteur sont obligatoires.");
      for (const s of SECTIONS) {
        if (!isValidLink(links[s.link] ?? ""))
          throw new Error(`Le lien Google indiqué pour « ${s.label} » n'est pas valide.`);
        if (!(fields[s.key] ?? "").trim() && !(links[s.link] ?? "").trim())
          throw new Error(`Renseignez « ${s.label} » : un texte ou un lien Google.`);
      }
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: title.trim(),
          description: fields["synopsis"] ?? "",
          logline: fields["logline"] ?? "",
          synopsis: fields["synopsis"] ?? "",
          intention_note: fields["intention_note"] ?? "",
          directing_note: fields["directing_note"] ?? "",
          script_title: fields["script_title"] ?? "",
          logline_link: links["logline_link"] ?? "",
          synopsis_link: links["synopsis_link"] ?? "",
          intention_link: links["intention_link"] ?? "",
          directing_link: links["directing_link"] ?? "",
          script_link: links["script_link"] ?? "",
          origin: "interne",
          approval_state: "en_etude",
          author_profile_id: org.myId,
          author_name: author.name.trim(),
          author_email: author.email.trim(),
          author_position: author.position,
          created_by: org.myId,
        })
        .select("id, title")
        .single();
      if (error) throw error;
      const leaders = await clubLeaderIds();
      await notifyProfiles(
        leaders,
        "Nouveau projet à étudier",
        `${author.name} a déposé le projet « ${data.title} ».`,
        "/projets-approuves",
      );
      if (org.myId)
        await notifyProfiles(
          [org.myId],
          "Projet reçu",
          `Votre projet « ${data.title} » a bien été enregistré et part en étude.`,
          "/projets-approuves",
        );
      return data.id;
    },
    onSuccess: () => {
      toast.success("Projet déposé : le comité en est informé.");
      navigate({ to: "/projets-approuves" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Déposer un projet">
      <Card className="clap-panel max-w-3xl">
        <CardHeader>
          <CardTitle className="text-sm">Votre projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Pour chaque partie, vous pouvez écrire le texte, indiquer un lien Google Docs ou Drive,
            ou les deux.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="t">Titre du projet</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {SECTIONS.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <Label>{s.label}</Label>
              <Textarea
                rows={s.key === "logline" ? 2 : 4}
                value={fields[s.key] ?? ""}
                onChange={(e) => setFields({ ...fields, [s.key]: e.target.value })}
              />
              <Input
                placeholder="Lien Google Docs ou Drive (facultatif)"
                value={links[s.link] ?? ""}
                onChange={(e) => setLinks({ ...links, [s.link]: e.target.value })}
              />
            </div>
          ))}

          <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="an">Auteur</Label>
              <PickerInput
                id="an"
                value={author.name}
                onChange={(v) => setAuthor({ ...author, name: v })}
                options={org.activeProfiles.map((p) => p.full_name)}
                placeholder="Choisir un membre…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap">Poste</Label>
              <PickerInput
                id="ap"
                value={author.position}
                onChange={(v) => setAuthor({ ...author, position: v })}
                options={org.positions.filter((p) => p.active).map((p) => p.name)}
                placeholder="Choisir un poste…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ae">Adresse e-mail de réponse</Label>
              <Input
                id="ae"
                type="email"
                value={author.email}
                onChange={(e) => setAuthor({ ...author, email: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Déposer le projet
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
