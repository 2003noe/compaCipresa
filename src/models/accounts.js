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

// Table de liaison utilisateur <-> rôle : clé composée (user_id, role_id), donc pas de primaryKey simple.
export class UserRole extends BaseModel {
  static table = "user_roles";
  static primaryKey = null;
  static fields = {
    user_id: { type: "uuid", required: true },
    role_id: { type: "uuid", required: true },
  };
  static assign(user_id, role_id) { return this.create({ user_id, role_id }); }
  static revoke(user_id, role_id) { return this.deleteWhere({ user_id, role_id }); }
}

export class Notification extends BaseModel {
  static table = "notifications";
  static ordering = { column: "created_at", ascending: false };
  static TYPES = ["TVA", "CLOTURE", "RAPPROCHEMENT", "ECRITURE", "SYSTEME", "UTILISATEUR"];
  static fields = {
    id,
    user_id: { type: "uuid", required: true },
    type: { type: "text", choices: Notification.TYPES },
    titre: { type: "text" },
    message: { type: "text" },
    lu: { type: "bool", default: false },
    created_at: { type: "datetime", readOnly: true },
  };
}

// Une seule ligne, id fixe (la même que celle utilisée par l'onglet Paramètres > Entreprise).
export class ParametresEntreprise extends BaseModel {
  static table = "parametres_entreprise";
  static ID = "00000000-0000-0000-0000-000000000001";
  static fields = {
    id,
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
  static current() { return this.get(this.ID); }
}
