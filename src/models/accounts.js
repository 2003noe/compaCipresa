import BaseModel from "./BaseModel";

const id = { type: "uuid", readOnly: true };

// Un profil est créé à l'inscription (probablement par un trigger) ; son id = l'id de l'utilisateur Supabase Auth.
export class Profile extends BaseModel {
  static table = "profiles";
  static ordering = { column: "created_at" };
  static fields = {
    id,
    nom: { type: "text" },
    prenom: { type: "text" },
    telephone: { type: "text" },
    adresse: { type: "text" },
    ville: { type: "text" },
    photo_url: { type: "text" },
    actif: { type: "bool", default: true },
    active_entreprise_id: { type: "uuid", readOnly: true },
    created_at: { type: "datetime", readOnly: true },
  };
  get nomComplet() { return [this.prenom, this.nom].filter(Boolean).join(" ") || "Utilisateur"; }
}

export class Role extends BaseModel {
  static table = "roles";
  static ordering = { column: "nom" };
  static fields = {
    id,
    code: { type: "text", readOnly: true }, // ADMIN, GERANT, COMPTABLE, CONSULTANT, MAGASINIER, AGENT_COMMERCIAL
    nom: { type: "text", readOnly: true },
    description: { type: "text", readOnly: true },
  };
}

// Liaison d'un utilisateur, d'un rôle et d'une entreprise (clé composée).
export class UserRole extends BaseModel {
  static table = "entreprise_utilisateurs";
  static primaryKey = null;
  static fields = {
    entreprise_id: { type: "uuid", required: true },
    user_id: { type: "uuid", required: true },
    role_id: { type: "uuid", required: true },
  };
  static assign(entreprise_id, user_id, role_id) { return this.create({ entreprise_id, user_id, role_id }); }
  static revoke(entreprise_id, user_id, role_id) { return this.deleteWhere({ entreprise_id, user_id, role_id }); }
}

export class Notification extends BaseModel {
  static table = "notifications";
  static ordering = { column: "created_at", ascending: false };
  static TYPES = ["TVA", "CLOTURE", "RAPPROCHEMENT", "ECRITURE", "SYSTEME", "UTILISATEUR"];
  static fields = {
    id,
    entreprise_id: { type: "uuid", readOnly: true },
    user_id: { type: "uuid", required: true },
    type: { type: "text", choices: Notification.TYPES },
    titre: { type: "text" },
    message: { type: "text" },
    lu: { type: "bool", default: false },
    created_at: { type: "datetime", readOnly: true },
  };
}

// Une ligne de paramètres par entreprise; RLS limite la requête à l'entreprise active.
export class ParametresEntreprise extends BaseModel {
  static table = "parametres_entreprise";
  static fields = {
    id,
    entreprise_id: { type: "uuid", readOnly: true },
    raison_sociale: { type: "text" },
    forme_juridique: { type: "text" },
    numero_rccm: { type: "text" },
    numero_cc: { type: "text" },
    regime_fiscal: { type: "text" },
    secteur_activite: { type: "text" },
    adresse_postale: { type: "text" },
    telephone: { type: "text" },
    email_contact: { type: "text" },
    plan_comptable_referentiel: { type: "text" },
    devise: { type: "text" },
    tva_defaut_taux: { type: "number" },
  };
  static async current(entreprise_id) {
    const { data, error } = await this.query().eq("entreprise_id", entreprise_id).maybeSingle();
    if (error) this._fail(error, "lecture");
    return data ? new this(data) : null;
  }
}
