import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/archives")({
  component: ArchivesPage,
});

type Tab = "depenses" | "fonds" | "membres" | "votes" | "feuilles";

const TABS: { key: Tab; label: string }[] = [
  { key: "depenses", label: "Journal des dépenses" },
  { key: "fonds", label: "Documents des fonds" },
  { key: "membres", label: "Liste des membres" },
  { key: "votes", label: "Analyses des votes" },
  { key: "feuilles", label: "Feuilles de service" },
];


type Named = { title: string } | null;
type ExpenseRow = { id: string; amount: number; spent_on: string; subcategory: string; description: string; projects: Named; funders: { name: string } | null };
type FundRow = { id: string; amount: number; contributed_on: string; note: string; funders: { name: string; location: string } | null; projects: Named };
type MemberRow = { id: string; full_name: string; email: string; active: boolean; role_description: string; profile_positions: { rank_label: string; positions: { name: string } | null }[] | null };
type VoteRow = { id: string; title: string; status: string; proclamation: string; archived_at: string | null; closed_at: string | null; result_snapshot: { results?: { title: string; votes: number }[]; anomalies?: string[] } | null };
type SheetRow = { id: string; title: string; service_date: string; call_time: string; location: string; crew: string; notes: string; projects: Named };

function money(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Number(n ?? 0));
}

function ArchivesPage() {
  const [tab, setTab] = useState<Tab>("depenses");

  const expenses = useQuery({
    queryKey: ["arch-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, spent_on, subcategory, description, projects(title), funders(name)")
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseRow[];
    },
  });

  const funds = useQuery({
    queryKey: ["arch-funds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, contributed_on, note, funders(name, location), projects(title)")
        .order("contributed_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FundRow[];
    },
  });

  const members = useQuery({
    queryKey: ["arch-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, active, role_description, profile_positions(rank_label, positions(name))")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
  });

  const votes = useQuery({
    queryKey: ["arch-votes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vote_sessions")
        .select("id, title, status, proclamation, archived_at, result_snapshot, closed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VoteRow[];
    },
  });

  const sheets = useQuery({
    queryKey: ["arch-sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_sheets")
        .select("id, title, service_date, call_time, location, crew, notes, projects(title)")
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SheetRow[];
    },
  });

  return (
    <AppLayout title="Archives du club">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {TABS.map((tb) => (
          <Button
            key={tb.key}
            size="sm"
            variant={tab === tb.key ? "default" : "outline"}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => window.print()}>
          Imprimer / PDF
        </Button>
      </div>

      <Card className="clap-panel">
        <CardHeader>
          <CardTitle className="text-sm">{TABS.find((t) => t.key === tab)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {tab === "depenses" && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Projet</th>
                  <th>Poste</th>
                  <th>Bailleur</th>
                  <th>Description</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {(expenses.data ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2">{new Date(e.spent_on).toLocaleDateString("fr-FR")}</td>
                    <td>{e.projects?.title ?? "Club"}</td>
                    <td>{e.subcategory}</td>
                    <td>{e.funders?.name ?? ""}</td>
                    <td>{e.description}</td>
                    <td className="text-right">{money(e.amount)}</td>
                  </tr>
                ))}
                {(expenses.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "fonds" && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Bailleur</th>
                  <th>Provenance</th>
                  <th>Projet</th>
                  <th>Note</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {(funds.data ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2">
                      {new Date(c.contributed_on).toLocaleDateString("fr-FR")}
                    </td>
                    <td>{c.funders?.name ?? ""}</td>
                    <td>{c.funders?.location ?? ""}</td>
                    <td>{c.projects?.title ?? "Club"}</td>
                    <td>{c.note}</td>
                    <td className="text-right">{money(c.amount)}</td>
                  </tr>
                ))}
                {(funds.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
                      Aucun fonds enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "membres" && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Nom</th>
                  <th>Postes</th>
                  <th>Email</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2">{m.full_name}</td>
                    <td>
                      {(m.profile_positions ?? [])
                        .map((pp) =>
                          pp.rank_label
                            ? `${pp.positions?.name ?? ""} (${pp.rank_label})`
                            : (pp.positions?.name ?? ""),
                        )
                        .join(", ")}
                    </td>
                    <td>{m.email}</td>
                    <td>{m.active ? "Actif" : "Inactif"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "votes" && (
            <div className="space-y-3">
              {(votes.data ?? []).map((v) => {
                const snap = v.result_snapshot;
                return (
                  <div key={v.id} className="rounded border border-border p-3">
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.status}
                      {v.archived_at
                        ? ` : archivée le ${new Date(v.archived_at).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                    {v.proclamation ? <p className="mt-1 text-sm">{v.proclamation}</p> : null}
                    {snap?.results && (
                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {snap.results.map((r) => (
                            <tr key={r.title} className="border-t border-border">
                              <td className="py-1">{r.title}</td>
                              <td className="text-right">{r.votes} voix</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {snap?.anomalies && snap.anomalies.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                        {snap.anomalies.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {(votes.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune session de vote.</p>
              )}
            </div>
          )}

          {tab === "feuilles" && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Titre</th>
                  <th>Projet</th>
                  <th>Heure</th>
                  <th>Lieu</th>
                  <th>Équipe</th>
                </tr>
              </thead>
              <tbody>
                {(sheets.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">
                      {new Date(s.service_date).toLocaleDateString("fr-FR")}
                    </td>
                    <td>{s.title}</td>
                    <td>{s.projects?.title ?? ""}</td>
                    <td>{s.call_time}</td>
                    <td>{s.location}</td>
                    <td>{s.crew}</td>
                  </tr>
                ))}
                {(sheets.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
                      Aucune feuille de service.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
