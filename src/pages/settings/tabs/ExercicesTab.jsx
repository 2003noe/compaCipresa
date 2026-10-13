import { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useExercice } from '../../../context/ExerciceContext';

const empty = { code: '', annee: '', date_debut: '', date_fin: '' };

export default function ExercicesTab() {
  const { reloadExercices } = useExercice();
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState('');

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('exercices_comptables')
      .select('*')
      .order('date_debut', { ascending: false })
      .order('code');
    if (fetchError) setError(fetchError.message);
    else setExercices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateYear = (event) => {
    const annee = event.target.value;
    setForm((current) => ({
      ...current,
      annee,
      date_debut: current.date_debut.startsWith(`${annee}-`) ? current.date_debut : '',
      date_fin: current.date_fin.startsWith(`${annee}-`) ? current.date_fin : '',
    }));
  };

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const validateForm = () => {
    const annee = Number(form.annee);
    if (!form.code.trim() || !form.annee || !form.date_debut || !form.date_fin) {
      return 'Tous les champs sont obligatoires.';
    }
    if (!Number.isInteger(annee) || annee < 1900 || annee > 9999) {
      return 'Saisissez une année valide.';
    }
    const anneeTexte = String(annee).padStart(4, '0');
    if (form.date_debut.slice(0, 4) !== anneeTexte || form.date_fin.slice(0, 4) !== anneeTexte) {
      return 'Les dates de début et de fin doivent appartenir à l’année sélectionnée.';
    }
    if (form.date_debut > form.date_fin) {
      return 'La date de début doit précéder ou être égale à la date de fin.';
    }
    return '';
  };

  const save = async () => {
    setError('');
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    if (!supabaseConfigured) { setError("Supabase n'est pas configuré."); return; }

    setSaving(true);
    if (editingId) {
      // Ne pas déplacer silencieusement des écritures hors de leur exercice.
      const { count, error: countError } = await supabase
        .from('ecritures_comptables')
        .select('id', { count: 'exact', head: true })
        .eq('exercice_id', editingId)
        .or(`date_ecriture.lt.${form.date_debut},date_ecriture.gt.${form.date_fin}`);
      if (countError) {
        setSaving(false);
        setError(`Impossible de vérifier les écritures liées : ${countError.message}`);
        return;
      }
      if (count > 0) {
        setSaving(false);
        setError(`${count} écriture(s) de cet exercice se trouvent hors de la nouvelle plage. Corrigez leurs dates avant de modifier l’exercice.`);
        return;
      }
    }

    const values = {
      code: form.code.trim(),
      annee: Number(form.annee),
      date_debut: form.date_debut,
      date_fin: form.date_fin,
    };
    const result = editingId
      ? await supabase.from('exercices_comptables').update(values).eq('id', editingId)
      : await supabase.from('exercices_comptables').insert({ ...values, statut: 'OUVERT' });

    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    resetForm();
    await load();
    await reloadExercices();
  };

  const startEdit = (exercice) => {
    setError('');
    setEditingId(exercice.id);
    setForm({
      code: exercice.code || '',
      annee: String(exercice.annee || ''),
      date_debut: exercice.date_debut || '',
      date_fin: exercice.date_fin || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExercise = async (exercice) => {
    const confirmed = window.confirm(
      `Supprimer l’exercice ${exercice.code} (${exercice.date_debut} au ${exercice.date_fin}) ?\n\nLa suppression sera refusée par Supabase si des écritures, comptes ou autres données y sont rattachés.`,
    );
    if (!confirmed) return;

    setError('');
    setWorking(exercice.id);
    const { error: deleteError } = await supabase
      .from('exercices_comptables')
      .delete()
      .eq('id', exercice.id);
    setWorking('');
    if (deleteError) {
      setError(`Suppression impossible. Des données peuvent être rattachées à cet exercice. ${deleteError.message}`);
      return;
    }
    await load();
    await reloadExercices();
  };

  const toggleStatut = async (exercice) => {
    setError('');
    setWorking(exercice.id);
    const { error: updateError } = await supabase
      .from('exercices_comptables')
      .update({ statut: exercice.statut === 'OUVERT' ? 'CLOTURE' : 'OUVERT' })
      .eq('id', exercice.id);
    setWorking('');
    if (updateError) { setError(updateError.message); return; }
    await load();
    await reloadExercices();
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  const dateMin = form.annee ? `${String(form.annee).padStart(4, '0')}-01-01` : undefined;
  const dateMax = form.annee ? `${String(form.annee).padStart(4, '0')}-12-31` : undefined;

  return (
    <div>
      <div className="params-tab-header">
        <h2 className="params-content-title">Exercices comptables</h2>
        <Button size="sm" icon={Plus} onClick={() => {
          if (showForm && !editingId) resetForm();
          else { setError(''); setEditingId(null); setForm(empty); setShowForm(true); }
        }}>
          Nouvel exercice
        </Button>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}

      {showForm && (
        <div className="form-section precise-section">
          <h3>{editingId ? 'Modifier un exercice' : 'Créer un exercice'}</h3>
          <div className="grid grid-2">
            <Input label="Code unique" placeholder="EX-2026-A" required value={form.code} onChange={update('code')} />
            <Input label="Année" type="number" min="1900" max="9999" step="1" required value={form.annee} onChange={updateYear} />
            <Input label="Date de début" type="date" min={dateMin} max={form.date_fin || dateMax} required value={form.date_debut} onChange={update('date_debut')} />
            <Input label="Date de fin" type="date" min={form.date_debut || dateMin} max={dateMax} required value={form.date_fin} onChange={update('date_fin')} />
          </div>
          <p className="page-subtitle">Les deux dates doivent être comprises dans l’année sélectionnée. Plusieurs exercices peuvent partager la même année, avec un code unique pour chacun.</p>
          <div className="form-actions left-actions">
            <Button variant="secondary" disabled={saving} onClick={resetForm}>Annuler</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Créer l’exercice'}</Button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="balance-table">
          <thead><tr><th>Code</th><th>Année</th><th>Période</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {exercices.map((exercice) => (
              <tr key={exercice.id}>
                <td>{exercice.code}</td>
                <td>{exercice.annee}</td>
                <td>{new Date(`${exercice.date_debut}T00:00:00`).toLocaleDateString('fr-FR')} → {new Date(`${exercice.date_fin}T00:00:00`).toLocaleDateString('fr-FR')}</td>
                <td><Badge tone={exercice.statut === 'OUVERT' ? 'success' : 'neutral'}>{exercice.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé'}</Badge></td>
                <td>
                  <div className="form-actions">
                    <Button variant="secondary" size="sm" icon={Edit2} disabled={Boolean(working) || saving} onClick={() => startEdit(exercice)}>Modifier</Button>
                    <Button variant="secondary" size="sm" disabled={Boolean(working) || saving} onClick={() => toggleStatut(exercice)}>{working === exercice.id ? '…' : (exercice.statut === 'OUVERT' ? 'Clôturer' : 'Rouvrir')}</Button>
                    <Button variant="secondary" size="sm" icon={Trash2} disabled={Boolean(working) || saving} onClick={() => deleteExercise(exercice)}>{working === exercice.id ? '…' : 'Supprimer'}</Button>
                  </div>
                </td>
              </tr>
            ))}
            {exercices.length === 0 && <tr><td colSpan={5}>Aucun exercice créé.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
