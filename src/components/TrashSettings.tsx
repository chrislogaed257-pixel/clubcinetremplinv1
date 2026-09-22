import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

type Trashed = { id: string; label: string; table: string; deleted_at: string };

/** Corbeille : tout élément retiré reste récupérable par le Producteur général. */
export function TrashSettings() {
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["trash"],
    queryFn: async () => {
      const out: Trashed[] = [];
      const [projects, ideas, lines, expenses, resources] = await Promise.all([
        supabase.from("projects").select("id, title, deleted_at").not("deleted_at", "is", null),
        supabase
          .from("ideas")
          .select("id, project_title, reference, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("project_budget_lines")
          .select("id, label, deleted_at")
          .not("deleted_at", "is", null),
        supabase
          .from("expenses")
          .select("id, description, amount, deleted_at")
          .not("deleted_at", "is", null),
        supabase.from("resources").select("id, title, deleted_at").not("deleted_at", "is", null),
      ]);
      for (const p of projects.data ?? [])
        out.push({ id: p.id, label: `Projet · ${p.title}`, table: "projects", deleted_at: p.deleted_at! });
      for (const i of ideas.data ?? [])
        out.push({
          id: i.id,
          label: `Dossier · ${i.reference ?? ""} ${i.project_title ?? ""}`.trim(),
          table: "ideas",
          deleted_at: i.deleted_at!,
        });
      for (const l of lines.data ?? [])
        out.push({
          id: l.id,
          label: `Ligne de budget · ${l.label}`,
          table: "project_budget_lines",
          deleted_at: l.deleted_at!,
        });
      for (const e of expenses.data ?? [])
        out.push({
          id: e.id,
          label: `Dépense · ${e.description} (${e.amount})`,
          table: "expenses",
          deleted_at: e.deleted_at!,
        });
      for (const r of resources.data ?? [])
        out.push({
          id: r.id,
          label: `Document · ${r.title}`,
          table: "resources",
          deleted_at: r.deleted_at!,
        });
      return out.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    },
  });

  const restore = async (it: Trashed) => {
    const { error } = await supabase
      .from(it.table as "projects")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Élément restauré");
    qc.invalidateQueries({ queryKey: ["trash"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["ideas"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Corbeille</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Les éléments retirés par leurs auteurs restent ici et peuvent être remis en place.
        </p>
        {(items.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">La corbeille est vide.</p>
        )}
        {(items.data ?? []).map((it) => (
          <div
            key={`${it.table}-${it.id}`}
            className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm"
          >
            <span className="mr-auto">{it.label}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(it.deleted_at).toLocaleString("fr-FR")}
            </span>
            <Button size="sm" variant="outline" onClick={() => restore(it)}>
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurer
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
