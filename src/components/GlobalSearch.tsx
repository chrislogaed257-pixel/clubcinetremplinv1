import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Result = { label: string; kind: string; to: string };
type ResultsPosition = { top: number; left: number; width: number };

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
  const [resultsPosition, setResultsPosition] = useState<ResultsPosition | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const org = useOrgContext();
  const navigate = useNavigate();
  const q = term.trim();

  useEffect(() => {
    if (!open) return;
    const placeResults = () => {
      const box = searchRef.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(352, window.innerWidth - 16);
      setResultsPosition({
        top: box.bottom + 6,
        left: Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8)),
        width,
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !searchRef.current?.contains(target)) setOpen(false);
    };
    placeResults();
    window.addEventListener("resize", placeResults);
    window.addEventListener("scroll", placeResults, true);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("resize", placeResults);
      window.removeEventListener("scroll", placeResults, true);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

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
    <div ref={searchRef} className="relative shrink-0">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Rechercher…"
        aria-label="Rechercher dans l'application"
        aria-expanded={open && q.length >= 2}
        aria-controls="global-search-results"
        className="h-7 w-36 pl-7 text-[11px] lg:w-48"
      />
      {open && q.length >= 2 && resultsPosition &&
        createPortal(
          <div
            id="global-search-results"
            role="listbox"
            className="fixed z-[100] max-h-[min(24rem,60vh)] overflow-y-auto rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
            style={resultsPosition}
          >
            {results.isPending && (
              <p className="p-3 text-xs text-muted-foreground">Recherche en cours…</p>
            )}
            {!results.isPending && (results.data ?? []).length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">Aucun résultat.</p>
            )}
            {(results.data ?? []).map((r, i) => (
              <Button
                key={`${r.kind}-${i}`}
                role="option"
                variant="ghost"
                size="sm"
                className="h-auto min-h-9 w-full justify-start gap-2 whitespace-normal px-2 py-2 text-left text-xs"
                onClick={() => {
                  setOpen(false);
                  setTerm("");
                  navigate({ to: r.to });
                }}
              >
                <span className="w-20 shrink-0 text-[10px] font-semibold uppercase text-primary">
                  {r.kind}
                </span>
                <span className="min-w-0 break-words">{r.label}</span>
              </Button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
