# Ciné Tremplin — e-mails, projets, budget prévisionnel, mentor externe

## Point bloquant à régler d'abord : les vrais e-mails

Aujourd'hui l'application n'envoie **aucun e-mail automatique**. Les boutons
« Répondre par e-mail » ouvrent la messagerie de la personne (mailto) : rien ne part tout seul,
donc rien ne peut être testé vers `tofac61@gmail.com`.

Pour envoyer de vrais e-mails, il faut un **nom de domaine que vous possédez**
(ex. `cinetremplin.org`). Il n'existe pas d'adresse d'envoi gratuite fournie par la plateforme.
Tant que le domaine n'est pas branché, je peux tout préparer (modèles, envois, journal des envois,
bouton de renvoi) mais aucun e-mail réel ne partira et je ne pourrai pas fournir de preuve de
réception.

Dites-moi si vous avez un domaine : je le configure et j'active les envois réels dans la foulée.

## Ce que je construis (dans cet ordre)

### 1. Envois d'e-mails
- Liste de tous les points d'envoi : dossier externe reçu, accusé au porteur, avis d'étude,
  approbation/refus, délai fixé ou modifié, invitation de mentor, message de mentor au club,
  réponse de casting, rappels de délais, messages internes hors ligne.
- Modèles d'e-mails aux couleurs du club (logo, slogan) et adresse de réponse pointant vers la
  bonne personne.
- Journal des envois (destinataire, objet, rubrique, statut, erreur, date) consultable par le
  Producteur général dans Modifications, avec bouton « Renvoyer ».
- Correction du dossier externe : note d'intention, note du réalisateur et scénario enregistrés,
  présents dans l'e-mail et affichés dans la fiche.

### 2. Suppression réversible
- Chaque créateur peut supprimer ce qu'il a créé (confirmation) ; le Producteur général peut tout
  supprimer, y compris n'importe quel projet.
- Suppression « en corbeille » : l'élément disparaît des listes mais reste restaurable depuis
  Modifications. Tout est inscrit au journal.
- Supprimer un projet avec budget ou dépenses : confirmation renforcée, la comptabilité est
  conservée et marquée « projet supprimé ».

### 3. Indicateurs d'activité
- Suivi « déjà vu » par personne : les pastilles diminuent puis disparaissent à la consultation,
  en temps réel, en réutilisant les indicateurs existants.

### 4. Création et étude des projets
- Formulaire de projet ouvert à tous les membres (dossier interne, hors vote) : titre, logline,
  synopsis, note d'intention, note du réalisateur, scénario — chacun en texte et/ou lien Google
  vérifié — plus le bloc auteur (nom, poste, e-mail).
- Étude à quatre (Producteur général, Producteur délégué, Réalisateur, Scénariste) : avis
  approuvé / à revoir / refusé avec commentaire, visible des quatre.
- L'approbation du Producteur général fait passer le projet en « approuvé » ; le refus est
  conservé et l'auteur informé. À chaque étape : notification interne et/ou e-mail avec le lien
  de suivi.
- Le projet reste lié à son auteur et apparaît dans tous les sélecteurs de projet dès son
  approbation (ou dès la proclamation du vote), depuis une seule et même table.

### 5. Projets approuvés
- Deux vues : internes approuvés / externes approuvés. Fiche : équipe, logline, synopsis, phase,
  délai.
- Délai fixé et modifié uniquement par le Producteur général et le Producteur délégué, communiqué
  à l'auteur à chaque changement.
- Les quatre responsables voient tout et peuvent marquer un projet « démarré ».

### 6. Mentor externe
- Depuis son lien : projets en cours, phase et logline en lecture seule (ni scénario, ni budget).
- Fil de discussion avec la personne qui lui a donné le lien, et message « au club » qui arrive
  au Producteur général et au Producteur délégué, avec réponse possible.

### 7. Budget prévisionnel
- On choisit un projet puis on remplit les lignes (catégorie libre : accessoires, matériel,
  transports, repas, lieux…), avec quantité, prix unitaire, total, auteur et date ; totaux par
  catégorie et total du projet automatiques.
- Accès en écriture : Réalisateur, Accessoiriste, Régisseur général, Directeur artistique,
  Comptable / Trésorier, Producteur général, Producteur délégué, Chef opérateur, Scénariste et
  l'auteur du projet. Mêmes données que le budget déjà présent dans la fiche projet.

### 8. Comptabilité reliée aux projets
- Nouvelle partie « Dépenses prévisionnelles » alimentée par le budget prévisionnel.
- Chaque nouvel enregistrement demande de choisir un projet ; les anciens restent valides en
  « sans projet » et peuvent être rattachés.
- Dans la fiche projet : prévisionnel face au réel, avec l'écart.

### 9 et 10. Base, journal et outils du Producteur général
- Nouvelles tables et colonnes intégrées à la fiche Excel et au journal automatique.
- Dans Modifications : suivi des e-mails, corbeille, projets en attente d'étude et avis manquants,
  délais dépassés ou proches, gestion des liens de mentors.

## Détails techniques

- Migrations additives : `email_log`, `user_seen`, `project_reviews`, `project_deadlines`
  (ou colonnes `deadline_*` sur `projects`), colonnes `deleted_at` / `deleted_by` sur les tables
  concernées, colonnes de liens Google sur `ideas`, `expenses.project_id` conservé tel quel.
- Réutilisation de `project_budget_lines` pour le budget prévisionnel (source unique) et de
  `project_edits` pour le circuit de modification existant, qui reste inchangé.
- Envois via le service d'e-mails géré (modèles React Email + fonction serveur), journalisés dans
  `email_log`.
- Politiques RLS ajoutées à côté des existantes ; aucune table, colonne, fonction ou policy
  existante n'est supprimée ni renommée.

## Vérification

Je déroule chaque point de votre méthode avec des données marquées « TEST », puis je les supprime
(ce qui teste aussi la corbeille). Pour les e-mails, je fournirai la liste exacte des envois
(objet, heure, statut) — la réception dans votre boîte devra être confirmée par vous.
