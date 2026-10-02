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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { downloadCsv, downloadTextPdf, openMail } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/casting")({
  component: CastingPage,
});

const NONE = "none";

type Call = {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  public_token: string;
  is_open: boolean;
  document?: unknown;
};

type Application = {
  id: string;
  call_id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  age: string;
  link: string;
  note: string;
  status: string;
  comment: string;
  created_at: string;
  province?: string;
  neighborhood?: string;
  spoken_language?: string;
  availability?: string;
  cinema_experience?: boolean | null;
  response_sent_at?: string | null;
  extra?: Record<string, unknown> | null;
};

function CastingPage() {
  const org = useOrgContext();
  const qc = useQueryClient();
  const canManage = org.isAdmin || org.isDeputy || org.has("Producteur général") || org.isProductionDirector;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(NONE);

  const projects = useQuery({
    queryKey: ["projects_casting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const calls = useQuery({
    queryKey: ["casting_calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casting_calls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Call[];
    },
  });

  const apps = useQuery({
    queryKey: ["casting_applications"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casting_applications")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("casting_calls").insert({
        title,
        description,
        project_id: projectId === NONE ? null : projectId,
        public_token: crypto.randomUUID().replace(/-/g, ""),
        created_by: org.myId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["casting_calls"] });
      toast.success("Appel à casting créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleOpen = useMutation({
    mutationFn: async (c: Call) => {
      const { error } = await supabase
        .from("casting_calls")
        .update({ is_open: !c.is_open })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["casting_calls"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = useQuery({
    queryKey: ["message_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*");
      if (error) throw error;
      return (data ?? []) as { key: string; subject: string; body: string }[];
    },
  });

  const markResponseSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("casting_applications")
        .update({ response_sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["casting_applications"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  type Compose = {
    app: Application;
    callTitle: string;
    project: string;
    status: string;
    to: string;
    subject: string;
    body: string;
  };
  const [compose, setCompose] = useState<Compose | null>(null);
  const [tplEdit, setTplEdit] = useState(false);
  const [editCall, setEditCall] = useState<string | null>(null);

  const roleOf = (a: Application) =>
    String((a.extra as Record<string, unknown> | null)?.["Rôles souhaités"] ?? "").trim();

  /** Message prérempli selon le statut (retenu / non retenu). */
  const buildMessage = (a: Application, callTitle: string, project: string, status: string) => {
    const key = status === "selected" ? "casting_selected" : "casting_rejected";
    const t = (templates.data ?? []).find((x) => x.key === key);
    const role = roleOf(a) || "proposé";
    const apply = (s: string) =>
      s
        .replaceAll("{nom}", a.full_name)
        .replaceAll("{appel}", callTitle)
        .replaceAll("{role}", role)
        .replaceAll("{projet}", project);
    return {
      subject: t?.subject ? apply(t.subject) : `Ciné Tremplin — votre candidature (${callTitle})`,
      body: t?.body ? apply(t.body) : `Bonjour ${a.full_name},\n\nLe Club Ciné Tremplin`,
    };
  };

  /** Ouvre la zone de réponse préremplie (destinataire, objet, message). */
  const mailCandidate = (a: Application, callTitle: string, project?: string) => {
    const proj = project || callTitle;
    const status = a.status === "selected" ? "selected" : "rejected";
    setCompose({ app: a, callTitle, project: proj, status, to: a.email, ...buildMessage(a, callTitle, proj, status) });
  };

  const sendCompose = () => {
    if (!compose) return;
    markResponseSent.mutate(compose.app.id);
    openMail(compose.to, compose.subject, compose.body);
    setCompose(null);
  };

  const removeApp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("casting_applications")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casting_applications"] });
      toast.success("Candidature supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async (t: { key: string; subject: string; body: string }) => {
      const { error } = await supabase
        .from("message_templates")
        .update({ subject: t.subject, body: t.body })
        .eq("key", t.key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message_templates"] });
      toast.success("Modèle enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCall = useMutation({
    mutationFn: async (c: { id: string; title: string; description: string; document: unknown }) => {
      const { error } = await supabase
        .from("casting_calls")
        .update({ title: c.title, description: c.description, document: c.document as never })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casting_calls"] });
      setEditCall(null);
      toast.success("Fiche mise à jour — visible aussitôt par tous via le même lien");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: string; comment: string }) => {
      if (!comment.trim()) throw new Error("Un commentaire est obligatoire.");
      const { error } = await supabase
        .from("casting_applications")
        .update({ status, comment })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casting_applications"] });
      toast.success("Décision enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (!canManage) {
    return (
      <AppLayout title="Casting">
        <p className="text-sm text-muted-foreground">
          Rubrique réservée à la production et à la direction de production.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Casting">
      <div className="grid gap-4 md:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Nouvel appel à casting</CardTitle>
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
                <Label htmlFor="t">Titre</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Projet</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucun</SelectItem>
                    {(projects.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d">Description des rôles</Label>
                <Textarea
                  id="d"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {(calls.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun appel à casting.</p>
          )}
          {(calls.data ?? []).map((c) => {
            const link = `${origin}/casting-soumission/${c.public_token}`;
            const list = (apps.data ?? []).filter((a) => a.call_id === c.id);
            return (
              <Card key={c.id} className="card-lift clap-panel pt-2">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    {c.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <p className="mt-1 break-all text-xs text-muted-foreground">{link}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(link);
                        toast.success("Lien copié");
                      }}
                    >
                      Copier le lien
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleOpen.mutate(c)}>
                      {c.is_open ? "Clôturer" : "Rouvrir"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadCsv(
                          `candidatures-${c.title}`,
                          [
                            "Nom",
                            "Email",
                            "Téléphone",
                            "Ville",
                            "Âge",
                            "Statut",
                            "Commentaire",
                            "Lien",
                            "Reçue le",
                          ],
                          list.map((a) => [
                            a.full_name,
                            a.email,
                            a.phone,
                            a.city,
                            a.age,
                            a.status === "pending"
                              ? "En attente"
                              : a.status === "selected"
                                ? "Retenu"
                                : "Non retenu",
                            a.comment,
                            a.link,
                            new Date(a.created_at).toLocaleDateString("fr-FR"),
                          ]),
                        )
                      }
                    >
                      Télécharger les candidatures (CSV)
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune candidature.</p>
                  )}
                  {list.map((a) => (
                    <ApplicationRow
                      key={a.id}
                      app={a}
                      onDecide={(status, comment) => decide.mutate({ id: a.id, status, comment })}
                      onMail={() => mailCandidate(a, c.title)}
                      onDownload={() => downloadApplication(a, c.title)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

/** Télécharge la fiche complétée par le candidat (PDF). */
function downloadApplication(a: Application, callTitle: string) {
  const extra = Object.entries(a.extra ?? {}).filter(([, v]) => String(v ?? "").trim());
  downloadTextPdf({
    title: `Fiche de candidature — ${a.full_name}`,
    subtitle: callTitle,
    fileName: `candidature-${a.full_name}`,
    blocks: [
      { label: "Nom et prénom", text: a.full_name },
      { label: "Âge", text: a.age || "—" },
      { label: "Province / Quartier", text: `${a.province ?? ""} / ${a.neighborhood ?? ""}` },
      { label: "Commune / ville", text: a.city || "—" },
      { label: "Téléphone WhatsApp", text: a.phone || "—" },
      { label: "Adresse email", text: a.email || "—" },
      { label: "Langues parlées", text: a.spoken_language || "—" },
      { label: "Disponibilité", text: a.availability || "—" },
      {
        label: "Expérience en cinéma",
        text: a.cinema_experience == null ? "—" : a.cinema_experience ? "Oui" : "Non",
      },
      ...extra.map(([k, v]) => ({ label: k, text: String(v) })),
      { label: "Présentation", text: a.note || "—" },
      { label: "Lien vidéo / book", text: a.link || "—" },
      { label: "Reçue le", text: new Date(a.created_at).toLocaleString("fr-FR") },
    ],
  });
}

function ApplicationRow({
  app,
  onDecide,
  onMail,
  onDownload,
}: {
  app: Application;
  onDecide: (status: string, comment: string) => void;
  onMail: () => void;
  onDownload: () => void;
}) {
  const [comment, setComment] = useState(app.comment ?? "");
  const decided = app.status !== "pending";
  return (
    <div
      className={`space-y-2 rounded border p-3 ${
        decided ? "border-border" : "border-primary/40 spotlight-pulse"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{app.full_name}</span>
        <span className="text-xs text-muted-foreground">
          {app.age ? `${app.age} ans · ` : ""}
          {app.city} · {app.email} · {app.phone}
        </span>
        <span className="ml-auto rounded bg-secondary px-2 py-0.5 text-xs">
          {app.status === "pending"
            ? "En attente"
            : app.status === "selected"
              ? "Retenu"
              : "Non retenu"}
        </span>
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {app.province && <span>Province : {app.province}</span>}
        {app.neighborhood && <span>Quartier : {app.neighborhood}</span>}
        {app.spoken_language && <span>Langue parlée : {app.spoken_language}</span>}
        {app.cinema_experience !== null && app.cinema_experience !== undefined && (
          <span>Expérience en cinéma : {app.cinema_experience ? "Oui" : "Non"}</span>
        )}
        {app.availability && <span>Disponibilité : {app.availability}</span>}
        {Object.entries(app.extra ?? {})
          .filter(([, v]) => String(v ?? "").trim())
          .map(([k, v]) => (
            <span key={k}>
              {k} : {String(v)}
            </span>
          ))}
      </div>
      {app.note && <p className="text-sm">{app.note}</p>}
      {app.link && (
        <a href={app.link} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
          Voir la vidéo / le book
        </a>
      )}
      <Textarea
        rows={2}
        placeholder="Commentaire (obligatoire)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={onDownload}>
          Télécharger la fiche
        </Button>
        <Button size="sm" variant="outline" onClick={onMail}>
          Écrire au candidat
        </Button>
        <Button size="sm" onClick={() => onDecide("selected", comment)}>
          Retenir
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecide("rejected", comment)}>
          Ne pas retenir
        </Button>
        {decided && (
          <Button size="sm" variant="outline" onClick={onMail}>
            Répondre par email
          </Button>
        )}
        {decided && <span className="self-center text-xs text-muted-foreground">Décision enregistrée</span>}
        {app.response_sent_at && (
          <span className="self-center text-xs text-muted-foreground">
            Réponse envoyée le {new Date(app.response_sent_at).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>
    </div>
  );
}
