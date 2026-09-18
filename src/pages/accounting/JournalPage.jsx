import { useEffect, useState } from 'react';
import ListPage from './ListPage';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'ref', label: 'Référence' },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Débit', align: 'right' },
  { key: 'credit', label: 'Crédit', align: 'right' },
  { key: 'status', label: 'Statut' },
];

const money = (v) => Number(v || 0).toLocaleString('fr-FR');

export default function JournalPage() {
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
      .from('ecritures_comptables')
      .select('id,numero,date_ecriture,libelle,reference_piece,statut,lignes_ecritures(debit,credit)')
      .order('date_ecriture', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice(`Impossible de charger le journal : ${error.message}`);
        } else {
          setRows((data || []).map((entry) => {
            const lignes = entry.lignes_ecritures || [];
            const debit = lignes.reduce((acc, l) => acc + Number(l.debit || 0), 0);
            const credit = lignes.reduce((acc, l) => acc + Number(l.credit || 0), 0);
            return {
              id: entry.id,
              date: entry.date_ecriture,
              ref: entry.reference_piece || entry.numero,
              description: entry.libelle,
              debit: `${money(debit)} FCFA`,
              credit: `${money(credit)} FCFA`,
              status: entry.statut === 'VALIDEE' ? 'Validée' : 'Brouillon',
            };
          }));
        }
        setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const filteredRows = rows.filter((row) => `${row.ref} ${row.description}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <ListPage
      title="Journal comptable"
      subtitle="Consultez et gérez les écritures comptables"
      primary="Nouvelle écriture"
      primaryPath="/nouvelle-ecriture"
      columns={COLUMNS}
      rows={filteredRows}
      loading={loading}
      notice={notice}
      searchValue={query}
      onSearchChange={setQuery}
    />
  );
}
