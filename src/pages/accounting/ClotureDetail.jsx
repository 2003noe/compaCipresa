import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Toggle from '../../components/ui/Toggle';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { STATUT_LABEL, STATUT_TONE, CONTROLE_STATUT_LABEL, dateFr } from '../../lib/clotures';

export default function ClotureDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [cloture, setCloture] = useState(null);
  const [controles, setControles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);

  const load = () => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    Promise.all([
      supabase.from('clotures_comptables').select('*').eq('id', id).maybeSingle(),
      supabase.from('controles_cloture').select('*, referentiel_controles_cloture(numero,controle,frequence,responsable_type,justificatif_attendu)').eq('cloture_id', id),
    ]).then(([cRes, ctrlRes]) => {
      if (cRes.error || ctrlRes.error) { setNotice((cRes.error || ctrlRes.error).message); setLoading(false); return; }
      setCloture(cRes.data);
      setControles((ctrlRes.data || []).sort((a, b) => a.referentiel_controles_cloture.numero - b.referentiel_controles_cloture.numero));
      setLoading(false);
    });
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalFaits = controles.filter((c) => c.statut !== 'A_FAIRE').length;
  const pct = controles.length ? Math.round((totalFaits / controles.length) * 100) : 0;
  const tousTraites = controles.length > 0 && controles.every((c) => c.statut !== 'A_FAIRE');

  const updateControle = async (row, patch) => {
    const { error } = await supabase.from('controles_cloture').update({ ...patch, verifie_par: patch.statut && patch.statut !== 'A_FAIRE' ? profile?.id : row.verifie_par }).eq('id', row.id);
    if (error) { setNotice(error.message); return; }
    load();
  };

  const toggleGate = async (field, value) => {
    const { error } = await supabase.from('clotures_comptables').update({ [field]: value }).eq('id', id);
    if (error) { setNotice(error.message); return; }
    load();
  };

  const changerStatutCloture = async (statut, extra = {}) => {
    setWorking(true);
    const { error } = await supabase.from('clotures_comptables').update({ statut, ...extra }).eq('id', id);
    setWorking(false);
    if (error) { setNotice(error.message); return; }
    load();
  };

  if (loading) return <div className="page-content"><p className="page-subtitle">Chargement…</p></div>;
  if (!cloture) return <div className="page-content">{notice && <div className="message error">{notice}</div>}<Button variant="secondary" onClick={() => nav('/clotures')}>Retour</Button></div>;

  const gatesOk = cloture.balance_validee && cloture.rapprochement_valide && cloture.fiscalite_verifiee;

  return (
    <div className="page-content form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clôture — {cloture.periode}</h1>
          <p className="page-subtitle"><Badge tone={STATUT_TONE[cloture.statut]}>{STATUT_LABEL[cloture.statut]}</Badge> · {totalFaits}/{controles.length} contrôles traités{cloture.cloturee_le ? ` · Clôturée le ${dateFr(cloture.cloturee_le)}` : ''}</p>
        </div>
        <Button variant="secondary" onClick={() => nav('/clotures')}>Retour</Button>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <Card className="cloture-gates-card">
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="toggle-list" style={{ marginTop: 20 }}>
          <Toggle label="Balance validée" checked={cloture.balance_validee} onChange={(v) => toggleGate('balance_validee', v)} disabled={cloture.statut === 'CLOTUREE'} />
          <Toggle label="Rapprochement validé" checked={cloture.rapprochement_valide} onChange={(v) => toggleGate('rapprochement_valide', v)} disabled={cloture.statut === 'CLOTUREE'} />
          <Toggle label="Fiscalité vérifiée" checked={cloture.fiscalite_verifiee} onChange={(v) => toggleGate('fiscalite_verifiee', v)} disabled={cloture.statut === 'CLOTUREE'} />
        </div>
      </Card>

      <Card>
        <div className="card-heading">
          <div><h2>Checklist des 22 contrôles mensuels</h2><p>Liste minimale CIPRESA pour fiabiliser une comptabilité multi-sites</p></div>
        </div>
        <div className="table-wrap">
          <table className="balance-table">
            <thead>
              <tr><th>N°</th><th>Contrôle</th><th>Fréquence</th><th>Responsable</th><th>Justificatif attendu</th><th>Statut</th><th>Commentaire</th></tr>
            </thead>
            <tbody>
              {controles.map((c) => {
                const r = c.referentiel_controles_cloture;
                return (
                  <tr key={c.id}>
                    <td>{r.numero}</td>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{r.controle}</td>
                    <td>{r.frequence}</td>
                    <td>{r.responsable_type}</td>
                    <td style={{ whiteSpace: 'normal' }}>{r.justificatif_attendu}</td>
                    <td>
                      <select className="input select" style={{ height: 34, fontSize: 12 }} value={c.statut} disabled={cloture.statut === 'CLOTUREE'} onChange={(e) => updateControle(c, { statut: e.target.value })}>
                        {Object.entries(CONTROLE_STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160 }}>
                      <input className="input" style={{ height: 34, fontSize: 12 }} defaultValue={c.commentaire || ''} disabled={cloture.statut === 'CLOTUREE'} placeholder="Commentaire…" onBlur={(e) => { if (e.target.value !== (c.commentaire || '')) updateControle(c, { commentaire: e.target.value.trim() || null }); }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="form-actions left-actions" style={{ marginTop: 20 }}>
          {cloture.statut === 'OUVERTE' && (
            <Button disabled={working} onClick={() => changerStatutCloture('CONTROLES_EN_COURS')}>{working ? '…' : 'Démarrer les contrôles'}</Button>
          )}
          {cloture.statut === 'CONTROLES_EN_COURS' && (
            <Button disabled={working || !tousTraites || !gatesOk} onClick={() => changerStatutCloture('PRE_CLOTURE')}>{working ? '…' : 'Passer en pré-clôture'}</Button>
          )}
          {cloture.statut === 'PRE_CLOTURE' && (
            <Button disabled={working} onClick={() => changerStatutCloture('CLOTUREE', { cloturee_par: profile?.id || null, cloturee_le: new Date().toISOString() })}>{working ? '…' : 'Clôturer définitivement'}</Button>
          )}
        </div>
        {cloture.statut === 'CONTROLES_EN_COURS' && (!tousTraites || !gatesOk) && (
          <p className="page-subtitle" style={{ marginTop: 8 }}>La pré-clôture est désactivée tant que tous les contrôles ne sont pas traités et que les trois validations ci-dessus ne sont pas cochées.</p>
        )}
      </Card>
    </div>
  );
}
