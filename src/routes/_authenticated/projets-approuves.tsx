import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clubLeaderIds, notifyProfiles, sendClubMail } from "@/lib/club-email";
import { Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projets-approuves")({
  component: ApprovedProjectsPage,
  head: () => ({
    meta: [
      { title: "Projets approuvés — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Tous les projets approuvés du Club Ciné Tremplin : équipe, synopsis, logline, phase d'avancement et délai.",
      },
      { property: "og:title", content: "Projets approuvés — Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Suivez l'avancement et les délais des projets du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type P = {
  id: string;
  title: string;
  logline: string;
  synopsis: string;
  intention_note: string;
  directing_note: string;
  script_title: string;
  script_link: string;
  synopsis_link: string;
  logline_link: string;
  intention_link: string;
  directing_link: string;
  origin: string;
  approval_state: string;
  deadline: string | null;
  deadline_note: string;
  started_at: string | null;
  phase_id: string | null;
  author_profile_id: string | null;
  author_name: string;
  author_email: string;
  author_position: string;
  created_by: string | null;
  owner_profile_id: string | null;
  refusal_reason: string;
};

type Review = {
  id: string;
  project_id: string;
  reviewer_id: string;
  decision: string;
  comment: string;
};

const DECISIONS: Record<string, string> = {
  approuve: "Approuvé",
  a_revoir: "À revoir",
  refuse: "Refusé",
};

function ApprovedProjectsPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [view, setView] = useState<"tous" | "interne" | "externe" | "etude">("tous");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<Record<string, string>>({});

  const isPG = org.isAdmin || org.myBasePositions.includes("Producteur général");
  const isPD = org.myBasePositions.includes("Producteur délégué");
  const isCommittee =
    isPG ||
    isPD ||
    org.myBasePositions.includes("Réalisateur") ||
    org.myBasePositions.includes("Scénariste");

  const projects = useQuery({
    queryKey: ["projects", "approved-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as P[];
    },
  });

  const phases = useQuery({
    queryKey: ["project_phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const reviews = useQuery({
    queryKey: ["project_reviews"],
    enabled: isCommittee,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_reviews").select("*");
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const members = useQuery({
    queryKey: ["project_members", "approved-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, profile_id, status");
      if (error) throw error;
      return (data ?? []) as { project_id: string; profile_id: string; status: string }[];
    },
  });

  const review = useMutation({
    mutationFn: async (p: { project: P; decision: string }) => {
      const text = comment[p.project.id] ?? "";
      if (!text.trim()) throw new Error("Un commentaire est demandé avec votre avis.");
      const { error } = await supabase.from("project_reviews").upsert(
        {
          project_id: p.project.id,
          reviewer_id: org.myId!,
          decision: p.decision,
          comment: text.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,reviewer_id" },
      );
      if (error) throw error;
      const targets = [
        ...(await clubLeaderIds()),
        ...(p.project.author_profile_id ? [p.project.author_profile_id] : []),
      ];
      await notifyProfiles(
        targets,
        "Avis rendu sur un projet",
        `${org.profileName(org.myId ?? "")} a donné son avis (${DECISIONS[p.decision]}) sur « ${p.project.title} ».`,
        "/projets-approuves",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_reviews"] });
      toast.success("Avis enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (p: { project: P; approve: boolean }) => {
      const { error } = await supabase
        .from("projects")
        .update(
          p.approve
            ? {
                approval_state: "approuve",
                approved_at: new Date().toISOString(),
                approved_by: org.myId,
              }
            : { approval_state: "refuse", refusal_reason: comment[p.project.id] ?? "" },
        )
        .eq("id", p.project.id);
      if (error) throw error;
      if (p.project.author_profile_id)
        await notifyProfiles(
          [p.project.author_profile_id],
          p.approve ? "Projet approuvé" : "Projet refusé",
          `Votre projet « ${p.project.title} » a été ${p.approve ? "approuvé" : "refusé"}.`,
          "/projets-approuves",
        );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Décision enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDeadline = useMutation({
    mutationFn: async (p: P) => {
      const value = deadline[p.id] ?? "";
      const { error } = await supabase
        .from("projects")
        .update({ deadline: value || null })
        .eq("id", p.id);
      if (error) throw error;
      if (p.author_profile_id)
        await notifyProfiles(
          [p.author_profile_id],
          "Délai du projet",
          `Le délai du projet « ${p.title} » est fixé au ${value || "—"}.`,
          "/projets-approuves",
        );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Délai enregistré et communiqué");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: async (p: P) => {
      const { error } = await supabase
        .from("projects")
        .update({ started_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw error;
      if (p.author_profile_id)
        await notifyProfiles(
          [p.author_profile_id],
          "Projet démarré",
          `Le projet « ${p.title} » vient d'être lancé.`,
          "/projets-approuves",
        );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet démarré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (p: P) => {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString(), deleted_by: org.myId })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet mis à la corbeille : le Producteur général peut le restaurer.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = projects.data ?? [];
  const list =
    view === "tous"
      ? all
      : view === "etude"
        ? all.filter((p) => p.approval_state === "en_etude")
        : all.filter((p) => p.approval_state === "approuve" && (p.origin === "externe") === (view === "externe"));

  const phaseName = (id: string | null) =>
    (phases.data ?? []).find((p) => p.id === id)?.name ?? "Phase non définie";

  const canDelete = (p: P) =>
    isPG || p.created_by === org.myId || p.author_profile_id === org.myId;

  const canEditFiche = isPG || isPD || org.myBasePositions.includes("Scénariste");

  return (
    <AppLayout title="Projets approuvés">
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="tous">Tous les projets ({all.length})</TabsTrigger>
          <TabsTrigger value="interne">Projets internes approuvés</TabsTrigger>
          <TabsTrigger value="externe">Projets externes approuvés</TabsTrigger>
          <TabsTrigger value="etude">En cours d'étude</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-4 space-y-3">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun projet dans cette vue.</p>
          )}
          {list.map((p) => {
            const team = (members.data ?? []).filter((m) => m.project_id === p.id);
            const given = (reviews.data ?? []).filter((r) => r.project_id === p.id);
            return (
              <Card key={p.id} className="card-lift">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {p.title}
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-normal">
                      {p.origin === "externe" ? "Dossier externe" : "Dossier interne"}
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                      {phaseName(p.phase_id)}
                    </span>
                    {p.started_at && (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-normal text-emerald-400">
                        Démarré
                      </span>
                    )}
                    {p.deadline && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-400">
                        Délai : {p.deadline}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {p.logline && <p className="italic">{p.logline}</p>}
                  {p.synopsis && <p className="whitespace-pre-wrap">{p.synopsis}</p>}
                  {isCommittee && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {p.intention_note && (
                        <p className="whitespace-pre-wrap">
                          <strong>Note d'intention :</strong> {p.intention_note}
                        </p>
                      )}
                      {p.directing_note && (
                        <p className="whitespace-pre-wrap">
                          <strong>Note du réalisateur :</strong> {p.directing_note}
                        </p>
                      )}
                      {p.script_title && (
                        <p className="whitespace-pre-wrap">
                          <strong>Scénario :</strong> {p.script_title}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      ["Logline", p.logline_link],
                      ["Synopsis", p.synopsis_link],
                      ["Note d'intention", p.intention_link],
                      ["Note du réalisateur", p.directing_link],
                      ["Scénario", p.script_link],
                    ]
                      .filter(([, l]) => !!l)
                      .map(([label, l]) => (
                        <a
                          key={label}
                          href={l as string}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-blue-500/10 px-2 py-1 text-blue-400 underline"
                        >
                          {label} (lien Google)
                        </a>
                      ))}
                  </div>

                  {canEditFiche && <FicheEditor project={p} />}
                  <p className="text-xs text-muted-foreground">
                    Auteur : {p.author_name || org.profileName(p.created_by ?? "")}
                    {p.author_position ? ` · ${p.author_position}` : ""}
                    {p.author_email ? ` · ${p.author_email}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Personnes sur le projet :{" "}
                    {team.length === 0
                      ? "à constituer"
                      : team.map((m) => org.profileName(m.profile_id)).join(", ")}
                  </p>

                  {given.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                      {given.map((r) => (
                        <p key={r.id}>
                          {org.profileName(r.reviewer_id)} — {DECISIONS[r.decision] ?? r.decision} :{" "}
                          {r.comment}
                        </p>
                      ))}
                    </div>
                  )}

                  {isCommittee && p.approval_state === "en_etude" && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Textarea
                        rows={2}
                        placeholder="Votre commentaire"
                        value={comment[p.id] ?? ""}
                        onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => review.mutate({ project: p, decision: "approuve" })}>
                          Avis : approuvé
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => review.mutate({ project: p, decision: "a_revoir" })}
                        >
                          Avis : à revoir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => review.mutate({ project: p, decision: "refuse" })}
                        >
                          Avis : refusé
                        </Button>
                        {(isPG || (p.origin === "externe" && isPD)) && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => decide.mutate({ project: p, approve: true })}
                            >
                              Approuver le projet
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => decide.mutate({ project: p, approve: false })}
                            >
                              Refuser le projet
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {(isPG || isPD) && (
                      <>
                        <Input
                          type="date"
                          className="w-44"
                          value={deadline[p.id] ?? p.deadline ?? ""}
                          onChange={(e) => setDeadline({ ...deadline, [p.id]: e.target.value })}
                        />
                        <Button size="sm" variant="outline" onClick={() => saveDeadline.mutate(p)}>
                          Enregistrer le délai
                        </Button>
                      </>
                    )}
                    {isCommittee && p.approval_state === "approuve" && !p.started_at && (
                      <Button size="sm" onClick={() => start.mutate(p)}>
                        Démarrer ce projet
                      </Button>
                    )}
                    {p.author_email && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          sendClubMail({
                            recipient: p.author_email,
                            subject: `Ciné Tremplin — votre projet « ${p.title} »`,
                            body: `Bonjour ${p.author_name},\n\nVoici des nouvelles de votre projet « ${p.title} ».\nPhase actuelle : ${phaseName(p.phase_id)}.\nDélai : ${p.deadline ?? "à définir"}.\n\nL'équipe du Club Ciné Tremplin`,
                            section: "Projets approuvés",
                            entityId: p.id,
                          })
                        }
                      >
                        <Mail className="mr-1 h-3.5 w-3.5" /> Répondre par e-mail
                      </Button>
                    )}
                    {canDelete(p) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const warn = window.confirm(
                            "Retirer ce projet ? Il ira dans la corbeille et pourra être restauré par le Producteur général. Les dépenses et le budget déjà enregistrés sont conservés.",
                          );
                          if (warn) softDelete.mutate(p);
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Retirer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
