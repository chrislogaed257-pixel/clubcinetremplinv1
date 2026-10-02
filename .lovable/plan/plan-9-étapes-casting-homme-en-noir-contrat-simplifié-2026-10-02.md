# Plan : 9 étapes (Casting → Homme en Noir) + Contrat simplifié

Règle d'or : rien supprimé, rien renommé, uniquement des ajouts. Tout est enregistré en base. Contrat et Comptabilité reliés automatiquement. Livraison par lots, chaque lot testé et corrigé avant le suivant.

## Lot 1 — Casting
- Candidatures classées par rôle (retenus) + groupe « Non retenus », statut visible.
- Supprimer une candidature (avec confirmation, va en corbeille).
- Fiche d'appel modifiable par le responsable ; le lien existant affiche toujours la version à jour.
- Toutes les cases de la fiche « Homme en Noir » deviennent des cases réutilisables pour tous les projets.
- Réponse par e-mail : destinataire prérempli, bouton « Copier l'e-mail », message « retenu » ou « non retenu » prérempli selon le statut (nom, rôle, projet insérés), modifiable, change si le statut change. Deux modèles chaleureux, modifiables dans Casting. La fonction d'envoi existante est conservée.

## Lot 2 — Projets et bailleur
- Corbeille PG : projet supprimé absent de toutes les listes et sélecteurs.
- Bailleur : ouvre ses discussions privées avec PG/PD, ne voit pas les discussions générales ; accepte/refuse un projet ; rubrique « Projets refusés » où il peut revenir sur sa décision.

## Lot 3 — Activités du club
- Nouvelle case dans Déposer un projet (description, budget, début/fin, membre et poste, source obligatoire si montant : caisse ou membre).
- Arrive dans Idées reçues ; PG/PD approuve (confirmation du versement si le membre paie) → classée « Autres », dépense créée automatiquement en Comptabilité.

## Lot 4 — Caisse des membres + Comptabilité
- Contributions (membre, montant, date), bailleur unique Ciné Tremplin, total versé au projet « Survie des activités du club ».
- Par projet : budget, entrées, dépenses, solde à jour.

## Lot 5 — Contrats (version simplifiée + étape 6)
- Un contrat par membre et par poste ; création par Chargé d'administration, PG ou PD : choix du membre et du poste, contrat prérempli aussitôt.
- Apports cochés avec points : compétences, matériel et lieux (valeur, prêt/don, restitution), temps, financement (source, remboursable), « Autre ».
- Calculs : total des points, % recommandé, % retenu modifiable, contrôle 100 % part du club comprise, plafond par personne, ordre de recoupement (coûts → club → bénéfice net).
- Contrat du club (part survie → Caisse), crédits et bénéfices non financiers.
- Document PDF et Word d'au moins 3 pages, inspiré de votre modèle Contrat_1.docx.
- Espace membre : ne voit que ses contrats, télécharge, signe (dessin ou saisie + date), renvoie → « signé et renvoyé ».
- Lien Google Drive avec case obligatoire « partagé avec cinetremplin@gmail.com ».
- Notifications à la personne concernée, et au créateur après signature. PG modifie tout.

## Lot 6 — Bénéfices (Comptabilité)
- Total des entrées et provenance ; partage automatique selon les % retenus après remboursement.
- Chaque membre voit uniquement sa ligne (bailleur compris), PG/PD/comptable/chargé d'administration voient et modifient tout ; PDF de sa ligne.

## Lot 7 — Organigramme
- PDF paysage + mode réduit pour voir toute la hiérarchie.

## Lot 8 — Nom du projet
- « Homme Noir » → « Homme en Noir » partout (base, textes, documents).

## Détails techniques
- Nouvelles tables additives (contrats détaillés, apports, signatures, caisse, bénéfices, modèles de messages casting, activités) avec GRANT + RLS basés sur les postes existants (has_position, is_admin_or_general_producer).
- Calculs de partage dans des fonctions de base pour que Lovable et Vercel donnent le même résultat sans clé privée.
- Word généré dans le navigateur (paquet docx), PDF via jsPDF déjà utilisé.
