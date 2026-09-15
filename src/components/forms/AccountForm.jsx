import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import Button from '../ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const ACCOUNT_CLASSES = [
  'Classe 1 - Ressources durables',
  'Classe 2 - Immobilisations',
  'Classe 3 - Stocks',
  'Classe 4 - Comptes de tiers',
  'Classe 5 - Trésorerie',
  'Classe 6 - Charges',
  'Classe 7 - Produits',
];

const NATURE_OPTIONS = ['ACTIF', 'PASSIF', 'CHARGE', 'PRODUIT', 'TRESORERIE'];

const CURRENCIES = [
  { code: 'XAF', label: 'FCFA (XAF)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dollar US ($)' },
];

const emptyForm = () => ({
  code: '',
  label: '',
  classe: ACCOUNT_CLASSES[3],
  nature: 'ACTIF',
  parentId: '',
  devise: 'XAF',
  lettrable: false,
  reconciliable: false,
  notes: '',
  soldeDebit: '0',
  soldeCredit: '0',
});

export default function AccountForm() {
  const nav = useNavigate();
  const [form, setForm] = useState(emptyForm());
  const [parentOptions, setParentOptions] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.from('comptes_comptables').select('id,numero,libelle').order('numero').then(({ data }) => {
      setParentOptions(data || []);
    });
  }, []);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const save = async (createAnother = false) => {
    setError('');
    setNotice('');

    if (!form.code.trim() || !form.label.trim()) {
      setError('Le numéro et le libellé du compte sont obligatoires.');
      return;
    }

    setSaving(true);

    if (!supabaseConfigured) {
      setSaving(false);
      setError("Supabase n'est pas configuré.");
      return;
    }

    const { error: insertError } = await supabase.from('comptes_comptables').insert({
      numero: form.code.trim(),
      libelle: form.label.trim(),
      classe: form.classe,
      nature: form.nature,
      actif: true,
      compte_parent_id: form.parentId || null,
      devise: form.devise,
      lettrable: form.lettrable,
      reconciliable: form.reconciliable,
      notes: form.notes.trim() || null,
      solde_ouverture_debit: Number(form.soldeDebit) || 0,
      solde_ouverture_credit: Number(form.soldeCredit) || 0,
    });

    setSaving(false);

    if (insertError) { setError(insertError.message); return; }

    if (createAnother) {
      setForm(emptyForm());
      setNotice('Compte enregistré. Vous pouvez en créer un autre.');
      return;
    }

    setNotice('Compte enregistré.');
    window.setTimeout(() => nav('/plan-comptable'), 350);
  };

  return (
    <div className="page-content form-page account-form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouveau compte comptable</h1>
          <p className="page-subtitle">Créez un nouveau compte dans votre plan comptable SYSCOHADA</p>
        </div>
      </div>
      <Card className="account-card">
        <div className="form-section precise-section">
          <h2>Identification du compte</h2>
          <div className="grid grid-2">
            <Input label="Numéro de compte" placeholder="Ex: 411001" required value={form.code} onChange={update('code')} />
            <Input label="Libellé du compte" placeholder="Ex: Client - Coopérative Gagnoa" required value={form.label} onChange={update('label')} />
            <Select label="Classe de compte" value={form.classe} onChange={update('classe')}>
              {ACCOUNT_CLASSES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <fieldset className="radio-field">
              <legend>Type de compte</legend>
              <div className="radio-row">
                {NATURE_OPTIONS.map((option) => (
                  <label key={option}>
                    <input type="radio" name="accountType" checked={form.nature === option} onChange={() => setForm((f) => ({ ...f, nature: option }))} />
                    <span>{option.charAt(0) + option.slice(1).toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="form-section precise-section">
          <h2>Configuration &amp; Propriétés</h2>
          <div className="grid grid-2">
            <Select label="Compte parent" value={form.parentId} onChange={update('parentId')}>
              <option value="">Aucun</option>
              {parentOptions.map((account) => (
                <option key={account.id} value={account.id}>{account.numero} - {account.libelle}</option>
              ))}
            </Select>
            <Select label="Devise" value={form.devise} onChange={update('devise')}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </div>
          <div className="toggle-pair">
            <Toggle label="Lettrable" description="Permet d'associer des débits et des crédits" checked={form.lettrable} onChange={(v) => setForm((f) => ({ ...f, lettrable: v }))} />
            <Toggle label="Réconciliable" description="Soumis au rapprochement de trésorerie" checked={form.reconciliable} onChange={(v) => setForm((f) => ({ ...f, reconciliable: v }))} />
          </div>
          <Input label="Notes / Description" placeholder="Ajoutez des détails internes sur l'affectation ou l'usage réglementaire de ce compte..." value={form.notes} onChange={update('notes')} />
        </div>

        <div className="form-section precise-section opening-section">
          <h2>Solde d'ouverture</h2>
          <div className="grid grid-2">
            <Input label={`Solde débiteur (${form.devise})`} type="number" min="0" step="0.01" value={form.soldeDebit} onChange={update('soldeDebit')} />
            <Input label={`Solde créditeur (${form.devise})`} type="number" min="0" step="0.01" value={form.soldeCredit} onChange={update('soldeCredit')} />
          </div>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="form-actions left-actions">
          <Button disabled={saving} onClick={() => save(false)}>{saving ? 'Enregistrement…' : 'Enregistrer le compte'}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => save(true)}>Enregistrer et créer un autre</Button>
          <button className="text-button" type="button" onClick={() => nav('/plan-comptable')}>Annuler</button>
        </div>
      </Card>
    </div>
  );
}
