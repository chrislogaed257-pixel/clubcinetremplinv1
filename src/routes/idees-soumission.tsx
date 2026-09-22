import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { submitIdeaFull } from "@/lib/ideas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { downloadTextPdf } from "@/lib/downloads";

const trackingBase = typeof window === "undefined" ? "" : window.location.origin;

export const Route = createFileRoute("/idees-soumission")({
  head: () => ({
    meta: [
      { title: "Déposer un projet de film : Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Déposez votre dossier de film au Club Ciné Tremplin en accès libre : présentation, logline, synopsis, scénario, note d'intention ou simple lien Google Drive.",
      },
      { property: "og:title", content: "Déposer un projet de film : Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Accès libre : partagez votre projet de film avec le Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicIdeaForm,
});

function PublicIdeaForm() {
  const [f, setF] = useState({
    name: "",
    email: "",
    job: "",
    experience: "Débutant",
    projectTitle: "",
    presentation: "",
    logline: "",
    synopsis: "",
    scriptText: "",
    treatment: "",
    intentionNote: "",
    directingNote: "",
    driveLink: "",
    presentationLink: "",
    loglineLink: "",
    synopsisLink: "",
    scriptLink: "",
    intentionLink: "",
    directingLink: "",
  });
  const [thanks, setThanks] = useState<{
    message: string;
    reference: string;
    publicToken: string;
    projectTitle: string;
    submitterName: string;
  } | null>(null);
  const set = (key: keyof typeof f) => (value: string) => setF((p) => ({ ...p, [key]: value }));

  /** Contrôle des champs avant envoi : renvoie le message à afficher, ou null si tout est bon. */
  const checkForm = (v: typeof f): string | null => {
    if (!v.name.trim() || !v.email.trim()) return "Nom et email sont requis.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) return "Adresse email invalide.";
    if (!v.projectTitle.trim()) return "Le titre du projet est obligatoire.";
    const link = v.driveLink.trim();
    const need: [string, string, string][] = [
      [v.presentation, "Votre présentation", v.presentationLink],
      [v.logline, "La logline", v.loglineLink],
      [v.synopsis, "Le synopsis", v.synopsisLink],
      [v.scriptText, "Le scénario", v.scriptLink],
      [v.intentionNote, "La note d'intention", v.intentionLink],
    ];
    for (const [value, label, own] of need) {
      if (!value.trim() && !own.trim() && !link)
        return `${label} : écrivez le texte ou ajoutez un lien Google Drive.`;
    }
    return null;
  };

  const send = useMutation({
    mutationFn: () =>
      submitIdeaFull({
        data: {
          name: f.name,
          email: f.email,
          job: f.job,
          experience: f.experience,
          projectTitle: f.projectTitle,
          presentation: f.presentation,
          logline: f.logline,
          synopsis: f.synopsis,
          scriptText: f.scriptText,
          treatment: f.treatment,
          intentionNote: f.intentionNote,
          directingNote: f.directingNote,
          driveLink: f.driveLink || undefined,
          presentationLink: f.presentationLink || undefined,
          loglineLink: f.loglineLink || undefined,
          synopsisLink: f.synopsisLink || undefined,
          scriptLink: f.scriptLink || undefined,
          intentionLink: f.intentionLink || undefined,
          directingLink: f.directingLink || undefined,
        },
      }),
    onSuccess: (r) =>
      setThanks({
        message: r.message,
        reference: r.reference,
        publicToken: r.publicToken,
        projectTitle: f.projectTitle,
        submitterName: f.name,
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (
    key: keyof typeof f,
    label: string,
    rows = 0,
    required = false,
    placeholder?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>
        {label}
        {required ? " *" : ""}
      </Label>
      {rows > 0 ? (
        <Textarea
          id={key}
          rows={rows}
          value={f[key]}
          placeholder={placeholder}
          onChange={(e) => set(key)(e.target.value)}
        />
      ) : (
        <Input
          id={key}
          value={f[key]}
          placeholder={placeholder}
          onChange={(e) => set(key)(e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="Club Ciné Tremplin" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary">CLUB CINÉ TREMPLIN</p>
            <p className="text-xs text-muted-foreground">On apprend, on tourne, on décolle.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl">Déposer un projet de film</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {thanks ? (
              <div className="space-y-4 text-sm">
                <p className="font-medium">Votre dossier est bien arrivé.</p>
                <p className="text-muted-foreground">{thanks.message}</p>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Numéro de dossier
                  </p>
                  <p className="text-lg font-semibold text-primary">{thanks.reference}</p>
                  {thanks.publicToken ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      Suivez votre dossier ici :{" "}
                      <a
                        className="text-primary underline"
                        href={`${trackingBase}/suivi-dossier/${thanks.publicToken}`}
                      >
                        {`${trackingBase}/suivi-dossier/${thanks.publicToken}`}
                      </a>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      downloadTextPdf({
                        title: "Accusé de réception de dossier",
                        subtitle: `Dossier ${thanks.reference} — ${new Date().toLocaleDateString("fr-FR")}`,
                        fileName: `accuse-reception-${thanks.reference}`,
                        blocks: [
                          {
                            text: `Bonjour ${thanks.submitterName},\n\nLe Club Ciné Tremplin confirme la bonne réception de votre dossier « ${thanks.projectTitle} », enregistré sous le numéro ${thanks.reference}.`,
                          },
                          {
                            label: "Suite donnée",
                            text: "Votre dossier est transmis au comité de lecture. Vous recevrez la décision par email à l'adresse indiquée dans votre dossier.",
                          },
                          {
                            label: "Lien de suivi",
                            text: thanks.publicToken
                              ? `${trackingBase}/suivi-dossier/${thanks.publicToken}`
                              : "—",
                          },
                        ],
                      })
                    }
                  >
                    Télécharger l'accusé de réception (PDF)
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Déposer un autre projet
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const problem = checkForm(f);
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  send.mutate();
                }}
              >
                <p className="text-xs text-muted-foreground">
                  Accès libre : aucun compte ni identifiant. Les champs marqués d'une étoile sont
                  obligatoires, mais un lien Google Drive contenant vos documents peut les remplacer.
                </p>
                {field("name", "Votre nom et prénom", 0, true)}
                {field("email", "Votre email", 0, true)}
                {field("job", "Votre métier")}
                <div className="space-y-1.5">
                  <Label htmlFor="experience">Expérience</Label>
                  <select
                    id="experience"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={f.experience}
                    onChange={(e) => set("experience")(e.target.value)}
                  >
                    <option value="Débutant">Débutant</option>
                    <option value="Expérimenté">Expérimenté</option>
                  </select>
                </div>
                {field("projectTitle", "Titre du projet", 0, true)}
                {field("presentation", "Votre présentation", 4, true)}
                {field("presentationLink", "Lien Google de votre présentation", 0, false, "https://docs.google.com/...")}
                {field("logline", "Logline", 2, true)}
                {field("loglineLink", "Lien Google de la logline", 0, false, "https://docs.google.com/...")}
                {field("synopsis", "Synopsis", 5, true)}
                {field("synopsisLink", "Lien Google du synopsis", 0, false, "https://docs.google.com/...")}
                {field("scriptText", "Scénario", 5, true)}
                {field("scriptLink", "Lien Google du scénario", 0, false, "https://docs.google.com/...")}
                {field("treatment", "Traitement", 4)}
                {field("intentionNote", "Note d'intention", 4, true)}
                {field("intentionLink", "Lien Google de la note d'intention", 0, false, "https://docs.google.com/...")}
                {field(
                  "directingNote",
                  "Note de réalisation (si vous êtes réalisateur)",
                  4,
                )}
                {field("directingLink", "Lien Google de la note de réalisation", 0, false, "https://docs.google.com/...")}
                {field(
                  "driveLink",
                  "Lien Google Drive de vos documents",
                  0,
                  false,
                  "https://drive.google.com/...",
                )}
                <Button type="submit" className="w-full" disabled={send.isPending}>
                  {send.isPending ? "Envoi en cours..." : "Envoyer mon dossier"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
