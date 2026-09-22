# Amélioration complète de Club Ciné Tremplin

## Principes non négociables

- Conserver toutes les données, rubriques, fonctions et réglages existants.
- Procéder par migrations additives et conserver les anciens champs pendant la transition.
- Donner au Producteur général un accès complet en lecture et modification dans chaque rubrique, sauf modification d’une session de vote ouverte.
- Remplacer tous les emojis visibles par des icônes Lucide cohérentes.
- Ne jamais employer le double tiret comme séparateur dans les textes.
- Tester chaque rubrique après modification, puis corriger toute régression avant la suivante.

## 1. Accès, mots de passe et permissions

- Auditer et harmoniser les règles d’accès de toutes les tables afin que l’administrateur et le Producteur général puissent tout consulter et modifier.
- Conserver le verrouillage des sessions de vote dès leur ouverture.
- Enrichir chaque demande de mot de passe avec le nom complet, le poste et l’identifiant email du membre.
- Ne pas stocker ni révéler un mot de passe actuel, car il est chiffré et irrécupérable. Permettre au Producteur général de générer le mot de passe temporaire choisi `Chris7545..`, avec changement obligatoire à la prochaine connexion.
- Ajouter l’icône œil sur le champ mot de passe de connexion.

## 2. Cycle complet Tâches vers Rapports

- Rendre le projet obligatoire sur chaque nouvelle tâche et rattacher les tâches existantes à leur projet quand l’information est disponible.
- Permettre au créateur de la tâche, au supérieur hiérarchique concerné et au Producteur général de créer, modifier et retirer les tâches autorisées.
- Ajouter la confirmation de réception et le dépôt d’un lien de rendu par le destinataire.
- Créer automatiquement un rapport relié à la tâche, au projet, à l’expéditeur et au supérieur qui l’a attribuée.
- Notifier le destinataire à chaque modification de tâche, puis notifier le supérieur lors de la remise.
- Ajouter aux rapports les décisions approuvé/refusé, le commentaire obligatoire, une nouvelle échéance facultative lors d’un refus et la notification de l’auteur.
- En cas de refus, remettre automatiquement la tâche à « À faire » et appliquer le délai supplémentaire.
- Corriger et tester le champ de réponse et les boutons de décision.

## 3. Navigation, notifications et messagerie

- Remplacer le menu par une navigation verticale fixe, hiérarchisée et entièrement basée sur des icônes vectorielles.
- Ajouter dans les réglages administrateur un ordre global du menu par glisser déposer, conservé dans la base.
- Mémoriser la position de défilement du menu et la restaurer au retour.
- Ajouter une flèche de retour utilisant l’historique réel de navigation.
- Rendre chaque notification cliquable, la marquer lue au clic et ouvrir directement l’élément concerné via son identifiant.
- Vérifier les destinataires et actions des demandes de membre, mentor, congé, tâche, rapport et casting.
- Conserver et fiabiliser les badges de messages non lus avant ouverture.
- Tester les conversations directes existantes, leur création, l’envoi, la lecture et les notifications.

## 4. Organigramme, congés, discussions et profils

- Afficher « En congé » sur l’organigramme quand une demande approuvée couvre la date courante.
- Afficher nom et poste de chaque supérieur dans le sélecteur de congé.
- Afficher, dans chaque discussion, les membres autorisés avec leurs postes selon le type de discussion.
- Conserver la description de poste existante et garantir sa modification par le membre, son affichage sur le tableau de bord et sous son nom dans l’organigramme.

## 5. Vote, mentors, PDF et archives

- Créer des liens de vote propres à chaque session afin que les identifiants partagés ouvrent directement la bonne session.
- Ajouter un lien mentor sans identifiant, limité à la session concernée, révocable et non réutilisable hors de cette session.
- Rendre l’enregistrement d’une voix atomique pour empêcher un dépassement de quota en cas de demandes simultanées.
- Afficher après le dernier vote un remerciement, un bouton Quitter et l’attente de proclamation.
- Conserver les résultats en direct pour le Producteur général, même si les votants ne les voient pas.
- Ajouter une analyse d’anomalies respectueuse de l’anonymat : rythme inhabituel, dépassements empêchés, volume de jetons et cohérence des totaux, sans relier une identité à un choix.
- À la proclamation : figer les résultats, clôturer la session, créer une archive immuable et rendre disponible une vue PDF dédiée à la session.
- Ajouter la rubrique Archives du club contenant journal des dépenses, documents de fonds, liste des membres, analyses de votes et feuilles de service.

## 6. Casting complet

- Appliquer l’accès demandé : Producteur général, Producteur délégué, Directeur de casting, Directeur d’acteurs, Réalisateur et Gestionnaire de communication.
- Réserver la modification aux Producteur général, Directeur de casting et Réalisateur.
- Étendre le formulaire externe avec projet, nom, âge, province, quartier, WhatsApp, email, langue, expérience cinéma et disponibilité.
- Présenter les candidatures en tableau, conserver les champs historiques et ajouter un message de confirmation nommé par projet.
- Permettre approbation/refus avec commentaire et préparer des liens Email et WhatsApp pour les candidats externes.
- Pour un candidat membre, créer une conversation « Casting » et lui transmettre la décision au nom du Directeur de casting.
- Ajouter « Acteurs approuvés » et notifier le réalisateur avec la liste complète après finalisation.
- Créer un espace de discussion casting réunissant uniquement les fonctions habilitées.

## 7. Documents, langue et charte graphique

- Créer des vues d’impression propres pour contrats et feuilles de service, sans menu, recherche, notifications, langue ni thème.
- Étendre la traduction FR/EN à toute l’interface, aux statuts et messages système. Les contenus rédigés par les membres restent dans leur langue d’origine.
- Extraire les teintes du logo existant et les formaliser en couleurs sémantiques : fond anthracite, surfaces neutres, accent or du logo.
- Harmoniser typographie, contrastes, tableaux, espacements, boutons et états actifs sans refonte structurelle ni suppression.
- Ajouter des métadonnées propres à chaque page de contenu.

## 8. Validation rubrique par rubrique

Pour chaque lot :

1. Vérifier les anciennes données avant migration et après migration.
2. Tester les permissions comme Producteur général, supérieur et membre ordinaire.
3. Tester création, lecture, modification, suppression ou décision selon la rubrique.
4. Tester notifications et liens profonds.
5. Tester affichage ordinateur et téléphone.
6. Tester l’impression des documents concernés.
7. Consigner dans la feuille de route ce qui a été testé et corrigé.
8. Exécuter les contrôles de sécurité et vérifier qu’aucune erreur de construction ou d’exécution ne subsiste.

## Ordre de livraison

1. Sécurité et permissions, mots de passe.
2. Tâches, rapports et notifications.
3. Navigation, messagerie, congés, organigramme, discussions et profils.
4. Vote, mentors et archives.
5. Casting.
6. PDF, langue et harmonisation visuelle.
7. Recette complète et rapport synthétique des tests.
