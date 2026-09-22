import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Club Ciné Tremplin — Espace membres" },
      {
        name: "description",
        content:
          "Outil interne du Club Ciné Tremplin : tâches, rapports, organigramme, liens et discussion de l'équipe.",
      },
      { property: "og:title", content: "Club Ciné Tremplin — Espace membres" },
      {
        property: "og:description",
        content: "Suivi d'activité interne du Club Ciné Tremplin. On apprend, on tourne, on décolle.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <img src={logo} alt="Club Ciné Tremplin" className="w-64 max-w-full" />
      <p className="max-w-md text-sm text-muted-foreground">
        Espace de suivi d'activité réservé aux membres du club. 


        On apprend, on tourne, on décolle.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/auth">
          <Button size="lg">Se connecter</Button>
        </Link>
        <Link to="/presentation">
          <Button size="lg" variant="outline">
            Fiche de présentation
          </Button>
        </Link>
      </div>
    </div>
  );
}
