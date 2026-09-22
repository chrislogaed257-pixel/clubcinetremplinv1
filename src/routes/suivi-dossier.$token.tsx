import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { IdeaTimeline } from "@/components/IdeaTimeline";

export const Route = createFileRoute("/suivi-dossier/$token")({
  head: () => ({
    meta: [
      { title: "Suivi de votre dossier : Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Suivez en temps réel l'avancement du dossier de film que vous avez déposé au Club Ciné Tremplin.",
      },
      { property: "og:title", content: "Suivi de votre dossier : Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Où en est votre dossier au Club Ciné Tremplin ?",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicIdeaTracking,
});

type PublicIdea = {
  reference: string;
  project_title: string;
  submitter_name: string;
  status: string;
  responded: boolean;
  created_at: string;
  votes_count: number;
};

function PublicIdeaTracking() {
  const { token } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["idea-public", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("idea_public_status", { _token: token });
      if (error) throw error;
      return ((data ?? []) as PublicIdea[])[0] ?? null;
    },
  });

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="Club Ciné Tremplin" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary">CLUB CINÉ TREMPLIN</p>
            <p className="text-xs text-muted-foreground">Suivi de dossier</p>
          </div>
        </div>
        <Card className="clap-panel">
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl">
                {data ? `Dossier ${data.reference}` : "Suivi de votre dossier"}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Chargement…</p>
            ) : !data ? (
              <p className="text-muted-foreground">
                Aucun dossier ne correspond à ce lien de suivi. Vérifiez le lien reçu dans votre
                accusé de réception.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-base font-medium">{data.project_title || "Projet de film"}</p>
                  <p className="text-muted-foreground">
                    Déposé par {data.submitter_name} le{" "}
                    {new Date(data.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <IdeaTimeline
                  status={data.status}
                  responded={data.responded}
                  votes={data.votes_count}
                />
                <p className="text-xs text-muted-foreground">
                  Cette page se met à jour automatiquement au fil des décisions du comité de
                  lecture. La réponse définitive vous sera envoyée par email.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
