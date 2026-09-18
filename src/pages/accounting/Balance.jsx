import { useEffect, useMemo, useState, Fragment } from 'react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));
const classNumber = (classe) => {
  const match = /classe\s*(\d+)/i.exec(classe || '');
  return match ? Number(match[1]) : 99;
};

export default function Balance() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [movementsByAccount, setMovementsByAccount] = useState({});
  const [classFilter, setClassFilter] = useState('Toutes classes');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }

    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,statut').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,solde_ouverture_debit,solde_ouverture_credit').order('numero'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(exercice_id,statut)'),
    ]).then(([ex, ac, mv]) => {
      if (ex.error || ac.error || mv.error) {
        setNotice(`Impossible de charger la balance : ${(ex.error || ac.error || mv.error).message}`);
        setLoading(false);
        return;
      }
      setExercises(ex.data || []);
      const openExercise = ex.data?.find((e) => e.statut === 'OUVERT') || ex.data?.[0];
      if (openExercise) setExerciceId(openExercise.id);
      setAccounts(ac.data || []);

      const grouped = {};
      (mv.data || []).forEach((line) => {
        if (line.ecritures_comptables?.statut !== 'VALIDEE') return;
        const key = `${line.compte_id}__${line.ecritures_comptables.exercice_id}`;
        if (!grouped[key]) grouped[key] = { debit: 0, credit: 0 };
        grouped[key].debit += Number(line.debit || 0);
        grouped[key].credit += Number(line.credit || 0);
      });
      setMovementsByAccount(grouped);
      setLoading(false);
    });
  }, []);

  const classOptions = useMemo(() => ['Toutes classes', ...new Set(accounts.map((a) => a.classe))].sort((a, b) => (a === 'Toutes classes' ? -1 : classNumber(a) - classNumber(b))), [accounts]);

  const rows = useMemo(() => accounts
    .filter((a) => classFilter === 'Toutes classes' || a.classe === classFilter)
    .map((a) => {
      const mvt = movementsByAccount[`${a.id}__${exerciceId}`] || { debit: 0, credit: 0 };
      const openingNet = Number(a.solde_ouverture_debit || 0) - Number(a.solde_ouverture_credit || 0);
      const closingNet = openingNet + mvt.debit - mvt.credit;
      return {
        ...a,
        openingDebit: a.solde_ouverture_debit,
        openingCredit: a.solde_ouverture_credit,
        mvtDebit: mvt.debit,
        mvtCredit: mvt.credit,
        closingDebit: closingNet >= 0 ? closingNet : 0,
        closingCredit: closingNet < 0 ? Math.abs(closingNet) : 0,
      };
    }), [accounts, movementsByAccount, exerciceId, classFilter]);

  const groups = useMemo(() => {
    const byClass = {};
    rows.forEach((row) => { (byClass[row.classe] = byClass[row.classe] || []).push(row); });
    return Object.entries(byClass).sort(([a], [b]) => classNumber(a) - classNumber(b));
  }, [rows]);

  const sumCol = (list, key) => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);
  const grandTotal = ['openingDebit', 'openingCredit', 'mvtDebit', 'mvtCredit', 'closingDebit', 'closingCredit']
    .reduce((acc, key) => ({ ...acc, [key]: sumCol(rows, key) }), {});

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Balance générale des comptes</h1>
          <p className="page-subtitle">Vue synthétique des soldes des comptes{loading ? ' · Chargement…' : ''}</p>
        </div>
      </div>

      <Card className="ledger-toolbar">
        <Select label="Exercice" value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
          {exercises.length === 0 && <option value="">Aucun exercice</option>}
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.code} ({e.annee})</option>)}
        </Select>
        <Select label="Filtrer" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Card>

      {notice && <div className="message error" role="alert">{notice}</div>}

      {!loading && (
        <Card>
          <div className="table-wrap">
            <table className="balance-table">
              <thead>
                <tr>
                  <th rowSpan={2}>N° Compte</th>
                  <th rowSpan={2}>Libellé du compte</th>
                  <th colSpan={2} className="text-center">Solde Ouverture</th>
                  <th colSpan={2} className="text-center">Mouvements</th>
                  <th colSpan={2} className="text-center">Solde Clôture</th>
                </tr>
                <tr>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([classe, list]) => (
                  <Fragment key={classe}>
                    <tr className="balance-class-row" key={`h-${classe}`}><td colSpan={8}>{classe}</td></tr>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td className="account-cell">{r.numero}</td>
                        <td>{r.libelle}</td>
                        <td className="text-right">{dash(r.openingDebit)}</td>
                        <td className="text-right">{dash(r.openingCredit)}</td>
                        <td className="text-right">{money(r.mvtDebit)}</td>
                        <td className="text-right">{money(r.mvtCredit)}</td>
                        <td className="text-right">{dash(r.closingDebit)}</td>
                        <td className="text-right">{dash(r.closingCredit)}</td>
                      </tr>
                    ))}
                    <tr className="balance-subtotal-row" key={`s-${classe}`}>
                      <td colSpan={2}>Sous-total {classe.split(' - ')[0]}</td>
                      <td className="text-right">{dash(sumCol(list, 'openingDebit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'openingCredit'))}</td>
                      <td className="text-right">{money(sumCol(list, 'mvtDebit'))}</td>
                      <td className="text-right">{money(sumCol(list, 'mvtCredit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'closingDebit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'closingCredit'))}</td>
                    </tr>
                  </Fragment>
                ))}
                {groups.length === 0 && <tr><td colSpan={8}>Aucun compte pour ce filtre.</td></tr>}
                <tr className="balance-total-row">
                  <td colSpan={2}>Total général</td>
                  <td className="text-right">{money(grandTotal.openingDebit)}</td>
                  <td className="text-right">{money(grandTotal.openingCredit)}</td>
                  <td className="text-right">{money(grandTotal.mvtDebit)}</td>
                  <td className="text-right">{money(grandTotal.mvtCredit)}</td>
                  <td className="text-right">{money(grandTotal.closingDebit)}</td>
                  <td className="text-right">{money(grandTotal.closingCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
