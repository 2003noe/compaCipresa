import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, Building2, Printer, FileText, Download } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { computeDepreciation } from '../lib/depreciation';
import { useExercice } from '../context/ExerciceContext';
import { useAuth } from '../context/AuthContext';
import { editPhysicalInventory, toast } from '../lib/notifications';
import {
  exportImmobilisationsExcel,
  ImmobilisationsPDFDocument,
  PDFPreviewModal,
  buildPdfFilename,
} from '../lib/generateFile';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const STATUT_LABEL = { EN_SERVICE: 'En service', CEDE: 'Cédé', REFORME: 'Réformé' };
const METHODE_LABEL = { LINEAIRE: 'Linéaire', DEGRESSIF: 'Dégressif', AUCUNE: 'Aucune' };

export default function Immobilisations() {
  const nav = useNavigate();
  const { can, hasRole } = useAuth();
  const physicalOnly = can('STOCK_INVENTORY') && !can('COMPTA_READ');
  const canManageFinancialAssets = can('COMPTA_ASSET_EDIT') || hasRole('ADMIN') || hasRole('GERANT') || hasRole('COMPTABLE');
  const canExport = can('COMPTA_EXPORT') || can('COMPTA_READ') || hasRole('ADMIN') || hasRole('GERANT') || hasRole('COMPTABLE');
  const { selectedExercice, selectedExerciceId, loading: exercicesLoading } = useExercice();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState('Tout');
  const [statut, setStatut] = useState('Tout');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);

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

  const handleDirectPrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportImmobilisationsExcel({
      assets: filtered,
      totals: { brut: totalBrut, amort: totalAmort, vnc: totalVnc },
      exercice: selectedExercice,
      filename: buildPdfFilename('Immobilisations', selectedExercice),
    });
  };

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
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Registre des immobilisations</h1>
          <p className="page-subtitle">Situation des immobilisations au {selectedExercice?.date_fin || '—'} — exercice {selectedExercice?.code || ''}{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canExport && (
            <Button
              variant="secondary"
              icon={Printer}
              onClick={handleDirectPrint}
              disabled={loading || filtered.length === 0}
              title="Imprimer directement le registre via le navigateur"
            >
              Imprimer
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              icon={FileText}
              onClick={() => setShowPDFPreview(true)}
              disabled={loading || filtered.length === 0}
              title="Prévisualiser et exporter en PDF"
            >
              PDF
            </Button>
          )}
          {canExport && (
            <Button
              variant="primary"
              icon={Download}
              onClick={handleExportExcel}
              disabled={loading || filtered.length === 0}
              title="Exporter vers Excel (.xlsx)"
            >
              Excel
            </Button>
          )}
          {canManageFinancialAssets && <Button icon={Plus} onClick={() => nav('/nouvelle-immobilisation')}>Nouvelle immobilisation</Button>}
        </div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <div className="cr-kpis no-print">
        <Card><span className="ledger-summary-label">Valeur brute totale</span><strong>{money(totalBrut)} FCFA</strong></Card>
        <Card><span className="ledger-summary-label">Amortissements cumulés</span><strong>{money(totalAmort)} FCFA</strong></Card>
        <Card className="kpi-highlight"><span className="ledger-summary-label">Valeur nette comptable</span><strong className="positive">{money(totalVnc)} FCFA</strong></Card>
      </div>

      <Card className="immo-screen-card">
        <div className="asset-toolbar no-print">
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
      {/* Document complet pour impression directe A4 Paysage (window.print) */}
      <div className="immo-print-document" style={{ display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #166534', paddingBottom: '10px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
              CIPRESA CONSULTING SARL
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#4b5563' }}>
              Cabinet International de Prestation de Services Agricoles
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              REGISTRE DES IMMOBILISATIONS ET DES AMORTISSEMENTS
            </p>
            <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>
              Système Comptable SYSCOHADA Révisé — Tenue de compte : FCFA
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#334155' }}>
            <p style={{ margin: '0 0 3px' }}><strong>Exercice :</strong> {selectedExercice?.code || selectedExercice?.annee || '—'}</p>
            <p style={{ margin: '0 0 3px' }}>
              <strong>Situation au :</strong> {selectedExercice?.date_fin ? new Date(selectedExercice.date_fin).toLocaleDateString('fr-FR') : '—'}
            </p>
            <p style={{ margin: '0 0 3px' }}>
              <strong>Catégorie :</strong> {categorie} · <strong>Statut :</strong> {statut === 'Tout' ? 'Tous les statuts' : (STATUT_LABEL[statut] || statut)}
            </p>
            <p style={{ margin: 0, color: '#64748b' }}>
              Tiré le : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Synthèse des totaux */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: '4px', marginBottom: '14px', fontSize: '11px' }}>
          <div>
            <strong>Biens enregistrés :</strong> {filtered.length} immobilisation(s)
          </div>
          <div>
            <strong>Valeur Brute Totale :</strong> {money(totalBrut)} FCFA
          </div>
          <div>
            <strong>Amortissements Cumulés :</strong> {money(totalAmort)} FCFA
          </div>
          <div>
            <strong style={{ color: '#166534' }}>Valeur Nette (VNC) :</strong> {money(totalVnc)} FCFA
          </div>
        </div>

        {/* Tableau complet des immobilisations */}
        <table className="immo-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ backgroundColor: '#275a43', color: '#ffffff', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', width: '10%' }}>Code</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', width: '25%' }}>Désignation du bien</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', width: '14%' }}>Catégorie</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', width: '9%' }}>Acquisition</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', textAlign: 'right', width: '12%' }}>Valeur brute</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', textAlign: 'center', width: '8%' }}>Méthode</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', textAlign: 'right', width: '11%' }}>Amort. cumulé</th>
              <th style={{ padding: '6px 8px', border: '1px solid #1e4735', textAlign: 'right', width: '11%' }}>VNC (FCFA)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={a.id || i} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 700, color: '#166534' }}>{a.code}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', fontWeight: 500 }}>{a.designation}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>{a.categorie || '—'}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>{a.date_acquisition ? new Date(a.date_acquisition).toLocaleDateString('fr-FR') : '—'}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace' }}>{money(a.valeur_brute)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '8px' }}>{METHODE_LABEL[a.methode] || a.methode || '—'} {a.duree_annees ? `(${a.duree_annees}a)` : ''}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c' }}>{money(a.amortCumule)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>{money(a.vnc)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  Aucune immobilisation enregistrée pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700, borderTop: '2px solid #000' }}>
              <td colSpan={4} style={{ padding: '6px 8px', border: '1px solid #94a3b8' }}>
                TOTAL GÉNÉRAL ({filtered.length} immobilisation{filtered.length > 1 ? 's' : ''})
              </td>
              <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>{money(totalBrut)}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #94a3b8' }}></td>
              <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c' }}>{money(totalAmort)}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontFamily: 'monospace', color: '#15803d' }}>{money(totalVnc)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Zone visas & signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', pageBreakInside: 'avoid' }}>
          <div style={{ width: '45%', border: '1px solid #94a3b8', padding: '10px', borderRadius: '4px', textAlign: 'center', minHeight: '70px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '10px', color: '#166534' }}>Le Responsable du Patrimoine / Comptable</p>
            <p style={{ margin: '3px 0 0', fontSize: '8px', color: '#64748b' }}>Visa & Date</p>
          </div>
          <div style={{ width: '45%', border: '1px solid #94a3b8', padding: '10px', borderRadius: '4px', textAlign: 'center', minHeight: '70px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '10px', color: '#166534' }}>La Direction Générale</p>
            <p style={{ margin: '3px 0 0', fontSize: '8px', color: '#64748b' }}>Signature & Cachet</p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '8px', color: '#94a3b8', marginTop: '12px' }}>
          Généré par l'application de comptabilité de CIPRESA CONSULTING — Système SYSCOHADA
        </p>
      </div>

      {showPDFPreview && canExport && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Registre des immobilisations"
          subtitle={`Exercice : ${selectedExercice?.code || selectedExercice?.annee || ''}`}
          filename={buildPdfFilename('Immobilisations', selectedExercice)}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <ImmobilisationsPDFDocument
              assets={filtered}
              totals={{ brut: totalBrut, amort: totalAmort, vnc: totalVnc }}
              exercice={selectedExercice}
              orientation={orientation}
            />
          )}
        />
      )}

      {/* Styles d'impression dédiés A4 Paysage */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body, #root, .app-layout, .main-content, .page-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .no-print, .sidebar, header, .app-header, nav, .asset-toolbar {
            display: none !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .immo-screen-card, .cr-kpis {
            display: none !important;
          }
          .immo-print-document {
            display: block !important;
          }
          .immo-print-table {
            width: 100% !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .immo-print-table th {
            background-color: #275a43 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr {
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>
    </div>
  );
}
