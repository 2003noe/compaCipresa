import { supabase } from "../lib/supabaseClient";

// Configuration de synchronisation
export const DEFAULT_SYNC_CONFIG = {
  apiUrl: import.meta.env.VITE_SALES_API_URL || "",
  apiKey: import.meta.env.VITE_SALES_API_KEY || "",
};

const STORAGE_KEY = "cipresa_sync_sales_config";

/**
 * Récupère la configuration actuelle (Stockée en localStorage ou variables d'environnement)
 */
export function getSyncConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiUrl: parsed.apiUrl ?? DEFAULT_SYNC_CONFIG.apiUrl,
        apiKey: parsed.apiKey ?? DEFAULT_SYNC_CONFIG.apiKey,
      };
    }
  } catch (e) {
    console.warn("Impossible de lire la configuration de synchro locale:", e);
  }
  return { ...DEFAULT_SYNC_CONFIG };
}

/**
 * Sauvegarde la configuration personnalisée (URL ou clé d'API)
 */
export function saveSyncConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Erreur sauvegarde configuration synchro:", e);
  }
}

/**
 * Teste la connectivité avec l'API externe configurée sans insérer de données
 */
export async function testApiConnection() {
  const config = getSyncConfig();
  const rawUrl = (config.apiUrl || "").trim();

  if (!rawUrl) {
    return {
      connected: false,
      configured: false,
      message: "Aucune URL d'API configurée. Le module est en attente d'une API externe valide.",
    };
  }

  try {
    const baseUrl = rawUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/ventes`);
    url.searchParams.append("limit", "1");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      headers["X-API-KEY"] = config.apiKey;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        connected: true,
        configured: true,
        status: response.status,
        message: "Connexion établie avec succès avec l'API externe.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        connected: false,
        configured: true,
        status: response.status,
        message: `L'API est joignable mais a refusé les identifiants (${response.status} Non autorisé). Vérifiez la clé API.`,
      };
    }

    return {
      connected: false,
      configured: true,
      status: response.status,
      message: `L'API a répondu avec le statut HTTP ${response.status} (${response.statusText}).`,
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return {
      connected: false,
      configured: true,
      message: isTimeout
        ? "Délai de connexion dépassé (l'adresse de l'API ne répond pas)."
        : `Impossible de contacter le serveur distant : ${err.message}`,
    };
  }
}

/**
 * Mappe un objet vente issu de l'API externe vers le format de la table Supabase
 */
export function mapExternalSaleToLocal(item) {
  const finances = item.finances || {};
  const client = item.client || {};
  const reglement = item.reglement || {};

  const ht = Number(finances.montant_ht ?? item.montant_ht ?? item.total_ht ?? 0);
  const tva = Number(finances.montant_tva ?? item.montant_tva ?? item.total_tva ?? 0);
  const ttc = Number(finances.montant_ttc ?? item.montant_ttc ?? item.total_ttc ?? (ht + tva));

  return {
    external_id: String(item.id || item.sale_id || item.reference_facture),
    reference_facture: item.reference_facture || item.invoice_number || `FAC-${item.id}`,
    client_nom: client.nom || item.client_nom || "Client Divers",
    client_identifiant: client.code || client.id || item.client_identifiant || null,
    date_vente: new Date(item.date_vente || item.created_at || Date.now()).toISOString(),
    montant_ht: ht,
    montant_tva: tva,
    montant_ttc: ttc,
    mode_reglement: reglement.mode_paiement || item.mode_reglement || "ESPECES",
    statut_comptable: "A_COMPTABILISER",
    donnees_brutes: item,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Récupère les ventes réelles depuis l'API distante (aucun faux enregistrement)
 */
export async function fetchExternalSales({ dateDebut, dateFin } = {}) {
  const config = getSyncConfig();
  const rawUrl = (config.apiUrl || "").trim();

  if (!rawUrl) {
    throw new Error(
      "L'URL de l'API de vente n'est pas encore configurée. Veuillez renseigner une API valide dans les paramètres."
    );
  }

  const baseUrl = rawUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/ventes`);
  if (dateDebut) url.searchParams.append("date_from", dateDebut);
  if (dateFin) url.searchParams.append("date_to", dateFin);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
    headers["X-API-KEY"] = config.apiKey;
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Réponse API HTTP ${response.status} : ${response.statusText}`);
    }

    const json = await response.json();
    const items = Array.isArray(json) ? json : (json.data || []);
    return items;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Délai d'attente de l'API de vente dépassé (timeout 10s).");
    }
    throw new Error(`Échec de communication avec l'API : ${err.message}`);
  }
}

/**
 * Pipeline de synchronisation réel :
 * 1. Vérification configuration
 * 2. Log de démarrage dans sync_logs
 * 3. Appel de l'API externe (sans simulation)
 * 4. Upsert des ventes authentiques en base Supabase
 * 5. Clôture du log
 */
export async function syncSalesPipeline({ dateDebut, dateFin } = {}) {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré. Vérifiez vos variables d'environnement.");
  }

  const config = getSyncConfig();
  if (!config.apiUrl) {
    throw new Error(
      "Aucune API externe configurée. Veuillez renseigner l'URL et la clé d'API dans les paramètres."
    );
  }

  // A. Création du log de début
  const { data: logEntry, error: logErr } = await supabase
    .from("sync_logs")
    .insert([
      {
        statut: "EN_COURS",
        source: "VENTES_API",
        started_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (logErr) {
    console.warn("Table sync_logs non disponible ou erreur d'insertion:", logErr.message);
  }

  const logId = logEntry?.id;

  try {
    // B. Appel réel de l'API externe (sans simulation)
    const items = await fetchExternalSales({ dateDebut, dateFin });

    if (!items || items.length === 0) {
      if (logId) {
        await supabase
          .from("sync_logs")
          .update({
            statut: "SUCCES",
            total_recupere: 0,
            total_insere: 0,
            finished_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      return {
        success: true,
        count: 0,
        message: "L'API externe a répondu avec succès : aucune nouvelle vente à importer.",
      };
    }

    // C. Transformation et normalisation
    const localRecords = items.map(mapExternalSaleToLocal);

    // D. Upsert dans la table `ventes`
    const { data: upsertedData, error: upsertErr } = await supabase
      .from("ventes")
      .upsert(localRecords, {
        onConflict: "external_id",
      })
      .select();

    if (upsertErr) {
      throw new Error(`Erreur lors de l'enregistrement en base : ${upsertErr.message}`);
    }

    const insertedCount = upsertedData?.length || localRecords.length;

    // E. Clôture avec succès
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          statut: "SUCCES",
          total_recupere: items.length,
          total_insere: insertedCount,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return {
      success: true,
      count: insertedCount,
      logId,
      message: `${insertedCount} vente(s) synchronisée(s) depuis l'API.`,
    };
  } catch (error) {
    // F. Log d'erreur
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          statut: "ERREUR",
          message_erreur: error.message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    throw error;
  }
}
