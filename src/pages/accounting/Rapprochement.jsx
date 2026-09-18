import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const DATE_TOLERANCE_DAYS = 5;
const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

export default function Rapprochement() {
  const [accounts, setAccounts] = useState([]);
  const [compteId, setCompteId] = useState('');
  const [releve, setReleve] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [soldeReleve, setSoldeReleve] = useState('0');
  const [newLine, setNewLine] = useState({ date: '', libelle: '', debit: '0', credit: '0' });

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    supabase.from('comptes_comptables').select('id,numero,libelle,solde_ouverture_debit,solde_ouverture_credit').eq('nature', 'TRESORERIE').order('numero').then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger les comptes : ${error.message}`); setLoading(false); return; }
      setAccounts(data || []);
      if (data?.length) setCompteId(data[0].id);
      else setLoading(false);
    });
  }, []);

  const loadData = async (accId) => {
    if (!accId) return;
    setLoading(true);
    const [rel, ec] = await Promise.all([
      supabase.from('lignes_releve_bancaire').select('*').eq('compte_id', accId).order('date_operation'),
      supabase.from('lignes_ecritures').select('id,debit,credit,ecritures_comptables(date_ecriture,libelle,statut)').eq('compte_id', accId),
    ]);
    if (rel.error || ec.error) { setNotice(`Impossible de charger les données : ${(rel.error || ec.error).message}`); setLoading(false); return; }
    setReleve(rel.data || []);
    setEcritures((ec.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
    setLoading(false);
  };

  useEffect(() => { if (compteId) loadData(compteId); }, [compteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchedEcritureIds = useMemo(() => new Set(releve.filter((r) => r.ligne_ecriture_id).map((r) => r.ligne_ecriture_id)), [releve]);
  const unmatchedReleve = releve.filter((r) => !r.rapproche);
  const unmatchedEcritures = ecritures.filter((e) => !matchedEcritureIds.has(e.id));
  const rapprochesCount = releve.filter((r) => r.rapproche).length;

  const addLine = async () => {
    if (!newLine.date || !newLine.libelle.trim()) { setNotice('Renseignez au moins une date et un libellé pour la ligne de relevé.'); return; }
    const { error } = await supabase.from('lignes_releve_bancaire').insert({
      compte_id: compteId, date_operation: newLine.date, libelle: newLine.libelle.trim(),
      debit: Number(newLine.debit) || 0, credit: Number(newLine.credit) || 0,
    });
    if (error) { setNotice(error.message); return; }
    setNewLine({ date: '', libelle: '', debit: '0', credit: '0' });
    loadData(compteId);
  };

  const lancerRapprochement = async () => {
    setWorking(true);
    setNotice('');
    let matches = 0;

    for (const r of unmatchedReleve) {
      const releveSigned = Number(r.debit || 0) - Number(r.credit || 0);
      const candidate = unmatchedEcritures.find((e) => {
        if (matchedEcritureIds.has(e.id)) return false;
        const ecritureSigned = Number(e.debit || 0) - Number(e.credit || 0);
        return ecritureSigned === releveSigned && dayDiff(r.date_operation, e.ecritures_comptables.date_ecriture) <= DATE_TOLERANCE_DAYS;
      });
      if (candidate) {
        matchedEcritureIds.add(candidate.id);
        await supabase.from('lignes_releve_bancaire').update({ rapproche: true, ligne_ecriture_id: candidate.id }).eq('id', r.id);
        matches += 1;
      }
    }

    setWorking(false);
    setNotice(matches > 0 ? `${matches} ligne(s) rapprochée(s) automatiquement.` : 'Aucune correspondance trouvée — vérifiez les montants et les dates.');
    loadData(compteId);
  };

  const validerRapprochement = async () => {
    setWorking(true);
    const { error } = await supabase.from('lignes_releve_bancaire').update({ valide: true }).eq('compte_id', compteId).eq('rapproche', true);
    setWorking(false);
    if (error) { setNotice(error.message); return; }
    setNotice('Rapprochement validé.');
    loadData(compteId);
  };

  const soldeComptable = useMemo(() => {
    const account = accounts.find((a) => a.id === compteId);
    if (!account) return 0;
    const base = Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0);
    const mvt = ecritures.reduce((acc, e) => acc + Number(e.debit || 0) - Number(e.credit || 0), 0);
    return base + mvt;
  }, [accounts, compteId, ecritures]);

  const sumSigned = (list, kind) => list.reduce((acc, item) => acc + (kind === 'releve' ? Number(item.debit || 0) - Number(item.credit || 0) : Number(item.debit || 0) - Number(item.credit || 0)), 0);
  const nonRapprochesReleveTotal = sumSigned(unmatchedReleve, 'releve');
  const nonRapprochesErpTotal = sumSigned(unmatchedEcritures, 'ecriture');
  const soldeAjuste = Number(soldeReleve || 0) + nonRapprochesReleveTotal - nonRapprochesErpTotal;
  const ecartResiduel = soldeAjuste - soldeComptable;

  const selectedAccount = accounts.find((a) => a.id === compteId);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapprochement Bancaire</h1>
          <p className="page-subtitle">Rapprochez le relevé bancaire et vos écritures comptables{loading ? ' · Chargement…' : ''}</p>
        </div>
      </div>

      <Card className="ledger-toolbar">
        <Select label="Compte de trésorerie" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
          {accounts.length === 0 && <option value="">Aucun compte</option>}
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.numero} - {a.libelle}</option>)}
        </Select>
        <Input label="Solde relevé (fin de période)" type="number" step="0.01" value={soldeReleve} onChange={(e) => setSoldeReleve(e.target.value)} />
        <Button icon={RefreshCw} onClick={lancerRapprochement} disabled={working || !compteId}>{working ? 'Traitement…' : 'Lancer le rapprochement'}</Button>
      </Card>

      {notice && <div className="message error" role="alert">{notice}</div>}

      {!loading && selectedAccount && (
        <>
          <div className="rappro-stats">
            <div className="rappro-chip success"><span className="dot ok" /><div><small>Rapprochés</small><strong>{rapprochesCount} écritures</strong></div></div>
            <div className="rappro-chip neutral"><span className="dot warn" /><div><small>En attente</small><strong>{unmatchedReleve.length + unmatchedEcritures.length} écritures</strong></div></div>
            <div className="rappro-chip danger"><span className="dot bad" /><div><small>Écarts détectés</small><strong>{unmatchedEcritures.length} alertes</strong></div></div>
          </div>

          <div className="rappro-columns">
            <Card>
              <h2 className="bilan-side-title">Relevé bancaire ({selectedAccount.numero})</h2>
              <div className="table-wrap">
                <table className="balance-table">
                  <thead><tr><th>Date</th><th>Détails</th><th className="text-right">Débit</th><th className="text-right">Crédit</th></tr></thead>
                  <tbody>
                    {releve.map((r) => (
                      <tr key={r.id} className={r.rapproche ? 'row-matched' : 'row-pending'}>
                        <td>{new Date(r.date_operation).toLocaleDateString('fr-FR')}</td>
                        <td>{r.libelle}</td>
                        <td className="text-right">{r.debit ? money(r.debit) : ''}</td>
                        <td className="text-right">{r.credit ? money(r.credit) : ''}</td>
                      </tr>
                    ))}
                    {releve.length === 0 && <tr><td colSpan={4}>Aucune ligne de relevé saisie.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="rappro-add-line">
                <Input label="Date" type="date" value={newLine.date} onChange={(e) => setNewLine((n) => ({ ...n, date: e.target.value }))} />
                <Input label="Détails" placeholder="Ex: VIR. RECU MIN AGRI" value={newLine.libelle} onChange={(e) => setNewLine((n) => ({ ...n, libelle: e.target.value }))} />
                <Input label="Débit" type="number" step="0.01" value={newLine.debit} onChange={(e) => setNewLine((n) => ({ ...n, debit: e.target.value }))} />
                <Input label="Crédit" type="number" step="0.01" value={newLine.credit} onChange={(e) => setNewLine((n) => ({ ...n, credit: e.target.value }))} />
                <Button size="sm" icon={Plus} onClick={addLine}>Ajouter</Button>
              </div>
            </Card>

            <Card>
              <h2 className="bilan-side-title">Écritures comptables (ERP)</h2>
              <div className="table-wrap">
                <table className="balance-table">
                  <thead><tr><th>Date</th><th>Libellé écriture</th><th className="text-right">Débit</th><th className="text-right">Crédit</th></tr></thead>
                  <tbody>
                    {ecritures.map((e) => (
                      <tr key={e.id} className={matchedEcritureIds.has(e.id) ? 'row-matched' : 'row-pending'}>
                        <td>{new Date(e.ecritures_comptables.date_ecriture).toLocaleDateString('fr-FR')}</td>
                        <td>{e.ecritures_comptables.libelle}</td>
                        <td className="text-right">{e.debit ? money(e.debit) : ''}</td>
                        <td className="text-right">{e.credit ? money(e.credit) : ''}</td>
                      </tr>
                    ))}
                    {ecritures.length === 0 && <tr><td colSpan={4}>Aucune écriture validée sur ce compte.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h2 className="bilan-side-title">Résumé du rapprochement</h2>
              <div className="rappro-summary">
                <div><span>Solde relevé bancaire (Fin de période)</span><strong>{money(soldeReleve)} FCFA</strong></div>
                <div><span>Écritures non rapprochées relevé (+)</span><strong className="positive">+ {money(nonRapprochesReleveTotal)} FCFA</strong></div>
                <div><span>Écritures non rapprochées ERP (-)</span><strong className="negative-amount">- {money(nonRapprochesErpTotal)} FCFA</strong></div>
                <div className="rappro-line-strong"><span>Solde comptable ajusté</span><strong>{money(soldeAjuste)} FCFA</strong></div>
                <div className={`rappro-line-strong ${Math.round(ecartResiduel) !== 0 ? 'danger' : 'success'}`}>
                  <span>Écart résiduel</span><strong>{money(Math.abs(ecartResiduel))} FCFA</strong>
                </div>
              </div>
              <Button icon={CheckCircle2} className="w-full" disabled={working || Math.round(ecartResiduel) !== 0 || rapprochesCount === 0} onClick={validerRapprochement}>
                Valider le rapprochement
              </Button>
              {Math.round(ecartResiduel) !== 0 && <p className="page-subtitle" style={{ marginTop: 8 }}>La validation est désactivée tant qu'il reste un écart résiduel.</p>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
