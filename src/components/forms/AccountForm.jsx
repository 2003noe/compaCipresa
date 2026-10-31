import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import Button from '../ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import ExerciceSelect from './ExerciceSelect';

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

const detectClasse = (num, parentClasseInt) => {
  if (parentClasseInt && parentClasseInt >= 1 && parentClasseInt <= 7) {
    return ACCOUNT_CLASSES[parentClasseInt - 1];
  }
  const clean = (num || '').trim();
  if (clean.length > 0) {
    const firstDigit = clean[0];
    const found = ACCOUNT_CLASSES.find((c) => c.startsWith(`Classe ${firstDigit}`));
    if (found) return found;
  }
  return null;
};

const detectNature = (num, categorie) => {
  if (categorie) {
    const catUpper = categorie.toUpperCase().trim();
    if (catUpper.includes('PASSIF')) return 'PASSIF';
    if (catUpper.includes('ACTIF')) return 'ACTIF';
    if (catUpper.includes('CHARGE')) return 'CHARGE';
    if (catUpper.includes('PRODUIT')) return 'PRODUIT';
    if (catUpper.includes('TRESOR') || catUpper.includes('TRÉSOR')) return 'TRESORERIE';
    if (NATURE_OPTIONS.includes(catUpper)) return catUpper;
  }
  const clean = (num || '').trim();
  if (!clean) return null;
  const first = clean[0];
  if (first === '1') return 'PASSIF';
  if (first === '2') return 'ACTIF';
  if (first === '3') return 'ACTIF';
  if (first === '4') {
    if (clean.startsWith('40') || clean.startsWith('42') || clean.startsWith('43') || clean.startsWith('44')) return 'PASSIF';
    return 'ACTIF';
  }
  if (first === '5') return 'TRESORERIE';
  if (first === '6') return 'CHARGE';
  if (first === '7') return 'PRODUIT';
  return null;
};

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
  const [searchParams] = useSearchParams();
  const parentCode = searchParams.get('parentCode') || '';
  const { selectedExerciceId, exercices, loading: exercicesLoading } = useExercice();
  const { can, hasRole, roles = [] } = useAuth();
  const canCreateAccount = hasRole('ADMIN') || can('COMPTA_CREATE') || roles.some((role) => ['GERANT', 'COMPTABLE'].includes(role.code));
  const [formExerciceId, setFormExerciceId] = useState(selectedExerciceId);
  const [form, setForm] = useState(emptyForm());
  const [parentOptions, setParentOptions] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [numberHint, setNumberHint] = useState('');

  useEffect(() => setFormExerciceId(selectedExerciceId), [selectedExerciceId]);
  const formExercice = exercices.find((exercice) => exercice.id === formExerciceId) || null;

  // Chargement des comptes parents depuis default_compt
  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase
      .from('default_compt')
      .select('id,num_compte,libelle,classe,categorie')
      .order('num_compte')
      .then(({ data, error: fetchErr }) => {
        if (fetchErr) {
          console.error('Erreur chargement default_compt:', fetchErr);
          return;
        }
        const sorted = (data || []).sort((a, b) => {
          const nA = Number(a.num_compte);
          const nB = Number(b.num_compte);
          if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
          return a.num_compte.localeCompare(b.num_compte);
        });
        setParentOptions(sorted);
      });
  }, []);

  useEffect(() => {
    if (!parentCode || !parentOptions.length) return;
    const parent = [...parentOptions]
      .filter((item) => parentCode.startsWith(item.num_compte))
      .sort((a, b) => b.num_compte.length - a.num_compte.length)[0];
    if (!parent) return;
    const classe = detectClasse(parent.num_compte, parent.classe) || ACCOUNT_CLASSES[0];
    const nature = detectNature(parent.num_compte, parent.categorie) || 'ACTIF';
    setForm((current) => ({ ...current, parentId: parent.id, code: parent.num_compte, classe, nature }));
  }, [parentCode, parentOptions]);

  const selectedParent = parentOptions.find((p) => p.id === form.parentId) || null;

  // Propose le prochain numéro libre sous la référence OHADA choisie.
  useEffect(() => {
    if (!selectedParent || !formExerciceId) { setNumberHint(''); return undefined; }
    let active = true;
    supabase.from('comptes_comptables').select('numero').then(({ data, error: numberError }) => {
      if (!active) return;
      if (numberError) { setNumberHint('Le numéro sera vérifié à l’enregistrement.'); return; }
      const prefix = selectedParent.num_compte;
      const used = (data || []).map((row) => String(row.numero || '')).filter((number) => number.startsWith(prefix));
      const suffixes = used.map((number) => number.slice(prefix.length)).filter((suffix) => /^\d+$/.test(suffix));
      const width = Math.max(2, ...suffixes.map((suffix) => suffix.length));
      let sequence = Math.max(0, ...suffixes.map(Number)) + 1;
      let nextNumber = `${prefix}${String(sequence).padStart(width, '0')}`;
      while (used.includes(nextNumber)) {
        sequence += 1;
        nextNumber = `${prefix}${String(sequence).padStart(width, '0')}`;
      }
      setForm((current) => ({ ...current, code: current.code === prefix || !current.code.startsWith(prefix) ? nextNumber : current.code }));
      setNumberHint(`Prochain numéro libre proposé : ${nextNumber}. Vous pouvez encore le modifier.`);
    });
    return () => { active = false; };
  }, [selectedParent?.id, formExerciceId]);

  // Gestion du changement de compte parent
  const handleParentChange = (event) => {
    const newParentId = event.target.value;
    const parent = parentOptions.find((p) => p.id === newParentId) || null;

    setForm((current) => {
      let nextCode = current.code;
      let nextClasse = current.classe;
      let nextNature = current.nature;

      if (parent) {
        const prefix = parent.num_compte;
        const currentOldPrefix = selectedParent ? selectedParent.num_compte : '';

        // Si l'ancien code commençait par l'ancien préfixe, on remplace le préfixe
        if (currentOldPrefix && nextCode.startsWith(currentOldPrefix)) {
          nextCode = prefix + nextCode.slice(currentOldPrefix.length);
        } else if (!nextCode.startsWith(prefix)) {
          nextCode = prefix;
        }

        const autoClasse = detectClasse(prefix, parent.classe);
        if (autoClasse) nextClasse = autoClasse;

        const autoNature = detectNature(prefix, parent.categorie);
        if (autoNature) nextNature = autoNature;
      }

      return {
        ...current,
        parentId: newParentId,
        code: nextCode,
        classe: nextClasse,
        nature: nextNature,
      };
    });
  };

  // Gestion de la saisie du numéro de compte (en forçant le préfixe parent et l'auto-détection de la classe)
  const handleCodeChange = (event) => {
    let val = event.target.value;

    if (selectedParent) {
      const prefix = selectedParent.num_compte;
      // Empêcher d'effacer en-dessous du préfixe parent
      if (!val.startsWith(prefix)) {
        if (prefix.startsWith(val)) {
          val = prefix;
        } else {
          val = prefix + val.replace(prefix, '');
        }
      }
    }

    const autoClasse = detectClasse(val, selectedParent?.classe);
    const autoNature = detectNature(val, selectedParent?.categorie);

    setForm((current) => ({
      ...current,
      code: val,
      ...(autoClasse ? { classe: autoClasse } : {}),
      ...(autoNature ? { nature: autoNature } : {}),
    }));
  };

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const save = async (createAnother = false) => {
    setError('');
    setNotice('');

    if (!canCreateAccount) {
      setError('Votre rôle ne permet pas de créer des comptes. Contactez un administrateur de l’entreprise.');
      return;
    }

    if (!form.code.trim() || !form.label.trim()) {
      setError('Le numéro et le libellé du compte sont obligatoires.');
      return;
    }
    if (!formExerciceId || exercicesLoading) {
      setError('Sélectionnez un exercice comptable avant de créer un compte.');
      return;
    }
    if (formExercice?.statut !== 'OUVERT') {
      setError('Impossible de créer un compte dans un exercice clôturé. Sélectionnez un exercice ouvert.');
      return;
    }

    if (selectedParent && !form.code.trim().startsWith(selectedParent.num_compte)) {
      setError(`Le numéro de compte doit obligatoirement commencer par le numéro du compte parent (${selectedParent.num_compte}).`);
      return;
    }

    setSaving(true);

    if (!supabaseConfigured) {
      setSaving(false);
      setError("Supabase n'est pas configuré.");
      return;
    }

    const { data: duplicateAccount, error: duplicateError } = await supabase.from('comptes_comptables')
      .select('id').eq('numero', form.code.trim()).maybeSingle();
    if (duplicateError) { setSaving(false); setError(`Impossible de vérifier le numéro du compte : ${duplicateError.message}`); return; }
    if (duplicateAccount) { setSaving(false); setError(`Le numéro ${form.code.trim()} existe déjà. Choisissez le numéro proposé ou saisissez-en un autre.`); return; }

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
          <p className="page-subtitle">Exercice : {formExercice?.code || 'aucun exercice sélectionné'}</p>
          <p className="page-subtitle">Créez un nouveau compte dans votre plan comptable SYSCOHADA</p>
        </div>
      </div>
      <Card className="account-card">
        <div className="form-section precise-section">
          <h2>Identification du compte</h2>
          <ExerciceSelect value={formExerciceId} onChange={(event) => setFormExerciceId(event.target.value)} />
          <Select label="Compte parent" value={form.parentId} onChange={handleParentChange}>
            <option value="">Aucun</option>
            {parentOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.num_compte} - {account.libelle}
              </option>
            ))}
          </Select>
          <div className="grid grid-2">
            <Input
              label="Numéro de compte"
              placeholder={selectedParent ? `Ex: ${selectedParent.num_compte}01` : 'Ex: 411001'}
              required
              value={form.code}
              onChange={handleCodeChange}
            />
            {numberHint && <p className="account-number-hint">{numberHint}</p>}
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
          <Button disabled={!canCreateAccount || saving || formExercice?.statut !== 'OUVERT'} onClick={() => save(false)}>{saving ? 'Enregistrement…' : 'Enregistrer le compte'}</Button>
          <Button variant="secondary" disabled={!canCreateAccount || saving || formExercice?.statut !== 'OUVERT'} onClick={() => save(true)}>Enregistrer et créer un autre</Button>
          <button className="text-button" type="button" onClick={() => nav('/plan-comptable')}>Annuler</button>
        </div>
      </Card>
    </div>
  );
}
