import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Result = { label: string; kind: string; to: string };

/**
 * Recherche globale. Toutes les requêtes passent par la base : un membre ne peut
 * donc voir que ce que ses droits l'autorisent. Les votes ne sont jamais indexés.
 */
export function GlobalSearch({
  sections = [],
}: {
  sections?: { to: string; label: string }[];
} = {}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const org = useOrgContext();
  const navigate = useNavigate();
  const q = term.trim();

  const results = useQuery({
    queryKey: ["global_search", q, sections.map((s) => s.to).join("|")],
    enabled: q.length >= 2 && !org.isMentor && !org.isFunder,
    queryFn: async (): Promise<Result[]> => {
      const like = `%${q}%`;
      const [
        projects,
        tasks,
        reports,
        contracts,
        festivals,
        resources,
        ideas,
        castings,
        applications,
        meetings,
        callSheets,
        teams,
        funders,
        expenses,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, title, logline, description, synopsis")
          .or(
            `title.ilike.${like},logline.ilike.${like},description.ilike.${like},synopsis.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("tasks")
          .select("id, title, description")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(6),
        supabase
          .from("reports")
          .select("id, title, content")
          .or(`title.ilike.${like},content.ilike.${like}`)
          .limit(6),
        supabase
          .from("contracts")
          .select("id, role_title, terms")
          .or(`role_title.ilike.${like},terms.ilike.${like}`)
          .limit(6),
        supabase
          .from("festivals")
          .select("id, name, notes")
          .or(`name.ilike.${like},notes.ilike.${like}`)
          .limit(6),
        supabase
          .from("resources")
          .select("id, title, description, category")
          .or(`title.ilike.${like},description.ilike.${like},category.ilike.${like}`)
          .limit(6),
        supabase
          .from("ideas")
          .select("id, project_title, reference, submitter_name, logline")
          .or(
            `project_title.ilike.${like},reference.ilike.${like},submitter_name.ilike.${like},logline.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("casting_calls")
          .select("id, title, description")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(6),
        supabase
          .from("casting_applications")
          .select("id, full_name, email, city")
          .or(`full_name.ilike.${like},email.ilike.${like},city.ilike.${like}`)
          .limit(6),
        supabase
          .from("meetings")
          .select("id, title, description")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(6),
        supabase
          .from("call_sheets")
          .select("id, title, location, crew")
          .or(`title.ilike.${like},location.ilike.${like},crew.ilike.${like}`)
          .limit(6),
        supabase.from("teams").select("id, name").ilike("name", like).limit(6),
        supabase
          .from("funders")
          .select("id, name, location, email")
          .or(`name.ilike.${like},location.ilike.${like},email.ilike.${like}`)
          .limit(6),
        supabase
          .from("expenses")
          .select("id, description, subcategory")
          .or(`description.ilike.${like},subcategory.ilike.${like}`)
          .limit(6),
      ]);
      const lower = q.toLowerCase();
      const people: Result[] = org.activeProfiles
        .filter((p) =>
          `${p.full_name} ${p.email ?? ""} ${p.position ?? ""} ${p.role_description ?? ""}`
            .toLowerCase()
            .includes(lower),
        )
        .slice(0, 6)
        .map((p) => ({ label: p.full_name, kind: "Membre", to: `/profil/${p.id}` }));
      const positions: Result[] = (org.positions ?? [])
        .filter((p) =>
          `${p.name} ${(p as { description?: string }).description ?? ""}`
            .toLowerCase()
            .includes(lower),
        )
        .slice(0, 4)
        .map((p) => ({ label: p.name, kind: "Poste", to: "/organigramme" }));
      const norm = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sectionResults: Result[] = sections
        .filter((s) => norm(s.label).includes(norm(q)))
        .map((s) => ({ label: s.label, kind: "Rubrique", to: s.to }));
      return [
        ...sectionResults,
        ...people,
        ...positions,
        ...(projects.data ?? []).map((r) => ({ label: r.title, kind: "Projet", to: "/idees" })),
        ...(ideas.data ?? []).map((r) => ({
          label: [r.reference, r.project_title || r.submitter_name].filter(Boolean).join(" · "),
          kind: "Dossier",
          to: "/idees",
        })),
        ...(tasks.data ?? []).map((r) => ({ label: r.title, kind: "Tâche", to: "/taches" })),
        ...(reports.data ?? []).map((r) => ({ label: r.title, kind: "Rapport", to: "/rapports" })),
        ...(contracts.data ?? []).map((r) => ({
          label: r.role_title,
          kind: "Contrat",
          to: "/contrats",
        })),
        ...(festivals.data ?? []).map((r) => ({
          label: r.name,
          kind: "Festival",
          to: "/festivals",
        })),
        ...(resources.data ?? []).map((r) => ({
          label: r.title,
          kind: "Document",
          to: "/ressources",
        })),
        ...(castings.data ?? []).map((r) => ({ label: r.title, kind: "Casting", to: "/casting" })),
        ...(applications.data ?? []).map((r) => ({
          label: r.full_name,
          kind: "Candidature",
          to: "/casting",
        })),
        ...(meetings.data ?? []).map((r) => ({ label: r.title, kind: "Réunion", to: "/reunions" })),
        ...(callSheets.data ?? []).map((r) => ({
          label: r.title,
          kind: "Feuille de service",
          to: "/feuille-de-service",
        })),
        ...(teams.data ?? []).map((r) => ({ label: r.name, kind: "Équipe", to: "/equipes" })),
        ...(funders.data ?? []).map((r) => ({
          label: r.name,
          kind: "Bailleur",
          to: "/comptabilite",
        })),
        ...(expenses.data ?? []).map((r) => ({
          label: r.description || r.subcategory,
          kind: "Dépense",
          to: "/comptabilite",
        })),
      ].filter((r) => r.label && r.label.trim().length > 0);
    },
  });

  if (org.isMentor || org.isFunder) return null;

  return (
    <div className="relative shrink-0">
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 Rechercher…"
        className="h-7 w-36 text-[11px] lg:w-48"
      />
      {open && q.length >= 2 && (
        <div className="absolute right-0 z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded border border-border bg-background p-1 shadow-lg">
          {(results.data ?? []).length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Aucun résultat.</p>
          )}
          {(results.data ?? []).map((r, i) => (
            <Button
              key={`${r.kind}-${i}`}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                setOpen(false);
                setTerm("");
                navigate({ to: r.to });
              }}
            >
              <span className="mr-2 text-muted-foreground">{r.kind}</span>
              {r.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
