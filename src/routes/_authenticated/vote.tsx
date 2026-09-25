import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { downloadCsv, downloadTablePdf } from "@/lib/downloads";
import { voteResults, producerLiveResults } from "@/lib/vote.functions";

export const Route = createFileRoute("/_authenticated/vote")({
  component: VotePage,
});

type Session = {
  id: string;
  title: string;
  description: string;
  status: string;
  max_votes: number;
  created_at: string;
  access_login: string;
  access_code: string;
  public_token?: string | null;
  opened_at: string | null;
  closed_at: string | null;
  proclamation: string;
  require_distinct: boolean;
  live_results: boolean;
  individual_codes: boolean;
};

type VoteProject = {
  id: string;
  session_id: string;
  code: string;
  title: string;
  description: string;
  sort_order: number;
};

function rand(n: number) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

function copy(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`${label} copié`);
}

function VotePage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const canManage = org.isAdmin || org.isDeputy || org.has("Producteur général");
  const isChief = org.isAdmin || org.has("Producteur général");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxVotes, setMaxVotes] = useState("2");

  const sessions = useQuery({
    queryKey: ["vote_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vote_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vote_sessions").insert({
        title,
        description,
        max_votes: Math.max(1, Number(maxVotes) || 2),
        created_by: org.myId,
        access_login: `VOTE-${rand(6)}`,
        access_code: rand(6),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["vote_sessions"] });
      toast.success("Session créée — ajoutez les projets avant d'ouvrir le vote");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (org.isMentor || org.isFunder) {
    return (
      <AppLayout title="Vote collectif">
        <p className="text-sm text-muted-foreground">
          Cet espace est réservé aux membres du club.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Vote collectif">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        {canManage && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Nouvelle session</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="t">Titre du vote</Label>
                  <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d">Description</Label>
                  <Textarea
                    id="d"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m">Voix par votant</Label>
                  <Input
                    id="m"
                    type="number"
                    min={1}
                    value={maxVotes}
                    onChange={(e) => setMaxVotes(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  Créer la session
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {(sessions.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune session de vote.</p>
          )}
          {(sessions.data ?? []).map((s) => (
            <SessionCard key={s.id} session={s} canManage={canManage} isChief={isChief} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function SessionCard({
  session,
  canManage,
  isChief,
}: {
  session: Session;
  canManage: boolean;
  isChief: boolean;
}) {
  const qc = useQueryClient();
  const opened = Boolean(session.opened_at);
  const closed = Boolean(session.closed_at);
  const locked = opened; // plus aucune modification une fois le vote ouvert
  const [code, setCode] = useState("");
  const [ptitle, setPtitle] = useState("");
  const [pdesc, setPdesc] = useState("");
  const [proclamation, setProclamation] = useState(session.proclamation);

  const projects = useQuery({
    queryKey: ["vote_projects", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vote_projects")
        .select("*")
        .eq("session_id", session.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as VoteProject[];
    },
  });

  const results = useQuery({
    queryKey: ["vote_tally", session.id],
    enabled: opened,
    refetchInterval: opened && !closed && session.live_results ? 5000 : false,
    queryFn: async () => voteResults({ data: { sessionId: session.id } }),
  });

  const producerResults = useQuery({
    queryKey: ["vote_tally_producer", session.id],
    enabled: opened && isChief,
    refetchInterval: opened && !closed && isChief ? 2000 : false,
    queryFn: async () => {
      return producerLiveResults({ data: { sessionId: session.id } });
    },
  });

  const addProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vote_projects").insert({
        session_id: session.id,
        code: code.trim().toUpperCase(),
        title: ptitle,
        description: pdesc,
        sort_order: (projects.data ?? []).length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCode("");
      setPtitle("");
      setPdesc("");
      qc.invalidateQueries({ queryKey: ["vote_projects", session.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vote_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vote_projects", session.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Session>) => {
      const { error } = await supabase.from("vote_sessions").update(patch).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vote_sessions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Le projet gagnant rejoint automatiquement « Projet interne » à la clôture ;
   * ce bouton permet de relancer la création si elle n'a pas eu lieu.
   */
  const createInternalProject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_project_from_vote", {
        _session: session.id,
      });
      if (error) throw error;
      const res = data as { ok: boolean; reason?: string } | null;
      if (!res?.ok) {
        const reasons: Record<string, string> = {
          deja_cree: "Le projet interne existe déjà pour ce vote.",
          egalite: "Vote à égalité : le Producteur général a été prévenu.",
          aucun_gagnant: "Aucune voix exprimée : le Producteur général a été prévenu.",
        };
        throw new Error(reasons[res?.reason ?? ""] ?? "Création impossible.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Projet interne créé à partir du gagnant du vote");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toujours partager le site public : une adresse d'aperçu Lovable demande
  // l'autorisation du propriétaire sur les téléphones des votants.
  const voteUrl = "https://clubcinetremplinv1.lovable.app/vote-acces";
  const titleOf = (c: string) => (projects.data ?? []).find((p) => p.code === c)?.title ?? "";
  const ranked = results.data?.rows ?? [];
  const privateRanked = [...(producerResults.data?.rows ?? [])].sort((a, b) => b.votes - a.votes);
  const projectById = (id: string) => (projects.data ?? []).find((p) => p.id === id);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">🗳️ {session.title}</CardTitle>
          {session.description && (
            <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {!opened
              ? "Préparation — modifications encore possibles"
              : closed
                ? `Vote clos · ${session.max_votes} voix par votant`
                : `Vote ouvert · ${session.max_votes} voix par votant`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {!opened && (
              <Button
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Une fois le vote ouvert, plus aucune modification ne sera possible. Confirmer l'ouverture ?",
                    )
                  )
                    update.mutate({ opened_at: new Date().toISOString(), status: "open" });
                }}
              >
                Ouvrir le vote
              </Button>
            )}
            {opened && !closed && isChief && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update.mutate({ closed_at: new Date().toISOString(), status: "published" })
                }
              >
                Clôturer
              </Button>
            )}
            {closed && (
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                PDF
              </Button>
            )}
            {closed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => createInternalProject.mutate()}
                disabled={createInternalProject.isPending}
              >
                Créer le projet interne du gagnant
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="rounded border border-border p-3 text-sm">
            <p className="font-medium">Lien public du vote</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toute personne qui reçoit ce lien entre directement dans le vote, sans compte ni
              authentification.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.public_token && (
                <Button
                  size="sm"
                  onClick={() => copy(`${voteUrl}?t=${session.public_token}`, "Lien public du vote")}
                >
                  Copier le lien public
                </Button>
              )}
            </div>
          </div>
        )}

        {canManage && !locked && (
          <div className="flex flex-wrap gap-4 rounded border border-border p-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={session.require_distinct}
                onChange={(e) => update.mutate({ require_distinct: e.target.checked })}
              />
              Projets différents obligatoires
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={session.live_results}
                onChange={(e) => update.mutate({ live_results: e.target.checked })}
              />
              Chiffres en direct
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={session.individual_codes}
                onChange={(e) => update.mutate({ individual_codes: e.target.checked })}
              />
              Codes votants individuels
            </label>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Projets soumis au vote
          </p>
          {(projects.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded border border-border p-2">
              <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">{p.code}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{p.title || "—"}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                )}
              </div>
              {canManage && !locked && (
                <Button size="sm" variant="ghost" onClick={() => removeProject.mutate(p.id)}>
                  Retirer
                </Button>
              )}
            </div>
          ))}
          {(projects.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>
          )}
          {canManage && !locked && (
            <form
              className="grid gap-2 sm:grid-cols-[110px_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                addProject.mutate();
              }}
            >
              <Input
                placeholder="Code (P1)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Input
                placeholder="Titre (facultatif)"
                value={ptitle}
                onChange={(e) => setPtitle(e.target.value)}
              />
              <Button type="submit" size="sm">
                Ajouter
              </Button>
              <Input
                className="sm:col-span-3"
                placeholder="Description (facultatif)"
                value={pdesc}
                onChange={(e) => setPdesc(e.target.value)}
              />
            </form>
          )}
        </div>

        {opened && results.data?.visible && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {closed ? "Résultats définitifs" : "Chiffres en direct"} — {results.data.total} voix
            </p>
            {ranked.map((r, i) => (
              <div key={r.code} className="flex items-center justify-between text-sm">
                <span>
                  {i + 1}. <span className="font-mono">{r.code}</span>{" "}
                  {titleOf(r.code) && `— ${titleOf(r.code)}`}
                </span>
                <span className="text-muted-foreground">{r.votes} voix</span>
              </div>
            ))}
            {ranked.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune voix exprimée.</p>
            )}
            {ranked.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadTablePdf({
                      title: `Résultats — ${session.title}`,
                      subtitle: `${results.data?.total ?? 0} voix exprimées`,
                      fileName: `resultats-${session.title}`,
                      head: ["Rang", "Code", "Projet", "Voix"],
                      rows: ranked.map((r, i) => [
                        String(i + 1),
                        r.code,
                        titleOf(r.code),
                        String(r.votes),
                      ]),
                    })
                  }
                >
                  Télécharger les résultats (PDF)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      `resultats-${session.title}`,
                      ["Rang", "Code", "Projet", "Voix"],
                      ranked.map((r, i) => [
                        String(i + 1),
                        r.code,
                        titleOf(r.code),
                        String(r.votes),
                      ]),
                    )
                  }
                >
                  Télécharger (CSV)
                </Button>
              </div>
            )}
          </div>
        )}

        {opened && isChief && (
          <div className="space-y-2 rounded border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Suivi privé du Producteur général
              </p>
              <span className="text-sm font-medium">
                {producerResults.data?.total ?? 0} voix exprimées
              </span>
            </div>
            {producerResults.isPending && (
              <p className="text-sm text-muted-foreground">Actualisation des chiffres…</p>
            )}
            {producerResults.isError && (
              <p className="text-sm text-destructive">
                Les chiffres n'ont pas pu être actualisés. Une nouvelle tentative est automatique.
              </p>
            )}
            {privateRanked.map((row, index) => {
              const project = projectById(row.projectId);
              return (
                <div key={row.projectId} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {project?.code ? `${project.code} — ` : ""}{project?.title || "Projet"}
                  </span>
                  <span className="font-semibold">{row.votes} voix</span>
                </div>
              );
            })}
            {!producerResults.isPending && privateRanked.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune voix exprimée.</p>
            )}
            {!closed && (
              <p className="text-[11px] text-muted-foreground">
                Chiffres confidentiels, actualisés automatiquement toutes les deux secondes.
              </p>
            )}
          </div>
        )}

        {closed && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Proclamation</p>
            {canManage ? (
              <>
                <Textarea
                  rows={3}
                  value={proclamation}
                  onChange={(e) => setProclamation(e.target.value)}
                  placeholder="Projets retenus, décision en cas d'ex æquo…"
                />
                <Button size="sm" onClick={() => update.mutate({ proclamation })}>
                  Enregistrer la proclamation
                </Button>
              </>
            ) : (
              <p className="text-sm">{session.proclamation || "—"}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Clôturé le {new Date(session.closed_at!).toLocaleString("fr-FR")} · aucun nom de
              votant n'est enregistré.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
