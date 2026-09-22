import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { downloadTextPdf } from "@/lib/downloads";
import { guideVersion, type Feature } from "@/lib/guide";
import { useMe } from "@/hooks/useProfile";

type Pitch = {
  id: string;
  audience: string;
  hook: string;
  funder_message: string;
  member_message: string;
  contact: string;
  free_text: string;
};

const EMPTY: Omit<Pitch, "id" | "audience"> = {
  hook: "",
  funder_message: "",
  member_message: "",
  contact: "",
  free_text: "",
};

const VERSIONS: { id: string; audience: string; label: string }[] = [
  { id: "bailleurs", audience: "Bailleurs", label: "Bailleurs" },
  { id: "membres", audience: "Membres du club", label: "Membres du club" },
];

export function PitchSettings() {
  const qc = useQueryClient();
  const meQuery = useMe();
  const [draft, setDraft] = useState<Record<string, Partial<Pitch>>>({});

  const pitches = useQuery({
    queryKey: ["pitch_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pitch_settings").select("*");
      if (error) throw error;
      return (data ?? []) as Pitch[];
    },
  });

  const features = useQuery({
    queryKey: ["app_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_features")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Feature[];
    },
  });

  function value(id: string, key: keyof Omit<Pitch, "id" | "audience">) {
    const saved = pitches.data?.find((p) => p.id === id);
    return draft[id]?.[key] ?? saved?.[key] ?? EMPTY[key];
  }

  const save = useMutation({
    mutationFn: async (id: string) => {
      const v = VERSIONS.find((x) => x.id === id)!;
      const { error } = await supabase.from("pitch_settings").upsert(
        {
          id,
          audience: v.audience,
          hook: String(value(id, "hook")),
          funder_message: String(value(id, "funder_message")),
          member_message: String(value(id, "member_message")),
          contact: String(value(id, "contact")),
          free_text: String(value(id, "free_text")),
          updated_at: new Date().toISOString(),
          updated_by: meQuery.data?.userId ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitch_settings"] });
      toast.success("Textes enregistrés.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function buildPdf(id: string) {
    const v = VERSIONS.find((x) => x.id === id)!;
    const list = features.data ?? [];
    const version = await guideVersion();
    const forFunders = id === "bailleurs";

    const byCategory = new Map<string, Feature[]>();
    for (const f of list) {
      const arr = byCategory.get(f.category) ?? [];
      arr.push(f);
      byCategory.set(f.category, arr);
    }

    const blocks: { label?: string; text: string }[] = [
      { label: "Accroche", text: String(value(id, "hook")) || "à compléter par le Producteur général" },
      {
        label: "Le problème que ce logiciel résout",
        text: "Dans un club de cinéma, les idées, les tâches, les dépenses et les messages se perdent vite. Ce logiciel rassemble tout au même endroit : chaque idée a un numéro, chaque projet a une phase, chaque dépense a un projet, et chaque personne sait ce qu'elle doit faire.",
      },
      {
        label: "Le club",
        text: "Club Ciné Tremplin — On apprend, on tourne, on décolle. Vision et mission : former des jeunes au cinéma et porter leurs films jusqu'à l'écran.",
      },
      {
        label: forFunders ? "Message aux bailleurs" : "Message aux membres du club",
        text:
          String(value(id, forFunders ? "funder_message" : "member_message")) ||
          "à compléter par le Producteur général",
      },
    ];

    for (const [cat, items] of byCategory) {
      blocks.push({
        label: `Ce que le logiciel apporte — ${cat}`,
        text: items.map((f) => `• ${f.name} : ${f.purpose || f.description}`).join("\n"),
      });
    }

    blocks.push({
      label: "Qui fait quoi dans l'équipe",
      text:
        list
          .map(
            (f) =>
              `${f.name} : ${(f.owner_positions ?? []).join(", ") || "à confirmer par le Producteur général"}`,
          )
          .join("\n") || "à confirmer par le Producteur général",
    });

    blocks.push(
      forFunders
        ? {
            label: "Ce que les bailleurs peuvent voir et suivre",
            text: "Les projets soutenus et leur phase d'avancement, le budget prévu face aux dépenses réelles, l'écart entre les deux, et l'historique des décisions. Tout est consultable, rien n'est modifiable de l'extérieur.",
          }
        : {
            label: "Ce que les membres y gagnent",
            text: "Des rôles clairs, des notifications quand quelque chose vous concerne, la possibilité de proposer un projet, de participer aux votes et de suivre l'avancement des films du club.",
          },
    );

    blocks.push({
      label: "Organisation et transparence",
      text: "Chaque action est enregistrée (qui, quoi, quand). Les suppressions passent par une corbeille récupérable. Les droits dépendent du poste occupé. Le guide d'utilisation se met à jour automatiquement.",
    });

    blocks.push({
      label: "Contact",
      text: String(value(id, "contact")) || "à compléter par le Producteur général",
    });

    const free = String(value(id, "free_text"));
    if (free.trim()) blocks.push({ label: "Informations complémentaires", text: free });

    downloadTextPdf({
      title: `Dossier de présentation — ${v.audience}`,
      subtitle: `Club Ciné Tremplin — guide version ${version}`,
      blocks,
      fileName: `dossier-presentation-${id}`,
    });
  }

  return (
    <div className="space-y-4">
      {VERSIONS.map((v) => (
        <Card key={v.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Version {v.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Phrase d'accroche</Label>
              <Input
                value={String(value(v.id, "hook"))}
                onChange={(e) =>
                  setDraft({ ...draft, [v.id]: { ...draft[v.id], hook: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message aux bailleurs</Label>
              <Textarea
                value={String(value(v.id, "funder_message"))}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [v.id]: { ...draft[v.id], funder_message: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message aux membres du club</Label>
              <Textarea
                value={String(value(v.id, "member_message"))}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [v.id]: { ...draft[v.id], member_message: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Input
                value={String(value(v.id, "contact"))}
                onChange={(e) =>
                  setDraft({ ...draft, [v.id]: { ...draft[v.id], contact: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texte libre</Label>
              <Textarea
                value={String(value(v.id, "free_text"))}
                onChange={(e) =>
                  setDraft({ ...draft, [v.id]: { ...draft[v.id], free_text: e.target.value } })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save.mutate(v.id)} disabled={save.isPending}>
                Enregistrer les textes
              </Button>
              <Button variant="outline" onClick={() => void buildPdf(v.id)}>
                Télécharger la version {v.label} (PDF)
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
