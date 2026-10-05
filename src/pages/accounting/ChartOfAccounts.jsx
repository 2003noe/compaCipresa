import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
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

/* ─── Styles PDF ──────────────────────────────────────────────────── */
const pdfStyles = StyleSheet.create({
  page:    { padding: 30, fontSize: 9, fontFamily: 'Helvetica' },
  title:   { fontSize: 16, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  sub:     { fontSize: 10, marginBottom: 16, color: '#555' },
  table:   { width: '100%' },
  thead:   { flexDirection: 'row', backgroundColor: '#1e40af', borderRadius: 3 },
  th:      { flex: 1, padding: '6 4', fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { flex: 1, padding: '6 4', fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  row:     { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  rowAlt:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  td:      { flex: 1, padding: '5 4' },
  tdRight: { flex: 1, padding: '5 4', textAlign: 'right' },
  footer:  { marginTop: 16, fontSize: 8, color: '#888', textAlign: 'center' },
});

/* ─── Document PDF ────────────────────────────────────────────────── */
function PlanComptablePDF({ rows, columns }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Plan Comptable</Text>
        <Text style={pdfStyles.sub}>Exporté le {new Date().toLocaleDateString('fr-FR')}</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {columns.map(c => (
              <Text key={c.key} style={c.align === 'right' ? pdfStyles.thRight : pdfStyles.th}>
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={row.id || i} style={i % 2 === 0 ? pdfStyles.row : pdfStyles.rowAlt}>
              {columns.map(c => (
                <Text key={c.key} style={c.align === 'right' ? pdfStyles.tdRight : pdfStyles.td}>
                  {row[c.key] ?? ''}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>
          {rows.length} compte(s) — compaCipresa
        </Text>
      </Page>
    </Document>
  );
}

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

  /* Export Excel */
  const exportExcel = () => {
    const data = filteredRows.map(r => ({
      Compte:  r.code,
      Libellé: r.label,
      Classe:  r.class,
      Nature:  r.nature,
      Solde:   r.balance,
      Statut:  r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan comptable');
    XLSX.writeFile(wb, 'plan_comptable.xlsx');
  };

  /* Export PDF */
  const exportPDF = async () => {
    setExporting(true);
    try {
      const blob = await pdf(
        <PlanComptablePDF rows={filteredRows} columns={COLUMNS} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'plan_comptable.pdf';
      a.click();
      URL.revokeObjectURL(url);
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
