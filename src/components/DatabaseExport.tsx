import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { toast } from "sonner";

/** Tables reprises dans la fiche téléchargeable (aucune donnée d'authentification). */
const TABLES = [
  "profiles",
  "positions",
  "position_categories",
  "profile_positions",
  "profile_managers",
  "projects",
  "project_budget_lines",
  "project_edits",
  "project_members",
  "project_phases",
  "project_statuses",
  "project_phase_history",
  "ideas",
  "idea_votes",
  "tasks",
  "reports",
  "report_comments",
  "teams",
  "team_members",
  "leave_requests",
  "expenses",
  "expense_categories",
  "contributions",
  "funders",
  "contracts",
  "festivals",
  "call_sheets",
  "casting_calls",
  "casting_applications",
  "meetings",
  "resources",
  "vote_projects",
  "menu_config",
  "role_config",
  "app_settings",
  "message_templates",
  "form_fields",
  "email_settings",
  "email_log",
] as const;

/** Colonnes jamais exportées (jetons, codes et pièces jointes privées). */
const HIDDEN = new Set([
  "access_code",
  "access_login",
  "public_token",
  "mentor_token",
  "code",
  "password",
  "voter_token",
  "token_fingerprint",
  "file_url",
]);

function clean(rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (HIDDEN.has(k)) continue;
      out[k] = v && typeof v === "object" ? JSON.stringify(v) : v;
    }
    return out;
  });
}

/** Fiche complète de la base : une feuille par table, la structure et le journal. */
export function DatabaseExport() {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.utils.book_new();

      const { data: structure } = await supabase.rpc("db_structure");
      const structRows: Record<string, string>[] = [];
      for (const [table, cols] of Object.entries(
        (structure ?? {}) as Record<string, string[]>,
      )) {
        for (const c of cols) structRows.push({ Table: table, Colonne: c });
      }
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(structRows),
        "Structure",
      );

      const { data: log } = await supabase
        .from("change_log")
        .select("created_at, table_name, action, source, summary, actor_id, changed")
        .order("created_at", { ascending: false })
        .limit(5000);
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          (log ?? []).map((l) => ({
            Date: new Date(l.created_at).toLocaleString("fr-FR"),
            Table: l.table_name,
            Action: l.action,
            Origine: l.source,
            Résumé: l.summary,
            "Auteur (identifiant)": l.actor_id ?? "",
            Détail: JSON.stringify(l.changed),
          })),
        ),
        "Journal des modifications",
      );

      let empty = 0;
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select("*").limit(5000);
        if (error) continue;
        const rows = clean((data ?? []) as Record<string, unknown>[]);
        if (rows.length === 0) empty += 1;
        XLSX.utils.book_append_sheet(
          book,
          XLSX.utils.json_to_sheet(rows.length ? rows : [{ Information: "Aucune donnée" }]),
          t.slice(0, 31),
        );
      }

      XLSX.writeFile(book, `base-cine-tremplin-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Fiche téléchargée (${TABLES.length} tables, dont ${empty} vides)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Fiche de la base de données</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Un fichier Excel avec une feuille par rubrique de l'application, une feuille
          « Structure » et une feuille « Journal des modifications ». Les mots de passe, codes
          d'accès et liens privés n'y figurent jamais.
        </p>
        <Button size="sm" disabled={busy} onClick={() => void run()}>
          <Download className="mr-1 h-4 w-4" />
          {busy ? "Préparation…" : "Télécharger la base de données"}
        </Button>
        <ChangeLogPreview />
      </CardContent>
    </Card>
  );
}

function ChangeLogPreview() {
  const [rows, setRows] = useState<
    { id: string; created_at: string; table_name: string; action: string; source: string; summary: string }[]
  >([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("change_log")
      .select("id, created_at, table_name, action, source, summary")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows(data ?? []);
    setOpen(true);
  }

  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => void load()}>
        Voir les 30 dernières modifications
      </Button>
    );

  return (
    <div className="space-y-1 border-t border-border pt-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Aucune modification enregistrée.</p>}
      {rows.map((r) => (
        <p key={r.id} className="text-xs text-muted-foreground">
          {new Date(r.created_at).toLocaleString("fr-FR")} · {r.table_name} · {r.action}
          {r.source !== "application" ? ` · ${r.source}` : ""} — {r.summary}
        </p>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Masquer
      </Button>
    </div>
  );
}
