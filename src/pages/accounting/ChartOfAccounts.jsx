import { useEffect, useState } from 'react';
import ListPage from './ListPage';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const COLUMNS = [
  { key: 'code', label: 'Compte' },
  { key: 'label', label: 'Libellé' },
  { key: 'class', label: 'Classe' },
  { key: 'nature', label: 'Nature' },
  { key: 'balance', label: 'Solde', align: 'right' },
  { key: 'status', label: 'Statut' },
];

const formatBalance = (row) => {
  const value = Number(row.soldeDebit || 0) - Number(row.soldeCredit || 0);
  return `${value.toLocaleString('fr-FR')} ${row.devise || ''}`.trim();
};

export default function ChartOfAccounts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

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
            id: row.id,
            code: row.numero,
            label: row.libelle,
            class: row.classe,
            nature: row.nature,
            status: row.actif ? 'Actif' : 'Inactif',
            devise: row.devise,
            soldeDebit: row.solde_ouverture_debit,
            soldeCredit: row.solde_ouverture_credit,
          }));
          setRows(mapped.map((row) => ({ ...row, balance: formatBalance(row) })));
        }
        setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const filteredRows = rows.filter((row) => `${row.code} ${row.label}`.toLowerCase().includes(query.toLowerCase()));

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
      searchValue={query}
      onSearchChange={setQuery}
    />
  );
}
