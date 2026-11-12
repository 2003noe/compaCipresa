import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, Building2 } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { computeDepreciation } from '../lib/depreciation';
import { useExercice } from '../context/ExerciceContext';
import { useAuth } from '../context/AuthContext';
import { editPhysicalInventory, toast } from '../lib/notifications';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const STATUT_LABEL = { EN_SERVICE: 'En service', CEDE: 'Cédé', REFORME: 'Réformé' };
const METHODE_LABEL = { LINEAIRE: 'Linéaire', DEGRESSIF: 'Dégressif', AUCUNE: 'Aucune' };

export default function Immobilisations() {
  const nav = useNavigate();
  const { can } = useAuth();
  const physicalOnly = can('STOCK_INVENTORY') && !can('COMPTA_READ');
  const canManageFinancialAssets = can('COMPTA_ASSET_EDIT');
  const { selectedExercice, selectedExerciceId, loading: exercicesLoading } = useExercice();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState('Tout');
  const [statut, setStatut] = useState('Tout');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    if (exercicesLoading) return;
    if (!selectedExercice) { setAssets([]); setLoading(false); return; }
    setLoading(true);
    setAssets([]);
    setNotice('');
    let active = true;
    supabase.from(physicalOnly ? 'immobilisations_parc_physique' : 'immobilisations').select('*').eq('exercice_id', selectedExerciceId).order('code').then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(`Impossible de charger le registre : ${error.message}`); setLoading(false); return; }
      setAssets(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [refreshTick, selectedExerciceId, selectedExercice, exercicesLoading, physicalOnly]);

  const withDepreciation = useMemo(() => assets.map((a) => ({ ...a, ...computeDepreciation(a, selectedExercice?.date_fin ? new Date(`${selectedExercice.date_fin}T23:59:59`) : new Date()) })), [assets, refreshTick, selectedExercice]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => ['Tout', ...new Set(assets.map((a) => a.categorie))], [assets]);

  const filtered = withDepreciation.filter((a) => {
    if (categorie !== 'Tout' && a.categorie !== categorie) return false;
    if (statut !== 'Tout' && a.statut !== statut) return false;
    if (search && !`${a.code} ${a.designation}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalBrut = withDepreciation.reduce((acc, a) => acc + Number(a.valeur_brute || 0), 0);
  const totalAmort = withDepreciation.reduce((acc, a) => acc + a.amortCumule, 0);
  const totalVnc = totalBrut - totalAmort;

  const updatePhysicalRecord = async (asset) => {
    const values = await editPhysicalInventory({
      title: `Inventaire physique · ${asset.code}`,
      etat: asset.etat_physique || '',
      emplacement: asset.emplacement_physique || '',
      observation: asset.observation_physique || '',
    });
    if (!values) return;
    const { error } = await supabase.rpc('update_asset_physical_inventory', {
      p_id: asset.id, p_etat: values.etat, p_emplacement: values.emplacement,
      p_date: new Date().toISOString().slice(0, 10), p_observation: values.observation,
    });
    if (error) { setNotice(error.message); toast.error('Mise à jour impossible', error.message); }
    else { setRefreshTick((tick) => tick + 1); toast.success('Inventaire mis à jour', asset.designation); }
  };

  /* ── Vue inventaire physique (accès limité) ── */
  if (physicalOnly) return (
    <div className="page-content">
      <div className="page-header"><div><h1 className="page-title">Inventaire physique des biens</h1><p className="page-subtitle">État, emplacement et observations · Exercice {selectedExercice?.code || ''}</p></div></div>
      {notice && <div className="message error" role="alert">{notice}</div>}
      <Card><div className="table-wrap"><table className="balance-table"><thead><tr><th>Code</th><th>Désignation</th><th>Catégorie</th><th>État physique</th><th>Emplacement</th><th>Dernier inventaire</th><th>Observation</th><th /></tr></thead><tbody>
        {assets.map((asset) => <tr key={asset.id}><td>{asset.code}</td><td>{asset.designation}</td><td>{asset.categorie}</td><td>{asset.etat_physique || 'À inventorier'}</td><td>{asset.emplacement_physique || '—'}</td><td>{asset.date_inventaire_physique || '—'}</td><td>{asset.observation_physique || '—'}</td><td><Button size="sm" variant="secondary" onClick={() => updatePhysicalRecord(asset)}>Mettre à jour</Button></td></tr>)}
        {!assets.length && !loading && <tr><td colSpan={8}>Aucun bien enregistré pour cet exercice.</td></tr>}
      </tbody></table></div></Card>
    </div>
  );

  /* ── Vue complète registre des immobilisations ── */
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Registre des immobilisations</h1>
          <p className="page-subtitle">Situation des immobilisations au {selectedExercice?.date_fin || '—'} — exercice {selectedExercice?.code || ''}{loading ? ' · Chargement…' : ''}</p>
        </div>
        {canManageFinancialAssets && <Button icon={Plus} onClick={() => nav('/nouvelle-immobilisation')}>Nouvelle immobilisation</Button>}
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <div className="cr-kpis">
        <Card><span className="ledger-summary-label">Valeur brute totale</span><strong>{money(totalBrut)} FCFA</strong></Card>
        <Card><span className="ledger-summary-label">Amortissements cumulés</span><strong>{money(totalAmort)} FCFA</strong></Card>
        <Card className="kpi-highlight"><span className="ledger-summary-label">Valeur nette comptable</span><strong className="positive">{money(totalVnc)} FCFA</strong></Card>
      </div>

      <Card>
        <div className="asset-toolbar">
          <div className="toolbar-search"><Search size={14} /><input placeholder="Rechercher une immobilisation..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input select asset-filter" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>Catégorie : {c}</option>)}
          </select>
          <select className="input select asset-filter" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="Tout">Statut : Tout</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>Statut : {v}</option>)}
          </select>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setRefreshTick((t) => t + 1)}>Calculer les amortissements</Button>
        </div>

        <div className="table-wrap">
          <table className="balance-table asset-table">
            <thead>
              <tr>
                <th>Code</th><th>Désignation</th><th>Catégorie</th><th>Acquisition</th>
                <th className="text-right">Valeur brute</th><th>Durée</th><th>Méthode</th>
                <th className="text-right">Amort. cumulé</th><th className="text-right">VNC (FCFA)</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="clickable-row"
                  onClick={() => setSelectedAsset(a)}
                  title="Cliquer pour afficher les détails de l'immobilisation"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="account-cell">{a.code}</td>
                  <td>{a.designation}</td>
                  <td>{a.categorie}</td>
                  <td>{new Date(a.date_acquisition).toLocaleDateString('fr-FR')}</td>
                  <td className="text-right font-mono">{money(a.valeur_brute)}</td>
                  <td>{a.duree_annees ? `${a.duree_annees} ans` : '—'}</td>
                  <td>{METHODE_LABEL[a.methode]}</td>
                  <td className="text-right font-mono">{money(a.amortCumule)}</td>
                  <td className="text-right font-mono"><strong>{money(a.vnc)}</strong></td>
                  <td><Badge tone={a.statut === 'EN_SERVICE' ? 'success' : 'danger'}>{STATUT_LABEL[a.statut]}</Badge></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                  {loading ? 'Chargement…' : 'Aucune immobilisation ne correspond à ces filtres.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedAsset && (
        <Modal
          isOpen={Boolean(selectedAsset)}
          onClose={() => setSelectedAsset(null)}
          title="Fiche d'immobilisation"
          subtitle={`${selectedAsset.code} — ${selectedAsset.designation}`}
          icon={Building2}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedAsset(null)}>Fermer</Button>
          }
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Code actif</span>
              <span className="detail-value font-mono">{selectedAsset.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Catégorie</span>
              <span className="detail-value">{selectedAsset.categorie}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Désignation du bien</span>
              <span className="detail-value" style={{ fontWeight: 600 }}>{selectedAsset.designation}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Date d'acquisition</span>
              <span className="detail-value">{new Date(selectedAsset.date_acquisition).toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Méthode d'amortissement</span>
              <span className="detail-value">{METHODE_LABEL[selectedAsset.methode] || selectedAsset.methode}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Durée d'amortissement</span>
              <span className="detail-value">{selectedAsset.duree_annees ? `${selectedAsset.duree_annees} ans` : '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Statut comptable</span>
              <div>
                <Badge tone={selectedAsset.statut === 'EN_SERVICE' ? 'success' : 'danger'}>
                  {STATUT_LABEL[selectedAsset.statut] || selectedAsset.statut}
                </Badge>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Valeur d'origine (brute)</span>
              <span className="detail-value font-mono" style={{ fontSize: '15px' }}>{money(selectedAsset.valeur_brute)} FCFA</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Amortissements cumulés</span>
              <span className="detail-value font-mono" style={{ color: '#b91c1c' }}>{money(selectedAsset.amortCumule)} FCFA</span>
            </div>
            <div className="detail-item full-width" style={{ background: 'var(--color-primary-light, #eef7f2)', padding: '12px 16px', borderRadius: '8px' }}>
              <span className="detail-label" style={{ color: 'var(--color-primary-dark, #1b4332)' }}>Valeur Nette Comptable (VNC)</span>
              <span className="detail-value font-mono" style={{ color: 'var(--color-primary, #275a43)', fontSize: '18px', fontWeight: 700 }}>
                {money(selectedAsset.vnc)} FCFA
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
