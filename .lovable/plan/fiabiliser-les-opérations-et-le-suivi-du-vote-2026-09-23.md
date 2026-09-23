# Fiabiliser les opérations et le suivi du vote

## Objectif
Éliminer l’erreur de connexion à Lovable Cloud pendant les enregistrements et suppressions, conserver les données existantes, et donner au Producteur général une lecture chiffrée du vote en direct.

## Changements prévus
- Réutiliser les valeurs publiques déjà intégrées à l’application comme secours côté serveur lorsque l’hébergement ne transmet pas `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY`.
- Garder toutes les opérations sensibles protégées par la session et le contrôle du rôle Producteur général.
- Vérifier les parcours de modification et suppression, en particulier les membres, et afficher des erreurs compréhensibles sans interrompre la rubrique.
- Ajouter au Producteur général un relevé actualisé automatiquement pendant un vote ouvert : rang, projet, nombre de voix et total exprimé, même si l’affichage public des résultats est désactivé.
- Conserver la confidentialité des votants et ne pas modifier les voix déjà enregistrées.
- Vérifier le fonctionnement dans l’aperçu et signaler clairement la limite propre à Vercel si une clé serveur privée n’y est pas disponible.

## Détails techniques
- Créer un middleware d’authentification propre au projet avec repli sur les variables publiques injectées à la compilation, sans exposer de clé privée.
- Remplacer uniquement les imports du middleware dans les fonctions serveur concernées ; ne pas modifier les fichiers générés.
- Ajouter une lecture protégée des résultats complets réservée au Producteur général, avec rafraîchissement périodique sur l’écran Vote.
- Tester l’enregistrement d’un membre, une suppression non destructive de test si possible, le contrôle des droits et l’actualisation des résultats.
