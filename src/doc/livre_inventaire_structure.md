# Spécification et Structure de Données : Module "Livre d'inventaire"

## 1. Contexte et Cadre Légal (SYSCOHADA / AUDCIF)

Conformément aux articles 17, 19 et 20 de l'**Acte Uniforme relatif au Droit Comptable et à l'Information Financière (AUDCIF)** de l'OHADA :
- **Article 17 & 19** : Toute entité doit procéder à l'inventaire physique et valorisé de ses éléments d'actif et de passif au moins une fois par exercice, à la clôture de celui-ci.
- **Article 20** : Les données d'inventaire sont regroupées sur le **Livre d'inventaire**. Sont transcrits sur ce livre :
  1. Le bilan et le compte de résultat de l'exercice.
  2. L'état récapitulatif détaillé des éléments composant le patrimoine de l'entreprise (valeur brute, amortissements/dépréciations, valeur nette).

---

## 2. Tables de la Base de Données (Supabase / PostgreSQL)

Le module s'appuie sur les tables du cœur comptable et du registre patrimonial :

### A. Tables existantes exploitées

```sql
-- 1. Paramètres de l'entreprise (identité légale & devise de tenue de compte)
TABLE parametres_entreprise (
    id UUID PRIMARY KEY,
    raison_sociale VARCHAR(255) NOT NULL,
    forme_juridique VARCHAR(100),
    numero_rccm VARCHAR(100),
    numero_cc VARCHAR(100),
    regime_fiscal VARCHAR(100),
    devise VARCHAR(10) DEFAULT 'FCFA',
    plan_comptable_referentiel VARCHAR(50) DEFAULT 'SYSCOHADA'
);

-- 2. Exercices comptables (périodes d'arrêté d'inventaire)
TABLE exercices_comptables (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,     -- ex: 'EX-2025'
    annee INTEGER NOT NULL,                -- ex: 2025
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    statut VARCHAR(30) NOT NULL            -- 'OUVERT', 'CLOTURE'
);

-- 3. Plan comptable (éléments de bilan / patrimoine Classes 1 à 5)
TABLE comptes_comptables (
    id UUID PRIMARY KEY,
    numero VARCHAR(20) NOT NULL UNIQUE,   -- ex: '215000', '411100'
    libelle VARCHAR(255) NOT NULL,
    classe VARCHAR(50) NOT NULL,          -- 'Classe 1', 'Classe 2', etc.
    nature VARCHAR(50) NOT NULL,          -- 'ACTIF', 'PASSIF', 'CHARGE', 'PRODUIT', 'TRESORERIE'
    solde_ouverture_debit NUMERIC(18, 2) DEFAULT 0,
    solde_ouverture_credit NUMERIC(18, 2) DEFAULT 0,
    devise VARCHAR(10) DEFAULT 'FCFA'
);

-- 4. Écritures et lignes comptables (mouvements de l'exercice)
TABLE ecritures_comptables (
    id UUID PRIMARY KEY,
    exercice_id UUID REFERENCES exercices_comptables(id),
    numero VARCHAR(50) NOT NULL,
    date_ecriture DATE NOT NULL,
    libelle TEXT NOT NULL,
    statut VARCHAR(30) NOT NULL           -- 'VALIDEE', 'BROUILLON'
);

TABLE lignes_ecritures (
    id UUID PRIMARY KEY,
    ecriture_id UUID REFERENCES ecritures_comptables(id) ON DELETE CASCADE,
    compte_id UUID REFERENCES comptes_comptables(id),
    debit NUMERIC(18, 2) DEFAULT 0,
    credit NUMERIC(18, 2) DEFAULT 0
);

-- 5. Registre des immobilisations (inventaire physique des biens amortissables)
TABLE immobilisations (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,     -- ex: 'IMM-001'
    designation VARCHAR(255) NOT NULL,
    categorie VARCHAR(100),
    date_acquisition DATE NOT NULL,
    valeur_brute NUMERIC(18, 2) NOT NULL,
    duree_annees NUMERIC(5, 2) NOT NULL,
    methode VARCHAR(30) DEFAULT 'LINEAIRE', -- 'LINEAIRE', 'DEGRESSIF', 'AUCUNE'
    statut VARCHAR(30) DEFAULT 'EN_SERVICE' -- 'EN_SERVICE', 'CEDE', 'REFORME'
);
```

### B. Tables complémentaires préconisées pour le comptage physique approfondi

