import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import { useExercice } from '../../context/ExerciceContext';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));

export default function CompteResultat() {
  const { selectedExerciceId: exerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    if (exercicesLoading) return;
    if (!exerciceId) { setAccounts([]); setLines([]); setLoading(false); return; }
    setLoading(true);
    setAccounts([]);
    setLines([]);
    setNotice('');
    let active = true;

    Promise.all([
      supabase.from('comptes_comptables').select('id,numero,libelle,nature').eq('exercice_id', exerciceId),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables!ligne_ecriture_company_fk!inner(exercice_id,date_ecriture,statut)').eq('ecritures_comptables.exercice_id', exerciceId),
    ]).then(([ac, ln]) => {
      if (!active) return;
      if (ac.error || ln.error) {
        setNotice(`Impossible de charger le compte de résultat : ${(ac.error || ln.error).message}`);
        setLoading(false);
        return;
      }
      setAccounts((ac.data || []).filter((a) => a.nature === 'CHARGE' || a.nature === 'PRODUIT'));
      setLines((ln.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
      setLoading(false);
    });
    return () => { active = false; };
  }, [exerciceId, exercicesLoading]);

  const selected = selectedExercice;

  const periodNet = (compteId, start, end) => {
    if (!start || !end) return 0;
    return lines
      .filter((l) => l.compte_id === compteId && l.ecritures_comptables.date_ecriture >= start && l.ecritures_comptables.date_ecriture <= end)
      .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
  };

  const rows = useMemo(() => accounts.map((a) => {
    const rawN = periodNet(a.id, selected?.date_debut, selected?.date_fin);
    const sign = a.nature === 'CHARGE' ? 1 : -1;
    return { ...a, valueN: rawN * sign };
  }), [accounts, lines, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const produitsExploit = rows.filter((r) => r.nature === 'PRODUIT' && !r.numero.startsWith('77'));
  const chargesExploit = rows.filter((r) => r.nature === 'CHARGE' && !r.numero.startsWith('67'));
  const produitsFin = rows.filter((r) => r.nature === 'PRODUIT' && r.numero.startsWith('77'));
  const chargesFin = rows.filter((r) => r.nature === 'CHARGE' && r.numero.startsWith('67'));
  const achats = chargesExploit.filter((r) => r.numero.startsWith('60'));

  const sum = (list, key = 'valueN') => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);

  const totalProduitsExploitN = sum(produitsExploit);
  const totalChargesExploitN = sum(chargesExploit);
  const resultatExploitN = totalProduitsExploitN - totalChargesExploitN;
  const totalProduitsFinN = sum(produitsFin);
  const totalChargesFinN = sum(chargesFin);
  const resultatNetN = resultatExploitN + totalProduitsFinN - totalChargesFinN;
  const margeBrute = totalProduitsExploitN > 0 ? ((totalProduitsExploitN - sum(achats)) / totalProduitsExploitN) * 100 : null;

  const Group = ({ title, list, refCode, refValue, refValue1, refLabel }) => (
    <>
      {title && <tr key={`h-${title}`}><td colSpan={3} className="cr-section-title">{title}</td></tr>}
      {list.map((r) => (
        <tr key={r.id}>
          <td className="account-cell">{r.numero}</td>
          <td>{r.libelle}</td>
          <td className="text-right">{dash(r.valueN)}</td>
        </tr>
      ))}
      {refCode && (
        <tr className="balance-subtotal-row">
          <td className="account-cell">{refCode}</td>
          <td>{refLabel}</td>
          <td className="text-right">{money(refValue)}</td>
        </tr>
      )}
    </>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compte de résultat</h1>
          <p className="page-subtitle">Performance de l'exercice{loading ? ' · Chargement…' : ''}</p>
        </div>
      </div>


      {notice && <div className="message error" role="alert">{notice}</div>}

      {!loading && selected && (
        <>
          <div className="cr-kpis">
            <Card><span className="ledger-summary-label">Marge brute (%)</span><strong className="positive">{margeBrute === null ? '—' : `${margeBrute.toFixed(1)}%`}</strong><small>Rentabilité globale</small></Card>
            <Card><span className="ledger-summary-label">Résultat d'exploitation</span><strong className="positive">{money(resultatExploitN)} FCFA</strong><small>Performance opérationnelle</small></Card>
            <Card><span className="ledger-summary-label">Résultat net</span><strong className="positive">{money(resultatNetN)} FCFA</strong><small>Bénéfice final de l'exercice</small></Card>
          </div>

          <Card>
            <h2 className="bilan-side-title">Calcul du Résultat Net de l'Exercice</h2>
            <div className="table-wrap">
              <table className="balance-table">
                <thead><tr><th>Réf</th><th>Libellé des comptes</th><th className="text-right">Exercice sélectionné (FCFA)</th></tr></thead>
                <tbody>
                  <Group title="PRODUITS D'EXPLOITATION" list={produitsExploit} refCode="A" refLabel="TOTAL PRODUITS D'EXPLOITATION" refValue={totalProduitsExploitN} />
                  <Group title="CHARGES D'EXPLOITATION" list={chargesExploit} refCode="B" refLabel="TOTAL CHARGES D'EXPLOITATION" refValue={totalChargesExploitN} />
                  <tr className="balance-total-row"><td className="account-cell">C (A-B)</td><td>RÉSULTAT D'EXPLOITATION</td><td className="text-right">{money(resultatExploitN)}</td></tr>
                  <Group list={produitsFin} />
                  <Group list={chargesFin} />
                  <tr className="balance-total-row"><td className="account-cell">R.NET</td><td>RÉSULTAT NET DE L'EXERCICE</td><td className="text-right">{money(resultatNetN)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
