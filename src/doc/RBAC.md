# Modèle de Contrôle d'Accès Basé sur les Rôles (RBAC) - CIPRESA

Ce document définit la matrice **RBAC (Role-Based Access Control)** de l'application de gestion comptable et financière **CIPRESA**. Il formalise la répartition des responsabilités, les droits d'accès par écran et les permissions applicatives afin de garantir la **séparation des tâches (Segregation of Duties - SoD)**, la sécurité des données et une efficacité opérationnelle maximale.

---

## 1. Principes Directeurs

1. **Principe du Moindre Privilège** : Chaque utilisateur ne dispose que des accès strictement nécessaires à l'exercice de sa mission.
2. **Séparation des Tâches (SoD)** : La personne qui initie une opération physique ou commerciale (Magasinier, Commercial) n'est pas celle qui enregistre les écritures comptables (Comptable), ni celle qui valide définitivement les comptes (Gérant).
3. **Intégrité et Immuabilité Comptable** : Les états légaux (SYSCOHADA) et les écritures validées ne peuvent être altérés arbitrairement.
4. **Cloisonnement Multi-Entreprise** : Les rôles et droits sont attribués par entreprise (via `entreprise_utilisateurs`). Un utilisateur peut avoir un rôle différent selon l'entité sélectionnée.

---

## 2. Synthèse des Rôles

| Rôle | Code Système | Profil cible | Mission principale |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `ADMIN` | RSI, Responsable IT, Superviseur Groupe | Gestion technique, sécurité, utilisateurs, multi-entreprises et configuration système. |
| **Gérant** | `GERANT` | Chef d'entreprise, Directeur Général | Pilotage financier, validation des clôtures, décisions stratégiques et supervision globale. |
| **Comptable** | `COMPTABLE` | Responsable Comptable, Comptable unique | Tenue des écritures, réconciliations, immobilisations, déclarations et préparation des clôtures. |
| **Consultant** | `CONSULTANT` | Expert-Comptable externe, Auditeur, Commissaire aux comptes | Audit, révision, analyse financière et export des états légaux en lecture seule. |
| **Magasinier** | `MAGASINIER` | Gestionnaire de stock, Chef magasin | Inventaire physique des stocks et matières, suivi physique du matériel et immobilisations. |
| **Agent Commercial** | `AGENT_COMMERCIAL` | Commercial, Caissier, ADV | Suivi des ventes, facturation client et suivi de l'intégration des flux de vente. |

---

## 3. Matrice Générale des Droits d'Accès par Page

### Légende des droits :
- **C** : Création (*Create*)
- **R** : Lecture / Consultation (*Read*)
- **U** : Modification (*Update*)
- **D** : Suppression (*Delete*)
- **V** : Validation / Verrouillage / Approbation (*Validate*)
- **X** : Export (PDF / Excel)
- **—** : Aucun accès (Menu masqué et route protégée)

| Page / Module | Route(s) | Administrateur | Gérant | Comptable | Consultant | Magasinier | Agent Commercial |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tableau de bord** | `/dashboard` | R | R | R | R | — | R *(Vue restreinte)* |
| **Plan comptable** | `/plan-comptable`, `/nouveau-compte` | R / U / D | R / U *(Sensible)* | C / R / U *(Courant)* | R | — | — |
| **Journal des écritures** | `/journal`, `/nouvelle-ecriture` | R | R / V | C / R / U / V | R / X | — | — |
| **Grand livre** | `/grand-livre` | R | R / X | R / U *(Lettrage)* / X | R / X | — | — |
| **Balance générale** | `/balance` | R | R / X | R / X | R / X | — | — |
| **Bilan** | `/bilan` | R | R / X | R / X | R / X | — | — |
| **Compte de résultat** | `/compte-resultat` | R | R / X | R / X | R / X | — | — |
| **Trésorerie & Rapprochement** | `/tresorerie`, `/nouvelle-tresorerie` | R | R / X | C / R / U / X | R / X | — | — |
| **Livre d'inventaire** | `/livre-inventaire` | R | R / X | R / U / X | R / X | C / R / U *(Physique)* | — |
| **Immobilisations** | `/immobilisations`, `/nouvelle-immobilisation` | R | R / X | C / R / U / X | R / X | R *(Parc physique)* | — |
| **Synchro Ventes** | `/sync-ventes` | R / U *(Config)* | R | R / V *(Intégration)* | R | — | C / R *(Ventes)* |
| **Clôtures comptables** | `/clotures`, `/clotures/:id`, `/nouvelle-cloture` | R | C / R / V | C / R / U *(Prépa)* | R | — | — |
| **Paramètres Entreprise & Exercices** | `/parametres` (Entreprise, Exercices, Journaux) | C / R / U / D | R / U *(Exercices)* | R | R | — | — |
| **Gestion Utilisateurs & Rôles** | `/configuration`, `/parametres/utilisateurs` | C / R / U / D | R | — | — | — | — |
| **Vue Multi-Entreprises** | `/administration/entreprises` | R / V | — | — | — | — | — |
| **FAQ & Aide** | `/faq` | R | R | R | R | R | R |
| **Profil personnel** | `/profil` | R / U | R / U | R / U | R / U | R / U | R / U |

