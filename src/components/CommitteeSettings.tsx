import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type RoleRow = { key: string; label: string; positions: string[]; threshold: number };

/** Comité de lecture et rôles fonctionnels (qui vote, qui valide, qui gère). */
export function CommitteeSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, RoleRow>>({});

  const config = useQuery({
    queryKey: ["role_config_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_config")
        .select("key, label, positions, threshold")
        .order("key");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const positions = useQuery({
    queryKey: ["positions_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, active")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; active: boolean }[];
    },
  });

  const rowOf = (r: RoleRow) => draft[r.key] ?? r;

  const save = useMutation({
    mutationFn: async (r: RoleRow) => {
      const { error } = await supabase
        .from("role_config")
        .update({ positions: r.positions, threshold: r.threshold })
        .eq("key", r.key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_config_full"] });
      qc.invalidateQueries({ queryKey: ["role_config"] });
      toast.success("Réglage enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ces réglages décident qui siège au comité de lecture, qui valide les congés, qui gère la
        comptabilité, le casting et les feuilles de service. Chaque changement est tracé dans le
        journal d'activité.
      </p>
      {(config.data ?? []).map((base) => {
        const r = rowOf(base);
        return (
          <Card key={r.key} className="card-lift">
            <CardHeader>
              <CardTitle className="text-sm">{r.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(positions.data ?? [])
                  .filter((p) => p.active)
                  .map((p) => {
                    const on = r.positions.includes(p.name);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs"
                      >
                        <Switch
                          checked={on}
                          onCheckedChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              [r.key]: {
                                ...r,
                                positions: v
                                  ? [...r.positions, p.name]
                                  : r.positions.filter((x) => x !== p.name),
                              },
                            }))
                          }
                        />
                        {p.name}
                      </label>
                    );
                  })}
              </div>
              {r.key === "idea_voters" && (
                <div className="w-48 space-y-1.5">
                  <Label htmlFor={`th-${r.key}`}>Avis favorables nécessaires</Label>
                  <Input
                    id={`th-${r.key}`}
                    type="number"
                    min={1}
                    value={r.threshold}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [r.key]: { ...r, threshold: Number(e.target.value) || 1 },
                      }))
                    }
                  />
                </div>
              )}
              <Button size="sm" onClick={() => save.mutate(r)} disabled={save.isPending}>
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
