import { useEffect, useRef, useState } from "react";
import {
  Search,
  CalendarDays,
  Sun,
  Moon,
  FileText,
  BookOpen,
  Building2,
  Plus,
  X,
  RefreshCw,
  Menu,
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient";
import { useTheme } from "../../context/ThemeContext";
import { useExercice } from "../../context/ExerciceContext";
import { useAuth } from "../../context/AuthContext";
import { syncSalesPipeline } from "../../services/syncVentesService";

export default function TopBar({ onMenuOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ comptes: [], ecritures: [] });
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const { exercices, selectedExerciceId, setSelectedExerciceId } = useExercice();
  const { companies, selectedEntrepriseId, switchEntreprise, createCompany, hasRole } = useAuth();
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
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

  async function handleCreateCompany(event) {
    event.preventDefault();
    const name = companyName.trim();
    if (name.length < 2) { setCompanyError("Le nom doit contenir au moins 2 caractères."); return; }
    setCreatingCompany(true);
    setCompanyError("");
    const { error } = await createCompany(name);
    setCreatingCompany(false);
    if (error) { setCompanyError(error.message || "La création de l’entreprise a échoué."); return; }
    setCompanyName("");
    setCompanyFormOpen(false);
  }

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let active = true;
    window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2 || !selectedExerciceId) {
      setResults({ comptes: [], ecritures: [] });
      setSearching(false);
      return () => { active = false; };
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      const term = `%${query.trim()}%`;
      const [comptesRes, ecrituresRes] = await Promise.all([
        supabase
          .from("comptes_comptables")
          .select("id,numero,libelle")
          .or(`numero.ilike.${term},libelle.ilike.${term}`)
          .limit(5),
        supabase
          .from("ecritures_comptables")
          .select("id,numero,libelle,reference_piece,date_ecriture")
          .eq("exercice_id", selectedExerciceId)
          .or(
            `numero.ilike.${term},libelle.ilike.${term},reference_piece.ilike.${term}`,
          ) ]);
      if (!active) return;
      setResults({
        comptes: comptesRes.data || [],
        ecritures: ecrituresRes.data || [],
      });
      setSearching(false);
    }, 300);

    return () => { active = false; window.clearTimeout(debounceRef.current); };
  }, [query, selectedExerciceId]);

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const aucunResultat =
    query.trim().length >= 2 &&
    !searching &&
    results.comptes.length === 0 &&
    results.ecritures.length === 0;

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
        <div className="topbar-search" ref={searchRef}>
          <Search size={16} />
          <input
            placeholder="Rechercher un compte, une écriture…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && query.trim().length >= 2 && (
            <div className="search-panel">
              {searching && (
                <p className="page-subtitle" style={{ padding: 14 }}>
                  Recherche…
                </p>
              )}
              {!searching && results.comptes.length > 0 && (
                <div className="search-group">
                  <span className="search-group-title">Comptes</span>
                  {results.comptes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="search-result"
                      onClick={() => {
                        navigate("/plan-comptable");
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <BookOpen size={14} />
                      <span>
                        {c.numero} — {c.libelle}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && results.ecritures.length > 0 && (
                <div className="search-group">
                  <span className="search-group-title">Écritures</span>
                  {results.ecritures.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="search-result"
                      onClick={() => {
                        navigate("/journal");
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <FileText size={14} />
                      <span>
                        {e.numero} — {e.libelle}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {aucunResultat && (
                <p className="page-subtitle" style={{ padding: 14 }}>
                  Aucun résultat pour « {query} ».
                </p>
              )}
            </div>
          )}
        </div>

        <label className="topbar-exercice" title="Exercice comptable (appliqué à toutes les pages)">
          <CalendarDays size={14} />
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
        {companies.length > 0 && <label className="topbar-exercice" title="Entreprise active pour toutes les pages">
          <Building2 size={14} />
          <select value={selectedEntrepriseId} onChange={(e) => switchEntreprise(e.target.value)} aria-label="Entreprise active">
            {companies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}
          </select>
        </label>}
        {hasRole("ADMIN") && <button type="button" className="topbar-company-create" onClick={() => { setCompanyError(""); setCompanyFormOpen(true); }}>
          <Plus size={15} /><span>Nouvelle entreprise</span>
        </button>}
      </div>
      <div className="topbar-right">
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
      {companyFormOpen && <div className="company-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingCompany) setCompanyFormOpen(false); }}>
        <section className="company-dialog" role="dialog" aria-modal="true" aria-labelledby="company-dialog-title">
          <header><div><Building2 size={19} /><h2 id="company-dialog-title">Créer une entreprise</h2></div><button type="button" aria-label="Fermer" onClick={() => setCompanyFormOpen(false)} disabled={creatingCompany}><X size={18} /></button></header>
          <p>Vous deviendrez administrateur de cette entreprise. Ses comptes, exercices et écritures seront séparés des autres entreprises.</p>
          <form onSubmit={handleCreateCompany}>
            <label htmlFor="new-company-name">Nom de l’entreprise</label>
            <input id="new-company-name" autoFocus required minLength={2} maxLength={120} value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Ex. CIPRESA SARL" />
            {companyError && <p className="company-dialog-error" role="alert">{companyError}</p>}
            <footer><button type="button" className="company-dialog-cancel" onClick={() => setCompanyFormOpen(false)} disabled={creatingCompany}>Annuler</button><button type="submit" disabled={creatingCompany || companyName.trim().length < 2}>{creatingCompany ? "Création…" : "Créer et ouvrir"}</button></footer>
          </form>
        </section>
      </div>}
    </header>
  );
}