---

## 4. Définition Détaillée par Rôle

### 4.1. Administrateur (`ADMIN`)
*Garant de la plateforme, de la gouvernance des identités et de la sécurité technique.*

- **Ce qu'il doit pouvoir faire :**
  - Gérer l'annuaire d'entreprise : inviter des utilisateurs, assigner et révoquer les rôles (`/configuration`).
  - Activer ou suspendre les comptes utilisateurs.
  - Configurer les paramètres globaux de l'entreprise (raison sociale, identifiants légaux, devise, régimes fiscaux).
  - Créer et configurer les journaux comptables et les clés d'API / connecteurs d'intégration (`/parametres`).
  - Superviser les logs d'activité et la vue analytique multi-entreprises (`/administration/entreprises`).
- **Ce qu'il ne doit pas faire (Contrôle interne) :**
  - Ne doit pas saisir ni modifier d'écritures comptables quotidiennes pour prévenir les risques de conflits d'intérêts et de falsification technique.

---

### 4.2. Gérant (`GERANT`)
*Pilote de l'entreprise, décisionnaire stratégique et garant légal des comptes.*

- **Ce qu'il doit pouvoir faire :**
  - Consulter l'ensemble des indicateurs de performance, KPIs de rentabilité et alertes financières sur le Dashboard.
  - Visualiser et exporter les états financiers de synthèse : Bilan, Compte de Résultat, Soldes Intermédiaires de Gestion (SIG), Balance et Trésorerie.
  - Détenir le pouvoir d'approbation finale sur les clôtures comptables mensuelles et annuelles (`/clotures`).
  - Valider l'ouverture et le verrouillage définitif des exercices fiscaux.
  - Modifier les champs hautement sensibles du plan comptable (création de comptes de classe 1 à 5 sous permission `COMPTA_ACCOUNT_ADMIN`).
- **Ce qu'il ne doit pas faire :**
  - Ne passe pas de temps sur la saisie manuelle des écritures ou le pointage technique des comptes.

---

### 4.3. Comptable (`COMPTABLE`)
*Opérateur central de la chaîne comptable, garant de la conformité OHADA au quotidien.*

- **Ce qu'il doit pouvoir faire :**
  - Saisir, importer, corriger et **valider directement** les écritures comptables dans tous les journaux auxiliaires (Achats, Ventes, Caisse, Banque, Opérations Diverses).
  - Réaliser le lettrage des comptes tiers (clients/fournisseurs) et le rapprochement bancaire (`/tresorerie`).
  - Intégrer les ventes synchronisées vers les écritures comptables définitives (`/sync-ventes`).
  - Gérer le registre des immobilisations et calculer les tableaux d'amortissement (`/immobilisations`).
  - Personnaliser les libellés et options courantes des comptes (`COMPTA_ACCOUNT_EDIT`).
  - Préparer les dossiers de clôture et exécuter la liste des contrôles pré-clôture (lettrage, cadrage TVA, inventaire).
  - Générer et exporter tous les documents comptables (Grand Livre, Balance, Journaux).
- **Ce qu'il ne doit pas faire :**
  - Ne peut pas modifier les utilisateurs, ni altérer la configuration système ou supprimer un exercice validé.

---

### 4.4. Consultant (`CONSULTANT`) / Auditeur
*Réviseur externe, auditeur contractuel ou commissaire aux comptes.*

- **Ce qu'il doit pouvoir faire :**
  - Accéder en **lecture intégrale (Read-Only)** à tous les livres et documents financiers de l'entreprise :
    - Grand Livre général et auxiliaire
    - Journaux comptables et pièces justificatives
    - Balance générale à plusieurs colonnes
    - Bilan et Compte de Résultat
    - Livre d'inventaire et tableau des immobilisations
    - États de clôture et contrôles associés
  - Exporter l'intégralité des rapports aux formats PDF et Excel pour ses feuilles de travail d'audit.
- **Ce qu'il ne doit pas faire :**
  - **Aucun droit d'écriture, de modification ou de suppression**. L'impossibilité de modifier les données garantit la conformité et l'indépendance de sa mission légale d'audit.

---

### 4.5. Magasinier (`MAGASINIER`)
*Gestionnaire des flux physiques, des stocks de marchandises, intrants et actifs matériels.*

