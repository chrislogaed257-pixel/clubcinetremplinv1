# Évolution complète de Club Ciné Tremplin

Votre demande couvre une refonte fonctionnelle très large. Rien de l'existant (comptes, tâches, rapports, organigramme, liens, discussion) ne sera supprimé : tout est étendu. Le travail est découpé en 8 lots livrables l'un après l'autre, chacun testable immédiatement.

## Lot 1 — Fondations : postes multiples et supérieurs multiples
- Table des postes officiels (les 45 postes de votre liste, dans l'ordre, avec catégorie et rang possible), modifiable ensuite.
- Un membre peut avoir plusieurs postes (avec rang : 1er AR, 2e AR…) et plusieurs supérieurs directs.
- Le poste texte actuel et le supérieur actuel de chaque membre sont repris automatiquement, aucune donnée perdue.
- Les règles de visibilité hiérarchique sont adaptées aux supérieurs multiples.
- Sélecteur « Je travaille maintenant comme : … » en haut de l'écran pour les membres multi-postes.
- Écran Membres étendu : plusieurs postes, plusieurs supérieurs, deux champs « Une chose que tu aimes » / « que tu n'aimes pas ».

## Lot 2 — Organigramme, profils, catégories
- Organigramme cliquable, fiche profil (postes, rangs, supérieurs, personnes dirigées, goûts), visibilité selon la hiérarchie.
- Quatre catégories de tableau de bord (Organisation, Artistique, Technique, Autres) rattachées aux postes.
- Onglet « Modifications », réservé au Producteur général : comptes, postes, hiérarchie, catégories, phases, statuts, catégories de dépenses.

## Lot 3 — Tâches et analyse
- Ajout aux tâches : durée estimée, phase du projet (liste obligatoire, administrable), lien Google Drive cliquable.
- Page « Analyse de travail » : tâches terminées, en retard, rapports envoyés, respect des délais — complète pour Producteur général/délégué, limitée à son équipe pour un chef d'équipe.

## Lot 4 — Équipes et discussions
- Équipes personnelles : création par un responsable, membres, tâches attribuées, rapports via le système existant.
- Discussions séparées : générale, équipe, catégorie, projet, congé, bailleur, mentor.
- Style messagerie : bulles gauche/droite selon l'auteur, champ « Coller un lien Google Drive », liens centrés en bleu et cliquables, pas d'envoi de fichier.

## Lot 5 — Idées de films & scénarios
- Page publique de soumission sans compte : nom, email, fichier (Word/PDF/Excel) **ou** lien Drive, description.
- Rubrique « Idées reçues » : Producteur général, Producteur délégué, Scénariste votent (commentaire obligatoire) ; Directeur de production en lecture + discussion.
- « Marquer comme répondu » par le Scénariste avec note de réponse.
- Passage automatique en « Projets approuvés » après les 3 approbations, avec discussion dédiée au projet.

## Lot 6 — Congés
- « Mes congés » : début, retour, motif, règle des 3 jours contrôlée à la date réelle.
- Validation par Producteur général, Producteur délégué et supérieurs directs, sans doublon ; statut et commentaires visibles par le demandeur ; discussion de décision réservée aux validateurs.

## Lot 7 — Comptabilité et bailleurs
- Dépenses (montant, date, projet, catégorie/sous-catégorie par phase, bailleur).
- Bailleurs et contributions multiples, journal de traçabilité Bailleur → contribution → projet → dépense.
- Espace bailleur strictement isolé (ses fonds, ses projets, nom et poste des membres impliqués), plus un interrupteur d'accès élargi contrôlé par l'administration.

## Lot 8 — Mentor et notifications
- Rôle Mentor : seuls les projets à un stade avancé (statuts configurables), discussion limitée aux deux producteurs.
- Zone de notifications globale, indépendante du poste actif.
- Emails automatiques : nouvelle idée, nouvelle demande de congé, sans doublon de destinataire.

## Détails techniques
- Nouvelles tables : `positions`, `position_categories`, `profile_positions`, `profile_managers`, `teams`, `team_members`, `project_phases`, `ideas`, `idea_votes`, `projects`, `conversations`, `conversation_members`, `leave_requests`, `leave_decisions`, `expenses`, `expense_categories`, `funders`, `contributions`, `funding_links`, `notifications`.
- La table `messages` existante devient le fil de la discussion générale via une colonne `conversation_id` (valeur par défaut = discussion générale), aucun message perdu.
- Toutes les règles d'accès sont doublées en base (RLS + fonctions `security definer` étendues pour les supérieurs multiples) et dans l'interface.
- Les emails nécessitent un nom de domaine que vous possédez ; à défaut, les notifications internes fonctionnent et l'envoi email sera activé dès le domaine fourni.

## Ce dont j'ai besoin de vous
- Un nom de domaine pour l'envoi des emails automatiques (lots 5, 6, 8). Sans lui, je livre les notifications dans l'application et l'email suivra.
