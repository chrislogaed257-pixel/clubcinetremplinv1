import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useProjectPhases } from "@/components/ProjectPhase";
import { useMe, useProfiles, visibleMemberIds } from "@/hooks/useProfile";
import {
  useOrgContext,
  useUnread,
  useProjects,
  useProjectMembers,
  useProjectStatuses,
  useCategories,
  usePositions,
  useProfilePositions,
} from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { playConfirm } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const statusLabel: Record<string, string> = { todo: "À faire", doing: "En cours", done: "Terminé" };

function Dashboard() {
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const org = useOrgContext();
  const unread = useUnread(org.myId);
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: projectMembers = [] } = useProjectMembers();
  const { data: statuses = [] } = useProjectStatuses();
  const phases = useProjectPhases();
  const { data: categories = [] } = useCategories();
  const { data: positions = [] } = usePositions();
  const { data: profilePositions = [] } = useProfilePositions();
  const { data: categoryConversations = [] } = useQuery({
    queryKey: ["conversations", "category"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, ref_id")
        .eq("kind", "category");
      if (error) throw error;
      return (data ?? []) as { id: string; ref_id: string | null }[];
    },
  });

  // Relances automatiques : vérifiées à l'ouverture du tableau de bord.
  useEffect(() => {
    void supabase.rpc("send_pending_reminders");
  }, []);
  const [comments, setComments] = useState<Record<string, string>>({});

  const tasks = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reports = useQuery({
    queryKey: ["reports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "refused" }) => {
      const comment = (comments[id] ?? "").trim();
      if (!comment) throw new Error("Un commentaire est obligatoire.");
      const { error } = await supabase
        .from("project_members")
        .update({ status, comment })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      playConfirm();
      qc.invalidateQueries({ queryKey: ["project_members"] });
      toast.success("Réponse enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Description de poste : rédigée par le membre, reprise dans l'organigramme.
  const [roleDraft, setRoleDraft] = useState<string | null>(null);
  /** Description officielle des postes occupés, reprise par défaut si rien n'est écrit. */
  const myOfficialDescription = org.profilePositions
    .filter((pp) => pp.profile_id === me?.userId)
    .map((pp) => org.positions.find((p) => p.id === pp.position_id))
    .filter((p): p is NonNullable<typeof p> => !!p && !!(p.description ?? "").trim())
    .map((p) => `${p.name} : ${p.description}`)
    .join("\n\n");
  const roleText =
    roleDraft ?? (me?.profile?.role_description || myOfficialDescription) ?? "";
  const saveRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ role_description: roleText })
        .eq("id", me!.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Description de poste enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Aperçu des projets : titre, logline et phase actuelle.
  const projectBriefs = useQuery({
    queryKey: ["projects", "brief"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, logline, phase_id, state")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        title: string;
        logline: string;
        phase_id: string | null;
        state: string;
      }[];
    },
  });

  const festivals = useQuery({
    queryKey: ["festivals", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("festivals")
        .select("id, name, kind, deadline, url, notes")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        kind: string;
        deadline: string | null;
        url: string;
        notes: string;
      }[];
    },
  });


  const myTasks = (tasks.data ?? []).filter((t) => t.owner_id === me?.userId && t.status !== "done");
  const receivedTasks = (tasks.data ?? []).filter(
    (t) => t.owner_id === me?.userId && t.assigned_by && t.assigned_by !== me?.userId && t.status !== "done",
  );
  const myReports = (reports.data ?? []).filter((r) => r.author_id === me?.userId).slice(0, 5);
  const teamIds = me
    ? visibleMemberIds(profiles, me.userId, me.isAdmin).filter((id) => id !== me.userId)
    : [];
  const name = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  const maxOrder = statuses.reduce((a, s) => Math.max(a, s.sort_order), 0) || 1;
  const progressOf = (status: string) => {
    const s = statuses.find((x) => x.name === status);
    return Math.round(((s?.sort_order ?? 0) / maxOrder) * 100);
  };
  const activePhases = (phases.data ?? []).filter((p) => p.active);
  const phaseProgress = (phaseId: string | null) => {
    if (!phaseId || activePhases.length === 0) return 0;
    const i = activePhases.findIndex((p) => p.id === phaseId);
    return i < 0 ? 0 : Math.round(((i + 1) / activePhases.length) * 100);
  };
  const phaseNameOf = (phaseId: string | null) =>
    (phases.data ?? []).find((p) => p.id === phaseId)?.name ?? "";

  const today = new Date().toISOString().slice(0, 10);
  const lateTasks = (tasks.data ?? []).filter(
    (t) => t.owner_id === me?.userId && t.status !== "done" && t.due_date && t.due_date < today,
  );

  const pending = projectMembers.filter(
    (pm) => pm.profile_id === org.myId && (pm.status ?? "") === "pending",
  );

  return (
    <AppLayout title="📋 Tableau de bord">
      {lateTasks.length > 0 && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
          ⏰ {lateTasks.length} tâche(s) en retard :{" "}
          {lateTasks
            .slice(0, 4)
            .map((t) => t.title)
            .join(", ")}
        </div>
      )}

      {(receivedTasks.length > 0 || unread.total > 0 || pending.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {receivedTasks.length > 0 && (
            <Link to="/taches">
              <Button size="sm" variant="outline">
                📋 {receivedTasks.length} tâche(s) reçue(s) de vos supérieurs
              </Button>
            </Link>
          )}
          {unread.total > 0 && (
            <Link to="/discussion">
              <Button size="sm" variant="outline">
                💬 {unread.total} message(s) non lu(s)
              </Button>
            </Link>
          )}
          {pending.length > 0 && (
            <Button size="sm" variant="outline" asChild>
              <a href="#participation">🎬 {pending.length} participation(s) à confirmer</a>
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="text-sm">Mes tâches en cours ({myTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {myTasks.length === 0 && <p className="text-muted-foreground">Aucune tâche en cours.</p>}
            {myTasks.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.title}</span>
                <Badge variant="secondary">{statusLabel[t.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="text-sm">Mes derniers rapports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {myReports.length === 0 && <p className="text-muted-foreground">Aucun rapport envoyé.</p>}
            {myReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <span>{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="text-sm">Mon équipe ({teamIds.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {teamIds.length === 0 && <p className="text-muted-foreground">Vous ne supervisez personne.</p>}
            {teamIds.slice(0, 8).map((id) => {
              const open = (tasks.data ?? []).filter((t) => t.owner_id === id && t.status !== "done").length;
              const rep = (reports.data ?? []).filter((r) => r.author_id === id).length;
              return (
                <div key={id} className="flex items-center justify-between gap-2">
                  <span>{name(id)}</span>
                  <span className="text-xs text-muted-foreground">
                    {open} tâche(s) ouverte(s) · {rep} rapport(s)
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-lift md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Description de mon poste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Cette description est reprise automatiquement de votre poste : vous pouvez la
              compléter. Ce texte apparaît aussitôt sur votre fiche dans l'organigramme.
            </p>
            {myOfficialDescription && (
              <div className="rounded border border-border bg-muted/40 p-2 text-xs">
                <p className="mb-1 font-medium">Description officielle de votre poste</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {myOfficialDescription}
                </p>
                {myOfficialDescription !== roleText && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 text-[11px]"
                    onClick={() => setRoleDraft(myOfficialDescription)}
                  >
                    Reprendre cette description
                  </Button>
                )}
              </div>
            )}
            <Textarea
              rows={4}
              placeholder="Exemple : je prépare les plans de tournage et je coordonne l'équipe image."
              value={roleText}
              onChange={(e) => setRoleDraft(e.target.value)}
            />
            <Button size="sm" disabled={saveRole.isPending} onClick={() => saveRole.mutate()}>
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="text-sm">Festival en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(festivals.data ?? []).length === 0 && (
              <p className="text-muted-foreground">Aucun festival annoncé.</p>
            )}
            {(festivals.data ?? []).slice(0, 3).map((f) => {
              const days = f.deadline
                ? Math.ceil((new Date(f.deadline).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <div key={f.id} className="space-y-1 rounded border border-border p-3">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.kind === "residence"
                      ? "Résidence"
                      : f.kind === "appel"
                        ? "Appel à projets"
                        : "Festival"}
                    {f.deadline
                      ? ` : date limite ${new Date(f.deadline).toLocaleDateString("fr-FR")}`
                      : ""}
                    {days !== null
                      ? days < 0
                        ? " (dépassée)"
                        : days === 0
                          ? " (dernier jour)"
                          : ` (${days} jour(s) restant(s))`
                      : ""}
                  </p>
                  {f.notes && <p className="text-xs">{f.notes}</p>}
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Voir l'appel
                    </a>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>



        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">🎞️ Catégories du club</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {categories
              .filter((c) => c.active)
              .map((c) => {
                const posIds = positions.filter((p) => p.category_id === c.id).map((p) => p.id);
                const count = new Set(
                  profilePositions
                    .filter((pp) => posIds.includes(pp.position_id))
                    .map((pp) => pp.profile_id),
                ).size;
                const conv = categoryConversations.find((cc) => cc.ref_id === c.id);
                return (
                  <div key={c.id} className="space-y-1 rounded border border-border p-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{count} membre(s)</p>
                    {conv && (
                      <Link
                        to="/discussion"
                        search={{ c: conv.id }}
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        💬 Discussion {c.name}
                      </Link>
                    )}
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card className="card-lift md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">🎬 Projets du club en bref</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {(projectBriefs.data ?? []).length === 0 && (
              <p className="text-muted-foreground">Aucun projet pour le moment.</p>
            )}
            {(projectBriefs.data ?? []).map((p) => (
              <div key={p.id} className="space-y-1 rounded border border-border p-3">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {p.logline || "Logline à venir."}
                </p>
                <p className="text-xs">
                  Phase : {phaseNameOf(p.phase_id) || "—"} · {p.state || "En cours"}
                </p>
                <Link to="/idees" className="text-xs text-primary underline underline-offset-2">
                  Voir la fiche complète
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">🎥 Avancement des projets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {projects.length === 0 && <p className="text-muted-foreground">Aucun projet.</p>}
            {projects.map((p) => {
              const value = p.phase_id ? phaseProgress(p.phase_id) : progressOf(p.status);
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {phaseNameOf(p.phase_id) || p.status || "—"} · {p.state || "En cours"} ·{" "}
                      {value}%
                    </span>
                  </div>
                  <Progress value={value} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {pending.length > 0 && (
          <Card className="md:col-span-3" id="participation">
            <CardHeader>
              <CardTitle className="text-sm">🎬 Participation aux projets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {pending.map((pm) => {
                const project = projects.find((p) => p.id === pm.project_id);
                return (
                  <div key={pm.id} className="space-y-2 rounded border border-border p-3">
                    <p className="font-medium">{project?.title ?? "Projet"}</p>
                    {project?.description && (
                      <p className="text-xs text-muted-foreground">{project.description}</p>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="Commentaire obligatoire"
                      value={comments[pm.id] ?? ""}
                      onChange={(e) =>
                        setComments((c) => ({ ...c, [pm.id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ id: pm.id, status: "accepted" })}
                      >
                        Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ id: pm.id, status: "refused" })}
                      >
                        Refuser
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Votre réponse est enregistrée et visible par les producteurs ; le
                      rattachement au projet est conservé dans tous les cas.
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
