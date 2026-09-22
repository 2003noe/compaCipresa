import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Calculator } from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { genererPeriodes, calculerEcheance } from '../../lib/tva';

const emptyForm = () => ({
  exerciceId: '', periodicite: 'TRIMESTRIELLE', periodeKey: '',
  compteCollecteeId: '', compteDeductibleId: '',
  baseImposable: '0', tvaCollectee: '0', tvaDeductible: '0',
  dateEcheance: '', reference: '', notes: '',
});

export default function NewTvaDeclaration() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyForm());
  const [exercices, setExercices] = useState([]);
  const [comptes, setComptes] = useState([]);
  const [existantes, setExistantes] = useState([]);
  const [regleTva, setRegleTva] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin').order('annee', { ascending: false }).then(({ data }) => {
      setExercices(data || []);
      if (data?.length) setForm((f) => ({ ...f, exerciceId: data[0].id }));
    });
    supabase.from('comptes_comptables').select('id,numero,libelle').ilike('classe', 'Classe 4%').order('numero').then(({ data }) => setComptes(data || []));
    supabase.from('regles_echeances_fiscales').select('*').eq('code', 'TVA_STANDARD').maybeSingle().then(({ data }) => setRegleTva(data || null));
  }, []);

  useEffect(() => {
    if (!form.exerciceId) return;
    supabase.from('declarations_tva').select('periode_debut,periode_fin').eq('exercice_id', form.exerciceId).then(({ data }) => setExistantes(data || []));
  }, [form.exerciceId]);

  const exercice = exercices.find((e) => e.id === form.exerciceId);
  const periodes = useMemo(() => genererPeriodes(exercice, form.periodicite), [exercice, form.periodicite]);
  const periodesDisponibles = periodes.filter((p) => !existantes.some((e) => e.periode_debut === p.debut && e.periode_fin === p.fin));
  const periodeSelectionnee = periodesDisponibles.find((p) => `${p.debut}_${p.fin}` === form.periodeKey);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const choisirPeriode = (key) => {
    const p = periodesDisponibles.find((x) => `${x.debut}_${x.fin}` === key);
    setForm((f) => ({ ...f, periodeKey: key, dateEcheance: p && regleTva ? calculerEcheance(p.fin, regleTva) : f.dateEcheance }));
  };

  const calculerAuto = async () => {
    if (!periodeSelectionnee) { setError('Sélectionnez une période avant de calculer.'); return; }
    setCalculating(true); setError('');
    const requetes = [];
    if (form.compteCollecteeId) requetes.push(
      supabase.from('lignes_ecritures').select('debit,credit,ecritures_comptables!inner(date_ecriture,statut)').eq('compte_id', form.compteCollecteeId).eq('ecritures_comptables.statut', 'VALIDEE').gte('ecritures_comptables.date_ecriture', periodeSelectionnee.debut).lte('ecritures_comptables.date_ecriture', periodeSelectionnee.fin)
    ); else requetes.push(Promise.resolve({ data: [] }));
    if (form.compteDeductibleId) requetes.push(
      supabase.from('lignes_ecritures').select('debit,credit,ecritures_comptables!inner(date_ecriture,statut)').eq('compte_id', form.compteDeductibleId).eq('ecritures_comptables.statut', 'VALIDEE').gte('ecritures_comptables.date_ecriture', periodeSelectionnee.debut).lte('ecritures_comptables.date_ecriture', periodeSelectionnee.fin)
    ); else requetes.push(Promise.resolve({ data: [] }));

    const [collRes, dedRes] = await Promise.all(requetes);
    setCalculating(false);
    if (collRes.error || dedRes.error) { setError((collRes.error || dedRes.error).message); return; }
    const sumCredit = (rows) => (rows || []).reduce((a, r) => a + Number(r.credit || 0) - Number(r.debit || 0), 0);
    const sumDebit = (rows) => (rows || []).reduce((a, r) => a + Number(r.debit || 0) - Number(r.credit || 0), 0);
    const collectee = form.compteCollecteeId ? Math.max(sumCredit(collRes.data), 0) : Number(form.tvaCollectee) || 0;
    const deductible = form.compteDeductibleId ? Math.max(sumDebit(dedRes.data), 0) : Number(form.tvaDeductible) || 0;
    setForm((f) => ({ ...f, tvaCollectee: String(collectee), tvaDeductible: String(deductible) }));
    setNotice('Montants proposés depuis les écritures validées de la période — vérifiez et ajustez si besoin avant d\'enregistrer.');
  };

  const save = async (creerAutre = false) => {
    setError(''); setNotice('');
    if (!form.exerciceId || !periodeSelectionnee) { setError('Exercice et période sont obligatoires.'); return; }
    setSaving(true);
    if (!supabaseConfigured) { setSaving(false); setError("Supabase n'est pas configuré."); return; }

    const { error: insertError } = await supabase.from('declarations_tva').insert({
      exercice_id: form.exerciceId,
      periodicite: form.periodicite,
      periode_debut: periodeSelectionnee.debut,
      periode_fin: periodeSelectionnee.fin,
      periode_libelle: periodeSelectionnee.libelle,
      compte_tva_collectee_id: form.compteCollecteeId || null,
      compte_tva_deductible_id: form.compteDeductibleId || null,
      base_imposable: Number(form.baseImposable) || 0,
      tva_collectee: Number(form.tvaCollectee) || 0,
      tva_deductible: Number(form.tvaDeductible) || 0,
      statut: 'BROUILLON',
      date_echeance: form.dateEcheance || null,
      reference_declaration: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      created_by: profile?.id || null,
    });

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }

    if (creerAutre) { setForm((f) => ({ ...emptyForm(), exerciceId: f.exerciceId })); setNotice('Déclaration enregistrée. Vous pouvez en créer une autre.'); return; }
    setNotice('Déclaration enregistrée.');
    window.setTimeout(() => nav('/tva-taxes'), 350);
  };

  return (
    <div className="page-content form-page asset-form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle déclaration TVA</h1>
          <p className="page-subtitle">Préparez une déclaration pour une période — calcul proposé depuis les écritures, modifiable à la main</p>
        </div>
      </div>
      <Card>
        <div className="form-section precise-section">
          <h2>Période concernée</h2>
          <div className="grid grid-2">
            <Select label="Exercice" required value={form.exerciceId} onChange={update('exerciceId')}>
              {exercices.length === 0 && <option value="">Aucun exercice</option>}
              {exercices.map((e) => <option key={e.id} value={e.id}>Exercice {e.code || e.annee}</option>)}
            </Select>
            <Select label="Périodicité" value={form.periodicite} onChange={(e) => setForm((f) => ({ ...f, periodicite: e.target.value, periodeKey: '' }))}>
              <option value="TRIMESTRIELLE">Trimestrielle</option>
              <option value="MENSUELLE">Mensuelle</option>
            </Select>
            <Select label="Période" required value={form.periodeKey} onChange={(e) => choisirPeriode(e.target.value)}>
              <option value="">Sélectionner…</option>
              {periodesDisponibles.map((p) => <option key={`${p.debut}_${p.fin}`} value={`${p.debut}_${p.fin}`}>{p.libelle}</option>)}
            </Select>
            <Input label="Date d'échéance" type="date" value={form.dateEcheance} onChange={update('dateEcheance')} />
          </div>
          {periodes.length > periodesDisponibles.length && <p className="page-subtitle">Certaines périodes de cet exercice ont déjà une déclaration et n'apparaissent plus dans la liste.</p>}
        </div>

        <div className="form-section precise-section">
          <h2>Comptes TVA (Classe 4) &amp; calcul automatique</h2>
          <div className="grid grid-2">
            <Select label="Compte TVA collectée" value={form.compteCollecteeId} onChange={update('compteCollecteeId')}>
              <option value="">Aucun — saisie manuelle</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} - {c.libelle}</option>)}
            </Select>
            <Select label="Compte TVA déductible" value={form.compteDeductibleId} onChange={update('compteDeductibleId')}>
              <option value="">Aucun — saisie manuelle</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.numero} - {c.libelle}</option>)}
            </Select>
          </div>
          <Button variant="secondary" size="sm" icon={Calculator} disabled={calculating || !periodeSelectionnee} onClick={calculerAuto}>
            {calculating ? 'Calcul…' : 'Calculer automatiquement'}
          </Button>
        </div>

        <div className="form-section precise-section">
          <h2>Montants de la déclaration</h2>
          <div className="grid grid-2">
            <Input label="Base imposable (FCFA)" type="number" min="0" step="0.01" value={form.baseImposable} onChange={update('baseImposable')} />
            <Input label="TVA collectée (FCFA)" type="number" min="0" step="0.01" value={form.tvaCollectee} onChange={update('tvaCollectee')} />
            <Input label="TVA déductible (FCFA)" type="number" min="0" step="0.01" value={form.tvaDeductible} onChange={update('tvaDeductible')} />
            <Input label="Référence de dépôt (optionnel)" placeholder="N° de dépôt DGI" value={form.reference} onChange={update('reference')} />
          </div>
          <Input label="Notes" placeholder="Détails complémentaires (optionnel)" value={form.notes} onChange={update('notes')} />
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="form-actions left-actions">
          <Button variant="secondary" disabled={saving} onClick={() => nav('/tva-taxes')}>Annuler</Button>
          <Button icon={Save} disabled={saving} onClick={() => save(false)}>{saving ? 'Enregistrement…' : 'Enregistrer la déclaration'}</Button>
          <Button variant="secondary" disabled={saving} onClick={() => save(true)}>Enregistrer et créer une autre</Button>
        </div>
      </Card>
    </div>
  );
}
