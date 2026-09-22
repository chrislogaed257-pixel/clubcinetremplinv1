# CineFlow Hub

Crée une application web interne pour "Club Ciné Tremplin", un club de cinéma. C'est un outil de suivi d'activité pour les membres, pas un site vitrine — reste simple et fonctionnel, sans design trop chargé, pour rester efficace en développement.

1. Authentification et sécurité

Connexion par email + mot de passe (utilise l'authentification intégrée type Supabase Auth).

Pas d'inscription publique : les comptes sont créés uniquement par un administrateur (le Producteur général) depuis l'application, qui définit pour chaque membre : son nom, son poste, et son supérieur direct (voir hiérarchie ci-dessous).

Chaque utilisateur ne peut voir que ce que sa position hiérarchique l'autorise à voir (règles détaillées plus bas).

2. Hiérarchie des membres

Chaque membre a un poste et un "supérieur direct" (la personne à qui il rapporte). Voici la structure à utiliser comme référence pour les rôles :

Producteur général (rôle admin, tout en haut) — supervise : Producteur délégué, Producteur exécutif, Directeur de production, Gestionnaire de communication, Diffuseur, Distributeur

Producteur délégué — supervise : Producteur exécutif, Directeur de production, Directeur de casting, Chargé des festivals

Producteur exécutif — supervise : Directeur de production, Administrateur de production, Comptable/Trésorier

Directeur de production — supervise : Administrateur de production, Régisseur général

Réalisateur — supervise : Assistant réalisateur (1er AR), Chef opérateur, Ingénieur du son, Directeur artistique, etc. (toute l'équipe technique/artistique)

Assistant réalisateur (1er AR) — supervise : 2e assistant réalisateur, Scripte

Chef opérateur — supervise : Cadreur, 1er assistant caméra, Chef électricien, Machiniste

Gestionnaire de communication — supervise : Graphiste, Designer, Photographe de plateau, Vidéaste de making-of

etc.

Ne code pas cette liste en dur dans l'interface : crée plutôt un système générique où chaque compte a un champ "poste" (texte libre) et un champ "supérieur" (lien vers un autre compte). Cela permettra d'ajouter n'importe quel nouveau poste plus tard sans toucher au code. Prévois un écran "Organigramme" simple (une liste ou un arbre) qui affiche qui rapporte à qui.

3. Règle de visibilité (le cœur de l'app)

Un membre voit toujours ses propres tâches et rapports.

Un membre voit aussi les tâches et rapports de toutes les personnes situées en dessous de lui dans la chaîne hiérarchique (ses subordonnés directs, et les subordonnés de ses subordonnés, etc.), mais jamais ceux de ses collègues du même niveau ou de ses supérieurs.

Le Producteur général (admin) voit tout, pour tout le club.

4. Mes tâches

Chaque membre a un espace "Mes tâches" où il liste ce qu'il doit faire : titre, description courte, date d'échéance (optionnelle), statut (à faire / en cours / terminé).

Un membre peut créer, modifier et cocher ses propres tâches.

Un supérieur peut voir (lecture seule) les tâches de tous ceux qu'il dirige, avec un filtre par membre.

5. Rapports

Chaque membre peut rédiger un rapport (texte libre, avec éventuellement une pièce jointe ou un lien) et l'envoyer à son supérieur direct.

Le rapport apparaît automatiquement dans la liste "Rapports reçus" du supérieur concerné, et remonte aussi (en lecture) à tous les niveaux au-dessus, jusqu'au Producteur général.

Un supérieur peut laisser un commentaire ou marquer un rapport comme "lu"/"validé".

Garder l'historique de tous les rapports, classés par date et par auteur.

6. Espace liens et documents

Un espace partagé où chaque membre peut déposer un lien (ex : lien Google Drive, lien vers une vidéo, un scénario) avec un titre et une courte description, et le rattacher à un projet ou une catégorie (ex : "Qui est le microbe ?", "Communication", "Général").

Visible par tous les membres connectés (pas de restriction hiérarchique sur cet espace, c'est un espace de partage libre).

7. Groupe de discussion

Un seul groupe de discussion général, accessible à tous les membres connectés, façon chat simple : liste de messages avec nom de l'auteur, contenu texte, heure d'envoi, mise à jour en direct.

Pas besoin de discussions privées ni de plusieurs canaux pour la première version.

8. Interface

Menu simple avec : Tableau de bord, Mes tâches, Rapports, Organigramme, Liens & documents, Discussion.

Le tableau de bord affiche : mes tâches en cours, mes derniers rapports envoyés, et (si je supervise des gens) un résumé rapide de l'activité de mon équipe.

Utilise le logo du club (je l'attacherai) et une palette noir/or sobre, cohérente avec l'identité "Club Ciné Tremplin — On apprend, on tourne, on décolle".

9. Contrainte technique

Reste sur une architecture simple et standard (auth + base de données + quelques écrans), sans fonctionnalités superflues, pour limiter la consommation de crédits de génération. Je ferai les améliorations et ajustements ensuite au fur et à mesure.

Conseils avant d'envoyer le prompt

Ajoute le logo du club comme image de référence dans Lovable si l'outil le permet, pour que l'interface s'en inspire dès le départ.

Envoie ce prompt en un seul bloc pour que Lovable génère la structure de base (auth, base de données, écrans) en une fois — évite de fragmenter en plusieurs petites demandes séparées, cela consomme plus de crédits.

Une fois la base générée, teste d'abord la connexion et la création d'un compte admin avant de demander d'autres ajustements.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cinetremplin.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/07fdccec-9a00-4aff-8384-374c6e128828).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