- **Ce qu'il doit pouvoir faire :**
  - Accéder à la page **Livre d'inventaire (`/livre-inventaire`)** :
    - Saisir les quantités physiques réelles constatées lors des inventaires tournants ou de fin de période.
    - Renseigner les comptages de stocks (produits finis, intrants, récoltes, matières).
    - Pointer les écarts entre stock théorique et stock réel en rayon/entrepôt.
  - Consulter la liste des **Immobilisations (`/immobilisations`)** pour localiser et inventorier le matériel physique (engins, outillage, équipements).
- **Ce qu'il ne doit pas faire :**
  - Aucun accès aux états financiers confidentiels (Bilan, Compte de résultat, Trésorerie bancaire, Soldes bancaires).
  - Aucun accès au Journal d'écritures ou au Plan comptable financier.

---

### 4.6. Agent Commercial (`AGENT_COMMERCIAL`)
*Acteur terrain des ventes, de la facturation et du contact client.*

- **Ce qu'il doit pouvoir faire :**
  - Consulter le module **Synchro Ventes (`/sync-ventes`)** :
    - Consulter les transactions de vente réalisées, les factures clients émises, les montants HT/TTC et modes de règlement.
    - Suivre les statuts de traitement des ventes (`A_COMPTABILISER`, `COMPTABILISE`).
  - Consulter un tableau de bord allégé présentant les performances commerciales (chiffre d'affaires brut réalisé, volume des ventes journalières).
- **Ce qu'il ne doit pas faire :**
  - Aucun accès à la comptabilité générale (Journal, Balance, Grand Livre, Clôtures).
  - Aucun accès aux charges de l'entreprise, marges nettes globales ou données de trésorerie bancaire.

---

## 5. Correspondance Technique des Permissions (Supabase RLS)

Les règles de sécurité en base de données s'appuient sur la fonction `has_active_entreprise_permission(code)` et le catalogue de rôles :

| Code Permission | Description | Rôles Attribués par Défaut |
| :--- | :--- | :--- |
| `CONFIG_USERS` | Gestion des utilisateurs, invitations et affectation des rôles | `ADMIN` |
| `CONFIG_COMPANY` | Paramétrage de la société, devises, exercices, journaux | `ADMIN` |
| `COMPTA_READ` | Lecture des journaux, balances, bilans et écritures | `ADMIN`, `GERANT`, `COMPTABLE`, `CONSULTANT` |
| `COMPTA_CREATE` | Saisie d'écritures comptables et pièces justificatives | `COMPTABLE` |
| `COMPTA_VALIDATE` | Validation ferme et verrouillage des écritures | `COMPTABLE`, `GERANT` |
| `COMPTA_CLOTURE` | Exécution des contrôles de clôture et verrouillage de période | `GERANT`, `COMPTABLE` *(Validation finale réservée au Gérant)* |
| `COMPTA_ACCOUNT_EDIT` | Modification des libellés et options courantes des comptes | `COMPTABLE`, `GERANT` |
| `COMPTA_ACCOUNT_ADMIN` | Modification des classes, numéros et soldes d'ouverture | `GERANT`, `ADMIN` |
| `STOCK_INVENTORY` | Saisie des comptages physiques et inventaire de stock | `MAGASINIER`, `COMPTABLE` |
| `SALES_READ` | Visualisation des ventes synchronisées et factures | `AGENT_COMMERCIAL`, `COMPTABLE`, `GERANT` |

---

## 6. Flux Opérationnel Collaboratif Optimal

Pour illustrer l'optimisation des flux au sein de CIPRESA, voici le cycle de traitement d'une opération :

```
[Agent Commercial / Caisse]
   └── Émet les ventes / factures clients 
         │
         ▼
[Synchro Ventes]
   └── Les ventes arrivent avec statut "A_COMPTABILISER"
         │
         ▼
[Magasinier]
   └── Met à jour les quantités physiques dans le Livre d'inventaire
         │
         ▼
[Comptable]
   ├── Intègre les ventes en écritures comptables
   ├── Rapproche les règlements bancaires (Trésorerie)
   ├── Enregistre les amortissements et écritures de régularisation
   └── Prépare le dossier de clôture
         │
         ▼
[Gérant]
   ├── Analyse les états financiers (Bilan, Compte de Résultat, SIG)
   └── Valide et verrouille la Clôture de l'exercice
         │
         ▼
[Consultant / Auditeur]
   └── Révise les comptes, contrôle les balances et exporte les rapports certifiés
```

Ce modèle garantit l'absence totale de blocage opérationnel, préserve la confidentialité des données financières et respecte scrupuleusement les exigences de contrôle interne.

