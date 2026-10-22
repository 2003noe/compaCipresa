import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree,
  LayoutGrid,
  List,
  Search,
  Plus,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Loader2,
  Calendar,
  Layers,
  SlidersHorizontal,
  X,
  Database,
  RefreshCw,
} from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { exportToExcel, downloadPDF, GenericTablePDF } from '../../lib/generateFile';
import { useExercice } from '../../context/ExerciceContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SubAccountModal from '../../components/accounting/SubAccountModal';

/* ─── Noms officiels des thèmes par classe OHADA (SYSCOHADA) ──────── */
const THEME_NAMES = {
  1: 'CLASSE 1 : RESSOURCES DURABLES',
  2: 'CLASSE 2 : ACTIF IMMOBILISÉ',
  3: 'CLASSE 3 : STOCKS ET EN-COURS',
  4: 'CLASSE 4 : COMPTES DE TIERS',
  5: 'CLASSE 5 : TRÉSORERIE',
  6: "CLASSE 6 : CHARGES D'EXPLOITATION",
  7: "CLASSE 7 : PRODUITS D'EXPLOITATION",
};

/* ─── Colonnes pour la vue Liste complète ─────────────────────────── */
const LIST_COLUMNS = [
  { key: 'code', label: 'Compte' },
  { key: 'label', label: 'Libellé' },
  { key: 'class', label: 'Classe' },
  { key: 'nature', label: 'Nature / Catégorie' },
  { key: 'balance', label: 'Solde', align: 'right' },
  { key: 'status', label: 'Statut' },
];

/* ─── Formatage du solde ──────────────────────────────────────────── */
const formatBalance = (row) => {
  const value =
    Number(row.soldeDebit || row.solde_ouverture_debit || 0) -
    Number(row.soldeCredit || row.solde_ouverture_credit || 0);
  return `${value.toLocaleString('fr-FR')} ${row.devise || 'XAF'}`.trim();
};

