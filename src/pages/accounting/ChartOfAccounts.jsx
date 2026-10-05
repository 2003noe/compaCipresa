import { useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { exportToExcel, downloadPDF, GenericTablePDF } from '../../lib/generateFile';
import ListPage from './ListPage';

/* ─── Colonnes ────────────────────────────────────────────────────── */
const COLUMNS = [
  { key: 'code',    label: 'Compte'           },
  { key: 'label',   label: 'Libellé'          },
  { key: 'class',   label: 'Classe'           },
  { key: 'nature',  label: 'Nature'           },
  { key: 'balance', label: 'Solde', align: 'right' },
  { key: 'status',  label: 'Statut'           },
];

/* ─── Formatage du solde ──────────────────────────────────────────── */
const formatBalance = (row) => {
  const value = Number(row.soldeDebit || 0) - Number(row.soldeCredit || 0);
  return `${value.toLocaleString('fr-FR')} ${row.devise || ''}`.trim();
};


/* ─── Composant principal ─────────────────────────────────────────── */
export default function ChartOfAccounts() {
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [notice,    setNotice]    = useState('');
  const [query,     setQuery]     = useState('');
  const [exporting, setExporting] = useState(false);

  // Filtres par colonne : { class: '', nature: '', status: '' }
  const [filters, setFilters] = useState({ class: '', nature: '', status: '' });

  /* Chargement */
  useEffect(() => {
    let active = true;
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return undefined;
    }
    supabase
      .from('comptes_comptables')
      .select('id,numero,libelle,classe,nature,actif,devise,solde_ouverture_debit,solde_ouverture_credit')
      .order('numero')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice(`Impossible de charger le plan comptable : ${error.message}`);
        } else {
          const mapped = (data || []).map((row) => ({
            id:          row.id,
            code:        row.numero,
            label:       row.libelle,
            class:       row.classe,
            nature:      row.nature,
            status:      row.actif ? 'Actif' : 'Inactif',
            devise:      row.devise,
            soldeDebit:  row.solde_ouverture_debit,
            soldeCredit: row.solde_ouverture_credit,
          }));
          setRows(mapped.map((row) => ({ ...row, balance: formatBalance(row) })));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  /* Valeurs uniques pour chaque filtre (calculées dynamiquement) */
  const uniqueValues = (key) =>
    [...new Set(rows.map(r => r[key]).filter(Boolean))].sort();

  /* Filtrage combiné : recherche texte + filtres par colonne */
  const filteredRows = rows.filter(row => {
    const matchSearch = `${row.code} ${row.label}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchClass  = !filters.class  || row.class  === filters.class;
    const matchNature = !filters.nature || row.nature === filters.nature;
    const matchStatus = !filters.status || row.status === filters.status;
    return matchSearch && matchClass && matchNature && matchStatus;
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  /* Réinitialiser tous les filtres */
  const resetFilters = () => setFilters({ class: '', nature: '', status: '' });

  /* Export Excel — délégué à lib/generateFile/exportExcel */
  const exportExcel = () =>
    exportToExcel({
      rows:     filteredRows,
      columns:  COLUMNS,
      filename: 'plan_comptable',
      sheet:    'Plan comptable',
    });

  /* Export PDF — délégué à lib/generateFile/exportPDF */
  const exportPDF = async () => {
    setExporting(true);
    try {
      await downloadPDF({
        filename: 'plan_comptable',
        document: (
          <GenericTablePDF
            title="Plan Comptable"
            columns={COLUMNS}
            rows={filteredRows}
            footerText={`${filteredRows.length} compte(s) — compaCipresa`}
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
    <ListPage
      title="Plan comptable"
      subtitle="Gérez les comptes et la structure de votre plan comptable"
      primary="Nouveau compte"
      primaryPath="/nouveau-compte"
      columns={COLUMNS}
      rows={filteredRows}
      loading={loading}
      notice={notice}
      /* Recherche */
      searchValue={query}
      onSearchChange={setQuery}
      /* Filtres */
      filters={filters}
      onFilterChange={(key, val) => setFilters(prev => ({ ...prev, [key]: val }))}
      onFilterReset={resetFilters}
      activeFilterCount={activeFilterCount}
      filterOptions={{
        class:  uniqueValues('class'),
        nature: uniqueValues('nature'),
        status: uniqueValues('status'),
      }}
      /* Export */
      onExportExcel={exportExcel}
      onExportPDF={exportPDF}
      exporting={exporting}
    />
  );
}
