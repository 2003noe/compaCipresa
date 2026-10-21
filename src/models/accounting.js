import BaseModel, { ModelError } from "./BaseModel";
import { computeDepreciation } from "../lib/depreciation";

const id = { type: "uuid", readOnly: true };

// Plan comptable (SYSCOHADA) : un compte = un numéro (ex. 411100) classé dans une classe 1 à 7.
export class Compte extends BaseModel {
  static table = "comptes_comptables";
  static ordering = { column: "numero" };
  static NATURES = ["ACTIF", "PASSIF", "CHARGE", "PRODUIT", "TRESORERIE"];
  static fields = {
    id,
    numero: { type: "text", required: true },
    libelle: { type: "text", required: true },
    classe: { type: "text", required: true },          // "Classe 4 - Comptes de tiers"
    nature: { type: "text", required: true, choices: Compte.NATURES, default: "ACTIF" },
    actif: { type: "bool", default: true },
    compte_parent_id: { type: "uuid" },
    devise: { type: "text", default: "XAF" },
    lettrable: { type: "bool", default: false },
    reconciliable: { type: "bool", default: false },
    notes: { type: "text" },
    solde_ouverture_debit: { type: "number", default: 0 },
    solde_ouverture_credit: { type: "number", default: 0 },
  };
  get soldeOuverture() { return Number(this.solde_ouverture_debit || 0) - Number(this.solde_ouverture_credit || 0); }
  static tresorerie() { return this.filter({ nature: "TRESORERIE" }); }
}

// Exercice = période comptable (en général une année).
export class ExerciceComptable extends BaseModel {
  static table = "exercices_comptables";
  static ordering = { column: "annee", ascending: false };
  static fields = {
    id,
    code: { type: "text", required: true },
    annee: { type: "number", required: true },
    date_debut: { type: "date", required: true },
    date_fin: { type: "date", required: true },
    statut: { type: "text", choices: ["OUVERT", "CLOTURE"], default: "OUVERT" },
  };
  static async ouvert() { return (await this.filter({ statut: "OUVERT" }, { limit: 1 }))[0] || null; }
}

// Journal = classeur où l'on range les écritures (ventes, achats, banque...).
export class Journal extends BaseModel {
  static table = "journaux";
  static ordering = { column: "code" };
  static TYPES = ["VENTE", "ACHAT", "BANQUE", "CAISSE", "OD"];
  static fields = {
    id,
    code: { type: "text", required: true },
    libelle: { type: "text", required: true },
    type: { type: "text", choices: Journal.TYPES, default: "OD" },
  };
}

// Une ligne d'écriture : un montant au débit OU au crédit d'un compte.
export class LigneEcriture extends BaseModel {
  static table = "lignes_ecritures";
  static fields = {
    id,
    ecriture_id: { type: "uuid", required: true },
    compte_id: { type: "uuid", required: true },
    libelle: { type: "text" },
    debit: { type: "number", default: 0 },
    credit: { type: "number", default: 0 },
  };
}

// Une écriture = une opération comptable. Règle de la partie double : total débit = total crédit.
export class EcritureComptable extends BaseModel {
  static table = "ecritures_comptables";
  static ordering = { column: "date_ecriture", ascending: false };
  static STATUTS = ["BROUILLON", "VALIDEE"];
  static fields = {
    id,
    numero: { type: "text", required: true },
    date_ecriture: { type: "date", required: true },
    libelle: { type: "text", required: true },
    reference_piece: { type: "text" },
    statut: { type: "text", required: true, choices: EcritureComptable.STATUTS, default: "BROUILLON" },
    exercice_id: { type: "uuid", required: true },
    journal_id: { type: "uuid", required: true },
  };

  static checkBalanced(lignes) {
    const debit = lignes.reduce((a, l) => a + Number(l.debit || 0), 0);
    const credit = lignes.reduce((a, l) => a + Number(l.credit || 0), 0);
    if (lignes.length < 2 || debit !== credit || debit <= 0) {
      throw new ModelError("L'écriture doit avoir au moins 2 lignes et un total débit égal au total crédit.", { table: this.table });
    }
  }

  // Entête + lignes. Ce ne sont PAS des opérations atomiques (2 requêtes) : en cas d'échec
  // on supprime l'entête. Pour une vraie transaction, créer une fonction SQL (RPC) côté Supabase.
  static async createWithLignes(data, lignes) {
    this.checkBalanced(lignes);
    const ecriture = await this.create(data);
    try {
      await LigneEcriture.bulkCreate(lignes.map((l) => ({ ...l, ecriture_id: ecriture.id })));
    } catch (error) {
      await ecriture.delete();
      throw error;
    }
    return ecriture;
  }

  static recentes(limit = 8) {
    return this.all({ select: "*, lignes_ecritures(debit,credit)", limit });
  }
  get totalDebit() { return (this.lignes_ecritures || []).reduce((a, l) => a + Number(l.debit || 0), 0); }
  get totalCredit() { return (this.lignes_ecritures || []).reduce((a, l) => a + Number(l.credit || 0), 0); }
}

