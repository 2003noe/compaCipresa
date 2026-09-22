import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { STATUT_LABEL, STATUT_TONE, PERIODICITE_LABEL, money, dateFr } from '../../lib/tva';

export default function TvaDeclarationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [decl, setDecl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const load = () => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    supabase.from('declarations_tva').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) { setNotice(error.message); setLoading(false); return; }
      setDecl(data);
      setLoading(false);
    });
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const marquer = async (statut, dateField) => {
    setWorking(true);
    const payload = { statut, [dateField]: new Date().toISOString().slice(0, 10) };
    const { error } = await supabase.from('declarations_tva').update(payload).eq('id', id);
    setWorking(false);
    if (error) { setNotice(error.message); return; }
    load();
  };

  if (loading) return <div className="page-content"><p className="page-subtitle">Chargement…</p></div>;
  if (!decl) return <div className="page-content">{notice && <div className="message error">{notice}</div>}<Button variant="secondary" onClick={() => nav('/tva-taxes')}>Retour</Button></div>;

  return (
    <div className="page-content form-page asset-form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Déclaration TVA — {decl.periode_libelle}</h1>
          <p className="page-subtitle">{PERIODICITE_LABEL[decl.periodicite]} · <Badge tone={STATUT_TONE[decl.statut]}>{STATUT_LABEL[decl.statut]}</Badge></p>
        </div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <Card>
        <div className="form-section precise-section">
          <h2>Montants</h2>
          <div className="detail-grid">
            <div className="item"><span>Base imposable</span><strong>{money(decl.base_imposable)} FCFA</strong></div>
            <div className="item"><span>TVA collectée</span><strong>{money(decl.tva_collectee)} FCFA</strong></div>
            <div className="item"><span>TVA déductible</span><strong>{money(decl.tva_deductible)} FCFA</strong></div>
            <div className="item"><span>TVA nette</span><strong className="positive">{money(decl.tva_nette)} FCFA</strong></div>
          </div>
        </div>
        <div className="form-section precise-section">
          <h2>Dates &amp; référence</h2>
          <div className="detail-grid">
            <div className="item"><span>Période</span><strong>{dateFr(decl.periode_debut)} → {dateFr(decl.periode_fin)}</strong></div>
            <div className="item"><span>Échéance</span><strong>{dateFr(decl.date_echeance)}</strong></div>
            <div className="item"><span>Date de déclaration</span><strong>{dateFr(decl.date_declaration)}</strong></div>
            <div className="item"><span>Date de paiement</span><strong>{dateFr(decl.date_paiement)}</strong></div>
            <div className="item"><span>Référence de dépôt</span><strong>{decl.reference_declaration || '—'}</strong></div>
          </div>
          {decl.notes && <p className="page-subtitle" style={{ marginTop: 16 }}>{decl.notes}</p>}
        </div>

        <div className="form-actions left-actions">
          <Button variant="secondary" disabled={working} onClick={() => nav('/tva-taxes')}>Retour</Button>
          {['BROUILLON', 'EN_ATTENTE'].includes(decl.statut) && (
            <Button disabled={working} onClick={() => marquer('DECLAREE', 'date_declaration')}>{working ? '…' : 'Marquer comme déclarée'}</Button>
          )}
          {decl.statut === 'DECLAREE' && (
            <Button disabled={working} onClick={() => marquer('PAYEE', 'date_paiement')}>{working ? '…' : 'Marquer comme payée'}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
