import { useState } from "react";
import {
  CalendarDays,
  Sun,
  Moon,
  RefreshCw,
  Menu,
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { useTheme } from "../../context/ThemeContext";
import { useExercice } from "../../context/ExerciceContext";
import { useAuth } from "../../context/AuthContext";
import { syncSalesPipeline } from "../../services/syncVentesService";

export default function TopBar({ onMenuOpen }) {
  const { theme, toggleTheme } = useTheme();
  const { exercices, selectedExerciceId, setSelectedExerciceId } = useExercice();
  const { can } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'success' | 'error' | null

  async function handleSyncSales() {
    if (syncing) return;
    try {
      setSyncing(true);
      setSyncStatus(null);
      const res = await syncSalesPipeline();
      window.dispatchEvent(new CustomEvent("cipresa-sales-synced", { detail: res }));
      setSyncStatus("success");
      setTimeout(() => setSyncStatus(null), 3500);
    } catch (err) {
      console.warn("[TopBar] Synchro en attente ou erreur :", err.message);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Bouton hamburger — visible uniquement sur mobile */}
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onMenuOpen}
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <label className="topbar-exercice" title="Exercice comptable (appliqué à toutes les pages)">
          <CalendarDays size={13} />
          <select
            value={selectedExerciceId}
            onChange={(e) => setSelectedExerciceId(e.target.value)}
            aria-label="Exercice comptable"
          >
            {exercices.length === 0 && <option value="">Aucun exercice</option>}
            {exercices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code || `Exercice ${e.annee}`} ({e.annee})
                {e.statut === "OUVERT" ? " · ouvert" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="topbar-right">
        {(can('SALES_SYNC') || can('COMPTA_SYNC')) && (
          <button
            className="icon-button"
            type="button"
            onClick={handleSyncSales}
            disabled={syncing}
            aria-label="Synchroniser les ventes"
            title={
              syncing
                ? "Synchronisation avec l'API en cours..."
                : syncStatus === "success"
                ? "Synchronisation réussie !"
                : syncStatus === "error"
                ? "API externe en attente ou injoignable (cliquez pour réessayer)"
                : "Synchroniser les ventes depuis l'API"
            }
          >
            <RefreshCw
              size={16}
              className={`${syncing ? "animate-spin text-blue-600" : ""} ${
                syncStatus === "success"
                  ? "text-emerald-500"
                  : syncStatus === "error"
                  ? "text-amber-500"
                  : ""
              }`}
            />
          </button>
        )}
        <button
          className="icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label="Changer de thème"
          title={theme === "dark" ? "Passer en clair" : "Passer en sombre"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <NotificationsPanel />
      </div>
    </header>
  );
}
