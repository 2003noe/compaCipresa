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
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import "./syncVentes.css";

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
    <div className="page-content sync-ventes-page">
      {/* Toast de notification */}
      {notification && (
        <div className={`sync-toast ${notification.type === "error" ? "error" : "success"}`} role="alert">
          {notification.type === "error" ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* En-tête de page standardisé et responsive */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Synchronisation des Ventes</h1>
          <p className="page-subtitle">
            Passerelle automatisée entre l'application de vente externe et la comptabilité.
          </p>
        </div>

        <div className="page-header-actions">
          <Button
            variant="secondary"
            icon={Settings}
            onClick={() => {
              setFormConfig({
                apiUrl: config.apiUrl || "",
                apiKey: config.apiKey || "",
              });
              setIsConfigOpen(true);
            }}
          >
            Paramètres API
          </Button>

          <Button
            variant="secondary"
            icon={Clock}
            onClick={() => setShowLogs(!showLogs)}
          >
            Historique ({logs.length})
          </Button>

          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={handleLaunchSync}
            disabled={syncing || testingConnection}
          >
            {syncing ? "Synchronisation en cours..." : "Synchroniser maintenant"}
          </Button>
        </div>
      </div>

      {/* Bannière d'état de l'API externe */}
      <div className="sync-gateway-card">
        <div className="sync-gateway-main">
          <div className="sync-gateway-icon">
            <Database size={18} />
          </div>
          <div className="sync-gateway-info">
            <div className="sync-gateway-title-row">
              <span className="sync-gateway-title">Statut de la passerelle API</span>
              <span
                className={`sync-status-badge ${
                  connectionStatus?.connected
                    ? "connected"
                    : config.apiUrl
                    ? "waiting"
                    : "unconfigured"
                }`}
              >
                <Radio
                  size={11}
                  className={connectionStatus?.connected ? "animate-pulse" : ""}
                />
                {connectionStatus?.connected
                  ? "Connecté à l'API"
                  : config.apiUrl
                  ? "En attente d'une API valide"
                  : "Non configuré"}
              </span>
            </div>
            <p className="sync-gateway-desc">
              {config.apiUrl ? (
                <>
                  URL cible : <code>{config.apiUrl}</code>
                </>
              ) : (
                "Aucune URL d'API configurée. Renseignez l'adresse de votre API externe dans les paramètres."
              )}
            </p>
            {connectionStatus && (
              <p
                className={`sync-gateway-msg ${
                  connectionStatus.connected ? "connected" : "disconnected"
                }`}
              >
                {connectionStatus.message}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={Radio}
          onClick={handleTestConnection}
          disabled={testingConnection || syncing}
        >
          {testingConnection ? "Vérification..." : "Tester la connexion API"}
        </Button>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-4 sync-kpis">
        <Card className="sync-kpi-card">
          <div className="sync-kpi-head">
            <span className="sync-kpi-label">CA Synchronisé (TTC)</span>
            <div className="sync-kpi-icon success">
              <DollarSign size={17} />
            </div>
          </div>
          <p className="sync-kpi-value">
            {formatMoney(totals.totalTtc)} <small>XAF</small>
          </p>
          <div className="sync-kpi-footer">
            <span>HT : {formatMoney(totals.totalHt)}</span>
            <span>TVA : {formatMoney(totals.totalTva)}</span>
          </div>
        </Card>

        <Card className="sync-kpi-card">
          <div className="sync-kpi-head">
            <span className="sync-kpi-label">Ventes Importées</span>
            <div className="sync-kpi-icon">
              <TrendingUp size={17} />
            </div>
          </div>
          <p className="sync-kpi-value">{ventes.length}</p>
          <div className="sync-kpi-footer">
            <span>Factures & tickets enregistrés</span>
          </div>
        </Card>

        <Card className="sync-kpi-card">
          <div className="sync-kpi-head">
            <span className="sync-kpi-label">À Comptabiliser</span>
            <div className="sync-kpi-icon warning">
              <FileText size={17} />
            </div>
          </div>
          <p className="sync-kpi-value warning">{totals.countAttente}</p>
          <div className="sync-kpi-footer">
            <span>Écritures journal à générer</span>
          </div>
        </Card>

        <Card className="sync-kpi-card">
          <div className="sync-kpi-head">
            <span className="sync-kpi-label">Dernier Statut</span>
            <div className="sync-kpi-icon">
              <Clock size={17} />
            </div>
          </div>
          <p className="sync-kpi-value" style={{ fontSize: "16px" }}>
            {lastLog?.finished_at
              ? new Date(lastLog.finished_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Aucune synchro"}
          </p>
          <div className="sync-kpi-footer">
            <span>
              {lastLog
                ? `${lastLog.statut} (${lastLog.total_insere || 0} traitées)`
                : "En attente de premier appel"}
            </span>
          </div>
        </Card>
      </div>

      {/* Historique déroulant */}
      {showLogs && (
        <Card className="sync-logs-card">
          <div className="sync-logs-header">
            <h3>
              <Clock size={16} /> Journal des synchronisations
            </h3>
            <button
              type="button"
              onClick={() => setShowLogs(false)}
              className="sync-logs-close"
            >
              Fermer
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0, padding: "8px 0" }}>
              Aucun historique enregistré pour le moment.
            </p>
          ) : (
            <div className="sync-logs-list">
              {logs.map((log) => (
                <div key={log.id} className="sync-log-row">
                  <div className="sync-log-left">
                    <span
                      className={`sync-log-tag ${
                        log.statut === "SUCCES"
                          ? "success"
                          : log.statut === "ERREUR"
                          ? "error"
                          : "running"
                      }`}
                    >
                      {log.statut}
                    </span>
                    <span className="sync-log-date">
                      {new Date(log.started_at).toLocaleString("fr-FR")}
                    </span>
                    <span className="sync-log-source">({log.source})</span>
                  </div>
                  <div className="sync-log-right">
                    <span className="sync-log-count">
                      {log.total_insere || 0} enregistrements
                    </span>
                    {log.message_erreur && (
                      <p className="sync-log-error">{log.message_erreur}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Barre de recherche et filtres */}
      <Card className="sync-toolbar">
        <div className="sync-search-shell">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher par facture, client, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sync-search-input"
          />
        </div>

        <div className="sync-filters-group">
          <span className="sync-filters-label">
            <Filter size={14} /> Filtres :
          </span>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="sync-select"
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
            className="sync-select"
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="A_COMPTABILISER">À comptabiliser</option>
            <option value="COMPTABILISE">Comptabilisé</option>
          </select>
        </div>
      </Card>

      {/* Tableau des ventes */}
      <Card className="sync-table-card">
        <div className="table-wrap">
          <table className="sync-table">
            <thead>
              <tr>
                <th>Réf. Facture</th>
                <th>Date</th>
                <th>Client</th>
                <th style={{ textAlign: "right" }}>Montant HT</th>
                <th style={{ textAlign: "right" }}>TVA</th>
                <th style={{ textAlign: "right" }}>Montant TTC</th>
                <th>Règlement</th>
                <th style={{ textAlign: "center" }}>Statut</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center" style={{ padding: "40px" }}>
                    <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 8px", color: "var(--color-primary)" }} />
                    <p style={{ margin: 0, color: "var(--color-muted)" }}>Chargement des données...</p>
                  </td>
                </tr>
              ) : filteredVentes.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="sync-empty-state">
                      <FileText size={36} />
                      <p>Aucune vente enregistrée</p>
                      <span>
                        Le module est configuré en attente d'une API de vente externe valide. Dès que l'API sera connectée, les ventes y apparaîtront sans simulation.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVentes.map((vente) => (
                  <tr key={vente.id || vente.external_id}>
                    <td>
                      <span className="sync-ref-main">
                        {vente.reference_facture}
                      </span>
                      <span className="sync-ref-id">
                        {vente.external_id}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--color-muted)" }}>
                      {new Date(vente.date_vente).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{vente.client_nom}</p>
                      {vente.client_identifiant && (
                        <span style={{ fontSize: "10px", color: "var(--color-subtle)" }}>
                          {vente.client_identifiant}
                        </span>
                      )}
                    </td>
                    <td className="sync-amount-cell">
                      {formatMoney(vente.montant_ht)}
                    </td>
                    <td className="sync-amount-cell" style={{ color: "var(--color-muted)" }}>
                      {formatMoney(vente.montant_tva)}
                    </td>
                    <td className="sync-amount-cell ttc">
                      {formatMoney(vente.montant_ttc)} <span style={{ fontSize: "10px", fontWeight: "normal", color: "var(--color-muted)" }}>XAF</span>
                    </td>
                    <td>
                      <span className="sync-mode-pill">
                        {vente.mode_reglement}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Badge tone={vente.statut_comptable === "COMPTABILISE" ? "success" : "warning"}>
                        {vente.statut_comptable === "COMPTABILISE" ? "Comptabilisé" : "À comptabiliser"}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedVente(vente)}
                        className="sync-action-btn"
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
      </Card>

      {/* Modale Paramètres API */}
      {isConfigOpen && (
        <div className="sync-modal-backdrop" onClick={() => setIsConfigOpen(false)}>
          <div className="sync-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sync-modal-header">
              <h2>
                <Settings size={18} /> Configuration de l'API de Vente
              </h2>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="sync-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig}>
              <div className="sync-modal-body">
                <div>
                  <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
                    URL de base de l'API
                  </label>
                  <input
                    type="text"
                    value={formConfig.apiUrl}
                    onChange={(e) => setFormConfig({ ...formConfig, apiUrl: e.target.value })}
                    placeholder="https://api.votre-entreprise.com/v1"
                    className="input"
                    style={{ width: "100%" }}
                  />
                  <p style={{ fontSize: "11px", color: "var(--color-subtle)", marginTop: 6 }}>
                    Endpoint appelé : <code>{formConfig.apiUrl ? `${formConfig.apiUrl.replace(/\/$/, '')}/ventes` : "/api/v1/ventes"}</code>
                  </p>
                </div>

                <div>
                  <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
                    Clé d'authentification (API Key / Bearer Token)
                  </label>
                  <input
                    type="password"
                    value={formConfig.apiKey}
                    onChange={(e) => setFormConfig({ ...formConfig, apiKey: e.target.value })}
                    placeholder="Laisser vide si non requis ou renseigner la clé"
                    className="input"
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                </div>
              </div>

              <div className="sync-modal-footer">
                <Button variant="secondary" onClick={() => setIsConfigOpen(false)}>
                  Annuler
                </Button>
                <Button variant="primary" type="submit" icon={Save}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Détails Vente */}
      {selectedVente && (
        <div className="sync-modal-backdrop" onClick={() => setSelectedVente(null)}>
          <div className="sync-modal-dialog large" onClick={(e) => e.stopPropagation()}>
            <div className="sync-modal-header">
              <div>
                <h2>
                  Détail de la vente {selectedVente.reference_facture}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--color-subtle)", fontFamily: "monospace" }}>
                  ID Externe : {selectedVente.external_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVente(null)}
                className="sync-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sync-modal-body">
              <div className="sync-detail-grid">
                <div className="sync-detail-card">
                  <span>Client</span>
                  <strong>{selectedVente.client_nom}</strong>
                </div>
                <div className="sync-detail-card">
                  <span>Date de vente</span>
                  <strong>
                    {new Date(selectedVente.date_vente).toLocaleString("fr-FR")}
                  </strong>
                </div>
                <div className="sync-detail-card">
                  <span>Mode de règlement</span>
                  <strong>{selectedVente.mode_reglement}</strong>
                </div>
                <div className="sync-detail-card">
                  <span>Montant TTC Total</span>
                  <strong className="highlight">
                    {formatMoney(selectedVente.montant_ttc)} XAF
                  </strong>
                </div>
              </div>

              <div>
                <span className="sync-kpi-label" style={{ display: "block", marginBottom: 8 }}>
                  Données Brutes Reçues (JSON)
                </span>
                <pre className="sync-raw-json">
                  {JSON.stringify(selectedVente.donnees_brutes || selectedVente, null, 2)}
                </pre>
              </div>
            </div>

            <div className="sync-modal-footer">
              <Button variant="secondary" onClick={() => setSelectedVente(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
