import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { downloadCsv, downloadTablePdf } from "@/lib/downloads";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budget-previsionnel")({
  component: ForecastBudgetPage,
  head: () => ({
    meta: [
      { title: "Budget prévisionnel — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Budget prévisionnel par projet approuvé du Club Ciné Tremplin : accessoires, matériel, transports, repas, lieux et autres catégories.",
      },
      { property: "og:title", content: "Budget prévisionnel — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Construisez ensemble le budget prévisionnel de chaque projet du club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATEGORIES = [
  "Accessoires",
  "Matériel",
  "Transports",
  "Repas",
  "Location de lieux",
  "Autres",
];

type Line = {
  id: string;
  project_id: string;
  category: string;
  label: string;
  quantity: number;
  unit_amount: number;
  note: string;
  created_by: string | null;
  created_at: string;
};

function ForecastBudgetPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState({
    category: CATEGORIES[0]!,
    custom: "",
    label: "",
    quantity: "1",
    unit: "0",
    note: "",
  });

  const projects = useQuery({
    queryKey: ["projects", "budget-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, origin, approval_state")
        .is("deleted_at", null)
        .neq("approval_state", "refuse")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string;
        origin: string;
        approval_state: string;
      }[];
    },
  });
  const selectable = (projects.data ?? []).filter((p) => p.approval_state === "approuve");

  const lines = useQuery({
    queryKey: ["budget_lines", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_budget_lines")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Line[];
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("project_id", projectId)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as { amount: number }[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Choisissez d'abord un projet.");
      if (!draft.label.trim()) throw new Error("Indiquez le libellé de la ligne.");
      const { error } = await supabase.from("project_budget_lines").insert({
        project_id: projectId,
        category: draft.custom.trim() || draft.category,
        label: draft.label.trim(),
        quantity: Number(draft.quantity) || 0,
        unit_amount: Number(draft.unit) || 0,
        note: draft.note,
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft({ ...draft, label: "", quantity: "1", unit: "0", note: "" });
      qc.invalidateQueries({ queryKey: ["budget_lines", projectId] });
      toast.success("Ligne ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_budget_lines")
        .update({ deleted_at: new Date().toISOString(), deleted_by: org.myId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines", projectId] });
      toast.success("Ligne mise à la corbeille");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = lines.data ?? [];
  const total = rows.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_amount), 0);
  const real = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const l of rows)
    byCategory.set(
      l.category,
      (byCategory.get(l.category) ?? 0) + Number(l.quantity) * Number(l.unit_amount),
    );
  const projectTitle = selectable.find((p) => p.id === projectId)?.title ?? "";
  const tableRows = rows.map((l) => [
    l.category,
    l.label,
    String(l.quantity),
    String(l.unit_amount),
    String(Number(l.quantity) * Number(l.unit_amount)),
    new Date(l.created_at).toLocaleDateString("fr-FR"),
  ]);

  return (
    <AppLayout title="Budget prévisionnel">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Choisir un projet approuvé" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} ({p.origin === "externe" ? "externe" : "interne"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectable.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun projet approuvé pour le moment.
              </p>
            )}
          </CardContent>
        </Card>

        {projectId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ajouter une ligne</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-6">
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft({ ...draft, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Autre catégorie</Label>
                  <Input
                    value={draft.custom}
                    onChange={(e) => setDraft({ ...draft, custom: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Libellé</Label>
                  <Input
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prix unitaire</Label>
                  <Input
                    type="number"
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => add.mutate()}>
                    Ajouter
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Budget prévisionnel — {projectTitle}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadTablePdf({
                        title: `Budget prévisionnel — ${projectTitle}`,
                        fileName: `budget-previsionnel-${projectTitle}`,
                        head: ["Catégorie", "Libellé", "Qté", "P.U.", "Total", "Date"],
                        rows: tableRows,
                      })
                    }
                  >
                    Télécharger (PDF)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadCsv(
                        `budget-previsionnel-${projectTitle}`,
                        ["Catégorie", "Libellé", "Qté", "P.U.", "Total", "Date"],
                        tableRows,
                      )
                    }
                  >
                    Télécharger (Excel)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {rows.length === 0 && (
                  <p className="text-muted-foreground">Aucune ligne pour ce projet.</p>
                )}
                {rows.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-border p-2"
                  >
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">{l.category}</span>
                    <span className="mr-auto">{l.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.quantity} × {l.unit_amount}
                    </span>
                    <span className="font-medium">
                      {Number(l.quantity) * Number(l.unit_amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {org.profileName(l.created_by ?? "")} ·{" "}
                      {new Date(l.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="border-t border-border pt-2">
                  {[...byCategory.entries()].map(([c, v]) => (
                    <p key={c} className="text-xs text-muted-foreground">
                      {c} : {v}
                    </p>
                  ))}
                  <p className="mt-1 font-semibold">Total prévisionnel : {total}</p>
                  <p className="text-xs text-muted-foreground">
                    Dépenses réellement enregistrées : {real} — écart : {total - real}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
