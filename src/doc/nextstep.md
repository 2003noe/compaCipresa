# Prochaines étapes

Mise à jour : octobre 2026.

Le cœur métier est fonctionnel : authentification OTP, multi-exercices, journal avec validation, grand livre, balance, bilan avec N-1, compte de résultat, trésorerie, immobilisations, clôtures, livre d'inventaire, exports. Ce document ne liste que ce qui reste à faire. Les anciens points du plan (statuts normalisés, contrôles avant validation, états vides, filtres, comparatif N-1, logique de calcul hors des composants) sont réalisés et ont été retirés.

## Priorité 1 : sécurité et reproductibilité

1. **Versionner les politiques RLS de toutes les tables.**
   Seule `exercices_comptables` a ses politiques dans `supabase/migrations`. À écrire ou à exporter depuis Supabase pour : `ecritures_comptables`, `lignes_ecritures`, `comptes_comptables`, `journaux`, `immobilisations`, `clotures_comptables`, `controles_cloture`, `pieces_comptables`, `declarations_tva`, `lignes_releve_bancaire`, `notifications`, `parametres_entreprise`, `profiles`, `user_roles`, `role_permissions`, `roles`, `permissions`, `default_compt`. S'appuyer sur `user_has_permission` pour les droits par rôle.
   Critère de fin : avec la clé anon et un utilisateur sans rôle, aucune table sensible n'est lisible ni modifiable.

2. **Versionner la fonction `valider_ecriture`.**
   Le front l'appelle et les triggers en dépendent, mais sa définition n'est dans aucune migration. L'ajouter, avec son `GRANT EXECUTE` limité aux utilisateurs authentifiés et au bon rôle.

3. **Ajouter une migration de base (schéma initial).**
   Tables, types (statuts), index, clés étrangères, rôles et permissions de départ, données de `default_compt`. Critère de fin : sur un projet Supabase vide, appliquer les migrations dans l'ordre suffit à obtenir une base qui fonctionne avec l'application.

4. **Retirer les identifiants en dur du code.**
   `src/lib/supabaseClient.js` contient une URL et une clé de repli codées en dur, et `.env.example` contient les vraies valeurs. Supprimer le repli, mettre des placeholders dans `.env.example`, vérifier que `.env` est bien ignoré. Les clés publishable ne sont pas secrètes, mais le code ne doit pas dépendre d'un projet précis, et la vraie protection reste la RLS (point 1).

5. **Vérifier les droits côté base, pas seulement dans l'interface.**
   `hasRole` et `can` masquent des écrans, mais seule la RLS empêche un appel direct. Tester chaque rôle (ADMIN, comptable, lecteur) sur les opérations sensibles : validation, clôture, suppression d'exercice, gestion des utilisateurs.

## Priorité 2 : qualité du code

6. **Tests unitaires sur les calculs.**
   Aucun test n'existe. Ajouter Vitest et couvrir en premier : `computeDepreciation` (linéaire, dégressif, aucun, dernière année partielle), `genererPeriodes` (mensuel, trimestriel, exercice décalé), les agrégations de `lib/bilan.js` (équilibre actif = passif, signes), `lib/dashboard.js`.

7. **Tests d'intégrité côté SQL.**
   Transformer `verify_accounting_integrity.sql` en jeu de tests reproductibles : écriture déséquilibrée refusée, modification d'une écriture validée refusée, écriture dans une période clôturée refusée, compte d'un autre exercice refusé.

8. **Nettoyer le dépôt.**
   - Supprimer le fichier `tore --staged node_modules` (sortie de `git` enregistrée par erreur).
   - Retirer `dist/` du suivi Git et l'ajouter à `.gitignore`.
   - Épingler les versions dans `package.json` (react, react-dom, react-router-dom, vite, lucide-react, @vitejs/plugin-react sont en `latest`).
   - Ne garder qu'une bibliothèque de saisie téléphone (trois sont installées : `react-international-phone`, `react-phone-input-2`, `react-phone-number-input`).

9. **Supprimer le code hérité de la phase maquette.**
   `GenericAccountingPage`, `GenericNewForm` et les routes `/nouveau-grand-livre`, `/nouvelle-balance`, `/nouveau-resultat`, `/nouvelle-tresorerie` ne correspondent plus au fonctionnement actuel. À supprimer ou à brancher sur de vraies fonctions.

10. **Gestion d'erreurs uniforme.**
    Remplacer les `console.error` isolés par un affichage lisible pour l'utilisateur et, à terme, un suivi d'erreurs. Prévoir un comportement clair quand Supabase est indisponible.

## Priorité 3 : fonctionnalités à terminer ou à clarifier

11. **TVA.**
    La table `declarations_tva`, `regles_echeances_fiscales` et `lib/tva.js` existent, et le dashboard et les clôtures s'en servent, mais il n'y a pas de page dédiée. Décider : soit construire la page (workflow brouillon, en attente, déclarée, payée, échéances, alertes de retard), soit la retirer du périmètre annoncé.

12. **Rapprochement bancaire.**
    La table `lignes_releve_bancaire` est utilisée, mais la route `/rapprochement` n'existe plus. Même décision : construire (import de relevé, proposition d'écritures, historique de rapprochement) ou retirer.

13. **Amortissement dégressif.**
    Le calcul est une approximation (sans bascule vers le linéaire). Si l'application vise un usage fiscal réel, implémenter le régime exact ou documenter clairement la limite dans l'interface.

14. **Correction des écritures validées.**
    Une écriture validée est verrouillée, ce qui est correct, mais la FAQ renvoie à une « procédure d'extourne » qui n'existe pas dans l'application. Ajouter une fonction d'extourne (écriture inverse liée à l'originale) ou préciser la procédure.

15. **Onglets Utilisateurs et Intégrations des paramètres.**
    Ils ne font que renvoyer vers la page Configuration ou afficher un message vide. Soit les supprimer, soit y mettre du contenu réel (connexion MTN et Orange Money, portail DGI, si ces intégrations sont prévues).

16. **Dashboard.**
    Pistes restantes : marge brute et marge nette, ratio de trésorerie, tendance de trésorerie sur 3, 6 et 12 mois, clic sur une catégorie de charges pour filtrer les mouvements.

## Priorité 4 : mise en production

17. **Environnements** : un projet Supabase de développement et un de production, avec les migrations appliquées par script.
18. **Sauvegardes et reprise** : vérifier la stratégie de sauvegarde (le plan gratuit est limité) et documenter la restauration.
19. **Performance** : limiter les requêtes multiples, réduire les colonnes sélectionnées, paginer le journal et le grand livre sur de gros volumes, éventuellement mettre en cache les exercices et les comptes.
20. **Données de démonstration** : un script d'initialisation avec plusieurs exercices, des comptes, des écritures et de la TVA pour démontrer l'application et tester les ratios sur des données réalistes.
21. **Documentation fonctionnelle** : pour chaque page, objectif, tables utilisées, logique de calcul, règles de validation.

## Ordre conseillé

1. Points 2, 3 et 1 (le dépôt devient reproductible et la base est protégée).
2. Points 4, 5 et 8 (hygiène et sécurité).
3. Points 6 et 7 (tests sur les calculs et les gardes SQL).
4. Points 11 et 12 : trancher entre construire ou retirer, puis agir.
5. Le reste selon l'usage visé (démonstration, candidature ou production).