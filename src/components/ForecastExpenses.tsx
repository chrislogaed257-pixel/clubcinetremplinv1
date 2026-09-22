import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Dépenses prévisionnelles : mêmes données que le budget prévisionnel du projet. */
export function ForecastExpenses() {
  const [projectId, setProjectId] = useState("");

  const projects = useQuery({
    queryKey: ["projects", "forecast-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, approval_state")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; approval_state: string }[];
    },
  });

  const lines = useQuery({
    queryKey: ["budget_lines", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_budget_lines")
        .select("id, category, label, quantity, unit_amount")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("category");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        category: string;
        label: string;
        quantity: number;
        unit_amount: number;
      }[];
    },
  });

  const spent = useQuery({
    queryKey: ["expenses", "forecast", projectId],
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

  const rows = lines.data ?? [];
  const forecast = rows.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_amount), 0);
  const real = (spent.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Dépenses prévisionnelles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Choisir un projet" />
          </SelectTrigger>
          <SelectContent>
            {(projects.data ?? [])
              .filter((p) => p.approval_state === "approuve")
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {projectId && rows.length === 0 && (
          <p className="text-muted-foreground">
            Aucune ligne prévisionnelle pour ce projet pour le moment.
          </p>
        )}
        {rows.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-xs">{l.category}</span>
            <span className="mr-auto">{l.label}</span>
            <span className="text-xs text-muted-foreground">
              {l.quantity} × {l.unit_amount}
            </span>
            <span className="font-medium">{Number(l.quantity) * Number(l.unit_amount)}</span>
          </div>
        ))}
        {projectId && (
          <div className="border-t border-border pt-2">
            <p className="font-semibold">Total prévisionnel : {forecast}</p>
            <p className="text-xs text-muted-foreground">
              Dépenses enregistrées : {real} — écart : {forecast - real}
            </p>
            <Link to="/budget-previsionnel" className="text-xs underline">
              Modifier le budget prévisionnel
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
