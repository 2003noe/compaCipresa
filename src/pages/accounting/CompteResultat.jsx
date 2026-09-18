import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));

export default function CompteResultat() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }

    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin,statut').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,nature'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(date_ecriture,statut)'),
    ]).then(([ex, ac, ln]) => {
      if (ex.error || ac.error || ln.error) {
        setNotice(`Impossible de charger le compte de résultat : ${(ex.error || ac.error || ln.error).message}`);
        setLoading(false);
        return;
      }
      setExercises(ex.data || []);
      const openExercise = ex.data?.find((e) => e.statut === 'OUVERT') || ex.data?.[0];
      if (openExercise) setExerciceId(openExercise.id);
      setAccounts((ac.data || []).filter((a) => a.nature === 'CHARGE' || a.nature === 'PRODUIT'));
      setLines((ln.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
      setLoading(false);
    });
  }, []);

  const selected = exercises.find((e) => e.id === exerciceId);
  const previous = exercises.find((e) => e.annee === (selected?.annee ? selected.annee - 1 : null));

  const periodNet = (compteId, start, end) => {
    if (!start || !end) return 0;
    return lines
      .filter((l) => l.compte_id === compteId && l.ecritures_comptables.date_ecriture >= start && l.ecritures_comptables.date_ecriture <= end)
      .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
  };

  const rows = useMemo(() => accounts.map((a) => {
    const rawN = periodNet(a.id, selected?.date_debut, selected?.date_fin);
    const rawN1 = previous ? periodNet(a.id, previous.date_debut, previous.date_fin) : null;
    const sign = a.nature === 'CHARGE' ? 1 : -1;
    return { ...a, valueN: rawN * sign, valueN1: rawN1 === null ? null : rawN1 * sign };
  }), [accounts, lines, selected, previous]); // eslint-disable-line react-hooks/exhaustive-deps

  const produitsExploit = rows.filter((r) => r.nature === 'PRODUIT' && !r.numero.startsWith('77'));
  const chargesExploit = rows.filter((r) => r.nature === 'CHARGE' && !r.numero.startsWith('67'));
  const produitsFin = rows.filter((r) => r.nature === 'PRODUIT' && r.numero.startsWith('77'));
  const chargesFin = rows.filter((r) => r.nature === 'CHARGE' && r.numero.startsWith('67'));
  const achats = chargesExploit.filter((r) => r.numero.startsWith('60'));

  const sum = (list, key = 'valueN') => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);

  const totalProduitsExploitN = sum(produitsExploit); const totalProduitsExploitN1 = sum(produitsExploit, 'valueN1');
  const totalChargesExploitN = sum(chargesExploit); const totalChargesExploitN1 = sum(chargesExploit, 'valueN1');
  const resultatExploitN = totalProduitsExploitN - totalChargesExploitN;
  const resultatExploitN1 = totalProduitsExploitN1 - totalChargesExploitN1;
  const totalProduitsFinN = sum(produitsFin); const totalProduitsFinN1 = sum(produitsFin, 'valueN1');
  const totalChargesFinN = sum(chargesFin); const totalChargesFinN1 = sum(chargesFin, 'valueN1');
  const resultatNetN = resultatExploitN + totalProduitsFinN - totalChargesFinN;
  const resultatNetN1 = resultatExploitN1 + totalProduitsFinN1 - totalChargesFinN1;
  const margeBrute = totalProduitsExploitN > 0 ? ((totalProduitsExploitN - sum(achats)) / totalProduitsExploitN) * 100 : null;

  const Group = ({ title, list, refCode, refValue, refValue1, refLabel }) => (
    <>
      {title && <tr key={`h-${title}`}><td colSpan={4} className="cr-section-title">{title}</td></tr>}
      {list.map((r) => (
        <tr key={r.id}>
          <td className="account-cell">{r.numero}</td>
          <td>{r.libelle}</td>
          <td className="text-right">{dash(r.valueN)}</td>
          <td className="text-right cr-n1">{r.valueN1 === null ? '—' : dash(r.valueN1)}</td>
        </tr>
      ))}
      {refCode && (
        <tr className="balance-subtotal-row">
          <td className="account-cell">{refCode}</td>
          <td>{refLabel}</td>
          <td className="text-right">{money(refValue)}</td>
          <td className="text-right cr-n1">{refValue1 === null ? '—' : money(refValue1)}</td>
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

      <Card className="ledger-toolbar">
        <Select label="Exercice" value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
          {exercises.length === 0 && <option value="">Aucun exercice</option>}
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.code} ({e.annee})</option>)}
        </Select>
      </Card>

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
                <thead><tr><th>Réf</th><th>Libellé des comptes</th><th className="text-right">Exercice N (FCFA)</th><th className="text-right">Exercice N-1 (FCFA)</th></tr></thead>
                <tbody>
                  <Group title="PRODUITS D'EXPLOITATION" list={produitsExploit} refCode="A" refLabel="TOTAL PRODUITS D'EXPLOITATION" refValue={totalProduitsExploitN} refValue1={previous ? totalProduitsExploitN1 : null} />
                  <Group title="CHARGES D'EXPLOITATION" list={chargesExploit} refCode="B" refLabel="TOTAL CHARGES D'EXPLOITATION" refValue={totalChargesExploitN} refValue1={previous ? totalChargesExploitN1 : null} />
                  <tr className="balance-total-row"><td className="account-cell">C (A-B)</td><td>RÉSULTAT D'EXPLOITATION</td><td className="text-right">{money(resultatExploitN)}</td><td className="text-right">{previous ? money(resultatExploitN1) : '—'}</td></tr>
                  <Group list={produitsFin} />
                  <Group list={chargesFin} />
                  <tr className="balance-total-row"><td className="account-cell">R.NET</td><td>RÉSULTAT NET DE L'EXERCICE</td><td className="text-right">{money(resultatNetN)}</td><td className="text-right">{previous ? money(resultatNetN1) : '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
