import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Cases supplémentaires configurables par le producteur général.
 * Les valeurs sont stockées dans la colonne `extra` (jsonb) de chaque fiche,
 * ce qui alimente automatiquement l'affichage et la version imprimable / PDF.
 */
export type FormFieldScope = "contrat" | "feuille" | "casting";

export type FormField = {
  id: string;
  scope: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  active: boolean;
};

export type ExtraValues = Record<string, string>;

export function useFormFields(scope: FormFieldScope, onlyActive = true) {
  return useQuery({
    queryKey: ["form_fields", scope, onlyActive],
    queryFn: async () => {
      let q = supabase.from("form_fields").select("*").eq("scope", scope).order("sort_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FormField[];
    },
  });
}

export function ExtraFieldsInputs({
  fields,
  values,
  onChange,
  idPrefix = "xf",
}: {
  fields: FormField[];
  values: ExtraValues;
  onChange: (key: string, value: string) => void;
  idPrefix?: string;
}) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.field_key}`;
        const value = values[f.field_key] ?? "";
        return (
          <div key={f.id} className="space-y-1.5">
            <Label htmlFor={id}>{f.label}</Label>
            {f.field_type === "textarea" ? (
              <Textarea
                id={id}
                rows={3}
                required={f.required}
                value={value}
                onChange={(e) => onChange(f.field_key, e.target.value)}
              />
            ) : f.field_type === "ouinon" ? (
              <select
                id={id}
                required={f.required}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={value}
                onChange={(e) => onChange(f.field_key, e.target.value)}
              >
                <option value="">À préciser</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            ) : (
              <Input
                id={id}
                type={
                  f.field_type === "date" ? "date" : f.field_type === "number" ? "number" : "text"
                }
                required={f.required}
                value={value}
                onChange={(e) => onChange(f.field_key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function ExtraFieldsView({
  fields,
  values,
}: {
  fields: FormField[];
  values: unknown;
}) {
  const data = (values ?? {}) as ExtraValues;
  const rows = fields.filter((f) => (data[f.field_key] ?? "") !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      {rows.map((f) => (
        <div key={f.id} className="flex gap-2">
          <dt className="text-muted-foreground">{f.label} :</dt>
          <dd className="whitespace-pre-wrap">{data[f.field_key]}</dd>
        </div>
      ))}
    </dl>
  );
}
