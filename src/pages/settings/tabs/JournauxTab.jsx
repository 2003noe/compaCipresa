import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';

const TYPE_LABEL = { VENTE: 'Ventes', ACHAT: 'Achats', BANQUE: 'Banque', CAISSE: 'Caisse', OD: 'Opérations diverses' };
const empty = { code: '', libelle: '', type: 'OD' };

export default function JournauxTab() {
  const [journaux, setJournaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    supabase.from('journaux').select('*').order('code').then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      setJournaux(data || []); setLoading(false);
    });
  };
  useEffect(load, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async () => {
    setError('');
    if (!form.code || !form.libelle) { setError('Code et libellé sont obligatoires.'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('journaux').insert(form);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(empty); setShowForm(false); load();
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  return (
    <div>
      <div className="params-tab-header">
        <h2 className="params-content-title">Journaux comptables</h2>
        <Button size="sm" icon={Plus} onClick={() => setShowForm((s) => !s)}>Nouveau journal</Button>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}

      {showForm && (
        <div className="form-section precise-section">
          <div className="grid grid-2">
            <Input label="Code" placeholder="VT, AC, BQ…" value={form.code} onChange={update('code')} />
            <Input label="Libellé" placeholder="Journal des ventes" value={form.libelle} onChange={update('libelle')} />
            <Select label="Type" value={form.type} onChange={update('type')}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="form-actions left-actions">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button disabled={saving} onClick={create}>{saving ? 'Création…' : 'Créer le journal'}</Button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="balance-table">
          <thead><tr><th>Code</th><th>Libellé</th><th>Type</th></tr></thead>
          <tbody>
            {journaux.map((j) => (
              <tr key={j.id}><td><strong>{j.code}</strong></td><td>{j.libelle}</td><td>{TYPE_LABEL[j.type] || j.type}</td></tr>
            ))}
            {journaux.length === 0 && <tr><td colSpan={3}>Aucun journal créé.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