Pour étendre le module vers un inventaire physique complet avec pointage article par article (stocks, mobilier, matériel) :

```sql
-- Sessions d'inventaire physique (campagnes d'inventaire annuel)
TABLE sessions_inventaire (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercice_id UUID NOT NULL REFERENCES exercices_comptables(id),
    reference VARCHAR(50) NOT NULL UNIQUE,       -- ex: 'INV-2025-CLOTURE'
    date_inventaire DATE NOT NULL,
    responsable_id UUID REFERENCES profiles(id),
    statut VARCHAR(30) DEFAULT 'EN_COURS',       -- 'EN_COURS', 'VALIDE', 'VERROUILLE'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lignes de comptage physique & réconciliation comptable
TABLE lignes_inventaire_physique (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions_inventaire(id) ON DELETE CASCADE,
    compte_id UUID REFERENCES comptes_comptables(id),
    code_article VARCHAR(100),
    designation VARCHAR(255) NOT NULL,
    emplacement VARCHAR(100),                    -- Dépôt, Siège, Magasin...
    quantite_theorique NUMERIC(14, 3) DEFAULT 0,
    quantite_reelle NUMERIC(14, 3) DEFAULT 0,
    valeur_unitaire NUMERIC(18, 2) DEFAULT 0,
    ecart_quantite NUMERIC(14, 3) GENERATED ALWAYS AS (quantite_reelle - quantite_theorique) STORED,
    ecart_valeur NUMERIC(18, 2) GENERATED ALWAYS AS ((quantite_reelle - quantite_theorique) * valeur_unitaire) STORED,
    statut_conforme BOOLEAN DEFAULT true,
    observations TEXT
);
```

---

## 3. Modèle de Données Frontend (TypeScript / JSON)

Voici la structure exacte des objets manipulés par le composant `LivreInventaire.jsx` :

### A. Entités principales

```typescript
/** Paramètres de l'entreprise */
interface EntrepriseInfo {
  id: string;
  raison_sociale: string;
  forme_juridique: string;
  numero_rccm?: string;
  numero_cc?: string;
  devise: string; // Ex: 'FCFA', 'EUR', 'USD'
}

/** Exercice comptable */
interface ExerciceComptable {
  id: string;
  code: string;            // 'EX-2025'
  annee: number;           // 2025
  date_debut: string;      // 'YYYY-MM-DD'
  date_fin: string;        // 'YYYY-MM-DD'
  statut: 'OUVERT' | 'CLOTURE';
}

/** Élément du Livre d'inventaire calculé */
interface CompteInventaireItem {
  id: string;
  numero: string;          // Ex: '241100'
  libelle: string;         // Ex: 'Matériel industriel'
  classe: string;          // 'Classe 2'
  nature: 'ACTIF' | 'PASSIF' | 'CHARGE' | 'PRODUIT' | 'TRESORERIE';
  category: 
    | 'ACTIF_IMMO'         // Classe 2
    | 'STOCKS'             // Classe 3
    | 'CREANCES'           // Classe 4 Débiteur
    | 'TRESORERIE'         // Classe 5 Débiteur
    | 'CAPITAUX_PROPRES'   // Classe 1
    | 'DETTES_COURT_TERME' // Classe 4/5 Créditeur
    | 'AUTRE';
  sectionName: string;     // Libellé de regroupement affiché
  isAmortOuDeprec: boolean;// Vrai pour comptes 28x, 29x, 39x, 49x, 59x
  
  // Valeurs calculées à la date d'arrêté
  balanceBrute: number;       // Valeur brute d'acquisition ou montant brut
  amortDeprec: number;        // Amortissements et dépréciations cumulés
  balanceNette: number;       // Valeur nette comptable (N)
  balancePrecedente: number | null; // Valeur nette N-1 (si disponible)
  variation: number | null;   // Écart N - (N-1)
}

/** Immobilisation physique répertoriée */
interface ImmobilisationPhysiqueItem {
  id: string;
  code: string;            // Ex: 'IMM-004'
  designation: string;     // Ex: 'Serveur HP ProLiant'
  categorie: string;       // Ex: 'Informatique'
  date_acquisition: string;
  valeur_brute: number;
  duree_annees: number;
  methode: 'LINEAIRE' | 'DEGRESSIF' | 'AUCUNE';
  statut: 'EN_SERVICE' | 'CEDE' | 'REFORME';
  
  // Valeurs dynamiques calculées à la date d'arrêté
  amortCumule: number;     // Amortissement cumulé calculé
  vnc: number;             // Valeur Nette Comptable = Valeur brute - Amort.
}
```

