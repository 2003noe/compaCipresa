import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { STATUT_LABEL, STATUT_TONE, dateFr } from '../../lib/clotures';

export default function Clotures() {
  const nav = useNavigate();
  const [exercices, setExercices] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [clotures, setClotures] = useState([]);
  const [progress, setProgress] = useState({});
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin').order('annee', { ascending: false }).then(({ data, error }) => {
      if (error) { setNotice(`Impossible de charger les exercices : ${error.message}`); setLoading(false); return; }
      setExercices(data || []);
      if (data?.length) setExerciceId(data[0].id); else setLoading(false);
    });
    supabase.from('profiles').select('id,nom,prenom').then(({ data }) => {
      const map = {}; (data || []).forEach((p) => { map[p.id] = `${p.prenom || ''} ${p.nom || ''}`.trim(); });
      setProfiles(map);
    });
  }, []);

  const load = (excId) => {
    if (!excId) return;
    setLoading(true);
    supabase.from('clotures_comptables').select('*').eq('exercice_id', excId).order('periode_debut', { ascending: false }).then(async ({ data, error }) => {
      if (error) { setNotice(`Impossible de charger les clôtures : ${error.message}`); setLoading(false); return; }
      setClotures(data || []);
      const ids = (data || []).map((c) => c.id);
      if (ids.length) {
        const { data: ctrls } = await supabase.from('controles_cloture').select('cloture_id,statut').in('cloture_id', ids);
        const map = {};
        (ctrls || []).forEach((c) => {
          map[c.cloture_id] = map[c.cloture_id] || { total: 0, faits: 0 };
          map[c.cloture_id].total += 1;
          if (c.statut !== 'A_FAIRE') map[c.cloture_id].faits += 1;
        });
        setProgress(map);
      } else setProgress({});
      setLoading(false);
    });
  };

  useEffect(() => { if (exerciceId) load(exerciceId); }, [exerciceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clôtures</h1>
          <p className="page-subtitle">Suivez les périodes comptables et leur checklist de clôture mensuelle{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
            {exercices.length === 0 && <option value="">Aucun exercice</option>}
            {exercices.map((e) => <option key={e.id} value={e.id}>Exercice {e.code || e.annee}</option>)}
          </Select>
          <Button icon={Plus} onClick={() => nav('/nouvelle-cloture')}>Nouvelle clôture</Button>
        </div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <Card>
        <div className="table-wrap">
          <table className="balance-table">
            <thead>
              <tr><th>Période</th><th>Statut</th><th>Avancement</th><th>Responsable</th><th>Clôturée le</th><th /></tr>
            </thead>
            <tbody>
              {clotures.map((c) => {
                const p = progress[c.id] || { total: 0, faits: 0 };
                const pct = p.total ? Math.round((p.faits / p.total) * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td>{c.periode}</td>
                    <td><Badge tone={STATUT_TONE[c.statut]}>{STATUT_LABEL[c.statut]}</Badge></td>
                    <td>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                      <small className="page-subtitle">{p.faits}/{p.total} contrôles</small>
                    </td>
                    <td>{profiles[c.responsable] || '—'}</td>
                    <td>{dateFr(c.cloturee_le)}</td>
                    <td><Button variant="secondary" size="sm" onClick={() => nav(`/clotures/${c.id}`)}>Ouvrir</Button></td>
                  </tr>
                );
              })}
              {clotures.length === 0 && <tr><td colSpan={6}>Aucune clôture pour cet exercice.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
