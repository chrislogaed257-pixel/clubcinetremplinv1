import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { downloadTablePdf, downloadCsv } from "@/lib/downloads";
import { Download } from "lucide-react";

export type BudgetLine = {
  id: string;
  project_id: string;
  category: string;
  label: string;
  quantity: number;
  unit_amount: number;
  note: string;
};

const DEFAULT_CATEGORIES = [
  "Accessoires",
  "Matériel",
  "Déplacements",
  "Décors",
  "Costumes",
  "Repas",
  "Postproduction",
  "Divers",
];

export function useProjectBudget(projectId: string) {
  return useQuery({
    queryKey: ["project_budget_lines", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_budget_lines")
        .select("id, project_id, category, label, quantity, unit_amount, note")
        .eq("project_id", projectId)
        .order("category")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as BudgetLine[];
    },
  });
}

/** Budget du projet : lignes par catégorie, total calculé automatiquement. */
export function ProjectBudget({
  projectId,
  projectTitle,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const lines = useProjectBudget(projectId);
  const [category, setCategory] = useState("Accessoires");
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("0");

  const refresh = () => qc.invalidateQueries({ queryKey: ["project_budget_lines", projectId] });

  const add = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Indiquez le libellé de la ligne.");
      const { error } = await supabase.from("project_budget_lines").insert({
        project_id: projectId,
        category: category.trim() || "Divers",
        label: label.trim(),
        quantity: Number(quantity) || 1,
        unit_amount: Number(amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      setQuantity("1");
      setAmount("0");
      refresh();
      toast.success("Ligne de budget ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Partial<BudgetLine> }) => {
      const { error } = await supabase
        .from("project_budget_lines")
        .update(p.patch)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_budget_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Ligne retirée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = lines.data ?? [];
  const totalOf = (l: BudgetLine) => Number(l.quantity) * Number(l.unit_amount);
  const total = rows.reduce((a, l) => a + totalOf(l), 0);
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...rows.map((r) => r.category)])];
  const money = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  const tableRows = rows.map((l) => [
    l.category,
    l.label,
    String(l.quantity),
    money(Number(l.unit_amount)),
    money(totalOf(l)),
  ]);

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Budget du projet</p>
        <span className="ml-auto text-sm font-semibold">Total : {money(total)}</span>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucune ligne de budget pour le moment.</p>
      )}

      {categories
        .filter((c) => rows.some((r) => r.category === c))
        .map((c) => (
          <div key={c} className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{c}</p>
            {rows
              .filter((r) => r.category === c)
              .map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {canEdit ? (
                    <>
                      <Input
                        className="h-8 w-56"
                        defaultValue={l.label}
                        onBlur={(e) =>
                          e.target.value !== l.label &&
                          update.mutate({ id: l.id, patch: { label: e.target.value } })
                        }
                      />
                      <Input
                        className="h-8 w-20"
                        type="number"
                        defaultValue={l.quantity}
                        onBlur={(e) =>
                          update.mutate({ id: l.id, patch: { quantity: Number(e.target.value) || 0 } })
                        }
                      />
                      <Input
                        className="h-8 w-28"
                        type="number"
                        defaultValue={l.unit_amount}
                        onBlur={(e) =>
                          update.mutate({
                            id: l.id,
                            patch: { unit_amount: Number(e.target.value) || 0 },
                          })
                        }
                      />
                    </>
                  ) : (
                    <span className="w-56">
                      {l.label} · {l.quantity} × {money(Number(l.unit_amount))}
                    </span>
                  )}
                  <span className="text-sm font-medium">{money(totalOf(l))}</span>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(l.id)}>
                      Retirer
                    </Button>
                  )}
                </div>
              ))}
          </div>
        ))}

      {canEdit && (
        <form
          className="grid gap-2 border-t border-border pt-2 sm:grid-cols-[160px_1fr_80px_110px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Input
            list={`cat-${projectId}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Catégorie"
          />
          <datalist id={`cat-${projectId}`}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" />
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qté"
          />
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant"
          />
          <Button type="submit" size="sm">
            Ajouter
          </Button>
        </form>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadTablePdf({
                title: `Budget — ${projectTitle}`,
                subtitle: `Total : ${money(total)}`,
                fileName: `budget-${projectTitle}`,
                head: ["Catégorie", "Libellé", "Quantité", "Montant", "Total"],
                rows: [...tableRows, ["", "", "", "TOTAL", money(total)]],
              })
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Budget (PDF)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `budget-${projectTitle}`,
                ["Catégorie", "Libellé", "Quantité", "Montant", "Total"],
                [...tableRows, ["", "", "", "TOTAL", money(total)]],
              )
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Budget (CSV)
          </Button>
        </div>
      )}
    </div>
  );
}
