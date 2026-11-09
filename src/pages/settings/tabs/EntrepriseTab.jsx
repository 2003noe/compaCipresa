import { useEffect, useState } from 'react';
import { Building2, Plus, X } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../lib/notifications';

const empty = {
  raison_sociale: '',
  forme_juridique: '',
  numero_rccm: '',
  numero_cc: '',
  regime_fiscal: '',
  secteur_activite: '',
  adresse_postale: '',
  telephone: '',
  email_contact: '',
  plan_comptable_referentiel: '',
  devise: '',
  tva_defaut_taux: '',
};

function CompanyField({ label, value, canEdit, onChange, type = 'text' }) {
  if (canEdit) return <Input label={label} type={type} value={value ?? ''} onChange={onChange} />;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="company-read-value">{value || '—'}</div>
    </div>
  );
}

export default function EntrepriseTab() {
  const {
    can,
    hasRole,
    companies,
    selectedEntrepriseId,
    selectedEntreprise,
    switchEntreprise,
    createCompany,
    updateCompanyName,
  } = useAuth();

  const peutModifier = can('CONFIG_COMPANY');
  const isAdmin = hasRole('ADMIN');

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Modale de création d'entreprise
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !selectedEntrepriseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('parametres_entreprise')
      .select('*')
      .eq('entreprise_id', selectedEntrepriseId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        if (data) {
          setForm({ ...empty, ...data, tva_defaut_taux: data.tva_defaut_taux ?? '' });
        } else {
          setForm(empty);
        }
        setLoading(false);
      });
  }, [selectedEntrepriseId]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSwitchCompany = async (companyId) => {
    if (!companyId || companyId === selectedEntrepriseId) return;
    setSwitchingCompany(true);
    setNotice('');
    setError('');
    const { error: switchError } = await switchEntreprise(companyId);
    setSwitchingCompany(false);
    if (switchError) {
      setError(switchError.message || "Impossible de changer d'entreprise.");
      toast.error("Erreur", switchError.message);
    } else {
      toast.success("Entreprise activée", "Vous avez basculé vers une nouvelle entreprise.");
    }
  };

  const handleCreateCompany = async (event) => {
    event.preventDefault();
    const name = companyName.trim();
    if (name.length < 2) {
      setCompanyError("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    setCreatingCompany(true);
    setCompanyError('');
    const { error: createErr } = await createCompany(name);
    setCreatingCompany(false);
    if (createErr) {
      setCompanyError(createErr.message || "La création de l’entreprise a échoué.");
      return;
    }
    setCompanyName('');
    setCompanyFormOpen(false);
    toast.success("Entreprise créée", `L'entreprise « ${name} » a été créée avec succès.`);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const { error: err } = await supabase
      .from('parametres_entreprise')
      .update({
        ...form,
        tva_defaut_taux: form.tva_defaut_taux === '' ? null : Number(form.tva_defaut_taux),
      })
      .eq('entreprise_id', selectedEntrepriseId);

    if (!err && form.raison_sociale?.trim()) {
      const { error: companyError } = await supabase
        .from('entreprises')
        .update({ nom: form.raison_sociale.trim() })
        .eq('id', selectedEntrepriseId);

      if (companyError) {
        setSaving(false);
        setError(companyError.message);
        toast.error('Enregistrement impossible', companyError.message);
        return;
      }
      updateCompanyName(selectedEntrepriseId, form.raison_sociale.trim());
    }

    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error('Enregistrement impossible', err.message);
      return;
    }
    setNotice('Paramètres enregistrés.');
    toast.success('Paramètres enregistrés', 'Les informations de l’entreprise ont été mises à jour.');
  };

  return (
    <div>
      <h2 className="params-content-title">Paramètres de l'entreprise</h2>

      {/* Bloc Sélection de l'entreprise active & Nouvelle entreprise */}
      <div className="form-section precise-section" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} /> Entreprise active
            </h2>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
              Sélectionnez l'entreprise à administrer ou créez une nouvelle entité.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => {
                setCompanyError('');
                setCompanyFormOpen(true);
              }}
            >
              Nouvelle entreprise
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: 260, maxWidth: 420 }}>
            <label
              className="field-label"
              htmlFor="select-active-company"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}
            >
              Changer d'entreprise active
            </label>
            <select
              id="select-active-company"
              className="input select"
              value={selectedEntrepriseId}
              onChange={(e) => handleSwitchCompany(e.target.value)}
              disabled={switchingCompany || companies.length === 0}
              style={{ width: '100%', height: 40 }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} {c.id === selectedEntrepriseId ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedEntreprise && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-end', paddingBottom: 4 }}>
              <span className="badge-pill success" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
                Entreprise active : {selectedEntreprise.nom}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="page-subtitle">Chargement des paramètres de l'entreprise…</p>
      ) : (
        <>
          {!peutModifier && (
            <div className="tva-warning" style={{ marginBottom: 16 }}>
              Lecture seule — seul un administrateur peut modifier ces informations.
            </div>
          )}

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
            <p className="page-subtitle" style={{ marginTop: 4 }}>
              La gestion des exercices comptables (dates de période) se fait dans l'onglet « Exercices ».
            </p>
          </div>

          {error && <div className="message error" role="alert">{error}</div>}
          {notice && <div className="message success" role="status">{notice}</div>}

          {peutModifier && (
            <div className="form-actions">
              <Button variant="secondary" disabled={saving}>Annuler</Button>
              <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
            </div>
          )}
        </>
      )}

      {/* Boîte de dialogue de création d'entreprise */}
      {companyFormOpen && (
        <div
          className="company-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingCompany) setCompanyFormOpen(false);
          }}
        >
          <section className="company-dialog" role="dialog" aria-modal="true" aria-labelledby="company-dialog-title">
            <header>
              <div>
                <Building2 size={19} />
                <h2 id="company-dialog-title">Créer une entreprise</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setCompanyFormOpen(false)}
                disabled={creatingCompany}
              >
                <X size={18} />
              </button>
            </header>
            <p>
              Vous deviendrez administrateur de cette entreprise. Ses comptes, exercices et écritures seront séparés des autres entreprises.
            </p>
            <form onSubmit={handleCreateCompany}>
              <label htmlFor="new-company-name">Nom de l’entreprise</label>
              <input
                id="new-company-name"
                autoFocus
                required
                minLength={2}
                maxLength={120}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Ex. CIPRESA SARL"
              />
              {companyError && <p className="company-dialog-error" role="alert">{companyError}</p>}
              <footer>
                <button
                  type="button"
                  className="company-dialog-cancel"
                  onClick={() => setCompanyFormOpen(false)}
                  disabled={creatingCompany}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany || companyName.trim().length < 2}
                >
                  {creatingCompany ? "Création…" : "Créer et ouvrir"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
