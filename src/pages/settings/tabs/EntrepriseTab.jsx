import { useEffect, useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';

const empty = { raison_sociale: '', forme_juridique: '', numero_rccm: '', numero_cc: '', regime_fiscal: '', secteur_activite: '', adresse_postale: '', telephone: '', email_contact: '', plan_comptable_referentiel: '', devise: '', tva_defaut_taux: '' };

function CompanyField({ label, value, canEdit, onChange, type = 'text' }) {
  if (canEdit) return <Input label={label} type={type} value={value ?? ''} onChange={onChange} />;
  return <div className="field"><span className="field-label">{label}</span><div className="company-read-value">{value || '—'}</div></div>;
}

export default function EntrepriseTab() {
  const { can, selectedEntrepriseId, updateCompanyName } = useAuth();
  const peutModifier = can('CONFIG_COMPANY');
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    if (!selectedEntrepriseId) { setLoading(false); return; }
    supabase.from('parametres_entreprise').select('*').eq('entreprise_id', selectedEntrepriseId).maybeSingle().then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      if (data) setForm({ ...empty, ...data, tva_defaut_taux: data.tva_defaut_taux ?? '' });
      setLoading(false);
    });
  }, [selectedEntrepriseId]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const { error: err } = await supabase.from('parametres_entreprise').update({
      ...form, tva_defaut_taux: form.tva_defaut_taux === '' ? null : Number(form.tva_defaut_taux),
    }).eq('entreprise_id', selectedEntrepriseId);
    if (!err && form.raison_sociale?.trim()) {
      const { error: companyError } = await supabase.from('entreprises').update({ nom: form.raison_sociale.trim() }).eq('id', selectedEntrepriseId);
      if (companyError) { setSaving(false); setError(companyError.message); return; }
      updateCompanyName(selectedEntrepriseId, form.raison_sociale.trim());
    }
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
          <CompanyField label="Raison sociale" value={form.raison_sociale} canEdit={peutModifier} onChange={update('raison_sociale')} />
          <CompanyField label="Forme juridique" value={form.forme_juridique} canEdit={peutModifier} onChange={update('forme_juridique')} />
          <CompanyField label="N° RCCM" value={form.numero_rccm} canEdit={peutModifier} onChange={update('numero_rccm')} />
          <CompanyField label="N° CC (Compte Contribuable)" value={form.numero_cc} canEdit={peutModifier} onChange={update('numero_cc')} />
          <CompanyField label="Régime fiscal" value={form.regime_fiscal} canEdit={peutModifier} onChange={update('regime_fiscal')} />
          <CompanyField label="Secteur d'activité" value={form.secteur_activite} canEdit={peutModifier} onChange={update('secteur_activite')} />
        </div>
      </div>

      <div className="form-section precise-section">
        <h2>Coordonnées</h2>
        <div className="grid grid-2">
          <CompanyField label="Adresse postale" value={form.adresse_postale} canEdit={peutModifier} onChange={update('adresse_postale')} />
          <div />
          <CompanyField label="Téléphone" value={form.telephone} canEdit={peutModifier} onChange={update('telephone')} />
          <CompanyField label="Email de contact" value={form.email_contact} canEdit={peutModifier} onChange={update('email_contact')} />
        </div>
      </div>

      <div className="form-section precise-section">
        <h2>Paramètres comptables</h2>
        <div className="grid grid-2">
          <CompanyField label="Plan comptable référentiel" value={form.plan_comptable_referentiel} canEdit={peutModifier} onChange={update('plan_comptable_referentiel')} />
          <CompanyField label="Devise principale" value={form.devise} canEdit={peutModifier} onChange={update('devise')} />
          <CompanyField label="TVA par défaut (%)" type="number" value={form.tva_defaut_taux} canEdit={peutModifier} onChange={update('tva_defaut_taux')} />
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
