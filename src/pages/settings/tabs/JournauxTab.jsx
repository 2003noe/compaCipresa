import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { confirmAction, toast } from '../../../lib/notifications';

const TYPE_LABEL = { VENTE: 'Ventes', ACHAT: 'Achats', BANQUE: 'Banque', CAISSE: 'Caisse', OD: 'Opérations diverses' };
const empty = { code: '', libelle: '', type: 'OD' };

export default function JournauxTab() {
  const { can } = useAuth();
  const canManage = can('CONFIG_COMPANY');
  const [journaux, setJournaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    supabase.from('journaux').select('*').order('code').then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      setJournaux(data || []); setLoading(false);
    });
  };
  useEffect(load, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    setError('');
    if (!form.code || !form.libelle) { setError('Code et libellé sont obligatoires.'); return; }
    setSaving(true);
    const query = editingId
      ? supabase.from('journaux').update(form).eq('id', editingId)
      : supabase.from('journaux').insert(form);
    const { error: err } = await query;
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(empty); setEditingId(null); setShowForm(false); load();
  };

  const edit = (journal) => { setEditingId(journal.id); setForm({ code: journal.code || '', libelle: journal.libelle || '', type: journal.type || 'OD' }); setShowForm(true); };
  const remove = async (journal) => {
    if (!await confirmAction({ title: 'Supprimer ce journal ?', text: `${journal.code} · ${journal.libelle}`, confirmText: 'Supprimer', danger: true })) return;
    const { error: err } = await supabase.from('journaux').delete().eq('id', journal.id);
    if (err) { setError(err.message); toast.error('Suppression impossible', err.message); }
    else { toast.success('Journal supprimé', `${journal.code} a été supprimé.`); load(); }
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  return (
    <div>
      <div className="params-tab-header">
        <h2 className="params-content-title">Journaux comptables</h2>
        {canManage && <Button size="sm" icon={Plus} onClick={() => { setEditingId(null); setForm(empty); setShowForm((s) => !s); }}>{editingId ? 'Annuler la modification' : 'Nouveau journal'}</Button>}
      </div>

      {error && <div className="message error" role="alert">{error}</div>}

      {showForm && canManage && (
        <div className="form-section precise-section">
          <div className="grid grid-2">
            <Input label="Code" placeholder="VT, AC, BQ…" value={form.code} onChange={update('code')} />
            <Input label="Libellé" placeholder="Journal des ventes" value={form.libelle} onChange={update('libelle')} />
            <Select label="Type" value={form.type} onChange={update('type')}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="form-actions left-actions">
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); setForm(empty); }}>Annuler</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Créer le journal'}</Button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="balance-table">
          <thead><tr><th>Code</th><th>Libellé</th><th>Type</th>{canManage && <th>Actions</th>}</tr></thead>
          <tbody>
            {journaux.map((j) => (
              <tr key={j.id}><td><strong>{j.code}</strong></td><td>{j.libelle}</td><td>{TYPE_LABEL[j.type] || j.type}</td>{canManage && <td><Button size="sm" variant="secondary" icon={Edit2} onClick={() => edit(j)}>Modifier</Button> <Button size="sm" variant="secondary" icon={Trash2} onClick={() => remove(j)}>Supprimer</Button></td>}</tr>
            ))}
            {journaux.length === 0 && <tr><td colSpan={canManage ? 4 : 3}>Aucun journal créé.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