### B. Synthèse patrimoniale (KPIs & Totaux)

```typescript
interface SynthesePatrimoniale {
  actifBrut: number;        // Somme des éléments d'actif bruts
  actifAmort: number;       // Cumul des amortissements et dépréciations d'actif
  actifNet: number;         // Actif Brut - Actif Amort (patrimoine réel possédé)
  
  capitauxPropres: number;   // Classe 1 (Capital, réserves, report à nouveau + résultat net)
  dettesTotal: number;       // Dettes financières + dettes d'exploitation & court terme
  passifTotal: number;       // Capitaux propres + Dettes
  
  situationNette: number;    // Actif Net - Dettes externes (= Capitaux propres)
  resultatNetExercice: number; // Produits (Cl. 7) - Charges (Cl. 6) de l'exercice
  ecartEquilibre: number;    // |Actif Net - Passif Total| (doit être égal à 0 en balance exacte)
  estEquilibre: boolean;     // ecartEquilibre === 0
}
```

---

## 4. Règles Métier et Algorithmes de Calcul (SYSCOHADA)

### 1. Solde du compte à date d'arrêté
Pour chaque compte $c$ :
$$\text{Solde d'ouverture} = \text{solde\_ouverture\_debit} - \text{solde\_ouverture\_credit}$$
$$\text{Mouvements Débit} = \sum \text{debit} \quad (\text{écritures validées avec } \text{date\_ecriture} \le \text{date\_arrete})$$
$$\text{Mouvements Crédit} = \sum \text{credit} \quad (\text{écritures validées avec } \text{date\_ecriture} \le \text{date\_arrete})$$
$$\text{Solde Net} = \text{Solde d'ouverture} + \text{Mouvements Débit} - \text{Mouvements Crédit}$$

### 2. Distinction Brute / Dépréciations
- Comptes ordinaires de l'actif (Classes 2, 3, 4 débiteur, 5 débiteur) :
  $$\text{Valeur Brute} = |\text{Solde Net}|$$
- Comptes de dépréciations et d'amortissements (28x, 29x, 39x, 49x, 59x) :
  $$\text{Amort. / Dépréc.} = |\text{Solde Net}|$$
- La valeur nette d'inventaire de l'actif est :
  $$\text{Actif Net} = \text{Actif Brut} - \text{Amortissements et Dépréciations}$$

### 3. Résultat net de l'exercice
Calculé pour l'exercice sélectionné :
$$\text{Produits} = \sum_{c \in \text{Classe 7}} (\text{Crédit} - \text{Débit})$$
$$\text{Charges} = \sum_{c \in \text{Classe 6}} (\text{Débit} - \text{Crédit})$$
$$\text{Résultat Net} = \text{Produits} - \text{Charges}$$
Ce résultat est réintégré aux capitaux propres (Poste 13 du SYSCOHADA) pour établir l'équilibre patrimonial de clôture.

---

## 5. Structure d'Exportation XLSX / Rapport d'Inventaire

Chaque ligne exportée dans la feuille Excel ou le document imprimé comporte :
| Champ | Type | Description |
|---|---|---|
| `N° Compte` | Texte | Numéro de compte normalisé SYSCOHADA (ex: `215000`) |
| `Libellé du compte` | Texte | Intitulé officiel |
| `Section OHADA` | Texte | Regroupement patrimonial (ex: `Actif Immobilisé (Classe 2)`) |
| `Valeur Brute` | Numérique | Montant brut à la date d'inventaire |
| `Amort. / Dépréc.` | Numérique | Pertes de valeur cumulées |
| `Valeur Nette N` | Numérique | Valeur bilantaire nette à l'arrêté |
| `Valeur N-1` | Numérique | Valeur nette à la clôture de l'exercice précédent |
| `Variation` | Numérique | Écart N vs N-1 |

---

## 6. Visas et Attestation Légale Obligatoire

En pied de document, l'état d'inventaire doit obligatoirement être visé par trois signataires avec horodatage :
1. **Le Responsable de l'Inventaire** (comptage et recensement physique).
2. **Le Chef Comptable / Expert-Comptable** (valorisation et conformité aux règles SYSCOHADA).
3. **La Direction Générale** (approbation et arrêté des comptes).
