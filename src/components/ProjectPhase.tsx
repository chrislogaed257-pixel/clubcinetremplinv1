import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

export const PROJECT_STATES = ["En cours", "En pause", "Terminé", "Abandonné"] as const;

export type ProjectPhaseRow = { id: string; name: string; active: boolean; sort_order: number };

export function useProjectPhases() {
  return useQuery({
    queryKey: ["project_phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProjectPhaseRow[];
    },
  });
}

function useHistory(projectId: string) {
  return useQuery({
    queryKey: ["project_phase_history", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phase_history")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        from_phase_id: string | null;
        to_phase_id: string | null;
        from_state: string;
        to_state: string;
        changed_by: string | null;
        created_at: string;
      }[];
    },
  });
}

/** Phase en cours, état du projet et historique des changements. */
export function ProjectPhaseControl({
  projectId,
  phaseId,
  state,
}: {
  projectId: string;
  phaseId: string | null;
  state: string;
}) {
  const org = useOrgContext();
  const qc = useQueryClient();
  const phases = useProjectPhases();
  const history = useHistory(projectId);
  const [showHistory, setShowHistory] = useState(false);

  const canAdvance =
    org.isAdmin ||
    org.isDeputy ||
    org.has("Producteur général") ||
    org.has("Directeur de production");
  const canClose = org.isAdmin || org.has("Producteur général");

  const save = useMutation({
    mutationFn: async (patch: { phase_id?: string; state?: string }) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_phase_history", projectId] });
      toast.success("Avancement enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (phases.data ?? []).filter((p) => p.active);
  const phaseName = (id: string | null) =>
    id ? (phases.data ?? []).find((p) => p.id === id)?.name ?? "—" : "—";
  const currentIndex = list.findIndex((p) => p.id === phaseId);
  const next = currentIndex >= 0 ? list[currentIndex + 1] : list[0];

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label className="text-xs">🎞️ Phase en cours</Label>
          {canAdvance ? (
            <Select
              value={phaseId ?? ""}
              onValueChange={(v) => save.mutate({ phase_id: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir une phase" />
              </SelectTrigger>
              <SelectContent>
                {list.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{phaseName(phaseId)}</p>
          )}
        </div>
        <div className="min-w-40 space-y-1.5">
          <Label className="text-xs">État</Label>
          {canAdvance ? (
            <Select value={state || "En cours"} onValueChange={(v) => save.mutate({ state: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATES.map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    disabled={!canClose && (s === "Terminé" || s === "Abandonné")}
                  >
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{state || "En cours"}</p>
          )}
        </div>
        {canAdvance && next && (
          <Button size="sm" variant="outline" onClick={() => save.mutate({ phase_id: next.id })}>
            Passer à « {next.name} »
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Masquer l'historique" : "Historique des phases"}
        </Button>
      </div>

      {showHistory && (
        <div className="space-y-1 border-t border-border pt-2">
          {(history.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun changement enregistré.</p>
          )}
          {(history.data ?? []).map((h) => (
            <p key={h.id} className="text-xs text-muted-foreground">
              {new Date(h.created_at).toLocaleString("fr-FR")} —{" "}
              {phaseName(h.from_phase_id)} → {phaseName(h.to_phase_id)}
              {h.from_state !== h.to_state ? ` · état ${h.from_state} → ${h.to_state}` : ""}
              {h.changed_by ? ` · par ${org.profileName(h.changed_by)}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
