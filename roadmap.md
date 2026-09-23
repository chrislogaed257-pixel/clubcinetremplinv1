# Ciné Tremplin — chantiers

- [x] Base de données recréée (55 tables, 25 migrations d'origine) + connexion email activée
- [x] 1. Producteur général = admin partout (fonction SQL, policies, assertAdmin, AppLayout/membres/modifications)
- [x] 5. Barre du haut fixe (sticky, fond opaque flouté)
- [x] 6a. Notifications en temps réel + son à la réception
- [x] 6b. Chat : canal filtré par conversation, coche "vu", son à la réception
- [x] 2. Réponse par email aux soumissions externes (mailto, modèle idea_received, response_drive_link, drive_link cliquable)
- [x] 3. Idées & projets : numéro de dossier, vues interne/externe, frise de statut, public_token + page publique, accusé PDF, identité clap
- [x] 4. Boutons "Télécharger" (PDF/CSV/Excel) sur toutes les rubriques listées
- [x] 7. Direction visuelle (motif clap, transitions, spotlight)
- [x] 8. Notifications pour tous types de conversation, password_messages, mentor_messages, casting "Répondre par email"
- [x] 9. Modifications : 3 nouveaux onglets (Comité & rôles, Identité visuelle, Rubriques du menu)
- [x] Vérification par rôle (6 comptes de test : PG sans rôle admin, PD, chef d'équipe, membre, mentor, bailleur ; vote, mailto, menus, Modifications, temps réel corrigé)
- [x] Nouveau logo sur l'application, les pages publiques et l'en-tête des PDF
- [x] Description officielle des 45 postes + remplissage des fiches membres vides
- [x] Fiche Excel de la base + journal automatique + relevé de structure à l'ouverture
- [x] Projet interne créé depuis le vote (logline, synopsis, scénario, budget, approbation PG/PD)
- [x] Phases visibles par membres, mentors et bailleurs + carte « Projets du club en bref »
- [x] Dépôt de projet interne, étude à quatre, projets approuvés, budget prévisionnel, comptabilité reliée, corbeille, journal des e-mails, pilotage PG
- [x] Mentor externe : logline + phase en lecture seule, bouton « Écrire au club » (PG/PD notifiés)
- [x] Pastilles par rubrique qui diminuent dès consultation (état personnel user_seen)
- [x] Restauration complète : données Excel importées, postes rattachés aux membres, rôles admin/mentor/bailleur, comptes recréés, outil technique temporaire supprimé

- [ ] Bloquant : aucun domaine d'envoi configuré → aucun e-mail réel ne peut partir ni être testé vers tofac61@gmail.com
- [ ] Avant mise en ligne : supprimer les 6 comptes de test @cinetremplin.test
- [ ] En attente : étapes 2 et 3 du prompt « description des postes » (affichage/notification, formulaires)

- [x] Envoi d'e-mails : point d'envoi unique (mode aucun / gmail_smtp / domaine vérifié), boîte d'envoi, écran domaine, journal complet

- [x] Rubriques par poste : table position_routes + onglet « Rubriques par poste », menu filtré ET accès direct bloqué (message clair + retour au tableau de bord), producteurs non restreints
- [x] Rubriques recommandées pré-remplies pour les 45 postes (ajout seul, ON CONFLICT DO NOTHING)
- [x] Fiche de présentation illustrée : page publique /presentation (3 images, imprimable), liée depuis l'accueil et l'onglet Guide
- [x] Vote public sur téléphone : lien publié sans authentification, ancien partage par identifiants retiré, parcours visiteur testé
- [x] Opérations hébergées fiabilisées : connexion Cloud de secours pour les fonctions protégées, modification/suppression des membres vérifiées
- [x] Vote : suivi chiffré privé actualisé toutes les 2 secondes pour le Producteur général
