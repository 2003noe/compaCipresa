Plan d'amélioration CIPRESA - Next steps

Contexte
- L'application est bien structurée : routes, layout, composants UI, pages comptables, dashboard, auth, settings.
- Le dashboard affiche maintenant des chiffres, ce qui montre que le cœur métier a été branché sur les tables SQL correctes.
- Le projet est proche d'un outil comptable exploitable, mais plusieurs points doivent être renforcés pour devenir robuste, fiable et professionnel.

Priorité 1 - Sécurité des données et cohérence métier
1. Normaliser les enums et statuts
- Vérifier que toutes les tables utilisent les mêmes valeurs : VALIDEE, BROUILLON, OUVERT, CLOTUREE, etc.
- Centraliser les libellés et statuts dans un fichier de constantes pour éviter les écarts entre front et SQL.
- Ajouter des contrôles côté application pour empêcher les statuts incohérents.

2. Sécuriser les accès Supabase
- Activer le Row Level Security (RLS) sur les tables sensibles.
- Définir les politiques selon les rôles (admin, comptable, gestionnaire, lecteur).
- Vérifier l'utilisation de l'auth user connectée pour filtrer les données.

3. Vérifier les relations entre tables
- Chaque écriture doit avoir un exercice valide.
- Chaque ligne d'écriture doit appartenir à un compte existant.
- Les soldes d'ouverture doivent être cohérents avec les comptes de trésorerie et les mouvements.

4. Contrôles comptables avant validation
- Avant de valider une écriture, vérifier qu'elle est équilibrée.
- Vérifier la cohérence du journal, du compte et du libellé.
- Empêcher la création de lignes avec débit et crédit simultanés.

Priorité 2 - Dashboard et analyse financière
5. Améliorer le dashboard
- Ajouter un état vide explicite quand le compte est vide.
- Afficher correctement les variations vs N-1 quand une donnée d'exercice précédent existe.
- Ajouter des messages explicites : pas d'écriture validée, pas de clôture, pas de TVA à déclarer.
- Ajouter des filtres avancés (mois, compte, statut, journal).
- Ajouter un indicateur de charge de travail : écriture du mois, TVA en retard, clôtures incomplètes.

6. Mettre la trésorerie en contexte
- Le dashboard ne doit pas seulement afficher un solde brut ; il doit indiquer :
  - encaisse disponible
  - décaissements
  - flux mensuels
  - tendance sur 3, 6 et 12 mois
- Ajouter un comparatif avec le mois précédent et l'exercice précédent.

7. Améliorer la répartition des charges
- Ajouter une légende plus lisible et plus détaillée.
- Afficher le total exact et la part (%) de chaque catégorie.
- Permettre un clic sur une catégorie pour filtrer les mouvements associés.

8. Ajouter des KPI uniquement pertinents
- Trésorerie : vrai tableau de bord de cash management
- Chiffre d'affaires : OK
- Résultat net : OK
- Écritures validées : OK
- Ajouter aussi : marge brute, marge nette, ratio de trésorerie, activités en retard.

Priorité 3 - Qualité de l'expérience utilisateur
9. Standardiser les composants de formulaire
- Tous les formulaires doivent avoir le même comportement de validation, affichage d'erreur, chargement et bouton de soumission.
- Ajouter les messages d'erreur côté front sur les champs obligatoires.
- Gérer les erreurs backend de manière propre.

10. Gérer les états de chargement et d'erreur
- Le dashboard, les listes et les pages de détail doivent afficher un loading propre.
- Les erreurs de Supabase doivent être lisibles pour l'utilisateur, pas seulement dans la console.
- Ajouter les messages “Aucune donnée pour cet exercice” au lieu de valeurs vides ou de 0 sans contexte.

11. Ajouter la recherche, le tri et les filtres sur toutes les listes
- Les pages comptables et réglages doivent permettre :
  - recherche par libellé, numéro, référence, statut
  - tri par date, montant, compte, statut
  - filtre par exercice, journal, nature, période

12. Rendre les tables plus lisibles
- Ajouter des colonnes utiles : journal, exercice, date d'échéance, pièce jointe, responsable, commentaire.
- Uniformiser les formats de montants et de dates.
- Ajouter un bouton “voir détails” sur chaque écriture.

Priorité 4 - Logique comptable et pages métier
13. La page Journal doit être plus fonctionnelle
- Afficher le journal détaillé avec toutes les lignes
- Permettre de filtrer par journal, exercice et statut
- Ajouter la possibilité de modifier ou d'annuler une écriture en brouillon
- Ajouter l'affichage du solde cumulatif par compte

14. La page Grand livre doit être exploitable
- Le grand livre est actuellement un écran technique, pas un écran métier.
- Il doit afficher : compte, date, libellé, débit, crédit, solde cumulatif, exercice
- Ajouter le filtrage par compte et par période

