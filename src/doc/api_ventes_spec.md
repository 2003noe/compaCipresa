# Spécification Technique de l'API Ventes (Application Source)

Ce document définit le **contrat d'interface (API Spec)** et la **structure exacte des données** que l'application de vente (caisse, ERP, CRM ou e-commerce) doit exposer pour permettre la synchronisation avec notre système comptable **Cipresa Accounting**.

---

## 1. Principes et Conventions Générales

| Règle | Spécification |
| :--- | :--- |
| **Format des échanges** | `JSON` (`application/json; charset=utf-8`) |
| **Authentification** | Header HTTP : `Authorization: Bearer <API_TOKEN>` ou `X-API-KEY: <KEY>` |
| **Format des dates** | Norme **ISO 8601** UTC : `YYYY-MM-DDTHH:mm:ssZ` (ex: `2026-10-16T14:30:00Z`) |
| **Montants financiers** | Nombres décimaux flottants ou entiers, **sans symbole de devise** ni espace (ex: `150000` ou `150000.50`, jamais `"150 000 XAF"`) |
| **Devise par défaut** | `XAF` (Franc CFA BEAC / CEMAC) |
| **Identifiants uniques** | Chaque vente doit posséder un identifiant immuable (`id` ou `uuid`) |

---

## 2. Endpoints requis sur l'API Source

### 2.1. Récupération des ventes (`GET /api/v1/ventes`)

Permet à notre module d'extraire les ventes par plage de dates ou de manière paginée.

#### Paramètres de requête (Query Params) :
- `date_from` *(optionnel)* : Date de début ISO 8601 (`2026-10-01T00:00:00Z`)
- `date_to` *(optionnel)* : Date de fin ISO 8601 (`2026-10-16T23:59:59Z`)
- `statut` *(optionnel)* : Filtrer par statut (`VALIDEE`, `PAYEE`, `ANNULEE`)
- `page` *(défaut: 1)* : Numéro de la page
- `limit` *(défaut: 100, max: 250)* : Nombre d'éléments par page
- `updated_since` *(recommandé pour synchro incrémentale)* : Récupère uniquement les ventes créées ou modifiées depuis cette date.

---

## 3. Structure Complète du Payload JSON

### Structure globale d'une réponse paginée :

```json
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 100,
    "total_records": 1250,
    "total_pages": 13,
    "has_next_page": true
  },
  "data": [
    {
      "id": "VTE-2026-00458",
      "reference_facture": "FAC-2026-10-0089",
      "date_vente": "2026-10-16T10:15:30Z",
      "statut": "PAYEE",
      "type_operation": "VENTE",

      "client": {
        "id": "CLI-0092",
        "code": "C411002",
        "nom": "SOCIETE COMMERCIALE DU SUD",
        "telephone": "+237699001122",
        "email": "contact@socomsud.cm",
        "nif": "M051812345678Z",
        "adresse": "Boulevard de la Liberté, Douala"
      },

      "magasin_ou_caisse": {
        "id": "CAISSE-01",
        "nom": "Caisse Principale Siège",
        "code_agence": "DLA-01",
        "vendeur": {
          "id": "USER-14",
          "nom": "Jean Eboué"
        }
      },

      "finances": {
        "devise": "XAF",
        "total_brut_ht": 100000.00,
        "remise_globale": 5000.00,
        "montant_ht": 95000.00,
        "taux_tva": 19.25,
        "montant_tva": 18287.50,
        "autres_taxes": 0.00,
        "montant_ttc": 113287.50
      },

      "reglement": {
        "mode_paiement": "VIREMENT",
        "statut_paiement": "TOTALEMENT_PAYE",
        "date_reglement": "2026-10-16T10:15:30Z",
        "reference_transaction": "VIR-BGFI-884920",
        "comptes_imputation_suggeree": "521100"
      },

      "lignes": [
        {
          "ligne_id": 1,
          "code_article": "ART-INF-001",
          "designation": "Serveur NAS Synology 4 baies",
          "famille_article": "MATERIEL_INFORMATIQUE",
          "quantite": 1,
          "prix_unitaire_ht": 75000.00,
          "remise_ligne": 0.00,
          "montant_ht": 75000.00,
          "taux_tva": 19.25,
          "montant_tva": 14437.50,
          "montant_ttc": 89437.50,
          "compte_vente_suggere": "701100"
        },
        {
          "ligne_id": 2,
          "code_article": "ART-SRV-002",
          "designation": "Installation & Configuration réseau",
          "famille_article": "PRESTATION_SERVICE",
          "quantite": 1,
          "prix_unitaire_ht": 25000.00,
          "remise_ligne": 5000.00,
          "montant_ht": 20000.00,
          "taux_tva": 19.25,
          "montant_tva": 3850.00,
          "montant_ttc": 23850.00,
          "compte_vente_suggere": "706100"
        }
      ]
    }
  ]
}
```

---

## 4. Dictionnaire des Données (Détail des Champs)

### 4.1. Entête de la vente (`vente`)

| Champ | Type | Obligatoire | Description / Contraintes |
| :--- | :--- | :---: | :--- |
| `id` | `String` / `UUID` | **Oui** | Clé primaire unique dans l'application source. Ne doit jamais changer. |
| `reference_facture` | `String` | **Oui** | Numéro séquentiel lisible (ex: `FAC-2026-0012`). |
| `date_vente` | `String (ISO 8601)` | **Oui** | Date et heure de l'acte de vente (`YYYY-MM-DDTHH:mm:ssZ`). |
| `statut` | `String` | **Oui** | Valeurs admises : `VALIDEE`, `PAYEE`, `ANNULEE`, `AVOIR`. |
| `type_operation` | `String` | Non | `VENTE` (normal) ou `RETOUR` / `AVOIR` (solde négatif). |

