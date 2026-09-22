import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { Save } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const CATEGORIES = ['Terrains', 'Constructions', 'Matériel et outillage', 'Véhicules', 'Matériel informatique', 'Mobilier'];
const METHODES = [{ value: 'LINEAIRE', label: 'Linéaire' }, { value: 'DEGRESSIF', label: 'Dégressif' }, { value: 'AUCUNE', label: 'Aucune (non amortissable)' }];

const emptyForm = () => ({ code: '', designation: '', categorie: CATEGORIES[2], compteId: '', dateAcquisition: '', valeurBrute: '', dureeAnnees: '5', methode: 'LINEAIRE', notes: '' });

export default function NewAsset() {
  const nav = useNavigate();
  const [form, setForm] = useState(emptyForm());
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.from('comptes_comptables').select('id,numero,libelle').ilike('classe', 'Classe 2%').order('numero').then(({ data }) => setAccounts(data || []));
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (createAnother = false) => {
    setError(''); setNotice('');
    if (!form.code.trim() || !form.designation.trim() || !form.dateAcquisition || !form.valeurBrute) {
      setError('Code, désignation, date d’acquisition et valeur brute sont obligatoires.');
      return;
    }
    if (form.methode !== 'AUCUNE' && (!form.dureeAnnees || Number(form.dureeAnnees) <= 0)) {
      setError('La durée d’amortissement doit être supérieure à 0 pour une méthode Linéaire ou Dégressive.');
      return;
    }

    setSaving(true);
    if (!supabaseConfigured) { setSaving(false); setError("Supabase n'est pas configuré."); return; }

    const { error: insertError } = await supabase.from('immobilisations').insert({
      code: form.code.trim(),
      designation: form.designation.trim(),
      categorie: form.categorie,
      compte_id: form.compteId || null,
      date_acquisition: form.dateAcquisition,
      valeur_brute: Number(form.valeurBrute) || 0,
      duree_annees: form.methode === 'AUCUNE' ? null : Number(form.dureeAnnees),
      methode: form.methode,
      notes: form.notes.trim() || null,
    });

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }

    if (createAnother) { setForm(emptyForm()); setNotice('Immobilisation enregistrée. Vous pouvez en créer une autre.'); return; }
    setNotice('Immobilisation enregistrée.');
    window.setTimeout(() => nav('/immobilisations'), 350);
  };

  return (
    <div className="page-content form-page asset-form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle immobilisation</h1>
          <p className="page-subtitle">Enregistrez une nouvelle immobilisation dans votre registre</p>
        </div>
      </div>
      <Card>
        <div className="form-section precise-section">
          <h2>Identification de l'immobilisation</h2>
          <div className="grid grid-2">
            <Input label="Code" placeholder="IMM-001" required value={form.code} onChange={update('code')} />
            <Input label="Désignation" placeholder="Ex: Tracteur agricole" required value={form.designation} onChange={update('designation')} />
            <Select label="Catégorie" value={form.categorie} onChange={update('categorie')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select label="Compte d'immobilisation (Classe 2)" value={form.compteId} onChange={update('compteId')}>
              <option value="">Aucun</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.numero} - {a.libelle}</option>)}
            </Select>
          </div>
        </div>

        <div className="form-section precise-section">
          <h2>Acquisition &amp; amortissement</h2>
          <div className="grid grid-2">
            <Input label="Date d'acquisition" type="date" required value={form.dateAcquisition} onChange={update('dateAcquisition')} />
            <Input label="Valeur brute (FCFA)" type="number" min="0" step="0.01" required value={form.valeurBrute} onChange={update('valeurBrute')} />
            <Select label="Méthode d'amortissement" value={form.methode} onChange={update('methode')}>
              {METHODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
            {form.methode !== 'AUCUNE' && (
              <Input label="Durée d'amortissement (années)" type="number" min="1" step="1" value={form.dureeAnnees} onChange={update('dureeAnnees')} />
            )}
          </div>
          <Input label="Notes" placeholder="Détails complémentaires (optionnel)" value={form.notes} onChange={update('notes')} />
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="form-actions left-actions">
          <Button variant="secondary" disabled={saving} onClick={() => nav('/immobilisations')}>Annuler</Button>
          <Button icon={Save} disabled={saving} onClick={() => save(false)}>{saving ? 'Enregistrement…' : 'Enregistrer l\u2019immobilisation'}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => save(true)}>Enregistrer et créer une autre</Button>
        </div>
      </Card>
    </div>
  );
}
