import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/** Délais de décision et avance de rappel, réglables par le Producteur général. */
export function DelaysSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const settings = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return (data ?? []) as { key: string; value: string }[];
    },
  });

  const valueOf = (key: string, fallback: string) =>
    draft[key] ?? (settings.data ?? []).find((s) => s.key === key)?.value ?? fallback;

  const save = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "decision_delay_days", value: valueOf("decision_delay_days", "3") },
        { key: "reminder_hours", value: valueOf("reminder_hours", "24") },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Délais enregistrés");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-sm">⏰ Délais & relances</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="dd">Délai de décision (jours)</Label>
            <Input
              id="dd"
              type="number"
              min={1}
              value={valueOf("decision_delay_days", "3")}
              onChange={(e) => setDraft((d) => ({ ...d, decision_delay_days: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rh">Rappel avant échéance (heures)</Label>
            <Input
              id="rh"
              type="number"
              min={1}
              value={valueOf("reminder_hours", "24")}
              onChange={(e) => setDraft((d) => ({ ...d, reminder_hours: e.target.value }))}
            />
          </div>
          <Button type="submit" size="sm" disabled={save.isPending}>
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