---

### 4.2. Informations Client (`client`)

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| `id` | `String` | Non | Identifiant interne du client dans l'autre système. |
| `code` | `String` | Non | Code tiers éventuel (ex: `C411001`). |
| `nom` | `String` | **Oui** | Raison sociale ou nom du client (ex: `"Client Comptoir"` si anonyme). |
| `telephone` | `String` | Non | Téléphone au format international (ex: `+237...`). |
| `email` | `String` | Non | Adresse e-mail du client. |
| `nif` | `String` | Non | Numéro d'Identifiant Fiscal (NIF / Contribuable) pour la déclaration fiscale. |

---

### 4.3. Bloc Financier (`finances`)

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| `devise` | `String` | **Oui** | Code ISO 4217 (`XAF`, `EUR`, `USD`). |
| `montant_ht` | `Number` | **Oui** | Montant net Hors Taxes (après remises). |
| `taux_tva` | `Number` | **Oui** | Taux applicable en pourcentage (ex: `19.25` ou `0` pour exonéré). |
| `montant_tva` | `Number` | **Oui** | Total de la TVA facturée. |
| `montant_ttc` | `Number` | **Oui** | Total Toutes Taxes Comprises (`montant_ht + montant_tva`). |
| `remise_globale` | `Number` | Non | Montant total de la remise accordée sur la facture. |

---

### 4.4. Modalités de Paiement (`reglement`)

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| `mode_paiement` | `String` | **Oui** | `ESPECES`, `VIREMENT`, `CHEQUE`, `MOBILE_MONEY`, `CARTE_BANCAIRE`, `A_CREDIT`. |
| `statut_paiement` | `String` | **Oui** | `TOTALEMENT_PAYE`, `PARTIEL`, `IMPAYE`. |
| `date_reglement` | `String` | Non | Date de perception effective des fonds. |
| `reference_transaction`| `String` | Non | N° de chèque, transaction Momo/OM, ou reçu de virement. |
| `comptes_imputation_suggeree` | `String` | Non | Ex: `571100` (Caisse), `521100` (Banque), `411100` (Client). |

---

### 4.5. Détail des Articles / Lignes (`lignes`)

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| `code_article` | `String` | Non | Référence SKU ou code-barres du produit. |
| `designation` | `String` | **Oui** | Description claire du produit ou service vendu. |
| `quantite` | `Number` | **Oui** | Nombre d'unités vendues (> 0 pour vente, < 0 pour retour). |
| `prix_unitaire_ht` | `Number` | **Oui** | Prix unitaire HT avant remise. |
| `montant_ht` | `Number` | **Oui** | Quantité × Prix unitaire - remise ligne. |
| `taux_tva` | `Number` | **Oui** | Taux de TVA applicable sur cette ligne spécifique. |
| `montant_tva` | `Number` | **Oui** | Montant de la taxe sur la ligne. |
| `montant_ttc` | `Number` | **Oui** | Montant total TTC de la ligne. |
| `compte_vente_suggere`| `String` | Non | Compte de produit OHADA (ex: `701...` Marchandises, `706...` Services). |

---

## 5. Format Minimal Accepté (Mode Simplifié)

Si l'application externe dispose d'un modèle plus simple (ex: caisse sans détail des articles ou des clients nominatifs), l'API peut retourner ce format condensé :

```json
{
  "id": "TICKET-9921",
  "reference_facture": "TICK-9921",
  "date_vente": "2026-10-16T12:00:00Z",
  "client_nom": "Client Comptoir",
  "montant_ht": 50000,
  "montant_tva": 9625,
  "montant_ttc": 59625,
  "mode_reglement": "ESPECES",
  "statut": "PAYEE"
}
```

---

## 6. Format des Webhooks (Temps Réel)

Si l'application de vente est capable d'émettre des événements en temps réel par webhook, voici le format recommandé envoyé en `POST` à notre endpoint :

```json
{
  "event": "sale.created",
  "timestamp": "2026-10-16T10:15:35Z",
  "data": {
    "id": "VTE-2026-00458",
    "reference_facture": "FAC-2026-10-0089",
    "date_vente": "2026-10-16T10:15:30Z",
    "montant_ht": 95000.00,
    "montant_tva": 18287.50,
    "montant_ttc": 113287.50,
    "mode_reglement": "VIREMENT",
    "client_nom": "SOCIETE COMMERCIALE DU SUD"
  }
}
```

---

## 7. Gestion des Erreurs et Codes HTTP

L'API de l'autre application doit respecter les codes HTTP standard :

- `200 OK` : Données retournées avec succès.
- `401 Unauthorized` : Jeton d'API absent, invalide ou expiré.
- `403 Forbidden` : Droits insuffisants pour accéder aux données de vente.
- `422 Unprocessable Entity` : Paramètres de filtres ou dates invalides.
- `429 Too Many Requests` : Trop de requêtes (rate limit atteint).
- `500 Internal Server Error` : Erreur interne du serveur de l'application source.

### Format type d'une erreur JSON :
```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE_FORMAT",
    "message": "Le paramètre date_from doit être au format ISO 8601 (ex: 2026-10-01T00:00:00Z)"
  }
}
```
