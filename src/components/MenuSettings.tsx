import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type MenuRow = { route: string; label: string; visible: boolean };

/** Rubriques du menu : renommer ou masquer une rubrique pour tout le monde. */
export function MenuSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, MenuRow>>({});

  const rows = useQuery({
    queryKey: ["menu_config_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_config")
        .select("route, label, visible")
        .order("route");
      if (error) throw error;
      return (data ?? []) as MenuRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (r: MenuRow) => {
      const { error } = await supabase
        .from("menu_config")
        .update({ label: r.label, visible: r.visible })
        .eq("route", r.route);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_config_admin"] });
      qc.invalidateQueries({ queryKey: ["menu_config"] });
      toast.success("Menu mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Rubriques du menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(rows.data ?? []).map((base) => {
          const r = draft[base.route] ?? base;
          return (
            <div key={r.route} className="flex flex-wrap items-center gap-2">
              <span className="w-44 shrink-0 font-mono text-xs text-muted-foreground">
                {r.route}
              </span>
              <Input
                className="w-56"
                value={r.label}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [r.route]: { ...r, label: e.target.value } }))
                }
              />
              <Switch
                checked={r.visible}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, [r.route]: { ...r, visible: v } }))
                }
              />
              <span className="text-xs text-muted-foreground">
                {r.visible ? "Visible" : "Masquée"}
              </span>
              <Button size="sm" variant="outline" onClick={() => save.mutate(r)}>
                Enregistrer
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
