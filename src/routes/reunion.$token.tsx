import { PublicBrand } from "@/components/PublicBrand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";

export const Route = createFileRoute("/reunion/$token")({
  component: PublicMeeting,
  head: () => ({
    meta: [
      { title: "Réunion vidéo : Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Rejoignez la réunion vidéo du Club Ciné Tremplin en accès libre, sans compte ni identifiant.",
      },
      { property: "og:title", content: "Réunion vidéo : Club Ciné Tremplin" },
      {
        property: "og:description",
        content: "Accès libre à la réunion vidéo du Club Ciné Tremplin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Meeting = {
  title: string;
  description: string;
  meet_url: string;
  starts_at: string | null;
  is_open: boolean;
};

function PublicMeeting() {
  const { token } = Route.useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("meetings")
        .select("title, description, meet_url, starts_at, is_open")
        .eq("public_token", token)
        .maybeSingle();
      setMeeting((data as Meeting | null) ?? null);
      setLoading(false);
    })();
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <PublicBrand />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Réunion : Club Ciné Tremplin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Chargement de la réunion...</p>}

          {!loading && (!meeting || !meeting.is_open) && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Cette réunion n'est pas accessible.</p>
              <p className="text-muted-foreground">
                Le lien est peut-être clos ou incorrect. Demandez un nouveau lien à votre contact au
                club.
              </p>
            </div>
          )}

          {!loading && meeting && meeting.is_open && (
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold">{meeting.title}</h1>
                {meeting.starts_at && (
                  <p className="text-sm text-muted-foreground">
                    {new Date(meeting.starts_at).toLocaleString("fr-FR")}
                  </p>
                )}
                {meeting.description && (
                  <p className="text-sm text-muted-foreground">{meeting.description}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Accès libre : aucun compte, aucun identifiant, aucune adresse email n'est demandé.
              </p>
              <a href={meeting.meet_url} target="_blank" rel="noreferrer">
                <Button className="w-full">
                  <Video className="mr-2 h-4 w-4" />
                  Rejoindre la réunion vidéo
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  Quitter
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
