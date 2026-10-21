import { supabase } from "../lib/supabaseClient";

// Clés et URLs par défaut pour la synchronisation
export const DEFAULT_SYNC_CONFIG = {
  apiUrl: import.meta.env.VITE_SALES_API_URL,      //|| "https://api-ventes.cipresa.local/v1",
  apiKey: import.meta.env.VITE_SALES_API_KEY , //|| "cipresa_sync_key_demo_2026_default",
  mockFallback: import.meta.env.VITE_SALES_API_MOCK_FALLBACK !== "false",
};

const STORAGE_KEY = "cipresa_sync_sales_config";

/**
 * Récupère la configuration actuelle (Stockée en localStorage ou valeurs par défaut)
 */
export function getSyncConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("Impossible de lire la configuration de synchro locale:", e);
  }
  return { ...DEFAULT_SYNC_CONFIG };
}

/**
 * Sauvegarde la configuration personnalisée (ex: nouvelle URL ou clé d'API)
 */
export function saveSyncConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Erreur sauvegarde configuration synchro:", e);
  }
}

/**
 * Générateur de données fictives de vente réalistes (conforme à api_ventes_spec.md)
 * Utilisé en attente de la disponibilité de l'API externe réelle.
 */
export function generateMockSales(count = 5) {
  const clients = [
    { nom: "SOCIETE COMMERCIALE DU SUD", code: "C411002", nif: "M051812345678Z" },
    { nom: "ETS FOTSO & FRERES SARL", code: "C411005", nif: "M081900192834A" },
    { nom: "PHARMACIE CENTRALE DE DOUALA", code: "C411010", nif: "M021798347102B" },
    { nom: "AFRICA DISTRIB LOGISTIQUE", code: "C411018", nif: "M112048593847C" },
    { nom: "CABINET AUDIT & CONSEILS", code: "C411025", nif: "M041692837492D" },
    { nom: "Client Comptoir / Vente directe", code: "C411001", nif: null },
  ];

  const modes = ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"];
  const now = new Date();

  const mockSales = [];

  for (let i = 0; i < count; i++) {
    const client = clients[i % clients.length];
    const mode = modes[i % modes.length];
    const seq = Math.floor(1000 + Math.random() * 9000);
    const saleId = `VTE-SIM-${now.getFullYear()}-${seq}`;
    const invoiceNum = `FAC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${seq}`;

    // Montant HT entre 25 000 et 850 000 XAF
    const baseHt = Math.round((25000 + Math.random() * 800000) / 500) * 500;
    const tauxTva = 19.25;
    const tva = Math.round((baseHt * tauxTva) / 100);
    const ttc = baseHt + tva;

    // Date aléatoire sur les 7 derniers jours
    const dateVente = new Date(now.getTime() - Math.floor(Math.random() * 7 * 86400000));

    mockSales.push({
      id: saleId,
      reference_facture: invoiceNum,
      date_vente: dateVente.toISOString(),
      statut: "PAYEE",
      type_operation: "VENTE",
      client: {
        id: `CLI-${seq}`,
        code: client.code,
        nom: client.nom,
        nif: client.nif,
      },
      finances: {
        devise: "XAF",
        montant_ht: baseHt,
        taux_tva: tauxTva,
        montant_tva: tva,
        montant_ttc: ttc,
      },
      reglement: {
        mode_paiement: mode,
        statut_paiement: "TOTALEMENT_PAYE",
        date_reglement: dateVente.toISOString(),
      },
      magasin_ou_caisse: {
        id: "CAISSE-01",
        nom: "Caisse Principale Siège",
      },
      lignes: [
        {
          designation: "Marchandises diverses (Lots conformes)",
          quantite: 1,
          prix_unitaire_ht: baseHt,
          montant_ht: baseHt,
          taux_tva: tauxTva,
          montant_tva: tva,
          montant_ttc: ttc,
          compte_vente_suggere: "701100",
        },
      ],
    });
  }

  return mockSales;
}

/**
 * Mappe un objet vente (issu de l'API externe ou du générateur) vers le format table Supabase
 */
export function mapExternalSaleToLocal(item) {
  const finances = item.finances || {};
  const client = item.client || {};
  const reglement = item.reglement || {};

  const ht = Number(finances.montant_ht ?? item.montant_ht ?? item.total_ht ?? 0);
  const tva = Number(finances.montant_tva ?? item.montant_tva ?? item.total_tva ?? 0);
  const ttc = Number(finances.montant_ttc ?? item.montant_ttc ?? item.total_ttc ?? (ht + tva));

  return {
    external_id: String(item.id || item.sale_id),
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
 * Effectue la requête HTTP vers l'API externe avec repli automatique vers le simulateur si indisponible
 */
export async function fetchExternalSales({ dateDebut, dateFin, forceMock = false } = {}) {
  const config = getSyncConfig();

  if (forceMock) {
    return { isMock: true, items: generateMockSales(6) };
  }

  try {
    const url = new URL(`${config.apiUrl.replace(/\/$/, "")}/ventes`);
    if (dateDebut) url.searchParams.append("date_from", dateDebut);
    if (dateFin) url.searchParams.append("date_to", dateFin);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-API-KEY": config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Réponse API HTTP ${response.status} : ${response.statusText}`);
    }

    const json = await response.json();
    const items = Array.isArray(json) ? json : (json.data || []);
    return { isMock: false, items };
  } catch (err) {
    // Si le mode mockFallback est activé (attente de l'API réelle), on simule
    if (config.mockFallback) {
      console.warn(
        `[SyncVentes] L'API (${config.apiUrl}) n'est pas encore accessible (${err.message}). Utilisation des données de simulation.`
      );
      return { isMock: true, items: generateMockSales(6) };
    }
    throw err;
  }
}

/**
 * Pipeline complet d'exécution de la synchronisation :
 * 1. Log en base (sync_logs)
 * 2. Appel API / simulation
 * 3. Normalisation
 * 4. Upsert dans la table `ventes`
 * 5. Clôture du log de synchro
 */
export async function syncSalesPipeline({ dateDebut, dateFin, forceMock = false } = {}) {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré. Vérifiez vos variables d'environnement.");
  }

  // A. Création du log de début
  const { data: logEntry, error: logErr } = await supabase
    .from("sync_logs")
    .insert([
      {
        statut: "EN_COURS",
        source: forceMock ? "VENTES_API_SIMULATION" : "VENTES_API",
        started_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (logErr) {
    console.error("Impossible de créer le log de synchronisation :", logErr);
    // On continue même si la table sync_logs n'est pas encore migrée
  }

  const logId = logEntry?.id;

  try {
    // B. Récupération des données
    const { isMock, items } = await fetchExternalSales({ dateDebut, dateFin, forceMock });

    if (!items || items.length === 0) {
      if (logId) {
        await supabase
          .from("sync_logs")
          .update({
            statut: "SUCCES",
            total_recupere: 0,
            finished_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      return { success: true, count: 0, isMock, message: "Aucune vente à synchroniser." };
    }

    // C. Transformation des données
    const localRecords = items.map(mapExternalSaleToLocal);

    // D. Upsert dans la table `ventes` (évite les doublons via external_id)
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

    // E. Clôture avec succès du log
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
      isMock,
      logId,
      message: `${insertedCount} vente(s) synchronisée(s) avec succès.`,
    };
  } catch (error) {
    // F. Enregistrement de l'erreur dans le log
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
