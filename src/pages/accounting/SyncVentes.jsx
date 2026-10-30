import React, { useState, useMemo } from "react";
import {
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Settings,
  X,
  FileText,
  Eye,
  Save,
  Database,
  Radio,
  ExternalLink,
} from "lucide-react";
import { useSyncVentes } from "../../hooks/useSyncVentes";

const formatMoney = (val) => Number(val || 0).toLocaleString("fr-FR");

export default function SyncVentes() {
  const {
    ventes,
    logs,
    lastLog,
    loading,
    syncing,
    testingConnection,
    error,
    config,
    updateConfig,
    triggerSync,
    checkConnection,
  } = useSyncVentes();

  // Filtres
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("TOUS");
  const [filterStatut, setFilterStatut] = useState("TOUS");

  // Modales
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedVente, setSelectedVente] = useState(null);
  const [showLogs, setShowLogs] = useState(false);

  // Formulaire de configuration
  const [formConfig, setFormConfig] = useState({
    apiUrl: config.apiUrl || "",
    apiKey: config.apiKey || "",
  });

  const [notification, setNotification] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    updateConfig(formConfig);
    setIsConfigOpen(false);
    setConnectionStatus(null);
    showToast("Paramètres de l'API de synchronisation enregistrés.");
  };

  const handleTestConnection = async () => {
    try {
      const res = await checkConnection();
      setConnectionStatus(res);
      if (res.connected) {
        showToast(res.message, "success");
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      const msg = `Erreur lors du test de connexion : ${err.message}`;
      setConnectionStatus({ connected: false, message: msg });
      showToast(msg, "error");
    }
  };

  const handleLaunchSync = async () => {
    try {
      const res = await triggerSync();
      showToast(
        res.message || `${res.count} vente(s) importée(s) avec succès depuis l'API.`,
        "success"
      );
    } catch (err) {
      showToast(`Échec de la synchronisation : ${err.message}`, "error");
    }
  };

  // Filtrage des données
  const filteredVentes = useMemo(() => {
    return ventes.filter((v) => {
      const matchSearch =
        search === "" ||
        (v.reference_facture || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.client_nom || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.external_id || "").toLowerCase().includes(search.toLowerCase());

      const matchMode =
        filterMode === "TOUS" || (v.mode_reglement || "").toUpperCase() === filterMode;

      const matchStatut =
        filterStatut === "TOUS" || v.statut_comptable === filterStatut;

      return matchSearch && matchMode && matchStatut;
    });
  }, [ventes, search, filterMode, filterStatut]);

  // Totaux calculés
  const totals = useMemo(() => {
    const totalTtc = ventes.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0);
    const totalHt = ventes.reduce((sum, v) => sum + Number(v.montant_ht || 0), 0);
    const totalTva = ventes.reduce((sum, v) => sum + Number(v.montant_tva || 0), 0);
    const countAttente = ventes.filter((v) => v.statut_comptable === "A_COMPTABILISER").length;

    return { totalTtc, totalHt, totalTva, countAttente };
  }, [ventes]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast de notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 transition-all ${
            notification.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {notification.type === "error" ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Synchronisation des Ventes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Passerelle automatisée entre l'application de vente externe et la comptabilité.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormConfig({
                apiUrl: config.apiUrl || "",
                apiKey: config.apiKey || "",
              });
              setIsConfigOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition"
          >
            <Settings size={16} />
            <span>Paramètres API</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition"
          >
            <Clock size={16} />
            <span>Historique ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={handleLaunchSync}
            disabled={syncing || testingConnection}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Synchronisation en cours..." : "Synchroniser maintenant"}</span>
          </button>
        </div>
      </div>

      {/* Bannière d'état de l'API externe (en attente / configurée) */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Database className="text-slate-600 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Statut de la passerelle API
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  connectionStatus?.connected
                    ? "bg-emerald-100 text-emerald-800"
                    : config.apiUrl
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <Radio size={10} className={connectionStatus?.connected ? "text-emerald-600 animate-pulse" : ""} />
                {connectionStatus?.connected
                  ? "Connecté à l'API"
                  : config.apiUrl
                  ? "En attente d'une API valide"
                  : "Non configuré"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {config.apiUrl ? (
                <>
                  URL cible : <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{config.apiUrl}</code>
                </>
              ) : (
                "Aucune URL d'API configurée. Renseignez l'adresse de votre API externe dans les paramètres."
              )}
            </p>
            {connectionStatus && (
              <p
                className={`text-xs mt-1.5 ${
                  connectionStatus.connected ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {connectionStatus.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testingConnection || syncing}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition shadow-xs disabled:opacity-50"
        >
          <Radio size={13} className={testingConnection ? "animate-pulse text-blue-600" : ""} />
          <span>{testingConnection ? "Vérification..." : "Tester la connexion API"}</span>
        </button>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">CA Synchronisé (TTC)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatMoney(totals.totalTtc)} <span className="text-xs font-normal text-gray-500">XAF</span></p>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>HT : {formatMoney(totals.totalHt)}</span>
            <span>TVA : {formatMoney(totals.totalTva)}</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ventes Importées</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900">{ventes.length}</p>
          <p className="text-xs text-gray-500 mt-1">Factures et tickets réels en base</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">À Comptabiliser</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FileText size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-600">{totals.countAttente}</p>
          <p className="text-xs text-gray-500 mt-1">Écritures journal à générer</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Dernier Statut</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {lastLog?.finished_at
              ? new Date(lastLog.finished_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              : "Aucune synchro"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {lastLog
              ? `${lastLog.statut} (${lastLog.total_insere || 0} traitées)`
              : "En attente de premier appel"}
          </p>
        </div>
      </div>

      {/* Historique déroulant si activé */}
      {showLogs && (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Clock size={16} /> Journal des synchronisations
            </h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Fermer
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">Aucun historique enregistré pour le moment.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto text-xs">
              {logs.map((log) => (
                <div key={log.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.statut === "SUCCES"
                          ? "bg-green-100 text-green-700"
                          : log.statut === "ERREUR"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {log.statut}
                    </span>
                    <span className="text-gray-600">
                      {new Date(log.started_at).toLocaleString("fr-FR")}
                    </span>
                    <span className="text-gray-400">({log.source})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-gray-800">
                      {log.total_insere || 0} enregistrements
                    </span>
                    {log.message_erreur && (
                      <p className="text-red-500 text-[11px] truncate max-w-xs">{log.message_erreur}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barre de recherche et filtres */}
      <div className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par facture, client, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
            <Filter size={14} /> Filtres :
          </div>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="TOUS">Tous les règlements</option>
            <option value="ESPECES">Espèces</option>
            <option value="VIREMENT">Virement</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CHEQUE">Chèque</option>
          </select>

          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="A_COMPTABILISER">À comptabiliser</option>
            <option value="COMPTABILISE">Comptabilisé</option>
          </select>
        </div>
      </div>

      {/* Tableau des ventes */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Réf. Facture</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Montant HT</th>
                <th className="px-4 py-3 text-right">TVA</th>
                <th className="px-4 py-3 text-right">Montant TTC</th>
                <th className="px-4 py-3">Règlement</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Chargement des données...
                  </td>
                </tr>
              ) : filteredVentes.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-10 text-center">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-700 font-medium text-sm">Aucune vente enregistrée</p>
                    <p className="text-gray-400 text-xs mt-1 max-w-md mx-auto">
                      Le module est configuré en attente d'une API de vente externe valide. Dès que l'API sera connectée, les ventes y apparaîtront sans simulation.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVentes.map((vente) => (
                  <tr key={vente.id || vente.external_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 block text-xs">
                        {vente.reference_facture}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {vente.external_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(vente.date_vente).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-gray-800">{vente.client_nom}</p>
                      {vente.client_identifiant && (
                        <span className="text-[10px] text-gray-400">{vente.client_identifiant}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-mono text-gray-600">
                      {formatMoney(vente.montant_ht)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-mono text-gray-500">
                      {formatMoney(vente.montant_tva)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                      {formatMoney(vente.montant_ttc)} <span className="text-[10px] text-gray-500 font-normal">XAF</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                        {vente.mode_reglement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          vente.statut_comptable === "COMPTABILISE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {vente.statut_comptable === "COMPTABILISE" ? "Comptabilisé" : "À comptabiliser"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedVente(vente)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Voir les détails de la vente"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale Paramètres API */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Settings size={18} /> Configuration de l'API de Vente
              </h2>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  URL de base de l'API
                </label>
                <input
                  type="text"
                  value={formConfig.apiUrl}
                  onChange={(e) => setFormConfig({ ...formConfig, apiUrl: e.target.value })}
                  placeholder="https://api.votre-entreprise.com/v1"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Endpoint appelé : <code className="font-mono">{formConfig.apiUrl ? `${formConfig.apiUrl.replace(/\/$/, '')}/ventes` : "/api/v1/ventes"}</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Clé d'authentification (API Key / Bearer Token)
                </label>
                <input
                  type="password"
                  value={formConfig.apiKey}
                  onChange={(e) => setFormConfig({ ...formConfig, apiKey: e.target.value })}
                  placeholder="Laisser vide si non requis ou renseigner la clé"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                >
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Détails Vente */}
      {selectedVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Détail de la vente {selectedVente.reference_facture}
                </h2>
                <p className="text-xs text-gray-500 font-mono">
                  ID Externe : {selectedVente.external_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedVente(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block mb-1">Client</span>
                  <span className="font-semibold text-gray-800">{selectedVente.client_nom}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block mb-1">Date de vente</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(selectedVente.date_vente).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block mb-1">Mode de règlement</span>
                  <span className="font-semibold text-gray-800">{selectedVente.mode_reglement}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block mb-1">Montant TTC Total</span>
                  <span className="font-bold text-blue-600 text-sm">
                    {formatMoney(selectedVente.montant_ttc)} XAF
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Données Brutes Reçues (JSON)
                </h4>
                <pre className="p-3 bg-gray-900 text-green-400 rounded-xl text-xs font-mono overflow-x-auto max-h-64">
                  {JSON.stringify(selectedVente.donnees_brutes || selectedVente, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVente(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
