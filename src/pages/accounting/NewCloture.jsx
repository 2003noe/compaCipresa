import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { genererPeriodesMensuelles } from '../../lib/clotures';

export default function NewCloture() {
  const nav = useNavigate();
  const [exercices, setExercices] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [periodeKey, setPeriodeKey] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [responsableId, setResponsableId] = useState('');
  const [existantes, setExistantes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin').order('annee', { ascending: false }).then(({ data }) => {
      setExercices(data || []);
      if (data?.length) setExerciceId(data[0].id);
    });
    supabase.from('profiles').select('id,nom,prenom').eq('actif', true).then(({ data }) => setProfiles(data || []));
  }, []);

  useEffect(() => {
    if (!exerciceId) return;
    supabase.from('clotures_comptables').select('periode_debut,periode_fin').eq('exercice_id', exerciceId).then(({ data }) => setExistantes(data || []));
  }, [exerciceId]);

  const exercice = exercices.find((e) => e.id === exerciceId);
  const periodes = useMemo(() => genererPeriodesMensuelles(exercice), [exercice]);
  const periodesDisponibles = periodes.filter((p) => !existantes.some((e) => e.periode_debut === p.debut && e.periode_fin === p.fin));
  const periodeSelectionnee = periodesDisponibles.find((p) => `${p.debut}_${p.fin}` === periodeKey);

  const save = async () => {
    setError('');
    if (!exerciceId || !periodeSelectionnee) { setError('Exercice et période sont obligatoires.'); return; }
    setSaving(true);
    if (!supabaseConfigured) { setSaving(false); setError("Supabase n'est pas configuré."); return; }

    const { data, error: insertError } = await supabase.from('clotures_comptables').insert({
      exercice_id: exerciceId,
      periode: periodeSelectionnee.libelle,
      periode_debut: periodeSelectionnee.debut,
      periode_fin: periodeSelectionnee.fin,
      responsable: responsableId || null,
      statut: 'OUVERTE',
    }).select('id').single();

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    nav(`/clotures/${data.id}`);
  };

  return (
    <div className="page-content form-page asset-form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle clôture</h1>
          <p className="page-subtitle">Ouvre une période et génère automatiquement les 22 contrôles de clôture mensuelle</p>
        </div>
      </div>
      <Card>
        <div className="form-section precise-section">
          <h2>Période à clôturer</h2>
          <div className="grid grid-2">
            <Select label="Exercice" required value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
              {exercices.length === 0 && <option value="">Aucun exercice</option>}
              {exercices.map((e) => <option key={e.id} value={e.id}>Exercice {e.code || e.annee}</option>)}
            </Select>
            <Select label="Période (mensuelle)" required value={periodeKey} onChange={(e) => setPeriodeKey(e.target.value)}>
              <option value="">Sélectionner…</option>
              {periodesDisponibles.map((p) => <option key={`${p.debut}_${p.fin}`} value={`${p.debut}_${p.fin}`}>{p.libelle}</option>)}
            </Select>
            <Select label="Responsable (optionnel)" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Non assigné</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
            </Select>
          </div>
          {periodes.length > periodesDisponibles.length && <p className="page-subtitle">Certaines périodes de cet exercice ont déjà une clôture et n'apparaissent plus dans la liste.</p>}
        </div>

        {error && <div className="message error" role="alert">{error}</div>}

        <div className="form-actions left-actions">
          <Button variant="secondary" disabled={saving} onClick={() => nav('/clotures')}>Annuler</Button>
          <Button icon={Save} disabled={saving} onClick={save}>{saving ? 'Création…' : 'Créer la clôture'}</Button>
        </div>
      </Card>
    </div>
  );
}
