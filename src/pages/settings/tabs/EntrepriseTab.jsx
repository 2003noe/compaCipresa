import { useEffect, useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

const ID = '00000000-0000-0000-0000-000000000001';
const empty = { raison_sociale: '', forme_juridique: '', numero_rccm: '', numero_cc: '', regime_fiscal: '', secteur_activite: '', adresse_postale: '', telephone: '', email_contact: '', plan_comptable_referentiel: '', devise: '', tva_defaut_taux: '' };

export default function EntrepriseTab() {
  const { hasRole } = useAuth();
  const peutModifier = hasRole('ADMIN');
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    supabase.from('parametres_entreprise').select('*').eq('id', ID).maybeSingle().then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      if (data) setForm({ ...empty, ...data, tva_defaut_taux: data.tva_defaut_taux ?? '' });
      setLoading(false);
    });
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const { error: err } = await supabase.from('parametres_entreprise').update({
      ...form, tva_defaut_taux: form.tva_defaut_taux === '' ? null : Number(form.tva_defaut_taux),
    }).eq('id', ID);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNotice('Paramètres enregistrés.');
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  return (
    <div>
      <h2 className="params-content-title">Paramètres de l'entreprise</h2>
      {!peutModifier && <div className="tva-warning">Lecture seule — seul un administrateur peut modifier ces informations.</div>}

      <div className="form-section precise-section">
        <h2>Informations générales</h2>
        <div className="grid grid-2">
          <Input label="Raison sociale" value={form.raison_sociale || ''} onChange={update('raison_sociale')} readOnly={!peutModifier} />
          <Input label="Forme juridique" value={form.forme_juridique || ''} onChange={update('forme_juridique')} readOnly={!peutModifier} />
          <Input label="N° RCCM" value={form.numero_rccm || ''} onChange={update('numero_rccm')} readOnly={!peutModifier} />
          <Input label="N° CC (Compte Contribuable)" value={form.numero_cc || ''} onChange={update('numero_cc')} readOnly={!peutModifier} />
          <Input label="Régime fiscal" value={form.regime_fiscal || ''} onChange={update('regime_fiscal')} readOnly={!peutModifier} />
          <Input label="Secteur d'activité" value={form.secteur_activite || ''} onChange={update('secteur_activite')} readOnly={!peutModifier} />
        </div>
      </div>

      <div className="form-section precise-section">
        <h2>Coordonnées</h2>
        <div className="grid grid-2">
          <Input label="Adresse postale" value={form.adresse_postale || ''} onChange={update('adresse_postale')} readOnly={!peutModifier} />
          <div />
          <Input label="Téléphone" value={form.telephone || ''} onChange={update('telephone')} readOnly={!peutModifier} />
          <Input label="Email de contact" value={form.email_contact || ''} onChange={update('email_contact')} readOnly={!peutModifier} />
        </div>
      </div>

      <div className="form-section precise-section">
        <h2>Paramètres comptables</h2>
        <div className="grid grid-2">
          <Input label="Plan comptable référentiel" value={form.plan_comptable_referentiel || ''} onChange={update('plan_comptable_referentiel')} readOnly={!peutModifier} />
          <Input label="Devise principale" value={form.devise || ''} onChange={update('devise')} readOnly={!peutModifier} />
          <Input label="TVA par défaut (%)" type="number" step="0.01" value={form.tva_defaut_taux} onChange={update('tva_defaut_taux')} readOnly={!peutModifier} />
        </div>
        <p className="page-subtitle" style={{ marginTop: 4 }}>La gestion des exercices comptables (dates de période) se fait dans l'onglet « Exercices ».</p>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}
      {notice && <div className="message success" role="status">{notice}</div>}

      {peutModifier && (
        <div className="form-actions">
          <Button variant="secondary" disabled={saving}>Annuler</Button>
          <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
        </div>
      )}
    </div>
  );
}