// Justificatif (PDF/image) rattaché à une écriture ; le fichier est dans le bucket "pieces-justificatives".
export class PieceComptable extends BaseModel {
  static table = "pieces_comptables";
  static fields = {
    id,
    ecriture_id: { type: "uuid", required: true },
    type: { type: "text" },
    reference: { type: "text" },
    fichier_url: { type: "text" },
  };
}

export class Immobilisation extends BaseModel {
  static table = "immobilisations";
  static ordering = { column: "code" };
  static fields = {
    id,
    code: { type: "text", required: true },
    designation: { type: "text", required: true },
    categorie: { type: "text", required: true },
    compte_id: { type: "uuid" },
    date_acquisition: { type: "date", required: true },
    valeur_brute: { type: "number", required: true },
    duree_annees: { type: "number" },
    methode: { type: "text", choices: ["LINEAIRE", "DEGRESSIF", "AUCUNE"], default: "LINEAIRE" },
    statut: { type: "text", choices: ["EN_SERVICE", "CEDE", "REFORME"], default: "EN_SERVICE" },
    notes: { type: "text" },
  };
  // { amortCumule, vnc } à une date donnée (calcul fait côté navigateur, pas stocké).
  amortissement(asOf = new Date()) { return computeDepreciation(this, asOf); }
}

export class DeclarationTva extends BaseModel {
  static table = "declarations_tva";
  static ordering = { column: "periode_debut", ascending: false };
  static fields = {
    id,
    exercice_id: { type: "uuid", required: true },
    periodicite: { type: "text", required: true, choices: ["MENSUELLE", "TRIMESTRIELLE"] },
    periode_debut: { type: "date", required: true },
    periode_fin: { type: "date", required: true },
    periode_libelle: { type: "text", required: true },
    compte_tva_collectee_id: { type: "uuid" },
    compte_tva_deductible_id: { type: "uuid" },
    base_imposable: { type: "number", default: 0 },
    tva_collectee: { type: "number", default: 0 },
    tva_deductible: { type: "number", default: 0 },
    tva_nette: { type: "number", readOnly: true }, // jamais envoyée par le code : probablement calculée par la base (à vérifier)
    statut: { type: "text", choices: ["BROUILLON", "EN_ATTENTE", "DECLAREE", "PAYEE"], default: "BROUILLON" },
    date_echeance: { type: "date" },
    date_declaration: { type: "date" },
    date_paiement: { type: "date" },
    reference_declaration: { type: "text" },
    notes: { type: "text" },
    created_by: { type: "uuid" },
  };
}

export class RegleEcheanceFiscale extends BaseModel {
  static table = "regles_echeances_fiscales";
  static fields = {
    id,
    code: { type: "text" },
    libelle: { type: "text" },
    description: { type: "text" },
    categorie: { type: "text" },
    actif: { type: "bool", default: true },
    decalage_jours: { type: "number" },
    mois_fixe: { type: "number" },
    jour_fixe: { type: "number" },
  };
}

export class ClotureComptable extends BaseModel {
  static table = "clotures_comptables";
  static ordering = { column: "periode_debut", ascending: false };
  static STATUTS = ["OUVERTE", "CONTROLES_EN_COURS", "PRE_CLOTURE", "CLOTUREE"];
  static fields = {
    id,
    exercice_id: { type: "uuid", required: true },
    periode: { type: "text", required: true },
    periode_debut: { type: "date", required: true },
    periode_fin: { type: "date", required: true },
    responsable: { type: "uuid" },
    statut: { type: "text", choices: ClotureComptable.STATUTS, default: "OUVERTE" },
    balance_validee: { type: "bool", default: false },
    rapprochement_valide: { type: "bool", default: false },
    fiscalite_verifiee: { type: "bool", default: false },
    cloturee_par: { type: "uuid" },
    cloturee_le: { type: "datetime" },
  };
}

// Les 22 contrôles de chaque clôture sont créés par la base (trigger probable), le code ne fait que les lire/modifier.
export class ControleCloture extends BaseModel {
  static table = "controles_cloture";
  static fields = {
    id,
    cloture_id: { type: "uuid", required: true },
    statut: { type: "text", choices: ["A_FAIRE", "FAIT", "NON_APPLICABLE"], default: "A_FAIRE" },
    commentaire: { type: "text" },
    verifie_par: { type: "uuid" },
    // + une clé étrangère vers referentiel_controles_cloture dont le nom m'est inconnu (voir README)
  };
}

export class ReferentielControleCloture extends BaseModel {
  static table = "referentiel_controles_cloture";
  static ordering = { column: "numero" };
  static fields = {
    id,
    numero: { type: "number", readOnly: true },
    controle: { type: "text", readOnly: true },
    frequence: { type: "text", readOnly: true },
    responsable_type: { type: "text", readOnly: true },
    justificatif_attendu: { type: "text", readOnly: true },
  };
}

export class LigneReleveBancaire extends BaseModel {
  static table = "lignes_releve_bancaire";
  static ordering = { column: "date_operation" };
  static fields = {
    id,
    compte_id: { type: "uuid", required: true },
    date_operation: { type: "date", required: true },
    libelle: { type: "text", required: true },
    debit: { type: "number", default: 0 },
    credit: { type: "number", default: 0 },
    rapproche: { type: "bool", default: false },
    ligne_ecriture_id: { type: "uuid" },
    valide: { type: "bool", default: false },
  };
}
