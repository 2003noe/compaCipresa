import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));

const isNumeroIn = (numero, prefixes) => prefixes.some((p) => (numero || '').startsWith(p));

export default function Bilan() {
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
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,nature,solde_ouverture_debit,solde_ouverture_credit'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(date_ecriture,statut)'),
    ]).then(([ex, ac, ln]) => {
      if (ex.error || ac.error || ln.error) {
        setNotice(`Impossible de charger le bilan : ${(ex.error || ac.error || ln.error).message}`);
        setLoading(false);
        return;
      }
      setExercises(ex.data || []);
      const openExercise = ex.data?.find((e) => e.statut === 'OUVERT') || ex.data?.[0];
      if (openExercise) setExerciceId(openExercise.id);
      setAccounts(ac.data || []);
      setLines((ln.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
      setLoading(false);
    });
  }, []);

  const selected = exercises.find((e) => e.id === exerciceId);
  const previous = exercises.find((e) => e.annee === (selected?.annee ? selected.annee - 1 : null));

  const balanceAsOf = (account, cutoffDate) => {
    if (!cutoffDate) return null;
    const base = Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0);
    const movement = lines
      .filter((l) => l.compte_id === account.id && l.ecritures_comptables.date_ecriture <= cutoffDate)
      .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
    return base + movement;
  };

  const resultNet = useMemo(() => {
    if (!selected) return 0;
    let produits = 0; let charges = 0;
    accounts.forEach((a) => {
      const net = lines
        .filter((l) => l.compte_id === a.id && l.ecritures_comptables.date_ecriture >= selected.date_debut && l.ecritures_comptables.date_ecriture <= selected.date_fin)
        .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
      if (a.nature === 'CHARGE') charges += net;
      if (a.nature === 'PRODUIT') produits += -net;
    });
    return produits - charges;
  }, [accounts, lines, selected]);

  const rows = useMemo(() => accounts.map((a) => ({
    ...a,
    netN: balanceAsOf(a, selected?.date_fin),
    netN1: previous ? balanceAsOf(a, previous.date_fin) : null,
  })), [accounts, lines, selected, previous]); // eslint-disable-line react-hooks/exhaustive-deps

  const actifImmoIncorp = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && isNumeroIn(r.numero, ['20', '21']));
  const actifImmoCorp = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && isNumeroIn(r.numero, ['22', '23', '24', '25']));
  const actifImmoFin = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && !isNumeroIn(r.numero, ['20', '21', '22', '23', '24', '25']));
  const actifCirculant = rows.filter((r) => r.nature === 'ACTIF' && (r.classe?.startsWith('Classe 3') || r.classe?.startsWith('Classe 4')));
  const tresorerieActif = rows.filter((r) => r.nature === 'TRESORERIE' && (r.netN || 0) >= 0);

  const capitauxPropres = rows.filter((r) => r.nature === 'PASSIF' && r.classe?.startsWith('Classe 1') && !isNumeroIn(r.numero, ['16', '17', '18']));
  const dettes = rows.filter((r) => r.nature === 'PASSIF' && (isNumeroIn(r.numero, ['16', '17', '18']) || r.classe?.startsWith('Classe 4')));
  const tresoreriePassif = rows.filter((r) => r.nature === 'TRESORERIE' && (r.netN || 0) < 0);

  const sum = (list, key = 'netN') => list.reduce((acc, r) => acc + Math.abs(Number(r[key]) || 0), 0);

  const totalActifImmo = sum(actifImmoIncorp) + sum(actifImmoCorp) + sum(actifImmoFin);
  const totalActif = totalActifImmo + sum(actifCirculant) + sum(tresorerieActif);

  const totalCapitaux = sum(capitauxPropres) + Math.abs(resultNet);
  const totalPassif = totalCapitaux + sum(dettes) + sum(tresoreriePassif);

  const AssetGroup = ({ title, list }) => list.length > 0 && (
    <>
      <tr className="balance-class-row"><td colSpan={3}>{title}</td></tr>
      {list.map((r) => (
        <tr key={r.id}>
          <td className="account-cell">{r.numero}</td>
          <td>{r.libelle}</td>
          <td className="text-right">{dash(r.netN)}</td>
        </tr>
      ))}
    </>
  );

  const LiabilityGroup = ({ title, list, extraLine }) => (list.length > 0 || extraLine) && (
    <>
      <tr className="balance-class-row"><td colSpan={3}>{title}</td></tr>
      {list.map((r) => (
        <tr key={r.id}>
          <td className="account-cell">{r.numero}</td>
          <td>{r.libelle}</td>
          <td className="text-right">{dash(Math.abs(r.netN))}</td>
        </tr>
      ))}
      {extraLine}
    </>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bilan comptable</h1>
          <p className="page-subtitle">Situation patrimoniale à la clôture{loading ? ' · Chargement…' : ''}</p>
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
        <div className="bilan-columns">
          <Card>
            <h2 className="bilan-side-title actif">ACTIF</h2>
            <div className="table-wrap">
              <table className="balance-table">
                <thead><tr><th>Compte</th><th>Libellé</th><th className="text-right">Net (N)</th></tr></thead>
                <tbody>
                  <AssetGroup title="Immobilisations incorporelles" list={actifImmoIncorp} />
                  <AssetGroup title="Immobilisations corporelles" list={actifImmoCorp} />
                  <AssetGroup title="Immobilisations financières" list={actifImmoFin} />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Actif immobilisé</td><td className="text-right">{money(totalActifImmo)}</td></tr>
                  <AssetGroup title="Actif circulant" list={actifCirculant} />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Actif circulant</td><td className="text-right">{money(sum(actifCirculant))}</td></tr>
                  <AssetGroup title="Trésorerie actif" list={tresorerieActif} />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Trésorerie actif</td><td className="text-right">{money(sum(tresorerieActif))}</td></tr>
                  <tr className="balance-total-row"><td colSpan={2}>TOTAL ACTIF</td><td className="text-right">{money(totalActif)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="bilan-side-title passif">PASSIF</h2>
            <div className="table-wrap">
              <table className="balance-table">
                <thead><tr><th>Compte</th><th>Libellé</th><th className="text-right">Montant (N)</th></tr></thead>
                <tbody>
                  <LiabilityGroup
                    title="Capitaux propres"
                    list={capitauxPropres}
                    extraLine={<tr key="resultat"><td className="account-cell">—</td><td>Résultat net de l'exercice</td><td className="text-right">{dash(resultNet)}</td></tr>}
                  />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Capitaux propres</td><td className="text-right">{money(totalCapitaux)}</td></tr>
                  <LiabilityGroup title="Dettes" list={dettes} />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Dettes</td><td className="text-right">{money(sum(dettes))}</td></tr>
                  <LiabilityGroup title="Trésorerie passif" list={tresoreriePassif} />
                  <tr className="balance-subtotal-row"><td colSpan={2}>Total Trésorerie passif</td><td className="text-right">{money(sum(tresoreriePassif))}</td></tr>
                  <tr className="balance-total-row"><td colSpan={2}>TOTAL PASSIF</td><td className="text-right">{money(totalPassif)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {!loading && selected && Math.round(totalActif) !== Math.round(totalPassif) && (
        <div className="message error" role="alert">
          Écart Actif / Passif : {money(Math.abs(totalActif - totalPassif))} FCFA — le bilan n'est pas équilibré (vérifiez vos écritures et la classification des comptes).
        </div>
      )}
    </div>
  );
}