15. La page Balance doit être auditable
- Vérifier les calculs du solde final de chaque compte
- Ajouter colonnes : solde initial, mouvements, solde final
- Afficher les écarts et les erreurs de balance

16. La page Bilan et Compte de résultat doivent être comparatifs
- Ajouter la comparaison N-1
- Ajouter les totaux de sections
- Ajouter la visualisation de la marge et du ratio de rentabilité
- Vérifier les conventions de signe pour les charges et produits

17. Les clôtures et dossiers TVA doivent être plus orientés workflow
- Ajouter un workflow clair : brouillon -> en attente -> déclarée -> payée
- Visualiser les échéances, les relances et les états de validation
- Ajouter des alertes de retard pour TVA et clôtures

18. Les rapprochements bancaires doivent être vrais
- Afficher les écritures possibles pour chaque relevé
- Rendre le matching visible et explicite
- Ajouter un historique de rapprochement

Priorité 5 - Architecture et code qualité
19. Séparer les responsabilités métier et UI
- Déplacer les calculs comptables dans des fonctions utilitaires ou services dédiés.
- Éviter de calculer la logique directement dans les composants.
- Créer un module comptable central pour :
  - totaliser les écritures
  - calculer les soldes
  - calculer les résultats
  - calculer les charges par groupe

20. Rendre le projet plus maintenable
- Ajouter des tests unitaires sur les fonctions de calcul comptable.
- Ajouter des tests d'intégration sur les écrans critiques.
- Ajouter des composants réutilisables pour les données, filtres et tableaux.
- Éviter les logiques dupliquées entre dashboard, compte de résultat, bilan et trésorerie.

21. Optimiser la performance
- Limiter les requêtes multiples et les données non nécessaires.
- Utiliser des fetchs avec payload réduit.
- Ajouter des hooks dédiés pour charger les données par module.
- Préparer un cache simple pour les exercices et comptes.

22. Préparer le projet pour la production
- Envoyer les variables d'environnement dans un fichier .env propre.
- Ajouter des logs et suivi des erreurs.
- Vérifier les limites de taille des requêtes SQL et des payloads.
- Ajouter une stratégie de fallback quand Supabase est indisponible.

Priorité 6 - UI/UX globale
23. Finaliser le design système
- Uniformiser les espacements, tailles de police, boutons, cartes et tableaux.
- Faire un design plus “ERP” : sérieux, lisible, dense, sans éléments décoratifs inutile.
- Harmoniser les couleurs et les badges avec les statuts comptables.

24. Ajouter la navigation orientée workflow
- Dashboard -> Journal -> Compte de résultat -> Bilan -> TVA -> Clôtures
- Chaque page doit avoir un chemin explicite vers la suivante.
- Les action buttons doivent être orientés vers le métier réel : créer, modifier, valider, clôturer.

25. Améliorer les tableaux et graphiques
- Les graphiques du dashboard doivent afficher des libellés lisibles.
- Les tables doivent rester lisibles en mobile et en desktop.
- Ajouter le hover, la sélection, les totaux et les couleurs adaptées.

Priorité 7 - Données de démonstration et mock data
26. Ajouter un vrai jeu de données de démonstration
- Créer plusieurs exercices, comptes, écritures et TVA pour simuler un vrai cas d’entreprise.
- Le dashboard, les ratios et les graphiques doivent être testés avec des données réalistes.
- Préparer un script d'initialisation pour les développeurs et les démonstrations.

27. Ajouter une documentation fonctionnelle
- Documenter chaque page : objectif, tables utilisées, logique de calcul, règles de validation.
- Ajouter un schéma de flux : exercice -> écritures -> balance -> bilan -> résultat -> clôture.

Priorité finale - Ce qui est le plus important à faire maintenant
- 1) Mettre en place la cohérence comptable des statuts et des comptes.
- 2) Finaliser les calculs de resultats (CA, trésorerie, résultat net, charges).
- 3) Ajouter les états vides, les filtres et les comparatifs N-1.
- 4) Vérifier toutes les pages de comptabilité avec les données réelles.
- 5) Ajouter les tests et la sécurité data avant la mise en production.

Conclusion
- Le projet a une bonne base structurelle et un vrai noyau métier fonctionnel.
- L'application est déjà très proche d'un vrai outil de gestion comptable de démonstration.
- La prochaine étape n'est pas de refaire le frontend, mais d'affiner la logique comptable, la qualité des données et l'expérience utilisateur.

A faire en priorité immédiate
- Sécuriser les données et les statuts
- Harmoniser les comptes par nature
- Finaliser les vues de calcul (CA, résultat, charges, trésorerie)
- Ajouter les filtres et les états vides
- Ajouter les tests métier de calcul

Ce plan permettra de passer d'un front visuellement convaincant à une application comptable fiable et utilisable en production.
