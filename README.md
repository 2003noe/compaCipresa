# CIPRESA Accounting (compaCipresa)

Application web de comptabilité conforme au référentiel SYSCOHADA, construite avec React, Vite et Supabase (PostgreSQL, Auth, Storage). Elle couvre le cycle complet : exercice, écritures, grand livre, balance, bilan, compte de résultat, trésorerie, immobilisations, clôtures et livre d'inventaire.

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Stack technique](#stack-technique)
3. [Installation](#installation)
4. [Configuration Supabase](#configuration-supabase)
5. [Rôles et permissions](#rôles-et-permissions)
6. [Règles comptables garanties par la base](#règles-comptables-garanties-par-la-base)
7. [Flux comptable](#flux-comptable)
8. [Pages et routes](#pages-et-routes)
9. [Structure du projet](#structure-du-projet)
10. [Documentation complémentaire](#documentation-complémentaire)
11. [État du projet](#état-du-projet)

## Fonctionnalités

- **Authentification** : inscription avec code OTP par e-mail, connexion, mot de passe oublié avec OTP de récupération, changement de mot de passe depuis les paramètres.
- **Multi-exercices** : plusieurs exercices comptables, un sélecteur unique dans la barre supérieure qui filtre toutes les pages.
- **Plan comptable** par exercice, avec comptes d'ouverture, comptes parents et export PDF.
- **Journal** : saisie en brouillon, pièces justificatives (image ou PDF) avec aperçu, validation définitive avec numérotation séquentielle, filtres par exercice, journal et période.
- **Grand livre, balance** : soldes calculés par compte, filtrage par période.
- **Bilan** avec comparatif N-1, **compte de résultat**, **trésorerie**.
- **Immobilisations** : amortissement linéaire, dégressif simplifié ou aucun, calcul de la VNC.
- **Clôtures mensuelles** avec contrôles de pré-clôture, **livre d'inventaire**.
- **Dashboard** : cinq cartes KPI (dont le bilan), graphiques, alertes, notifications.
- **Exports** PDF et Excel.
- **Paramètres** : entreprise, exercices, journaux, sécurité, profil avec avatar.
- **Gestion des utilisateurs et des rôles** (page Configuration, réservée aux administrateurs).

## Stack technique

| Couche | Technologie |
| --- | --- |
| Interface | React, React Router, Vite |
| Style | CSS (tokens, composants) et Tailwind 4 |
| Icônes | lucide-react |
| Données et auth | Supabase (`@supabase/supabase-js`) |
| Export | `@react-pdf/renderer`, `xlsx` |

## Installation

Prérequis : Node.js 20 ou plus récent et un projet Supabase.

```bash
git clone <url-du-depot>
cd compaCipresa
npm install
cp .env.example .env     # puis renseigner les valeurs
npm run dev
```

Autres commandes :

```bash
npm run build     # build de production dans dist/
npm run preview   # prévisualisation du build
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publishable (anon) du projet |
| `VITE_VAPID_PUBLIC_KEY` | Clé publique VAPID pour les notifications push |

Seules des clés publiques doivent figurer dans le front. N'ajoutez jamais la clé `service_role` dans le code ni dans un fichier `VITE_*`.

## Configuration Supabase

### 1. Authentification par OTP

Dans le dashboard Supabase : **Authentication > Emails > Templates**, modifier les modèles « Confirm signup » et « Reset password » pour afficher le code `{{ .Token }}` au lieu du lien. Le front utilise `verifyOtp` avec les types `signup` et `recovery`.

### 2. Migrations SQL

Les migrations sont dans `supabase/migrations/`. Elles supposent que le schéma de base (tables, types, rôles) existe déjà. Ordre d'application :

1. `20261013_allow_multiple_exercises_per_year.sql` : autorise plusieurs exercices par année, conserve l'unicité du code.
2. `20261013_add_immobilisation_exercice_id.sql` : rattache les immobilisations à un exercice.
3. `20261013_exercices_role_permissions.sql` : fonction `user_has_permission` et politiques RLS sur `exercices_comptables`.
4. `20261013_bilan_soldes_comptes_exercice.sql` : fonction `soldes_comptes_exercice(uuid, date, date)` utilisée par le bilan et le dashboard.
5. `20261013_z_accounting_integrity_guards.sql` : triggers d'intégrité comptable (à exécuter en dernier, il dépend des colonnes `exercice_id`).

Avant d'activer les gardes sur une base qui contient déjà des données, lancez `supabase/scripts/verify_accounting_integrity.sql` : ce script en lecture seule liste les comptes sans exercice et les écritures incohérentes.

### 3. Storage

Un bucket `avatars` est utilisé pour les photos de profil. Les pièces justificatives passent par la table `pieces_comptables`.

### 4. Tables utilisées

`clotures_comptables`, `comptes_comptables`, `controles_cloture`, `declarations_tva`, `default_compt`, `ecritures_comptables`, `exercices_comptables`, `immobilisations`, `journaux`, `lignes_ecritures`, `lignes_releve_bancaire`, `notifications`, `parametres_entreprise`, `pieces_comptables`, `profiles`, `regles_echeances_fiscales`, `role_permissions`, `roles`, `user_roles`, `permissions`.

## Rôles et permissions

Le front lit les rôles de l'utilisateur (`user_roles`) et les permissions associées (`role_permissions`) au moment de la connexion, via `AuthContext` (`hasRole`, `can`).

| Code | Effet |
| --- | --- |
| `ADMIN` | Accès à la page Configuration, suppression d'exercices, gestion des utilisateurs |
| `COMPTA_READ` | Lecture des exercices |
| `COMPTA_CLOTURE` | Création et modification des exercices, clôtures |

Les contrôles de l'interface ne remplacent pas la sécurité côté base : voir `nextstep.md` pour l'état des politiques RLS.

## Règles comptables garanties par la base

Ces règles sont appliquées par des triggers PostgreSQL, donc même un appel direct à l'API ne peut pas les contourner :

- une écriture est toujours créée en `BROUILLON` ; la validation définitive passe uniquement par la fonction `valider_ecriture`, qui attribue le numéro définitif ;
- une écriture validée est verrouillée : ni modification ni suppression, et ses lignes sont verrouillées aussi ;
- une écriture validée comporte au moins deux lignes, débit total égal au crédit total, et chaque ligne porte un montant au débit ou au crédit, jamais les deux ;
- la date de l'écriture est comprise dans les dates de l'exercice, qui doit être ouvert ;
- la période mensuelle d'une écriture ne doit pas être clôturée ;
- tous les comptes d'une écriture appartiennent au même exercice qu'elle ;
- un compte est rattaché à un exercice ouvert ; son compte parent est dans le même exercice ; les soldes d'ouverture ne sont ni négatifs ni simultanément débiteur et créditeur ;
- les immobilisations sont rattachées à un exercice ; les clôtures mensuelles et les périodes d'exercice sont contrôlées.

## Flux comptable

```
Exercice ouvert
   └─ Plan comptable (comptes de l'exercice, soldes d'ouverture)
        └─ Écritures en brouillon (+ pièces justificatives)
             └─ Validation (valider_ecriture) : contrôle et numérotation
                  └─ Grand livre et balance
                       └─ Bilan et compte de résultat
                            └─ Clôture mensuelle puis clôture d'exercice
```

## Pages et routes

| Route | Page |
| --- | --- |
| `/connexion`, `/inscription`, `/mot-de-passe-oublie` | Authentification (OTP) |
| `/dashboard` | Tableau de bord |
| `/plan-comptable`, `/nouveau-compte` | Plan comptable |
| `/journal`, `/nouvelle-ecriture` | Journal et saisie |
| `/grand-livre` | Grand livre |
| `/balance` | Balance |
| `/bilan` | Bilan |
| `/compte-resultat` | Compte de résultat |
| `/tresorerie` | Trésorerie |
| `/immobilisations`, `/nouvelle-immobilisation` | Immobilisations |
| `/clotures`, `/clotures/:id`, `/nouvelle-cloture` | Clôtures |
| `/livre-inventaire` | Livre d'inventaire |
| `/parametres`, `/profil` | Paramètres et profil |
| `/configuration` | Utilisateurs et rôles (ADMIN) |
| `/faq` | Aide |

Toutes les pages hors authentification sont derrière `ProtectedRoute`.

## Structure du projet

```
src/
├── components/   ui/ (Button, Input, Table...), layout/, accounting/, forms/
├── context/      AuthContext, ExerciceContext, ThemeContext
├── hooks/        useCountdown (renvoi d'OTP)
├── lib/          bilan, dashboard, depreciation, tva, clotures, notifications,
│                 generateFile/ (PDF, Excel), supabaseClient
├── models/       accès aux tables (BaseModel et modèles métier)
├── pages/        auth/, accounting/, dashboard/, settings/, FAQ
├── routes/       AppRoutes, ProtectedRoute
├── styles/       tokens, globals, components, otp
└── doc/          notes techniques (tables utilisées, SQL, livre d'inventaire)
supabase/
├── migrations/   gardes d'intégrité, RLS exercices, fonctions de soldes
└── scripts/      audit d'intégrité en lecture seule
```

## Documentation complémentaire

- `src/doc/used_table.md` : tables et buckets utilisés par le front.
- `src/doc/new_sql.md` : notes SQL.
- `src/doc/livre_inventaire_structure.md` : structure du livre d'inventaire.
- `nextstep.md` : travaux restants avant une mise en production.

## État du projet

Le cœur métier est fonctionnel et le front est cohérent avec le schéma Supabase. Les points restants (versionnement complet du schéma et des politiques RLS, tests, TVA et rapprochement bancaire) sont détaillés dans `nextstep.md`.

Précision sur les amortissements : le mode dégressif est une approximation (taux = coefficient / durée appliqué sur la valeur nette, dernière année au prorata), sans la bascule vers le linéaire du régime fiscal exact.