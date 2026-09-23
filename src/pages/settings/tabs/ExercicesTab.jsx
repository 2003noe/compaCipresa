import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';

const empty = { code: '', annee: '', date_debut: '', date_fin: '' };

export default function ExercicesTab() {
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState('');

  const load = () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    supabase.from('exercices_comptables').select('*').order('annee', { ascending: false }).then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      setExercices(data || []); setLoading(false);
    });
  };
  useEffect(load, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async () => {
    setError('');
    if (!form.code || !form.annee || !form.date_debut || !form.date_fin) { setError('Tous les champs sont obligatoires.'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('exercices_comptables').insert({ code: form.code, annee: Number(form.annee), date_debut: form.date_debut, date_fin: form.date_fin, statut: 'OUVERT' });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(empty); setShowForm(false); load();
  };

  const toggleStatut = async (ex) => {
    setWorking(ex.id);
    const { error: err } = await supabase.from('exercices_comptables').update({ statut: ex.statut === 'OUVERT' ? 'CLOTURE' : 'OUVERT' }).eq('id', ex.id);
    setWorking('');
    if (err) { setError(err.message); return; }
    load();
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  return (
    <div>
      <div className="params-tab-header">
        <h2 className="params-content-title">Exercices comptables</h2>
        <Button size="sm" icon={Plus} onClick={() => setShowForm((s) => !s)}>Nouvel exercice</Button>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}

      {showForm && (
        <div className="form-section precise-section">
          <div className="grid grid-2">
            <Input label="Code" placeholder="EX-2026" value={form.code} onChange={update('code')} />
            <Input label="Année" type="number" value={form.annee} onChange={update('annee')} />
            <Input label="Date de début" type="date" value={form.date_debut} onChange={update('date_debut')} />
            <Input label="Date de fin" type="date" value={form.date_fin} onChange={update('date_fin')} />
          </div>
          <div className="form-actions left-actions">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button disabled={saving} onClick={create}>{saving ? 'Création…' : 'Créer l\'exercice'}</Button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="balance-table">
          <thead><tr><th>Code</th><th>Année</th><th>Période</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {exercices.map((e) => (
              <tr key={e.id}>
                <td>{e.code}</td><td>{e.annee}</td>
                <td>{new Date(e.date_debut).toLocaleDateString('fr-FR')} → {new Date(e.date_fin).toLocaleDateString('fr-FR')}</td>
                <td><Badge tone={e.statut === 'OUVERT' ? 'success' : 'neutral'}>{e.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé'}</Badge></td>
                <td><Button variant="secondary" size="sm" disabled={working === e.id} onClick={() => toggleStatut(e)}>{working === e.id ? '…' : (e.statut === 'OUVERT' ? 'Clôturer' : 'Rouvrir')}</Button></td>
              </tr>
            ))}
            {exercices.length === 0 && <tr><td colSpan={5}>Aucun exercice créé.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
