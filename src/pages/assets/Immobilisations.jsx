import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { computeDepreciation } from '../../lib/depreciation';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const STATUT_LABEL = { EN_SERVICE: 'En service', CEDE: 'Cédé', REFORME: 'Réformé' };
const METHODE_LABEL = { LINEAIRE: 'Linéaire', DEGRESSIF: 'Dégressif', AUCUNE: 'Aucune' };

export default function Immobilisations() {
  const nav = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState('Tout');
  const [statut, setStatut] = useState('Tout');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    supabase.from('immobilisations').select('*').order('code').then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger le registre : ${error.message}`); setLoading(false); return; }
      setAssets(data || []);
      setLoading(false);
    });
  }, [refreshTick]);

  const withDepreciation = useMemo(() => assets.map((a) => ({ ...a, ...computeDepreciation(a) })), [assets, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Registre des immobilisations</h1>
          <p className="page-subtitle">Suivi des actifs immobilisés et de leurs amortissements{loading ? ' · Chargement…' : ''}</p>
        </div>
        <Button icon={Plus} onClick={() => nav('/nouvelle-immobilisation')}>Nouvelle immobilisation</Button>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <div className="cr-kpis">
        <Card><span className="ledger-summary-label">Valeur brute totale</span><strong>{money(totalBrut)} FCFA</strong></Card>
        <Card><span className="ledger-summary-label">Amortissements cumulés</span><strong>{money(totalAmort)} FCFA</strong></Card>
        <Card className="kpi-highlight"><span className="ledger-summary-label">Valeur nette comptable</span><strong className="positive">{money(totalVnc)} FCFA</strong></Card>
      </div>

      <Card>
        <div className="asset-toolbar">
          <div className="toolbar-search"><Search size={14} /><input placeholder="Rechercher immo..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input select asset-filter" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>Catégorie : {c}</option>)}
          </select>
          <select className="input select asset-filter" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="Tout">Statut : Tout</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>Statut : {v}</option>)}
          </select>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setRefreshTick((t) => t + 1)}>Calculer amortissements</Button>
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
                <tr key={a.id}>
                  <td className="account-cell">{a.code}</td>
                  <td>{a.designation}</td>
                  <td>{a.categorie}</td>
                  <td>{new Date(a.date_acquisition).toLocaleDateString('fr-FR')}</td>
                  <td className="text-right">{money(a.valeur_brute)}</td>
                  <td>{a.duree_annees ? `${a.duree_annees} ans` : '-'}</td>
                  <td>{METHODE_LABEL[a.methode]}</td>
                  <td className="text-right">{money(a.amortCumule)}</td>
                  <td className="text-right"><strong>{money(a.vnc)}</strong></td>
                  <td><span className={`badge-pill ${a.statut === 'EN_SERVICE' ? 'success' : 'danger'}`}>{STATUT_LABEL[a.statut]}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10}>Aucune immobilisation ne correspond à ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
