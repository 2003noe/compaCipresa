import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bell } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { calculerEcheance, STATUT_LABEL, STATUT_TONE, PERIODICITE_LABEL, money, dateFr } from '../../lib/tva';

const TABS = [
  { key: 'declarations', label: 'Déclarations TVA' },
  { key: 'impots', label: 'Impôts & taxes' },
  { key: 'historique', label: 'Historique' },
];

export default function TvaTaxes() {
  const nav = useNavigate();
  const [tab, setTab] = useState('declarations');
  const [exercices, setExercices] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [declarations, setDeclarations] = useState([]);
  const [allDeclarations, setAllDeclarations] = useState([]);
  const [regles, setRegles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin,statut').order('annee', { ascending: false }).then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger les exercices : ${error.message}`); setLoading(false); return; }
      setExercices(data || []);
      if (data?.length) setExerciceId(data[0].id); else setLoading(false);
    });
    supabase.from('regles_echeances_fiscales').select('*').eq('actif', true).then(({ data, error }) => {
      if (!error) setRegles(data || []);
    });
    supabase.from('declarations_tva').select('*').order('periode_fin', { ascending: false }).then(({ data, error }) => {
      if (!error) setAllDeclarations(data || []);
    });
  }, []);

  const loadDeclarations = (excId) => {
    if (!excId) return;
    setLoading(true);
    supabase.from('declarations_tva').select('*').eq('exercice_id', excId).order('periode_debut', { ascending: false }).then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger les déclarations : ${error.message}`); setLoading(false); return; }
      setDeclarations(data || []);
      setLoading(false);
    });
  };

  useEffect(() => { if (exerciceId) loadDeclarations(exerciceId); }, [exerciceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCollectee = declarations.reduce((a, d) => a + Number(d.tva_collectee || 0), 0);
  const totalDeductible = declarations.reduce((a, d) => a + Number(d.tva_deductible || 0), 0);
  const totalNette = totalCollectee - totalDeductible;

  const soumettre = async (decl) => {
    setWorking(decl.id);
    const { error } = await supabase.from('declarations_tva').update({ statut: 'DECLAREE', date_declaration: new Date().toISOString().slice(0, 10) }).eq('id', decl.id);
    setWorking('');
    if (error) { setNotice(error.message); return; }
    loadDeclarations(exerciceId);
  };

  // Prochaines échéances : déclarations TVA non soldées + obligations à date fixe, calculées via les règles configurables.
  const echeances = useMemo(() => {
    const items = [];
    allDeclarations.filter((d) => d.date_echeance && !['DECLAREE', 'PAYEE'].includes(d.statut)).forEach((d) => {
      items.push({ id: `decl-${d.id}`, titre: `Déclaration TVA ${d.periode_libelle}`, date: d.date_echeance, description: 'Dépôt et paiement de la TVA collectée sur la période.' });
    });
    regles.filter((r) => r.categorie === 'AUTRE').forEach((r) => {
      items.push({ id: `regle-${r.id}`, titre: r.libelle, date: calculerEcheance(null, r), description: r.description || '' });
    });
    return items.filter((i) => i.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [allDeclarations, regles]);

  const isSoon = (d) => { const diff = (new Date(d) - new Date()) / 86400000; return diff <= 30; };

  const historique = allDeclarations.filter((d) => ['DECLAREE', 'PAYEE'].includes(d.statut));
  const impots = regles.filter((r) => r.categorie === 'AUTRE');

  const renderTable = (rows) => (
    <div className="table-wrap">
      <table className="balance-table">
        <thead>
          <tr>
            <th>Période</th><th>Type</th><th className="text-right">Base imposable</th>
            <th className="text-right">TVA collectée</th><th className="text-right">TVA déductible</th>
            <th className="text-right">TVA nette</th><th>Statut</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.periode_libelle}</td>
              <td>{PERIODICITE_LABEL[d.periodicite]}</td>
              <td className="text-right">{money(d.base_imposable)}</td>
              <td className="text-right">{money(d.tva_collectee)}</td>
              <td className="text-right">{money(d.tva_deductible)}</td>
              <td className="text-right"><strong>{money(d.tva_nette)}</strong></td>
              <td><Badge tone={STATUT_TONE[d.statut]}>{STATUT_LABEL[d.statut]}</Badge></td>
              <td>
                <div className="row-actions">
                  <Button variant="secondary" size="sm" onClick={() => nav(`/tva-taxes/${d.id}`)}>Voir</Button>
                  {['BROUILLON', 'EN_ATTENTE'].includes(d.statut) && (
                    <Button size="sm" disabled={working === d.id} onClick={() => soumettre(d)}>{working === d.id ? '…' : 'Soumettre'}</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8}>Aucune déclaration pour cette sélection.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">TVA &amp; Taxes</h1>
          <p className="page-subtitle">Suivi des déclarations de TVA et des échéances fiscales{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
            {exercices.length === 0 && <option value="">Aucun exercice</option>}
            {exercices.map((e) => <option key={e.id} value={e.id}>Exercice {e.code || e.annee}</option>)}
          </Select>
          <Button icon={Plus} onClick={() => nav('/nouvelle-tva')}>Nouvelle déclaration</Button>
        </div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <div className="cr-kpis">
        <Card><span className="ledger-summary-label">TVA collectée</span><strong>{money(totalCollectee)} FCFA</strong></Card>
        <Card><span className="ledger-summary-label">TVA déductible</span><strong>{money(totalDeductible)} FCFA</strong></Card>
        <Card className="kpi-highlight"><span className="ledger-summary-label">TVA à reverser</span><strong className="positive">{money(totalNette)} FCFA</strong></Card>
      </div>

      <div className="tva-layout">
        <Card>
          <div className="tab-bar">
            {TABS.map((t) => <button key={t.key} type="button" className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
          </div>

          {tab === 'declarations' && renderTable(declarations)}

          {tab === 'historique' && renderTable(historique)}

          {tab === 'impots' && (
            <div className="echeances-list">
              <div className="tva-warning">Les dates ci-dessous sont calculées à partir de règles par défaut (voir Paramètres) — à confirmer avec votre comptable ou la DGI avant toute échéance réelle.</div>
              {impots.map((r) => (
                <div className="echeance-item" key={r.id}>
                  <div className="echeance-head">
                    <strong>{r.libelle}</strong>
                    <span className={`echeance-date ${isSoon(calculerEcheance(null, r)) ? 'soon' : 'normal'}`}>{dateFr(calculerEcheance(null, r))}</span>
                  </div>
                  <p>{r.description}</p>
                </div>
              ))}
              {impots.length === 0 && <p className="page-subtitle">Aucune autre obligation fiscale configurée.</p>}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-heading">
            <div>
              <h2>Prochaines échéances fiscales</h2>
              <p>Calendrier de dépôt et de paiement réglementaire</p>
            </div>
            <Bell size={16} />
          </div>
          <div className="echeances-list">
            {echeances.map((e) => (
              <div className="echeance-item" key={e.id}>
                <div className="echeance-head">
                  <strong>{e.titre}</strong>
                  <span className={`echeance-date ${isSoon(e.date) ? 'soon' : 'normal'}`}>{dateFr(e.date)}</span>
                </div>
                <p>{e.description}</p>
              </div>
            ))}
            {echeances.length === 0 && <p className="page-subtitle">Aucune échéance à venir.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
