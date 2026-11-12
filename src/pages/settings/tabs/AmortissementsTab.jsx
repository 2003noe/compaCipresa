import { useEffect, useState } from 'react';
import { Percent, Info } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../lib/notifications';

// Catégories SYSCOHADA avec taux légaux par défaut (0 = non défini)
const CATEGORIES_DEFAUT = [
  { key: 'terrains',          label: 'Terrains',                         taux: 0, duree: 0,  note: 'Non amortissable en général' },
  { key: 'constructions',     label: 'Constructions & aménagements',     taux: 0, duree: 20, note: 'Durée standard 20 ans' },
  { key: 'materiel_outillage',label: 'Matériel et outillage',            taux: 0, duree: 5,  note: 'Durée standard 5 à 10 ans' },
  { key: 'vehicules',         label: 'Véhicules de transport',           taux: 0, duree: 5,  note: 'Durée standard 5 ans' },
  { key: 'materiel_info',     label: 'Matériel informatique',            taux: 0, duree: 3,  note: 'Durée standard 3 ans' },
  { key: 'mobilier',          label: 'Mobilier et matériel de bureau',   taux: 0, duree: 10, note: 'Durée standard 10 ans' },
  { key: 'immobilisations_incorporelles', label: 'Immobilisations incorporelles', taux: 0, duree: 5, note: 'Logiciels, brevets…' },
  { key: 'autres',            label: 'Autres immobilisations',           taux: 0, duree: 0,  note: '' },
];

const pct = (v) => (v === '' || v == null ? '' : String(v));

export default function AmortissementsTab() {
  const { can, selectedEntrepriseId } = useAuth();
  const peutModifier = can('CONFIG_COMPANY');

  const [rows, setRows] = useState(
    CATEGORIES_DEFAUT.map((c) => ({ ...c, taux: '', duree: c.duree || '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Clé de stockage dans parametres_entreprise (colonne JSON)
  const COL = 'taux_amortissement';

  useEffect(() => {
    if (!supabaseConfigured || !selectedEntrepriseId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('parametres_entreprise')
      .select(COL)
      .eq('entreprise_id', selectedEntrepriseId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        const stored = data?.[COL] || {};
        setRows(
          CATEGORIES_DEFAUT.map((c) => ({
            ...c,
            taux: stored[c.key]?.taux ?? '',
            duree: stored[c.key]?.duree ?? (c.duree || ''),
          }))
        );
        setLoading(false);
      });
  }, [selectedEntrepriseId]);

  const updateRow = (key, field) => (e) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: e.target.value } : r))
    );
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = {};
    rows.forEach((r) => {
      payload[r.key] = {
        taux: r.taux === '' ? 0 : Number(r.taux),
        duree: r.duree === '' ? 0 : Number(r.duree),
      };
    });

    // Essai d'update d'abord, puis upsert si aucune ligne
    const { error: err } = await supabase
      .from('parametres_entreprise')
      .update({ [COL]: payload })
      .eq('entreprise_id', selectedEntrepriseId);

    if (err) {
      // La colonne n'existe peut-être pas encore — on informe l'utilisateur
      setError(`Impossible d'enregistrer : ${err.message}. Vérifiez que la colonne "${COL}" existe dans la table "parametres_entreprise".`);
      toast.error('Enregistrement impossible', err.message);
    } else {
      toast.success("Taux d\u2019amortissement enregistr\u00e9s", "Les taux ont \u00e9t\u00e9 mis \u00e0 jour avec succ\u00e8s.");
    }
    setSaving(false);
  };

  if (loading) return <p className="page-subtitle">Chargement…</p>;

  return (
    <div>
      <h2 className="params-content-title">Taux d'amortissement par catégorie</h2>

      <div
        className="message"
        style={{
          background: 'var(--color-primary-light, #eef7f2)',
          border: '1px solid var(--color-primary-light, #eef7f2)',
          color: 'var(--color-primary-dark, #1b4332)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 20,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          fontSize: 13,
        }}
      >
        <Info size={16} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Définissez les taux annuels et durées par défaut pour chaque catégorie d'immobilisation.
          Ces valeurs sont pré-remplies lors de la création d'une immobilisation.
          Laissez à <strong>0</strong> pour utiliser les valeurs saisies manuellement sur chaque bien.
        </span>
      </div>

      {error && <div className="message error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="amort-table-wrap">
        <table className="balance-table amort-config-table">
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Catégorie</th>
              <th className="text-center" style={{ minWidth: 120 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Percent size={12} /> Taux annuel (%)
                </span>
              </th>
              <th className="text-center" style={{ minWidth: 110 }}>Durée (années)</th>
              <th className="amort-note-col" style={{ minWidth: 140, color: 'var(--color-muted)', fontWeight: 400 }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={!peutModifier ? '' : 'clickable-row'}>
                <td style={{ fontWeight: 500 }}>{row.label}</td>
                <td className="text-center">
                  {peutModifier ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="input amort-rate-input"
                      value={pct(row.taux)}
                      onChange={updateRow(row.key, 'taux')}
                      placeholder="0"
                      style={{ width: 90, textAlign: 'center', margin: '0 auto', display: 'block' }}
                    />
                  ) : (
                    <span className="font-mono">{row.taux === '' || row.taux === 0 ? '—' : `${row.taux} %`}</span>
                  )}
                </td>
                <td className="text-center">
                  {peutModifier ? (
                    <input
                      type="number"
                      min="0"
                      max="99"
                      step="1"
                      className="input amort-rate-input"
                      value={pct(row.duree)}
                      onChange={updateRow(row.key, 'duree')}
                      placeholder="0"
                      style={{ width: 80, textAlign: 'center', margin: '0 auto', display: 'block' }}
                    />
                  ) : (
                    <span className="font-mono">{row.duree === '' || row.duree === 0 ? '—' : `${row.duree} ans`}</span>
                  )}
                </td>
                <td className="amort-note-col" style={{ color: 'var(--color-muted)', fontSize: 12 }}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!peutModifier && (
        <p className="page-subtitle" style={{ marginTop: 12 }}>
          Lecture seule — seul un administrateur peut modifier ces paramètres.
        </p>
      )}

      {peutModifier && (
        <div className="form-actions amort-actions" style={{ marginTop: 20 }}>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setRows(CATEGORIES_DEFAUT.map((c) => ({ ...c, taux: '', duree: c.duree || '' })))}
          >
            Réinitialiser
          </Button>
          <Button disabled={saving} onClick={save}>
            {saving ? 'Enregistrement…' : 'Enregistrer les taux'}
          </Button>
        </div>
      )}
    </div>
  );
}
