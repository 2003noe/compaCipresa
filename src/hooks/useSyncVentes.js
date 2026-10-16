import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  syncSalesPipeline,
  getSyncConfig,
  saveSyncConfig as persistSyncConfig,
} from "../services/syncVentesService";

export function useSyncVentes() {
  const [ventes, setVentes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastLog, setLastLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfigState] = useState(getSyncConfig());

  // Sauvegarde et mise à jour de la configuration
  const updateConfig = (newConfig) => {
    persistSyncConfig(newConfig);
    setConfigState(newConfig);
  };

  // Chargement des ventes et des logs depuis Supabase
  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [ventesRes, logsRes] = await Promise.all([
        supabase
          .from("ventes")
          .select("*")
          .order("date_vente", { ascending: false })
          .limit(150),
        supabase
          .from("sync_logs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(10),
      ]);

      if (ventesRes.error) {
        // Si la table n'existe pas encore ou erreur
        console.warn("[useSyncVentes] Erreur lecture ventes :", ventesRes.error.message);
      } else {
        setVentes(ventesRes.data || []);
      }

      if (logsRes.error) {
        console.warn("[useSyncVentes] Erreur lecture sync_logs :", logsRes.error.message);
      } else {
        setLogs(logsRes.data || []);
        setLastLog(logsRes.data?.[0] || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRemoteSync = () => loadData();
    window.addEventListener("cipresa-sales-synced", handleRemoteSync);
    return () => window.removeEventListener("cipresa-sales-synced", handleRemoteSync);
  }, [loadData]);

  // Déclencheur de synchronisation
  const triggerSync = async (params = {}) => {
    try {
      setSyncing(true);
      setError(null);
      const result = await syncSalesPipeline(params);
      await loadData();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return {
    ventes,
    logs,
    lastLog,
    loading,
    syncing,
    error,
    config,
    updateConfig,
    triggerSync,
    refresh: loadData,
  };
}
