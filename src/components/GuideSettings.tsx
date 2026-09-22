import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { downloadTextPdf } from "@/lib/downloads";
import { guideVersion, logGuideChange, syncFeatures, type Feature, type ChangelogRow } from "@/lib/guide";
import { useMe } from "@/hooks/useProfile";

const LEXIQUE: [string, string][] = [
  ["Logline", "Le film résumé en une seule phrase."],
  ["Synopsis", "Le résumé de l'histoire, en quelques paragraphes."],
  ["Phase", "L'étape où en est le film (idée, tournage, montage…)."],
  ["Budget prévisionnel", "Ce que l'on pense dépenser avant de commencer."],
  ["Notification", "Un petit message de l'application qui prévient d'une nouveauté."],
  ["Corbeille", "L'endroit où va ce qui est supprimé, pour pouvoir le récupérer."],
  ["RLS", "Les règles qui décident qui a le droit de voir ou modifier quoi."],
];

export function GuideSettings() {
  const qc = useQueryClient();
  const meQuery = useMe();
  const [edit, setEdit] = useState<Feature | null>(null);
  const [note, setNote] = useState("");

  const features = useQuery({
    queryKey: ["app_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_features")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Feature[];
    },
  });

  const changes = useQuery({
    queryKey: ["app_feature_changelog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feature_changelog")
        .select("id, feature_name, summary, guide_version, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ChangelogRow[];
    },
  });

  const version = useQuery({ queryKey: ["guide_version"], queryFn: guideVersion });

  // Vérification rapide à l'ouverture : les rubriques manquantes sont inscrites d'elles-mêmes.
  useEffect(() => {
    void (async () => {
      const added = await syncFeatures();
      if (added > 0) {
        qc.invalidateQueries({ queryKey: ["app_features"] });
        qc.invalidateQueries({ queryKey: ["app_feature_changelog"] });
        qc.invalidateQueries({ queryKey: ["guide_version"] });
      }
    })();
  }, [qc]);

  const save = useMutation({
    mutationFn: async (f: Feature) => {
      const { error } = await supabase
        .from("app_features")
        .update({
          description: f.description,
          child_explanation: f.child_explanation,
          purpose: f.purpose,
          how_to: f.how_to,
          owner_positions: f.owner_positions,
          collaborator_positions: f.collaborator_positions,
          needs_review: false,
          status: f.status === "nouvelle" ? "modifiee" : f.status,
          version: (f.version ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", f.id);
      if (error) throw error;
      await logGuideChange({
        featureId: f.id,
        featureName: f.name,
        summary: note.trim() || `La rubrique « ${f.name} » a été expliquée plus clairement.`,
        actorId: meQuery.data?.userId ?? null,
        notify: true,
      });
    },
    onSuccess: () => {
      setEdit(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["app_features"] });
      qc.invalidateQueries({ queryKey: ["app_feature_changelog"] });
      qc.invalidateQueries({ queryKey: ["guide_version"] });
      toast.success("Guide mis à jour : les membres sont prévenus.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function buildPdf() {
    const list = features.data ?? [];
    const v = version.data ?? 1;
    const blocks: { label?: string; text: string }[] = [
      {
        label: "À quoi sert cette application ?",
        text: "Elle réunit tout le travail du Club Ciné Tremplin au même endroit : les idées de films, les projets retenus, les tâches de chacun, l'argent prévu et dépensé, les messages et les réunions. Chacun voit ce qu'il doit faire, et le club garde une trace claire de tout.",
      },
      { label: "Version du guide", text: `Version ${v} — mis à jour le ${new Date().toLocaleDateString("fr-FR")}` },
    ];

    for (const f of list) {
      blocks.push({
        label: `${f.name} (${f.category})`,
        text: [
          `Ce que c'est : ${f.child_explanation || "à compléter"}`,
          `En détail : ${f.description || "à compléter"}`,
          `À quoi ça sert : ${f.purpose || "à compléter"}`,
          `Comment l'utiliser : ${f.how_to || "à compléter"}`,
          `Qui la gère : ${(f.owner_positions ?? []).join(", ") || "à confirmer par le Producteur général"}`,
          `Avec qui : ${(f.collaborator_positions ?? []).join(", ") || "—"}`,
          `Relié à : ${(f.links ?? []).map((l) => `${l.to} (${l.kind})`).join(", ") || "—"}`,
        ].join("\n"),
      });
    }

    blocks.push({
      label: "Schéma des liaisons",
      text:
        list
          .flatMap((f) => (f.links ?? []).map((l) => `${f.name}  --[${l.kind}]-->  ${l.to}`))
          .join("\n") || "—",
    });

    blocks.push({
      label: "Petit lexique",
      text: LEXIQUE.map(([m, d]) => `${m} : ${d}`).join("\n"),
    });

    blocks.push({
      label: "Ce qui a changé récemment",
      text:
        (changes.data ?? [])
          .map(
            (c) =>
              `${new Date(c.created_at).toLocaleDateString("fr-FR")} — v${c.guide_version} — ${c.feature_name} : ${c.summary}`,
          )
          .join("\n") || "Aucune nouveauté enregistrée pour l'instant.",
    });

    downloadTextPdf({
      title: "Guide d'utilisation",
      subtitle: `Club Ciné Tremplin — version ${v}`,
      blocks,
      fileName: `guide-club-cine-tremplin-v${v}`,
    });
  }

  const toReview = (features.data ?? []).filter(
    (f) =>
      f.needs_review ||
      [f.description, f.child_explanation, f.purpose, f.how_to].some((t) =>
        (t ?? "").toLowerCase().includes("à compléter"),
      ) ||
      (f.owner_positions ?? []).some((p) => p.toLowerCase().includes("à confirmer")),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Guide d'utilisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Version {version.data ?? 1} — dernière mise à jour le{" "}
            {changes.data?.[0]
              ? new Date(changes.data[0].created_at).toLocaleDateString("fr-FR")
              : new Date().toLocaleDateString("fr-FR")}
            . Le PDF est fabriqué au moment du clic : il contient toujours les dernières nouveautés.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={buildPdf}>Télécharger le guide (PDF)</Button>
            <a href="/presentation" target="_blank" rel="noreferrer">
              <Button variant="outline">Fiche de présentation illustrée</Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            La fiche illustrée s'ouvre dans un nouvel onglet : le bouton « Imprimer / PDF » permet de
            la remettre aux membres.
          </p>
        </CardContent>
      </Card>

      {toReview.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">À compléter ou à confirmer ({toReview.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {toReview.map((f) => (
              <Badge key={f.id} variant="outline">
                {f.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dernières modifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(changes.data ?? []).length === 0 && (
            <p className="text-muted-foreground">Aucune nouveauté enregistrée pour l'instant.</p>
          )}
          {(changes.data ?? []).map((c) => (
            <div key={c.id} className="rounded border border-border p-2">
              <div className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("fr-FR")} · version {c.guide_version}
              </div>
              <div className="font-medium">{c.feature_name}</div>
              <div className="text-muted-foreground">{c.summary}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Rubriques du guide ({(features.data ?? []).length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(features.data ?? []).map((f) => (
            <div key={f.id} className="rounded border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.name}</span>
                <Badge variant="secondary">{f.category}</Badge>
                {f.needs_review && <Badge variant="outline">à compléter</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    setEdit(edit?.id === f.id ? null : f);
                    setNote("");
                  }}
                >
                  {edit?.id === f.id ? "Fermer" : "Corriger"}
                </Button>
              </div>
              <p className="mt-1 text-muted-foreground">{f.child_explanation || f.description}</p>

              {edit?.id === f.id && (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate(edit);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label>Description simple</Label>
                    <Textarea
                      value={edit.description}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Explication pour un enfant</Label>
                    <Textarea
                      value={edit.child_explanation}
                      onChange={(e) => setEdit({ ...edit, child_explanation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>À quoi ça sert</Label>
                    <Textarea
                      value={edit.purpose}
                      onChange={(e) => setEdit({ ...edit, purpose: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comment l'utiliser</Label>
                    <Textarea
                      value={edit.how_to}
                      onChange={(e) => setEdit({ ...edit, how_to: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Postes responsables (séparés par une virgule)</Label>
                      <Input
                        value={(edit.owner_positions ?? []).join(", ")}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            owner_positions: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postes collaborateurs (séparés par une virgule)</Label>
                      <Input
                        value={(edit.collaborator_positions ?? []).join(", ")}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            collaborator_positions: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Explication simple pour le guide</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={`La rubrique « ${f.name} » a été expliquée plus clairement.`}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={save.isPending}>
                    Enregistrer et mettre à jour le guide
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
