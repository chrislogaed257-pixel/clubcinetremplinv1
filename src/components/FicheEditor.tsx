import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Fiche = {
  id: string;
  title?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  script_title?: string | null;
  script_link?: string | null;
  intention_note?: string | null;
  intention_link?: string | null;
};

/** Modification directe de la fiche (PG, PD, Scénariste) — tous les membres sont informés. */
export function FicheEditor({ project }: { project: Fiche }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const init = () => ({
    title: project.title ?? "",
    logline: project.logline ?? "",
    synopsis: project.synopsis ?? "",
    script_title: project.script_title ?? "",
    script_link: project.script_link ?? "",
    intention_note: project.intention_note ?? "",
    intention_link: project.intention_link ?? "",
  });
  const [f, setF] = useState(init);
  const save = useMutation({
    mutationFn: async () => {
      if (!f.title.trim()) throw new Error("Le titre est obligatoire.");
      const { error } = await supabase.rpc("update_project_fiche", {
        _project: project.id,
        _changes: f,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["project_logline", project.id] });
      setOpen(false);
      toast.success("Fiche modifiée — tous les membres sont informés");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open)
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setF(init());
          setOpen(true);
        }}
      >
        Modifier la fiche du projet
      </Button>
    );
  type K = keyof ReturnType<typeof init>;
  const row = (k: K, label: string, long = false) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {long ? (
        <Textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      ) : (
        <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      )}
    </div>
  );
  return (
    <div className="space-y-2 rounded border border-border p-3">
      {row("title", "Titre du projet")}
      {row("logline", "Logline", true)}
      {row("synopsis", "Synopsis", true)}
      {row("script_title", "Scénario (titre)")}
      {row("script_link", "Scénario (lien)")}
      {row("intention_note", "Note d'intention", true)}
      {row("intention_link", "Note d'intention (lien)")}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          Enregistrer et informer les membres
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
