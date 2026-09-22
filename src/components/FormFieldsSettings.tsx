import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { FormField } from "@/components/FormFields";

const SCOPES = [
  { key: "contrat", label: "Contrats" },
  { key: "feuille", label: "Feuilles de service" },
  { key: "casting", label: "Formulaire de casting" },
] as const;

const TYPES = [
  { key: "text", label: "Texte court" },
  { key: "textarea", label: "Texte long" },
  { key: "date", label: "Date" },
  { key: "number", label: "Nombre" },
  { key: "ouinon", label: "Oui / Non" },
];

function slug(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `champ_${Date.now()}`
  );
}

export function FormFieldsSettings() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<string>("contrat");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");

  const fields = useQuery({
    queryKey: ["form_fields", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .order("scope")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FormField[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form_fields"] });
  const fail = (e: Error) => toast.error(e.message);

  const add = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Indiquez le nom de la case.");
      const existing = (fields.data ?? []).filter((f) => f.scope === scope);
      const { error } = await supabase.from("form_fields").insert({
        scope,
        field_key: slug(label),
        label: label.trim(),
        field_type: type,
        sort_order: existing.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      invalidate();
      toast.success("Case ajoutée");
    },
    onError: fail,
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; label?: string; active?: boolean; sort_order?: number }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("form_fields").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Case retirée");
    },
    onError: fail,
  });

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Ajouter une case</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ff-scope">Fiche concernée</Label>
              <select
                id="ff-scope"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {SCOPES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-label">Nom de la case</Label>
              <Input id="ff-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-type">Type</Label>
              <select
                id="ff-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={add.isPending}>
              Ajouter
            </Button>
            <p className="text-xs text-muted-foreground">
              Les cases ajoutées apparaissent aussitôt dans le formulaire, dans la fiche et dans la
              version imprimable en PDF.
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {SCOPES.map((s) => {
          const list = (fields.data ?? []).filter((f) => f.scope === s.key);
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="text-sm">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune case supplémentaire.</p>
                )}
                {list.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Input
                      className="w-56"
                      defaultValue={f.label}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== f.label &&
                        update.mutate({ id: f.id, label: e.target.value.trim() })
                      }
                    />
                    <Input
                      className="w-20"
                      type="number"
                      defaultValue={f.sort_order}
                      onBlur={(e) => update.mutate({ id: f.id, sort_order: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {TYPES.find((t) => t.key === f.field_type)?.label ?? f.field_type}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Switch
                        checked={f.active}
                        onCheckedChange={(v) => update.mutate({ id: f.id, active: v })}
                      />
                      <span className="text-xs text-muted-foreground">Affichée</span>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
