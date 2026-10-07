import { getClient } from "./client";

export class ModelError extends Error {
  constructor(message, { table, cause, errors } = {}) {
    super(message);
    this.name = "ModelError";
    this.table = table;
    this.cause = cause;
    this.errors = errors || [];
  }
}

const isEmpty = (v) => v === undefined || v === null || v === "";

// Équivalent minimal de django.db.models.Model pour Supabase.
// Une sous-classe déclare : table, primaryKey, fields (et ordering).
// Chaque méthode (all, get, filter, create, save, delete...) = UNE requête HTTP vers Supabase.
export default class BaseModel {
  static table = "";
  static primaryKey = "id"; // null pour une table sans clé simple (ex. user_roles)
  static fields = {};       // { colonne: { type, required, choices, default, readOnly } }
  static ordering = null;   // { column: "numero", ascending: true }

  constructor(data = {}) {
    const defaults = {};
    for (const [name, def] of Object.entries(this.constructor.fields)) {
      if ("default" in def) defaults[name] = typeof def.default === "function" ? def.default() : def.default;
    }
    Object.assign(this, defaults, data);
  }

  // ---------- Lecture (SELECT) ----------
  static query(select = "*") {
    return getClient().from(this.table).select(select);
  }

  static _apply(q, { orderBy, ascending, limit } = {}) {
    const order = orderBy ? { column: orderBy, ascending: ascending ?? true } : this.ordering;
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
    if (limit) q = q.limit(limit);
    return q;
  }

  static _fail(error, action) {
    throw new ModelError(`${this.table} : ${action} impossible (${error.message})`, { table: this.table, cause: error });
  }

  static async all(opts = {}) {
    const { data, error } = await this._apply(this.query(opts.select || "*"), opts);
    if (error) this._fail(error, "lecture");
    return (data || []).map((row) => new this(row));
  }

  // where : { statut: "VALIDEE", compte_id: [a, b] (IN), date_fin: null (IS NULL) }
  static async filter(where = {}, opts = {}) {
    let q = this.query(opts.select || "*");
    for (const [key, value] of Object.entries(where)) {
      if (Array.isArray(value)) q = q.in(key, value);
      else if (value === null) q = q.is(key, null);
      else q = q.eq(key, value);
    }
    const { data, error } = await this._apply(q, opts);
    if (error) this._fail(error, "lecture");
    return (data || []).map((row) => new this(row));
  }

  static async get(id, { select = "*" } = {}) {
    const { data, error } = await this.query(select).eq(this.primaryKey, id).maybeSingle();
    if (error) this._fail(error, "lecture");
    return data ? new this(data) : null;
  }

  // ---------- Écriture (INSERT / UPDATE / DELETE) ----------
  static async create(data) {
    return new this(data).save();
  }

  static async bulkCreate(list) {
    const items = list.map((d) => new this(d).validate());
    const { data, error } = await getClient().from(this.table).insert(items.map((m) => m.toPayload())).select();
    if (error) this._fail(error, "création");
    return (data || []).map((row) => new this(row));
  }

  static async deleteWhere(where) {
    let q = getClient().from(this.table).delete();
    for (const [key, value] of Object.entries(where)) q = q.eq(key, value);
    const { error } = await q;
    if (error) this._fail(error, "suppression");
  }

  validate() {
    const M = this.constructor;
    const errors = [];
    for (const [name, def] of Object.entries(M.fields)) {
      if (def.readOnly) continue;
      const v = this[name];
      if (isEmpty(v)) {
        if (def.required) errors.push(`${name} est obligatoire`);
        continue;
      }
      if (def.type === "number" && Number.isNaN(Number(v))) errors.push(`${name} doit être un nombre`);
      if (def.type === "bool" && typeof v !== "boolean") errors.push(`${name} doit être vrai ou faux`);
      if (def.choices && !def.choices.includes(v)) errors.push(`${name} doit valoir : ${def.choices.join(", ")}`);
    }
    if (errors.length) throw new ModelError(`${M.table} : données invalides (${errors.join(" ; ")})`, { table: M.table, errors });
    return this;
  }

  // Seules les colonnes déclarées et modifiables partent vers la base.
  toPayload() {
    const M = this.constructor;
    const out = {};
    for (const [name, def] of Object.entries(M.fields)) {
      if (def.readOnly || name === M.primaryKey) continue;
      if (this[name] !== undefined) out[name] = this[name];
    }
    return out;
  }

  async save() {
    const M = this.constructor;
    this.validate();
    const id = M.primaryKey ? this[M.primaryKey] : undefined;
    const table = getClient().from(M.table);
    const { data, error } = id
      ? await table.update(this.toPayload()).eq(M.primaryKey, id).select().single()
      : await table.insert(this.toPayload()).select().single();
    if (error) M._fail(error, id ? "mise à jour" : "création");
    Object.assign(this, data);
    return this;
  }

  async delete() {
    const M = this.constructor;
    if (!M.primaryKey || this[M.primaryKey] === undefined) {
      throw new ModelError(`${M.table} : suppression impossible sans clé primaire`, { table: M.table });
    }
    const { error } = await getClient().from(M.table).delete().eq(M.primaryKey, this[M.primaryKey]);
    if (error) M._fail(error, "suppression");
  }
}
