import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import equipe from "@/assets/presentation-equipe.jpg";
import parcours from "@/assets/presentation-parcours.jpg";
import postes from "@/assets/presentation-postes.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "Fiche de présentation — Club Ciné Tremplin" },
      {
        name: "description",
        content:
          "Comprendre l'espace membres du Club Ciné Tremplin en quelques minutes : première connexion, rubriques, parcours d'un film.",
      },
      { property: "og:title", content: "Fiche de présentation — Club Ciné Tremplin" },
      {
        property: "og:description",
        content:
          "Guide illustré pour les membres du Club Ciné Tremplin : se connecter, trouver sa rubrique, suivre un projet de film.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PresentationPage,
});

const RUBRIQUES: [string, string][] = [
  ["Tableau de bord", "Votre point de départ : ce qui vous attend aujourd'hui."],
  ["Mes tâches", "Ce qu'on vous a confié, avec la date pour le rendre."],
  ["Rapports", "Vous racontez ce que vous avez fait ; le responsable valide."],
  ["Mes congés", "Vous demandez une absence, le responsable répond."],
  ["Équipes", "Qui travaille avec qui sur chaque film."],
  ["Organigramme", "Tous les postes du club et à quoi sert chacun."],
  ["Liens & documents", "Les fichiers utiles : scénarios, modèles, photos."],
  ["Discussions", "Les échanges de groupe du club."],
  ["Messagerie", "Un message privé à une seule personne."],
  ["Réunions vidéo", "Le lien et l'heure des réunions en ligne."],
  ["Idées & projets", "Les idées de films reçues, puis étudiées."],
  ["Déposer un projet", "Vous proposez votre propre idée de film."],
  ["Projets approuvés", "Les films retenus par le club."],
  ["Budget prévisionnel", "Ce qu'on prévoit de dépenser pour un film."],
  ["Comptabilité", "Ce qui a été réellement dépensé."],
  ["Feuille de service", "Le programme d'une journée de tournage."],
  ["Casting", "Les candidatures des comédiens."],
  ["Festivals", "Où le film est envoyé et ce qu'il a obtenu."],
  ["Vote", "Choisir ensemble le prochain film du club."],
  ["Archives du club", "La mémoire du club : ce qui est terminé."],
];

const ETAPES: [string, string][] = [
  ["1. Une idée arrive", "Un membre ou une personne de l'extérieur propose une histoire."],
  ["2. Le club en discute", "Les producteurs et scénaristes l'étudient et donnent leur avis."],
  ["3. On vote", "Le club choisit le projet qu'il veut faire."],
  ["4. Le projet est lancé", "Une équipe est formée, chacun reçoit ses tâches."],
  ["5. On prépare l'argent", "Budget prévisionnel, puis dépenses réelles en comptabilité."],
  ["6. On tourne et on montre", "Tournage, montage, puis festivals et archives."],
];

function PresentationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 print:py-0">
        <header className="flex flex-wrap items-center gap-4">
          <img src={logo} alt="Club Ciné Tremplin" className="h-16 w-16 object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-primary">
              CLUB CINÉ TREMPLIN
            </p>
            <h1 className="text-2xl font-semibold">Fiche de présentation de l'espace membres</h1>
            <p className="text-sm text-muted-foreground">
              On apprend, on tourne, on décolle.
            </p>
          </div>
          <div className="ml-auto flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimer / PDF
            </Button>
            <Link to="/auth">
              <Button size="sm">Se connecter</Button>
            </Link>
          </div>
        </header>

        <img
          src={equipe}
          alt="Des membres du club en tournage"
          width={1280}
          height={720}
          className="mt-6 w-full rounded-lg object-cover"
        />

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">À quoi sert cette application ?</h2>
          <p className="text-sm text-muted-foreground">
            Elle rassemble tout le travail du club au même endroit : les idées de films, les projets
            retenus, les tâches de chacun, l'argent prévu et dépensé, les messages, les réunions et
            les archives. Chacun voit ce qu'il doit faire, et le club garde une trace claire de tout
            ce qui se passe.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Votre première connexion, en 4 gestes</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Ouvrez l'adresse de
              l'application et cliquez sur « Se connecter ».
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span> Entrez l'adresse e-mail
              communiquée par le club et le mot de passe provisoire reçu.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span> Choisissez tout de suite votre
              mot de passe personnel, connu de vous seul.
            </li>
            <li>
              <span className="font-medium text-foreground">4.</span> Mot de passe oublié ? Sur
              l'écran de connexion, cliquez sur « Mot de passe oublié » : vous écrivez directement
              au Producteur général, qui vous répond au même endroit et vous donne un nouveau mot de
              passe provisoire.
            </li>
          </ol>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Votre poste décide de ce que vous voyez</h2>
          <img
            src={postes}
            alt="Les postes du club reliés entre eux"
            loading="lazy"
            width={1280}
            height={640}
            className="w-full rounded-lg object-cover"
          />
          <p className="text-sm text-muted-foreground">
            Chaque membre occupe un ou plusieurs postes. Le menu ne montre que les rubriques utiles
            à votre poste : pas de page inutile, pas de risque de se tromper. Si vous occupez
            plusieurs postes, un sélecteur en haut de l'écran vous permet de choisir celui que vous
            utilisez ; le menu et la description du poste changent aussitôt. Si une rubrique vous
            manque, le Producteur général peut l'ouvrir à votre poste.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Le parcours d'un film, du début à la fin</h2>
          <img
            src={parcours}
            alt="De l'idée au film : idée, vote, projet, budget, film"
            loading="lazy"
            width={1280}
            height={640}
            className="w-full rounded-lg object-cover"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {ETAPES.map(([titre, texte]) => (
              <Card key={titre}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{titre}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{texte}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Les rubriques, expliquées simplement</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {RUBRIQUES.map(([nom, texte]) => (
              <div key={nom} className="rounded border border-border p-3 text-sm">
                <p className="font-medium">{nom}</p>
                <p className="text-muted-foreground">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Trois habitudes qui font gagner du temps</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Regardez la cloche : elle prévient dès qu'une tâche ou un message vous concerne.</li>
            <li>Rendez vos rapports dès qu'une tâche est finie : c'est ce qui fait avancer le film.</li>
            <li>
              Écrivez dans « Discussions » ce qui concerne tout le monde, et dans « Messagerie » ce
              qui ne concerne qu'une personne.
            </li>
          </ul>
        </section>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Une question, un blocage, une idée d'amélioration ? Écrivez au Producteur général depuis la
          messagerie de l'application.
        </footer>
      </div>
    </div>
  );
}
