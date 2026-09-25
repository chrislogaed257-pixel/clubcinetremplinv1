# Corriger le préremplissage lors de la modification d’un membre

## Objectif
Faire en sorte que le formulaire de modification affiche systématiquement toutes les informations déjà enregistrées, y compris après un chargement lent sur Vercel.

## Changements
- Charger ensemble, au clic sur « Modifier », le niveau d’accès, les postes et rangs, les supérieurs, les postes supérieurs et les projets du membre.
- Ne plus dépendre des listes générales qui peuvent être encore incomplètes au moment du clic.
- Attendre la fin du chargement avant de rendre le formulaire modifiable, et signaler clairement une éventuelle erreur sans effacer les données présentes.
- Conserver le mot de passe vide et optionnel afin qu’il ne soit jamais remplacé sans demande.

## Vérification
- Tester ici avec un compte Producteur général sur une fiche contenant plusieurs informations.
- Vérifier que l’ouverture reprend bien les valeurs existantes et qu’un enregistrement sans modification les conserve.
- Contrôler les erreurs de compilation et de fonctionnement.

## Détail technique
Les lectures resteront authentifiées et utiliseront la même base partagée par Lovable et Vercel. La correction concerne le chargement du formulaire, pas les données existantes.
