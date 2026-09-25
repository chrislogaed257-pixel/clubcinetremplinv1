import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useOrgContext } from "@/hooks/useOrg";
import { Chat, useConversation } from "@/components/Chat";
import { ProjectPhaseControl } from "@/components/ProjectPhase";
import { getIdeaFileLink, approveIdeaAsProducer } from "@/lib/ideas.functions";
import { createProject, deleteProject } from "@/lib/projects.functions";
import { FicheEditor } from "@/components/FicheEditor";
import { sendClubMail } from "@/lib/club-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { IdeaTimeline } from "@/components/IdeaTimeline";
import { IdeaFullContent } from "@/components/IdeaFullContent";

import { ProjectBudget } from "@/components/ProjectBudget";
import { ProjectEdits, PROJECT_EDITORS } from "@/components/ProjectEdits";
import { downloadTextPdf } from "@/lib/downloads";
import { Copy, Mail, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/idees")({
  component: IdeasPage,
});

type Idea = {
  id: string;
  submitter_name: string;
  submitter_email: string;
  description: string;
  file_url: string | null;
  drive_link: string | null;
  status: string;
  responded: boolean;
  responded_at: string | null;
  response_note: string | null;
  created_at: string;
  reference?: string | null;
  public_token?: string | null;
  response_drive_link?: string | null;
  origin?: string | null;
  project_title?: string | null;
  presentation?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  treatment?: string | null;
  intention_note?: string | null;
  directing_note?: string | null;
  script_text?: string | null;
  submitter_job?: string | null;
  experience_level?: string | null;
  presentation_link?: string | null;
  logline_link?: string | null;
  synopsis_link?: string | null;
  intention_link?: string | null;
  directing_link?: string | null;
  script_link?: string | null;
};

type Vote = {
  id: string;
  idea_id: string;
  voter_id: string;
  voter_position: string;
  decision: "approved" | "rejected";
  comment: string;
};
type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  idea_id: string | null;
  phase_id: string | null;
  state: string;
  synopsis?: string;
  synopsis_link?: string;
  script_title?: string;
  script_link?: string;
  budget_title?: string;
  budget_link?: string;
};

const PROJECT_MANAGERS = [
  "Producteur général",
  "Producteur délégué",
  "Scénariste",
  "Réalisateur",
  "Comptable / Trésorier",
];

const VOTING_POSITIONS = ["Producteur général", "Producteur délégué", "Scénariste"];

/** Numérotation romaine des projets (I, II, III…). */
function roman(n: number): string {
  const table: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, letters] of table) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}

/** Jours restants avant la fin du délai de décision de 3 jours. */
function daysLeft(createdAt: string): number {
  const limit = new Date(createdAt).getTime() + 3 * 86400000;
  return Math.ceil((limit - Date.now()) / 86400000);
}

function IdeasPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [view, setView] = useState<"interne" | "externe">("interne");
  const [driveDraft, setDriveDraft] = useState<Record<string, string>>({});

  const ideas = useQuery({
    queryKey: ["ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });
  const votes = useQuery({
    queryKey: ["idea_votes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_votes").select("*");
      if (error) throw error;
      return (data ?? []) as Vote[];
    },
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
  const templates = useQuery({
    queryKey: ["message_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*");
      if (error) throw error;
      return (data ?? []) as { key: string; subject: string; body: string }[];
    },
  });

  const roleConfig = useQuery({
    queryKey: ["role_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_config").select("key, positions");
      if (error) throw error;
      return (data ?? []) as { key: string; positions: string[] }[];
    },
  });

  const votingPositions =
    roleConfig.data?.find((r) => r.key === "idea_voters")?.positions ?? VOTING_POSITIONS;

  const trackingUrl = (idea: Idea) =>
    idea.public_token && typeof window !== "undefined"
      ? `${window.location.origin}/suivi-dossier/${idea.public_token}`
      : "";

  const fillTemplate = (key: string, idea: Idea) => {
    const t = (templates.data ?? []).find((x) => x.key === key);
    if (!t) return { subject: "", body: "" };
    const apply = (s: string) =>
      s
        .replaceAll("{nom}", idea.submitter_name)
        .replaceAll("{reference}", idea.reference ?? "")
        .replaceAll("{titre}", idea.project_title ?? "")
        .replaceAll("{lien_suivi}", trackingUrl(idea))
        .replaceAll("{lien_drive}", idea.response_drive_link ?? "");
    return { subject: apply(t.subject ?? ""), body: apply(t.body ?? "") };
  };

  const autoReply = (idea: Idea) => {
    const key = idea.status === "Projet approuvé" ? "idea_approved" : "idea_rejected";
    const t = fillTemplate(key, idea);
    if (!t.body) return "";
    return idea.response_drive_link
      ? `${t.body}\n\nDocuments du club : ${idea.response_drive_link}`
      : t.body;
  };

  /**
   * Envoie la réponse finale à l'auteur : elle passe par le point d'envoi unique
   * du club (et reste inscrite au journal des e-mails). Si l'application ne peut
   * pas envoyer elle-même, la messagerie s'ouvre avec le message prêt.
   */
  const mailReply = async (idea: Idea) => {
    const key = idea.status === "Projet approuvé" ? "idea_approved" : "idea_rejected";
    const t = fillTemplate(key, idea);
    const body = idea.response_drive_link
      ? `${t.body}\n\nDocuments du club : ${idea.response_drive_link}`
      : t.body;
    await sendClubMail({
      recipient: idea.submitter_email,
      subject: t.subject || `Ciné Tremplin — réponse à votre dossier ${idea.reference ?? ""}`,
      body: body || `Bonjour ${idea.submitter_name},`,
      section: "Idées & projets",
      entityId: idea.id,
      template: key,
    });
    toast.success("Réponse enregistrée dans le journal des e-mails.");
  };

  /** Envoie l'accusé de réception à l'auteur du dossier. */
  const mailReceipt = async (idea: Idea) => {
    const t = fillTemplate("idea_received", idea);
    await sendClubMail({
      recipient: idea.submitter_email,
      subject: t.subject || `Ciné Tremplin — bien reçu, dossier ${idea.reference ?? ""}`,
      body:
        t.body ||
        `Bonjour ${idea.submitter_name},\n\nNous confirmons la réception de votre dossier ${idea.reference ?? ""}.`,
      section: "Idées & projets",
      entityId: idea.id,
      template: "idea_received",
    });
    toast.success("Accusé de réception enregistré dans le journal des e-mails.");
  };

  const receiptPdf = (idea: Idea) =>
    downloadTextPdf({
      title: "Accusé de réception de dossier",
      subtitle: `Dossier ${idea.reference ?? ""} — ${new Date(idea.created_at).toLocaleDateString("fr-FR")}`,
      fileName: `accuse-reception-${idea.reference ?? idea.id}`,
      blocks: [
        {
          text: `Bonjour ${idea.submitter_name},\n\nLe Club Ciné Tremplin confirme la bonne réception de votre dossier « ${idea.project_title || idea.description.slice(0, 80)} », enregistré sous le numéro ${idea.reference ?? ""}.`,
        },
        {
          label: "Suite donnée",
          text: "Votre dossier est transmis au comité de lecture. La décision vous sera communiquée par email.",
        },
        { label: "Lien de suivi", text: trackingUrl(idea) || "—" },
      ],
    });

  const letterPdf = (idea: Idea) =>
    downloadTextPdf({
      title:
        idea.status === "Projet approuvé"
          ? "Lettre de réponse — dossier approuvé"
          : "Lettre de réponse — dossier non retenu",
      subtitle: `Dossier ${idea.reference ?? ""} — ${idea.submitter_name}`,
      fileName: `reponse-${idea.reference ?? idea.id}`,
      blocks: [
        { text: autoReply(idea) || `Bonjour ${idea.submitter_name},` },
        ...(idea.response_note ? [{ label: "Note interne", text: idea.response_note }] : []),
      ],
    });

  const myVotingPositions = org.isAdmin
    ? votingPositions.filter((p) => org.myBasePositions.includes(p) || p === "Producteur général")
    : org.myBasePositions.filter((p) => votingPositions.includes(p));

  const vote = useMutation({
    mutationFn: async ({
      idea,
      decision,
      position,
    }: {
      idea: Idea;
      decision: Vote["decision"];
      position: string;
    }) => {
      if (!comment.trim()) throw new Error("Le commentaire est obligatoire.");
      const { error } = await supabase.from("idea_votes").upsert(
        {
          idea_id: idea.id,
          voter_id: org.myId,
          voter_position: position,
          decision,
          comment: comment.trim(),
        },
        { onConflict: "idea_id,voter_id,voter_position" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["idea_votes"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Avis enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDriveLink = useMutation({
    mutationFn: async ({ idea, link }: { idea: Idea; link: string }) => {
      const { error } = await supabase
        .from("ideas")
        .update({ response_drive_link: link.trim() })
        .eq("id", idea.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Lien Drive du club enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Le Producteur général (ou délégué) fait passer le dossier dans les projets approuvés. */
  const approveNow = useMutation({
    mutationFn: (idea: Idea) => approveIdeaAsProducer({ data: { ideaId: idea.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Dossier approuvé : il figure dans les projets approuvés.");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const markResponded = useMutation({
    mutationFn: async (idea: Idea) => {
      if (!note.trim()) throw new Error("Notez ce qui a été répondu.");
      const { error } = await supabase
        .from("ideas")
        .update({
          responded: true,
          responded_at: new Date().toISOString(),
          response_note: note.trim(),
        })
        .eq("id", idea.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Réponse enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canManageProjects =
    org.isAdmin || PROJECT_MANAGERS.some((p) => org.myBasePositions.includes(p));

  /** Fiche projet : production, réalisation, scénario, régie et porteur du projet. */
  const canEditProjectFiche =
    org.isAdmin || PROJECT_EDITORS.some((p) => org.myBasePositions.includes(p));
  /** Budget : les mêmes personnes, plus le Comptable / Trésorier. */
  const canEditBudget =
    canEditProjectFiche || org.myBasePositions.includes("Comptable / Trésorier");

  const remove = useMutation({
    mutationFn: async (projectId: string) => {
      if (!window.confirm("Supprimer définitivement ce projet ?")) throw new Error("Annulé");
      await deleteProject({ data: { projectId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projet supprimé");
    },
    onError: (e: Error) => {
      if (e.message !== "Annulé") toast.error(e.message);
    },
  });


  async function openFile(ideaId: string) {
    try {
      const { url } = await getIdeaFileLink({ data: { ideaId } });
      if (url) window.open(url, "_blank");
      else toast.error("Aucun fichier joint.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppLayout title="Idées & projets">
      <Tabs defaultValue="ideas">
        <TabsList>
          <TabsTrigger value="ideas">Idées reçues</TabsTrigger>
          <TabsTrigger value="projects">Projets approuvés</TabsTrigger>
          <TabsTrigger value="refused">Idées non retenues</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas" className="mt-4 space-y-4">
          <div className="clap-panel rounded-lg border border-border bg-card/60 p-4 pt-6">
            <p className="text-sm font-medium">Comité de lecture</p>
            <p className="text-xs text-muted-foreground">
              Lien public de soumission : <code>/idees-soumission</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={view === "interne" ? "default" : "outline"}
              onClick={() => setView("interne")}
            >
              Dossiers internes
            </Button>
            <Button
              size="sm"
              variant={view === "externe" ? "default" : "outline"}
              onClick={() => setView("externe")}
            >
              Dossiers externes
            </Button>
          </div>
          {(ideas.data ?? []).filter(
            (i) => i.status !== "Refusée" && (i.origin === "externe") === (view === "externe"),
          ).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun dossier dans cette vue.</p>
          )}
          {(ideas.data ?? [])
            .filter(
              (i) => i.status !== "Refusée" && (i.origin === "externe") === (view === "externe"),
            )
            .map((idea) => {
            const ideaVotes = (votes.data ?? []).filter((v) => v.idea_id === idea.id);
            const pending = !idea.responded && idea.status !== "Projet approuvé";
            return (
              <Card
                key={idea.id}
                className={`card-lift ${pending ? "border-primary/40 spotlight-pulse" : ""}`}
              >
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      {idea.reference || "—"}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-normal ${
                        idea.origin === "externe"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {idea.origin === "externe" ? "Dossier externe" : "Dossier interne"}
                    </span>
                    {idea.project_title || idea.submitter_name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {idea.submitter_name} · {idea.submitter_email} ·{" "}
                      {new Date(idea.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <IdeaTimeline
                    status={idea.status}
                    responded={idea.responded}
                    votes={ideaVotes.length}
                    compact
                  />
                  <p className="whitespace-pre-wrap text-sm">{idea.description}</p>
                  <IdeaFullContent idea={idea} />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => mailReceipt(idea)}>
                      <Mail className="mr-1 h-3.5 w-3.5" /> Envoyer l'accusé de réception
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => receiptPdf(idea)}>
                      <Download className="mr-1 h-3.5 w-3.5" /> Accusé (PDF)
                    </Button>
                    {idea.public_token && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(trackingUrl(idea));
                          toast.success("Lien de suivi copié");
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copier le lien de suivi
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-secondary px-2 py-1 text-xs">{idea.status}</span>
                    {idea.status !== "Projet approuvé" && (
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          daysLeft(idea.created_at) > 0
                            ? "bg-secondary text-muted-foreground"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {daysLeft(idea.created_at) > 0
                          ? `Décision attendue sous ${daysLeft(idea.created_at)} j`
                          : "Délai de 3 jours dépassé"}
                      </span>
                    )}
                    {idea.file_url && (
                      <Button size="sm" variant="outline" onClick={() => openFile(idea.id)}>
                        Ouvrir le fichier
                      </Button>
                    )}
                    {idea.drive_link && (
                      <>
                        <a
                          href={idea.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-400 underline"
                        >
                          Lien Google Drive
                        </a>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(idea.drive_link ?? "");
                            toast.success("Lien Google Drive copié");
                          }}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copier le lien
                        </Button>
                      </>
                    )}
                  </div>

                  {ideaVotes.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2">
                      {ideaVotes.map((v) => (
                        <p key={v.id} className="text-xs text-muted-foreground">
                          {org.profileName(v.voter_id)} ({v.voter_position}) —{" "}
                          {v.decision === "approved" ? "Approuvé" : "Refusé"} : {v.comment}
                        </p>
                      ))}
                    </div>
                  )}

                  {myVotingPositions.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Textarea
                        rows={2}
                        placeholder="Commentaire (obligatoire)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      {myVotingPositions.map((p) => (
                        <div key={p} className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">En tant que {p} :</span>
                          <Button
                            size="sm"
                            onClick={() => vote.mutate({ idea, decision: "approved", position: p })}
                          >
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => vote.mutate({ idea, decision: "rejected", position: p })}
                          >
                            Refuser
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(org.isScreenwriter ||
                    org.isAdmin ||
                    org.myBasePositions.includes("Producteur général")) && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[220px] flex-1 space-y-1">
                          <Label className="text-xs">Lien Drive du club (joint à la réponse)</Label>
                          <Input
                            value={driveDraft[idea.id] ?? idea.response_drive_link ?? ""}
                            placeholder="https://drive.google.com/..."
                            onChange={(e) =>
                              setDriveDraft((p) => ({ ...p, [idea.id]: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            saveDriveLink.mutate({
                              idea,
                              link: driveDraft[idea.id] ?? idea.response_drive_link ?? "",
                            })
                          }
                        >
                          Enregistrer le lien
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {idea.status !== "Projet approuvé" && (
                          <Button
                            size="sm"
                            onClick={() => approveNow.mutate(idea)}
                            disabled={approveNow.isPending}
                          >
                            Approuver et envoyer dans les projets approuvés
                          </Button>
                        )}
                        <Button size="sm" onClick={() => mailReply(idea)}>
                          <Mail className="mr-1 h-3.5 w-3.5" /> Répondre par email
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => letterPdf(idea)}>
                          <Download className="mr-1 h-3.5 w-3.5" /> Lettre de réponse (PDF)
                        </Button>
                      </div>
                      {idea.responded ? (
                        <p className="text-xs text-muted-foreground">
                          Répondu le{" "}
                          {idea.responded_at
                            ? new Date(idea.responded_at).toLocaleDateString("fr-FR")
                            : ""}{" "}
                          — {idea.response_note}
                        </p>
                      ) : (
                        <>
                          <Textarea
                            rows={3}
                            placeholder="Note de la réponse envoyée"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setNote(autoReply(idea))}
                            >
                              Réponse automatique
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markResponded.mutate(idea)}
                            >
                              Marquer comme répondu
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-4">
          {canManageProjects && <ProjectCreator />}
          {(projects.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun projet approuvé.</p>
          )}
          {[...(projects.data ?? [])].reverse().map((p, i) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="mr-2 text-primary">{roman(i + 1)}</span>
                      {p.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                  <span className="rounded bg-secondary px-2 py-1 text-xs">{p.status}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenProject(openProject === p.id ? null : p.id)}
                  >
                    {openProject === p.id ? "Fermer" : "Discussion du projet"}
                  </Button>
                  {canManageProjects && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(p.id)}
                      disabled={remove.isPending}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
                {(p.synopsis || p.synopsis_link || p.script_link || p.budget_link) && (
                  <div className="space-y-1 rounded border border-border p-3 text-sm">
                    {p.synopsis && <p className="whitespace-pre-wrap">{p.synopsis}</p>}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {p.synopsis_link && (
                        <a className="underline" href={p.synopsis_link} target="_blank" rel="noreferrer">
                          Document du synopsis
                        </a>
                      )}
                      {p.script_link && (
                        <a className="underline" href={p.script_link} target="_blank" rel="noreferrer">
                          Scénario{p.script_title ? ` : ${p.script_title}` : ""}
                        </a>
                      )}
                      {p.budget_link && (
                        <a className="underline" href={p.budget_link} target="_blank" rel="noreferrer">
                          Budget{p.budget_title ? ` : ${p.budget_title}` : ""}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {(org.isAdmin ||
                  ["Producteur général", "Producteur délégué", "Scénariste"].some((x) =>
                    org.myBasePositions.includes(x),
                  )) && <FicheEditor project={p as never} />}
                <LoglineEditor projectId={p.id} canEdit={org.isAdmin || org.isDeputy} />
                <ProjectEdits
                  projectId={p.id}
                  canEdit={canEditProjectFiche}
                  current={{
                    title: p.title,
                    description: p.description,
                    synopsis: p.synopsis,
                    synopsis_link: p.synopsis_link,
                    script_title: p.script_title,
                    script_link: p.script_link,
                    budget_title: p.budget_title,
                    budget_link: p.budget_link,
                  }}
                />
                <ProjectBudget projectId={p.id} projectTitle={p.title} canEdit={canEditBudget} />
                <ProjectPhaseControl
                  projectId={p.id}
                  phaseId={p.phase_id}
                  state={p.state ?? "En cours"}
                />
                {openProject === p.id && <ProjectChat projectId={p.id} />}
              </CardContent>
            </Card>
          ))}
        </TabsContent>


        <TabsContent value="refused" className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Les idées non retenues sont conservées avec leur auteur et les avis reçus.
          </p>
          {(ideas.data ?? [])
            .filter((i) => i.status === "Refusée")
            .map((idea) => (
              <Card key={idea.id}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">
                    {idea.submitter_name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {idea.submitter_email} ·{" "}
                      {new Date(idea.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{idea.description}</p>
                  {(votes.data ?? [])
                    .filter((v) => v.idea_id === idea.id)
                    .map((v) => (
                      <p key={v.id} className="text-xs text-muted-foreground">
                        {org.profileName(v.voter_id)} ({v.voter_position}) —{" "}
                        {v.decision === "approved" ? "Approuvé" : "Refusé"} : {v.comment}
                      </p>
                    ))}
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function ProjectChat({ projectId }: { projectId: string }) {
  const conv = useConversation("project", projectId);
  if (!conv.data) return <p className="text-sm text-muted-foreground">Discussion indisponible.</p>;
  return <Chat conversationId={conv.data.id} />;
}

function LoglineEditor({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string | null>(null);

  const logline = useQuery({
    queryKey: ["project_logline", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("logline")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data?.logline ?? "") as string;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ logline: value ?? "" })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_logline", projectId] });
      setValue(null);
      toast.success("Logline enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = logline.data ?? "";

  return (
    <div className="rounded border border-border p-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">🎞️ Logline</p>
      {value === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">{current || "Aucune logline pour le moment."}</p>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setValue(current)}>
              Modifier
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()}>
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setValue(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Création d'un projet par la production : le projet part aussi en approbation. */
function ProjectCreator() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: "",
    logline: "",
    description: "",
    synopsis: "",
    synopsisLink: "",
    scriptTitle: "",
    scriptLink: "",
    budgetTitle: "",
    budgetLink: "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => createProject({ data: f }),
    onSuccess: () => {
      setF({
        title: "",
        logline: "",
        description: "",
        synopsis: "",
        synopsisLink: "",
        scriptTitle: "",
        scriptLink: "",
        budgetTitle: "",
        budgetLink: "",
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Projet créé et envoyé en approbation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Créer un projet
      </Button>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Nouveau projet</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pt">Titre du projet</Label>
            <Input id="pt" value={f.title} onChange={(e) => set("title")(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl">Logline</Label>
            <Textarea id="pl" rows={2} value={f.logline} onChange={(e) => set("logline")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd">Présentation courte</Label>
            <Textarea id="pd" rows={3} value={f.description} onChange={(e) => set("description")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps">Synopsis</Label>
            <Textarea id="ps" rows={4} value={f.synopsis} onChange={(e) => set("synopsis")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="psl">Lien Google Drive du synopsis</Label>
            <Input id="psl" value={f.synopsisLink} onChange={(e) => set("synopsisLink")(e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pst">Titre du scénario</Label>
              <Input id="pst" value={f.scriptTitle} onChange={(e) => set("scriptTitle")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="psk">Lien Google Drive du scénario</Label>
              <Input id="psk" value={f.scriptLink} onChange={(e) => set("scriptLink")(e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pbt">Titre du budget</Label>
              <Input id="pbt" value={f.budgetTitle} onChange={(e) => set("budgetTitle")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pbl">Lien Google Drive du budget</Label>
              <Input id="pbl" value={f.budgetLink} onChange={(e) => set("budgetLink")(e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? "Enregistrement..." : "Enregistrer le projet"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
