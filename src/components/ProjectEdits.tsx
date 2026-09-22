import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type ProjectEdit = {
  id: string;
  project_id: string;
  field: string;
  field_label: string;
  old_value: string;
  new_value: string;
  author_id: string;
  status: string;
  decision_comment: string;
  decided_at: string | null;
  created_at: string;
};

/** Champs de la fiche projet modifiables avec approbation. */
export const EDITABLE_FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: "title", label: "Titre" },
  { key: "logline", label: "Logline", long: true },
  { key: "description", label: "Présentation", long: true },
  { key: "synopsis", label: "Synopsis", long: true },
  { key: "synopsis_link", label: "Lien du synopsis" },
  { key: "script_title", label: "Titre du scénario" },
  { key: "script_link", label: "Lien du scénario" },
  { key: "budget_title", label: "Titre du budget" },
  { key: "budget_link", label: "Lien du budget" },
];

/** Postes autorisés à compléter une fiche de projet interne. */
export const PROJECT_EDITORS = [
  "Producteur général",
  "Producteur délégué",
  "Réalisateur",
  "Scénariste",
  "Régisseur général",
];

export function useProjectEdits(projectId: string) {
  return useQuery({
    queryKey: ["project_edits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_edits")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectEdit[];
    },
  });
}

/** Proposition d'une modification et approbation par la production. */
export function ProjectEdits({
  projectId,
  current,
  canEdit,
}: {
  projectId: string;
  current: Record<string, string | null | undefined>;
  canEdit: boolean;
}) {
  const org = useOrgContext();
  const qc = useQueryClient();
  const edits = useProjectEdits(projectId);
  const [field, setField] = useState("logline");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");

  const canApprove =
    org.isAdmin ||
    org.myBasePositions.includes("Producteur général") ||
    org.myBasePositions.includes("Producteur délégué");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["project_edits", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project_logline", projectId] });
  };

  const propose = useMutation({
    mutationFn: async () => {
      if (!value.trim()) throw new Error("Saisissez la nouvelle valeur.");
      const meta = EDITABLE_FIELDS.find((f) => f.key === field);
      const { error } = await supabase.from("project_edits").insert({
        project_id: projectId,
        field,
        field_label: meta?.label ?? field,
        old_value: String(current[field] ?? ""),
        new_value: value.trim(),
        author_id: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      refresh();
      toast.success("Modification envoyée pour approbation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (p: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("decide_project_edit", {
        _edit: p.id,
        _approve: p.approve,
        _comment: comment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      refresh();
      toast.success("Décision enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = edits.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const meta = EDITABLE_FIELDS.find((f) => f.key === field);

  return (
    <div className="space-y-3 rounded border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Fiche du projet — modifications et approbation
      </p>

      {pending.length > 0 && (
        <div className="space-y-2 rounded border border-primary/40 bg-primary/5 p-2">
          {pending.map((e) => (
            <div key={e.id} className="space-y-1 text-sm">
              <p>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                  en attente d'approbation
                </span>{" "}
                {e.field_label} — proposé par {org.profileName(e.author_id)} le{" "}
                {new Date(e.created_at).toLocaleDateString("fr-FR")}
              </p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                Avant : {e.old_value || "—"}
              </p>
              <p className="whitespace-pre-wrap text-xs">Proposé : {e.new_value}</p>
              {canApprove && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input
                    className="h-8 w-56"
                    placeholder="Commentaire (facultatif)"
                    value={comment}
                    onChange={(ev) => setComment(ev.target.value)}
                  />
                  <Button size="sm" onClick={() => decide.mutate({ id: e.id, approve: true })}>
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide.mutate({ id: e.id, approve: false })}
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            propose.mutate();
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56 space-y-1">
              <Label className="text-xs">Élément à compléter</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={propose.isPending}>
              Envoyer pour approbation
            </Button>
          </div>
          {meta?.long ? (
            <Textarea
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nouvelle valeur"
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nouvelle valeur"
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            La version affichée officiellement reste la dernière version approuvée par le
            Producteur général ou le Producteur délégué.
          </p>
        </form>
      )}

      {rows.filter((r) => r.status !== "pending").length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          {rows
            .filter((r) => r.status !== "pending")
            .slice(0, 6)
            .map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                {e.decided_at ? new Date(e.decided_at).toLocaleDateString("fr-FR") : ""} ·{" "}
                {e.field_label} · {e.status === "approved" ? "approuvé" : "refusé"} ·{" "}
                {org.profileName(e.author_id)}
                {e.decision_comment ? ` — ${e.decision_comment}` : ""}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
