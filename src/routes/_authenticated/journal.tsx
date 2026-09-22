import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/downloads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/journal")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "Journal d'activité — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Journal des actions sensibles du Club Ciné Tremplin, réservé au Producteur général.",
      },
      { property: "og:title", content: "Journal d'activité — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Suivi des actions sensibles réservé au Producteur général.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Entry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string;
  created_at: string;
};

const ALL = "all";

const ENTITY_LABELS: Record<string, string> = {
  profiles: "Comptes",
  user_roles: "Rôles",
  profile_positions: "Postes",
  profile_managers: "Supérieurs",
  idea_votes: "Idées",
  leave_decisions: "Congés",
  casting_applications: "Casting",
  vote_sessions: "Sessions de vote",
  projects: "Projets",
  app_settings: "Réglages",
  project_phases: "Phases",
  positions: "Liste des postes",
};

function AuditPage() {
  const org = useOrgContext();
  const [entity, setEntity] = useState(ALL);
  const [search, setSearch] = useState("");

  const allowed = org.isAdmin || org.has("Producteur général");

  const log = useQuery({
    queryKey: ["audit_log"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  if (!allowed) {
    return (
      <AppLayout title="Journal d'activité">
        <p className="text-sm text-muted-foreground">
          Cet espace est réservé au Producteur général.
        </p>
      </AppLayout>
    );
  }

  const rows = (log.data ?? []).filter(
    (e) =>
      (entity === ALL || e.entity === entity) &&
      (search.trim() === "" ||
        (e.detail + " " + org.profileName(e.actor_id ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  return (
    <AppLayout title="Journal d'activité">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📊 Actions sensibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Le contenu des votes et l'identité des votants ne sont jamais enregistrés : seules les
            ouvertures et clôtures de sessions apparaissent ici.
          </p>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Input
              className="w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
            />
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes les catégories</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimer / enregistrer en PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "journal-activite",
                  ["Date", "Qui", "Catégorie", "Action"],
                  rows.map((e) => [
                    new Date(e.created_at).toLocaleString("fr-FR"),
                    org.profileName(e.actor_id ?? "") || "—",
                    ENTITY_LABELS[e.entity] ?? e.entity,
                    e.detail,
                  ]),
                )
              }
            >
              Télécharger (CSV)
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2">Date</th>
                  <th>Qui</th>
                  <th>Catégorie</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="text-xs">{org.profileName(e.actor_id ?? "") || "—"}</td>
                    <td className="text-xs">{ENTITY_LABELS[e.entity] ?? e.entity}</td>
                    <td>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Aucune action enregistrée.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
