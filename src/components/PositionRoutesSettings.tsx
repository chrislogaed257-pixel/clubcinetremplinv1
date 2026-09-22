import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePositions, usePositionRoutes } from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Rubriques par poste : coche les rubriques qu'un poste utilise.
 * Aucun choix pour un poste = ce poste garde toutes les rubriques.
 * Chaque coche est enregistrée immédiatement dans la base.
 */
export function PositionRoutesSettings() {
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  const { data: rows = [] } = usePositionRoutes();
  const [positionId, setPositionId] = useState("");
  const [filter, setFilter] = useState("");

  const menu = useQuery({
    queryKey: ["menu_config_routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_config")
        .select("route, label")
        .order("route");
      if (error) throw error;
      return (data ?? []) as { route: string; label: string }[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ route, on }: { route: string; on: boolean }) => {
      if (!positionId) throw new Error("Choisissez d'abord un poste.");
      if (on) {
        const { error } = await supabase
          .from("position_routes")
          .upsert({ position_id: positionId, route }, { onConflict: "position_id,route" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("position_routes")
          .delete()
          .eq("position_id", positionId)
          .eq("route", route);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["position_routes"] });
      toast.success("Enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chosen = new Set(rows.filter((r) => r.position_id === positionId).map((r) => r.route));
  const list = (menu.data ?? []).filter(
    (m) =>
      !filter ||
      m.label.toLowerCase().includes(filter.toLowerCase()) ||
      m.route.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Rubriques par poste</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Choisissez un poste, puis cochez les rubriques que ce poste doit utiliser. Si aucune case
          n'est cochée, le poste garde accès à toutes les rubriques. Le tableau de bord reste
          toujours accessible.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choisir un poste" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-56"
            placeholder="Rechercher une rubrique"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {positionId && (
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((m) => (
              <label key={m.route} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={chosen.has(m.route)}
                  onCheckedChange={(v) => toggle.mutate({ route: m.route, on: v === true })}
                />
                <span>{m.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{m.route}</span>
              </label>
            ))}
            {list.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucune rubrique trouvée.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
