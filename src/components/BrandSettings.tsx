import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/** Identité visuelle du club : logo, couleur d'accent, slogan. */
export function BrandSettings() {
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

  const valueOf = (key: string, fallback = "") =>
    draft[key] ?? (settings.data ?? []).find((s) => s.key === key)?.value ?? fallback;

  const save = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "brand_logo_url", value: valueOf("brand_logo_url") },
        { key: "brand_accent", value: valueOf("brand_accent", "#e0b34d") },
        { key: "brand_slogan", value: valueOf("brand_slogan") },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      qc.invalidateQueries({ queryKey: ["brand_settings"] });
      toast.success("Identité visuelle enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="clap-panel h-fit max-w-xl pt-6">
      <CardHeader>
        <CardTitle className="text-sm">Identité visuelle du club</CardTitle>
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
            <Label htmlFor="logo">Adresse du logo (laisser vide pour le logo d'origine)</Label>
            <Input
              id="logo"
              placeholder="https://…/logo.png"
              value={valueOf("brand_logo_url")}
              onChange={(e) => setDraft((d) => ({ ...d, brand_logo_url: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accent">Couleur d'accent</Label>
            <Input
              id="accent"
              type="color"
              className="h-10 w-24 p-1"
              value={valueOf("brand_accent", "#e0b34d")}
              onChange={(e) => setDraft((d) => ({ ...d, brand_accent: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slogan">Slogan</Label>
            <Input
              id="slogan"
              value={valueOf("brand_slogan")}
              onChange={(e) => setDraft((d) => ({ ...d, brand_slogan: e.target.value }))}
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
