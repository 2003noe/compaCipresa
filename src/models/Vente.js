import BaseModel from "./BaseModel";

const id = { type: "uuid", readOnly: true };

export class Vente extends BaseModel {
  static table = "ventes";
  static ordering = { column: "date_vente", ascending: false };
  static STATUTS_COMPTABLES = ["A_COMPTABILISER", "COMPTABILISE", "IGNORE"];

  static fields = {
    id,
    external_id: { type: "text", required: true },
    reference_facture: { type: "text" },
    client_nom: { type: "text" },
    client_identifiant: { type: "text" },
    date_vente: { type: "text", required: true },
    montant_ht: { type: "number", default: 0 },
    montant_tva: { type: "number", default: 0 },
    montant_ttc: { type: "number", default: 0 },
    mode_reglement: { type: "text", default: "ESPECES" },
    statut_comptable: {
      type: "text",
      choices: Vente.STATUTS_COMPTABLES,
      default: "A_COMPTABILISER",
    },
    donnees_brutes: { type: "object" },
    created_at: { type: "text", readOnly: true },
    updated_at: { type: "text", readOnly: true },
  };

  static async getRecentes(limit = 100) {
    return this.all({ limit, orderBy: "date_vente", ascending: false });
  }

  static async getEnAttente() {
    return this.filter({ statut_comptable: "A_COMPTABILISER" });
  }
}

export class SyncLog extends BaseModel {
  static table = "sync_logs";
  static ordering = { column: "started_at", ascending: false };
  static STATUTS = ["EN_COURS", "SUCCES", "ERREUR", "PARTIEL"];

  static fields = {
    id,
    source: { type: "text", default: "VENTES_API" },
    statut: { type: "text", choices: SyncLog.STATUTS, default: "EN_COURS" },
    total_recupere: { type: "number", default: 0 },
    total_insere: { type: "number", default: 0 },
    total_mis_a_jour: { type: "number", default: 0 },
    message_erreur: { type: "text" },
    started_at: { type: "text" },
    finished_at: { type: "text" },
  };

  static async getDernier() {
    const logs = await this.all({ limit: 1, orderBy: "started_at", ascending: false });
    return logs[0] || null;
  }
}
