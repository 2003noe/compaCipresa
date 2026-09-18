import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Table from '../../components/ui/Table';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'ref', label: 'N° Pièce' },
  { key: 'journal', label: 'Journal' },
  { key: 'description', label: "Libellé de l'écriture" },
  { key: 'debit', label: 'Débit (FCFA)', align: 'right' },
  { key: 'credit', label: 'Crédit (FCFA)', align: 'right' },
  { key: 'solde', label: 'Solde cumulé (FCFA)', align: 'right' },
];

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const firstDayOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastDayOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function GrandLivre() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState(firstDayOfMonth());
  const [periodEnd, setPeriodEnd] = useState(lastDayOfMonth());
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); return; }
    supabase.from('comptes_comptables').select('id,numero,libelle,solde_ouverture_debit,solde_ouverture_credit,devise').order('numero').then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger le plan comptable : ${error.message}`); return; }
      setAccounts(data || []);
      if (data?.length) setAccountId(data[0].id);
    });
  }, []);

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === accountId) || null, [accounts, accountId]);

  const generate = async () => {
    if (!accountId) return;
    setNotice('');
    setLoading(true);

    const { data, error } = await supabase
      .from('lignes_ecritures')
      .select('debit,credit,ecritures_comptables(date_ecriture,numero,statut,libelle,journaux(code))')
      .eq('compte_id', accountId);

    setLoading(false);

    if (error) { setNotice(`Impossible de charger le grand livre : ${error.message}`); return; }

    const validated = (data || []).filter((row) => row.ecritures_comptables?.statut === 'VALIDEE');
    const before = validated.filter((row) => row.ecritures_comptables.date_ecriture < periodStart);
    const within = validated
      .filter((row) => row.ecritures_comptables.date_ecriture >= periodStart && row.ecritures_comptables.date_ecriture <= periodEnd)
      .sort((a, b) => a.ecritures_comptables.date_ecriture.localeCompare(b.ecritures_comptables.date_ecriture));

    const accountBase = Number(selectedAccount?.solde_ouverture_debit || 0) - Number(selectedAccount?.solde_ouverture_credit || 0);
    const beforeNet = before.reduce((acc, row) => acc + Number(row.debit || 0) - Number(row.credit || 0), 0);
    const openingBalance = accountBase + beforeNet;

    let running = openingBalance;
    const movements = within.map((row, index) => {
      running += Number(row.debit || 0) - Number(row.credit || 0);
      return {
        id: index,
        date: new Date(row.ecritures_comptables.date_ecriture).toLocaleDateString('fr-FR'),
        ref: row.ecritures_comptables.numero,
        journal: row.ecritures_comptables.journaux?.code || '—',
        description: row.ecritures_comptables.libelle,
        debit: Number(row.debit || 0) ? money(row.debit) : '',
        credit: Number(row.credit || 0) ? money(row.credit) : '',
        solde: money(running),
      };
    });

    const totalDebit = within.reduce((acc, row) => acc + Number(row.debit || 0), 0);
    const totalCredit = within.reduce((acc, row) => acc + Number(row.credit || 0), 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    setLedger({ openingBalance, totalDebit, totalCredit, closingBalance, movements });
  };

  useEffect(() => { if (accountId) generate(); }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const devise = selectedAccount?.devise || 'FCFA';
  const soldeLabel = (value) => (value >= 0 ? 'Débiteur' : 'Créditeur');

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grand livre des comptes</h1>
          <p className="page-subtitle">Mouvements détaillés par compte</p>
        </div>
      </div>

      <Card className="ledger-toolbar">
        <Select label="Compte sélectionné" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.length === 0 && <option value="">Aucun compte disponible</option>}
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.numero} - {a.libelle}</option>)}
        </Select>
        <Input label="Début de période" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        <Input label="Fin de période" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        <Button icon={RefreshCw} onClick={generate} disabled={loading || !accountId}>{loading ? 'Génération…' : 'Générer'}</Button>
      </Card>

      {notice && <div className="message error" role="alert">{notice}</div>}

      {ledger && selectedAccount && (
        <>
          <Card className="ledger-summary">
            <div>
              <span className="ledger-summary-label">Compte courant</span>
              <strong className="ledger-summary-account">{selectedAccount.numero} - {selectedAccount.libelle}</strong>
            </div>
            <div><span className="ledger-summary-label">Solde d'ouverture</span><strong>{money(ledger.openingBalance)} {devise}</strong></div>
            <div><span className="ledger-summary-label">Total Débits</span><strong className="positive">{money(ledger.totalDebit)} {devise}</strong></div>
            <div><span className="ledger-summary-label">Total Crédits</span><strong>{money(ledger.totalCredit)} {devise}</strong></div>
            <div><span className="ledger-summary-label">Solde de clôture ({soldeLabel(ledger.closingBalance)})</span><strong className="positive">{money(Math.abs(ledger.closingBalance))} {devise}</strong></div>
          </Card>

          <Card>
            <Table columns={COLUMNS} rows={ledger.movements} />
            <div className="ledger-total-row">
              <strong>Mouvements &amp; Solde Final</strong>
              <strong>{money(ledger.totalDebit)}</strong>
              <strong>{money(ledger.totalCredit)}</strong>
              <strong>{soldeLabel(ledger.closingBalance) === 'Débiteur' ? 'SD' : 'SC'} : {money(Math.abs(ledger.closingBalance))}</strong>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
