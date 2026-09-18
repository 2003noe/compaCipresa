import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const isCaisse = (numero) => (numero || '').startsWith('57');

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Tresorerie() {
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }

    supabase.from('comptes_comptables').select('id,numero,libelle,solde_ouverture_debit,solde_ouverture_credit').eq('nature', 'TRESORERIE').order('numero').then(({ data: accs, error: accErr }) => {
      if (accErr) { setNotice(`Impossible de charger les comptes de trésorerie : ${accErr.message}`); setLoading(false); return; }
      setAccounts(accs || []);
      const ids = (accs || []).map((a) => a.id);
      if (ids.length === 0) { setLoading(false); return; }

      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(date_ecriture,numero,libelle,statut)').in('compte_id', ids).then(({ data: ln, error: lnErr }) => {
        if (lnErr) { setNotice(`Impossible de charger les mouvements : ${lnErr.message}`); setLoading(false); return; }
        setLines((ln || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
        setLoading(false);
      });
    });
  }, []);

  const accountBalances = useMemo(() => accounts.map((a) => {
    const base = Number(a.solde_ouverture_debit || 0) - Number(a.solde_ouverture_credit || 0);
    const mvt = lines.filter((l) => l.compte_id === a.id).reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
    return { ...a, balance: base + mvt, caisse: isCaisse(a.numero) };
  }), [accounts, lines]);

  const soldeBanque = accountBalances.filter((a) => !a.caisse).reduce((acc, a) => acc + a.balance, 0);
  const soldeCaisse = accountBalances.filter((a) => a.caisse).reduce((acc, a) => acc + a.balance, 0);
  const disponibilites = soldeBanque + soldeCaisse;

  const movements = useMemo(() => lines
    .filter((l) => l.ecritures_comptables)
    .map((l) => {
      const account = accounts.find((a) => a.id === l.compte_id);
      const debit = Number(l.debit || 0); const credit = Number(l.credit || 0);
      return {
        date: l.ecritures_comptables.date_ecriture,
        type: debit > 0 ? 'Encaissement' : 'Décaissement',
        libelle: l.ecritures_comptables.libelle,
        compte: account?.libelle || '—',
        montant: debit > 0 ? debit : -credit,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10), [lines, accounts]);

  const monthlyFlows = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getMonth()], entrees: 0, sorties: 0 });
    }
    lines.forEach((l) => {
      const date = l.ecritures_comptables?.date_ecriture;
      if (!date) return;
      const key = date.slice(0, 7);
      const bucket = buckets.find((b) => b.key === key);
      if (!bucket) return;
      bucket.entrees += Number(l.debit || 0);
      bucket.sorties += Number(l.credit || 0);
    });
    return buckets;
  }, [lines]);

  const maxFlow = Math.max(1, ...monthlyFlows.flatMap((b) => [b.entrees, b.sorties]));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suivi de Trésorerie</h1>
          <p className="page-subtitle">Vue d'ensemble des disponibilités{loading ? ' · Chargement…' : ''}</p>
        </div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      {!loading && (
        <>
          <div className="cr-kpis tresor-kpis">
            <Card><span className="ledger-summary-label">Solde de banque global</span><strong>{money(soldeBanque)} FCFA</strong><small>Comptes professionnels</small></Card>
            <Card><span className="ledger-summary-label">Solde caisse principale</span><strong>{money(soldeCaisse)} FCFA</strong><small>Espèces disponibles</small></Card>
            <Card><span className="ledger-summary-label">Disponibilités totales</span><strong className="positive">{money(disponibilites)} FCFA</strong><small>Trésorerie immédiatement mobilisable</small></Card>
          </div>

          <div className="tresor-columns">
            <Card>
              <h2 className="bilan-side-title">Flux de trésorerie mensuels</h2>
              <p className="page-subtitle" style={{ marginBottom: 20 }}>Encaissements vs Décaissements (FCFA)</p>
              <div className="flow-chart">
                {monthlyFlows.map((b) => (
                  <div className="flow-bar-group" key={b.key}>
                    <div className="flow-bars">
                      <div className="flow-bar entree" style={{ height: `${(b.entrees / maxFlow) * 100}%` }} title={`Entrées : ${money(b.entrees)}`} />
                      <div className="flow-bar sortie" style={{ height: `${(b.sorties / maxFlow) * 100}%` }} title={`Sorties : ${money(b.sorties)}`} />
                    </div>
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="flow-legend"><span><i className="dot entree" /> Entrées</span><span><i className="dot sortie" /> Sorties</span></div>
            </Card>

            <Card>
              <h2 className="bilan-side-title">Comptes de trésorerie</h2>
              <div className="tresor-account-list">
                {accountBalances.map((a) => (
                  <div className="tresor-account-row" key={a.id}>
                    <span className={`dot ${a.caisse ? 'warn' : 'ok'}`} />
                    <div className="tresor-account-info">
                      <strong>{a.libelle}</strong>
                      <small>{a.numero}{a.caisse ? ' · Caisse' : ' · Banque'}</small>
                    </div>
                    <strong>{money(a.balance)} FCFA</strong>
                  </div>
                ))}
                {accountBalances.length === 0 && <p className="page-subtitle">Aucun compte de trésorerie dans le plan comptable.</p>}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="bilan-side-title">Derniers mouvements de trésorerie</h2>
            <div className="table-wrap">
              <table className="balance-table">
                <thead><tr><th>Date</th><th>Type</th><th>Libellé du mouvement</th><th>Compte</th><th className="text-right">Montant (FCFA)</th></tr></thead>
                <tbody>
                  {movements.map((m, i) => (
                    <tr key={i}>
                      <td>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                      <td><span className={`badge-pill ${m.type === 'Encaissement' ? 'success' : 'danger'}`}>{m.type}</span></td>
                      <td>{m.libelle}</td>
                      <td>{m.compte}</td>
                      <td className={`text-right ${m.montant >= 0 ? 'positive' : 'negative-amount'}`}>{m.montant >= 0 ? '+' : ''}{money(m.montant)}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && <tr><td colSpan={5}>Aucun mouvement de trésorerie validé pour le moment.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