export default function ChartOfAccounts() {
  const navigate = useNavigate();
  const { selectedExerciceId, selectedExercice, loading: exercicesLoading } = useExercice();

  // Mode d'affichage : 'sectorial' (par thèmes, style document) ou 'list' (liste tabulaire)
  const [viewMode, setViewMode] = useState('sectorial');

  // Données chargées 100% dynamiquement depuis Supabase
  const [dbDefaultComptes, setDbDefaultComptes] = useState([]);
  const [dbExerciseComptes, setDbExerciseComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filtres pour la vue Liste
  const [listFilters, setListFilters] = useState({ class: '', nature: '', status: '' });
  const [showListFilters, setShowListFilters] = useState(false);

  // État du modal de sous-comptes
  const [selectedAccountForModal, setSelectedAccountForModal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /* ─── Chargement dynamique depuis la base de données ────────────── */
  const fetchDatabaseAccounts = useCallback(async (isSilent = false) => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    if (exercicesLoading) return;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setNotice('');

    try {
      // 1. Récupérer le plan de comptes référentiel (default_compt) depuis la BD
      const { data: defaultData, error: defaultError } = await supabase
        .from('default_compt')
        .select('id, num_compte, libelle, classe, categorie')
        .order('num_compte');

      if (defaultError) {
        throw new Error(`Erreur default_compt : ${defaultError.message}`);
      }

      setDbDefaultComptes(defaultData || []);

      // 2. Récupérer les comptes et sous-comptes de l'exercice sélectionné (comptes_comptables)
      if (selectedExerciceId) {
        const { data: exerciceData, error: exerciceError } = await supabase
          .from('comptes_comptables')
          .select('id, numero, libelle, classe, nature, actif, devise, solde_ouverture_debit, solde_ouverture_credit, compte_parent_id')
          .eq('exercice_id', selectedExerciceId)
          .order('numero');

        if (exerciceError) {
          throw new Error(`Erreur comptes_comptables : ${exerciceError.message}`);
        }
        setDbExerciseComptes(exerciceData || []);
      } else {
        setDbExerciseComptes([]);
      }
    } catch (err) {
      setNotice(`Erreur de connexion à la base de données : ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExerciceId, exercicesLoading]);

  useEffect(() => {
    fetchDatabaseAccounts();
  }, [fetchDatabaseAccounts]);

  /* ─── Callback après création réussie d'un sous-compte ──────────── */
  const handleSubAccountCreated = async (createdAccount) => {
    // Rafraîchir les données en temps réel depuis la base de données
    await fetchDatabaseAccounts(true);

    // Mettre à jour l'état local du compte sélectionné pour le modal
    if (selectedAccountForModal) {
      setSelectedAccountForModal((current) => {
        if (!current) return null;
        const updatedSubs = [...(current.subAccounts || []), createdAccount];
        return {
          ...current,
          subAccounts: updatedSubs,
          subAccountsCount: updatedSubs.length,
        };
      });
    }
  };

  /* ─── Construction dynamique des thèmes à partir de la BD ───────── */
  const dynamicThemes = useMemo(() => {
    if (!dbDefaultComptes.length && !dbExerciseComptes.length) return [];

    // Combiner les sources de la base de données
    // Les comptes de référence viennent de default_compt
    const accountsPool = dbDefaultComptes.map((d) => ({
      id: d.id,
      code: d.num_compte,
      label: d.libelle,
      classe: Number(d.classe) || 1,
      categorie: d.categorie,
      isDefault: true,
    }));

    // Ajouter les comptes de comptes_comptables s'ils n'existent pas dans default_compt
    dbExerciseComptes.forEach((c) => {
      const exists = accountsPool.some((a) => a.code === c.numero);
      if (!exists && (!c.compte_parent_id || c.numero.length <= 4)) {
        // Extraire la classe numérique depuis 'Classe X' ou le premier chiffre
        let clNum = parseInt(c.numero?.[0], 10);
        if (c.classe && typeof c.classe === 'string') {
          const match = c.classe.match(/\d+/);
          if (match) clNum = parseInt(match[0], 10);
        }
        accountsPool.push({
          id: c.id,
          code: c.numero,
          label: c.libelle,
          classe: clNum || 1,
          categorie: c.nature || 'Général',
          isDefault: false,
        });
      }
    });

    // Définir la structure des 6 sections thématiques comme dans le document
    // Section 1: Classe 1
    // Section 2: Classe 3
    // Section 3: Classes 4 & 5 (Tiers & Trésorerie combinés comme dans le document)
    // Section 4: Classe 2
    // Section 5: Classe 6
    // Section 6: Classe 7
    const themeSections = [
      {
        id: 'theme-1',
        title: THEME_NAMES[1] || 'CLASSE 1 : RESSOURCES DURABLES',
        classeFilter: [1],
        column: 'left',
      },
      {
        id: 'theme-3',
        title: THEME_NAMES[3] || 'CLASSE 3 : STOCKS ET EN-COURS',
        classeFilter: [3],
        column: 'left',
      },
      {
        id: 'theme-4-5',
        title: 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE',
        classeFilter: [4, 5],
        column: 'left',
      },
      {
        id: 'theme-2',
        title: THEME_NAMES[2] || 'CLASSE 2 : ACTIF IMMOBILISÉ',
        classeFilter: [2],
        column: 'right',
      },
      {
        id: 'theme-6',
        title: THEME_NAMES[6] || "CLASSE 6 : CHARGES D'EXPLOITATION",
        classeFilter: [6],
        column: 'right',
      },
      {
        id: 'theme-7',
        title: THEME_NAMES[7] || "CLASSE 7 : PRODUITS D'EXPLOITATION",
        classeFilter: [7],
        column: 'right',
      },
    ];

    // Vérifier s'il y a d'autres classes en BD (ex: Classe 8, 9) et les ajouter dynamiquement
    const allClassesInDb = [...new Set(accountsPool.map((a) => a.classe))];
    allClassesInDb.forEach((cl) => {
      const alreadyHandled = themeSections.some((ts) => ts.classeFilter.includes(cl));
      if (!alreadyHandled) {
        themeSections.push({
          id: `theme-custom-${cl}`,
          title: THEME_NAMES[cl] || `CLASSE ${cl}`,
          classeFilter: [cl],
          column: themeSections.length % 2 === 0 ? 'left' : 'right',
        });
      }
    });

    const q = searchQuery.toLowerCase().trim();

    return themeSections.map((section) => {
      // Filtrer les comptes appartenant aux classes de cette section
      const sectionAccounts = accountsPool
        .filter((acc) => section.classeFilter.includes(acc.classe))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      // Rattacher les sous-comptes réels enregistrés dans la BD (comptes_comptables)
      const enrichedAccounts = sectionAccounts.map((acc) => {
        const subAccounts = dbExerciseComptes.filter((sub) => {
          if (sub.compte_parent_id && sub.compte_parent_id === acc.id) return true;
          return sub.numero && sub.numero.startsWith(acc.code) && sub.numero !== acc.code;
        });

        const totalDebit = subAccounts.reduce(
          (sum, s) => sum + Number(s.solde_ouverture_debit || 0),
          0
        );
        const totalCredit = subAccounts.reduce(
          (sum, s) => sum + Number(s.solde_ouverture_credit || 0),
          0
        );
        const balance = totalDebit - totalCredit;

        return {
          ...acc,
          theme: section.title,
          subAccounts,
          subAccountsCount: subAccounts.length,
          totalDebit,
          totalCredit,
          balance,
        };
      });

      // Filtrer selon la recherche
      const filtered = enrichedAccounts.filter((acc) => {
        if (!q) return true;
        const matchCode = acc.code.toLowerCase().includes(q);
        const matchLabel = acc.label.toLowerCase().includes(q);
        const matchCat = (acc.categorie || '').toLowerCase().includes(q);
        const matchSubs = acc.subAccounts.some(
          (s) =>
            (s.numero || '').toLowerCase().includes(q) ||
            (s.libelle || '').toLowerCase().includes(q)
        );
        return matchCode || matchLabel || matchCat || matchSubs;
      });

      return {
        ...section,
        accounts: filtered,
        totalInTheme: enrichedAccounts.length,
      };
    });
  }, [dbDefaultComptes, dbExerciseComptes, searchQuery]);

  /* ─── Séparation en deux colonnes comme le document ────────────── */
  const leftThemes = dynamicThemes.filter((t) => t.column === 'left');
  const rightThemes = dynamicThemes.filter((t) => t.column === 'right');

  /* ─── Données pour la vue Liste complète ────────────────────────── */
  const flatRows = useMemo(() => {
    return dbExerciseComptes.map((row) => ({
      id: row.id,
      code: row.numero,
      label: row.libelle,
      class: row.classe,
      nature: row.nature,
      status: row.actif ? 'Actif' : 'Inactif',
      devise: row.devise,
      soldeDebit: row.solde_ouverture_debit,
      soldeCredit: row.solde_ouverture_credit,
      balance: formatBalance(row),
    }));
  }, [dbExerciseComptes]);

  const filteredFlatRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return flatRows.filter((row) => {
      const matchSearch = !q || `${row.code} ${row.label}`.toLowerCase().includes(q);
      const matchClass = !listFilters.class || row.class === listFilters.class;
      const matchNature = !listFilters.nature || row.nature === listFilters.nature;
      const matchStatus = !listFilters.status || row.status === listFilters.status;
      return matchSearch && matchClass && matchNature && matchStatus;
    });
  }, [flatRows, searchQuery, listFilters]);

  const uniqueFilterValues = (key) =>
    [...new Set(flatRows.map((r) => r[key]).filter(Boolean))].sort();

  /* ─── Ouverture du modal de sous-comptes ─────────────────────────── */
  const handleOpenAccountModal = (account) => {
    setSelectedAccountForModal(account);
    setIsModalOpen(true);
  };

  /* ─── Export Excel ──────────────────────────────────────────────── */
  const handleExportExcel = () => {
    if (viewMode === 'list') {
      exportToExcel({
        rows: filteredFlatRows,
        columns: LIST_COLUMNS,
        filename: 'plan_comptable_complet',
        sheet: 'Plan comptable',
      });
    } else {
      const exportRows = [];
      dynamicThemes.forEach((section) => {
        section.accounts.forEach((acc) => {
          exportRows.push({
            theme: section.title,
            code: acc.code,
            label: acc.label,
            categorie: acc.categorie || '—',
            subCount: acc.subAccountsCount,
            balance: `${acc.balance.toLocaleString('fr-FR')} XAF`,
          });
        });
      });
      exportToExcel({
        rows: exportRows,
        columns: [
          { key: 'theme', label: 'Thème' },
          { key: 'code', label: 'Compte' },
          { key: 'label', label: 'Intitulé du Compte' },
          { key: 'categorie', label: 'Catégorie BD' },
          { key: 'subCount', label: 'Sous-comptes', align: 'right' },
          { key: 'balance', label: 'Solde Net', align: 'right' },
        ],
        filename: 'plan_comptable_sectoriel_bd',
        sheet: 'Plan sectoriel BD',
      });
    }
  };

  /* ─── Export PDF ────────────────────────────────────────────────── */
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const rowsForPdf =
        viewMode === 'list'
          ? filteredFlatRows
          : dynamicThemes.flatMap((section) =>
              section.accounts.map((acc) => ({
                code: acc.code,
                label: acc.label,
                class: section.title,
                nature: acc.categorie || '—',
                balance: `${acc.subAccountsCount} sous-compte(s)`,
                status: 'Actif',
              }))
            );

      await downloadPDF({
        filename: 'plan_comptable_cipresa',
        document: (
          <GenericTablePDF
            title="Plan Comptable Général & Sectoriel"
            columns={LIST_COLUMNS}
            rows={rowsForPdf}
            footerText={`Plan comptable connecté à la base de données — Exercice ${selectedExercice?.code || ''}`}
          />
        ),
      });
    } catch (err) {
      console.error('Erreur export PDF :', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-content">
      {/* ── Bannière Présentation Document ──────────────────────────── */}
      <div className="sectorial-banner">
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="sectorial-banner-title">
              <FolderTree size={28} />
              <span>PLAN COMPTABLE GÉNÉRAL &amp; SECTORIEL</span>
            </h1>
            <p className="sectorial-banner-subtitle">
              Système comptable OHADA — Adapté aux activités agricoles et d'exploitation
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={refreshing ? Loader2 : RefreshCw}
              onClick={() => fetchDatabaseAccounts(false)}
              disabled={loading || refreshing}
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
              title="Rafraîchir depuis la base de données"
            >
              {refreshing ? 'Actualisation…' : 'Actualiser'}
            </Button>
            <Button
              variant="secondary"
              icon={FileSpreadsheet}
              onClick={handleExportExcel}
              disabled={exporting}
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileText}
              onClick={handleExportPDF}
              disabled={exporting}
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              {exporting ? 'Export…' : 'PDF'}
            </Button>
            <Button
              icon={Plus}
              onClick={() => navigate('/nouveau-compte')}
              style={{ background: '#10b981', color: '#fff', border: 'none' }}
            >
              Nouveau compte
            </Button>
          </div>
        </div>

        <div className="sectorial-banner-meta">
          <span className="sectorial-banner-tag">
            <Database size={13} />
            Connecté à la Base de Données
          </span>
          <span className="sectorial-banner-tag">
            <Calendar size={13} />
            Exercice : {selectedExercice?.code || 'Aucun sélectionné'}
          </span>
          <span className="sectorial-banner-tag">
            <Layers size={13} />
            {dbDefaultComptes.length} comptes de référence • {dbExerciseComptes.length} sous-comptes opérationnels
          </span>
        </div>
      </div>

      {notice && <p className="notice-error">{notice}</p>}

      {/* ── Barre d'outils et sélecteur de vue ──────────────────────── */}
      <div className="sectorial-toolbar">
        {/* Recherche instantanée */}
        <div className="toolbar-search-wrap" style={{ flex: '1 1 320px', maxWidth: 460 }}>
          <Search size={15} className="search-icon" />
          <input
            className="toolbar-search-input"
            placeholder="Rechercher dans la base (code, libellé, sous-compte)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted)' }}
              title="Effacer la recherche"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Bascule de vue */}
        <div className="sectorial-view-switch">
          <button
            className={`sectorial-view-btn ${viewMode === 'sectorial' ? 'active' : ''}`}
            onClick={() => setViewMode('sectorial')}
          >
            <LayoutGrid size={15} />
            <span>Vue Document Sectoriel</span>
          </button>
          <button
            className={`sectorial-view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={15} />
            <span>Vue Liste complète ({dbExerciseComptes.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-muted)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px auto', display: 'block' }} />
          <p>Chargement du plan comptable depuis la base de données…</p>
        </div>
      ) : (
        <>
          {/* ── Mode 1 : Présentation conforme au document fourni ───── */}
          {viewMode === 'sectorial' && (
            <div className="sectorial-grid">
              {/* Colonne Gauche : Classes 1, 3, 4 & 5 */}
              <div className="sectorial-column">
                {leftThemes.map((theme) => (
                  <div key={theme.id} className="sectorial-theme-card">
                    <div className="sectorial-card-header">
                      <span>{theme.title}</span>
                      <span className="sectorial-header-count">
                        {theme.accounts.length} comptes
                      </span>
                    </div>
                    <table className="sectorial-table">
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>Compte</th>
                          <th>Intitulé du Compte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {theme.accounts.length === 0 ? (
                          <tr>
                            <td colSpan={2} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-muted)' }}>
                              Aucun compte dans ce thème
                            </td>
                          </tr>
                        ) : (
                          theme.accounts.map((acc) => (
                            <tr
                              key={acc.id || acc.code}
                              className="sectorial-row"
                              onClick={() => handleOpenAccountModal(acc)}
                              title="Cliquez pour consulter ou créer des sous-comptes"
                            >
                              <td className="sectorial-code">{acc.code}</td>
                              <td>
                                <div className="sectorial-name-col">
                                  <div className="sectorial-label-row">
                                    <span className="sectorial-label">{acc.label}</span>
                                    {acc.subAccountsCount > 0 ? (
                                      <span className="sectorial-badge-count">
                                        {acc.subAccountsCount} sous-compte{acc.subAccountsCount > 1 ? 's' : ''}
                                      </span>
                                    ) : (
                                      <ChevronRight size={14} color="var(--color-subtle)" />
                                    )}
                                  </div>
                                  {acc.categorie && (
                                    <span className="sectorial-details">({acc.categorie})</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Colonne Droite : Classes 2, 6, 7 */}
              <div className="sectorial-column">
                {rightThemes.map((theme) => (
                  <div key={theme.id} className="sectorial-theme-card">
                    <div className="sectorial-card-header">
                      <span>{theme.title}</span>
                      <span className="sectorial-header-count">
                        {theme.accounts.length} comptes
                      </span>
                    </div>
                    <table className="sectorial-table">
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>Compte</th>
                          <th>Intitulé du Compte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {theme.accounts.length === 0 ? (
                          <tr>
                            <td colSpan={2} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-muted)' }}>
                              Aucun compte dans ce thème
                            </td>
                          </tr>
                        ) : (
                          theme.accounts.map((acc) => (
                            <tr
                              key={acc.id || acc.code}
                              className="sectorial-row"
                              onClick={() => handleOpenAccountModal(acc)}
                              title="Cliquez pour consulter ou créer des sous-comptes"
                            >
                              <td className="sectorial-code">{acc.code}</td>
                              <td>
                                <div className="sectorial-name-col">
                                  <div className="sectorial-label-row">
                                    <span className="sectorial-label">{acc.label}</span>
                                    {acc.subAccountsCount > 0 ? (
                                      <span className="sectorial-badge-count">
                                        {acc.subAccountsCount} sous-compte{acc.subAccountsCount > 1 ? 's' : ''}
                                      </span>
                                    ) : (
                                      <ChevronRight size={14} color="var(--color-subtle)" />
                                    )}
                                  </div>
                                  {acc.categorie && (
                                    <span className="sectorial-details">({acc.categorie})</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Mode 2 : Vue tabulaire complète ─────────────────────── */}
          {viewMode === 'list' && (
            <Card>
              <div className="list-toolbar">
                <span className="toolbar-count">
                  {filteredFlatRows.length} compte(s) dans l'exercice
                </span>
                <button
                  className={`filter-toggle-btn ${showListFilters ? 'active' : ''}`}
                  onClick={() => setShowListFilters((v) => !v)}
                >
                  <SlidersHorizontal size={14} />
                  <span>Filtres</span>
                </button>
              </div>

              {/* Filtres déroulants */}
              {showListFilters && (
                <div className="filter-panel">
                  <div className="filter-row">
                    <div className="filter-item">
                      <label className="filter-label">Classe</label>
                      <select
                        className="filter-select"
                        value={listFilters.class}
                        onChange={(e) => setListFilters((f) => ({ ...f, class: e.target.value }))}
                      >
                        <option value="">Toutes</option>
                        {uniqueFilterValues('class').map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-item">
                      <label className="filter-label">Nature</label>
                      <select
                        className="filter-select"
                        value={listFilters.nature}
                        onChange={(e) => setListFilters((f) => ({ ...f, nature: e.target.value }))}
                      >
                        <option value="">Toutes</option>
                        {uniqueFilterValues('nature').map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-item">
                      <label className="filter-label">Statut</label>
                      <select
                        className="filter-select"
                        value={listFilters.status}
                        onChange={(e) => setListFilters((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="">Tous</option>
                        {uniqueFilterValues('status').map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="filter-reset-btn"
                      onClick={() => setListFilters({ class: '', nature: '', status: '' })}
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {LIST_COLUMNS.map((col) => (
                        <th key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFlatRows.length === 0 ? (
                      <tr>
                        <td colSpan={LIST_COLUMNS.length} className="empty-row">
                          Aucun compte trouvé dans l'exercice
                        </td>
                      </tr>
                    ) : (
                      filteredFlatRows.map((row) => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.code}</td>
                          <td>{row.label}</td>
                          <td>{row.class}</td>
                          <td>
                            <span className="badge badge-neutral">{row.nature}</span>
                          </td>
                          <td className="text-right" style={{ fontWeight: 600 }}>{row.balance}</td>
                          <td>
                            <span className={`badge ${row.status === 'Actif' ? 'badge-success' : 'badge-neutral'}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Modal Interactif : Sous-comptes & Création directe ──────── */}
      <SubAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        account={selectedAccountForModal}
        subAccounts={selectedAccountForModal?.subAccounts || []}
        selectedExercice={selectedExercice}
        onSubAccountCreated={handleSubAccountCreated}
      />
    </div>
  );
}
