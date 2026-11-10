import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Lock, CheckCircle2, AlertTriangle, ArrowRight, Calendar } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { STATUT_LABEL, STATUT_TONE, dateFr } from '../../lib/clotures';
import { useAuth } from '../../context/AuthContext';

export default function Clotures() {
  const { can } = useAuth();
  const canPrepare = can('COMPTA_CLOTURE_PREPARE');
  const nav = useNavigate();
  const { selectedExerciceId: exerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const [clotures, setClotures] = useState([]);
  const [progress, setProgress] = useState({});
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [selectedCloture, setSelectedCloture] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('id,nom,prenom')
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((p) => {
          map[p.id] = `${p.prenom || ''} ${p.nom || ''}`.trim();
        });
        setProfiles(map);
      });
  }, []);

  const load = (excId) => {
    if (!excId) return;
    setLoading(true);
    supabase
      .from('clotures_comptables')
      .select('*')
      .eq('exercice_id', excId)
      .order('periode_debut', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          setNotice(`Impossible de charger les clôtures : ${error.message}`);
          setLoading(false);
          return;
        }
        setClotures(data || []);
        const ids = (data || []).map((c) => c.id);
        if (ids.length) {
          const { data: ctrls } = await supabase
            .from('controles_cloture')
            .select('cloture_id,statut')
            .in('cloture_id', ids);
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

  useEffect(() => {
    if (exerciceId) load(exerciceId);
    else if (!exercicesLoading) {
      setClotures([]);
      setProgress({});
      setLoading(false);
    }
  }, [exerciceId, exercicesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPeriodes = clotures.length;
  const controlesEnCours = clotures.filter((c) => c.statut !== 'CLOTUREE').length;
  const periodesCloturees = clotures.filter((c) => c.statut === 'CLOTUREE').length;

  return (
    <div className="page-content">
      {/* 1. Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Clôtures</h1>
          <p className="page-subtitle">
            Suivez vos périodes comptables et préparez chaque clôture avec méthode.
            {loading ? ' · Chargement…' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canPrepare && (
            <Button variant="primary" icon={Plus} onClick={() => nav('/nouvelle-cloture')}>
              Nouvelle clôture
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="message error" role="alert">
          {notice}
        </div>
      )}

      {/* 2. KPIs synthétiques */}
      <div className="cr-kpis no-print">
        <Card>
          <span className="ledger-summary-label">Périodes suivies</span>
          <strong>{totalPeriodes}</strong>
          <small>{selectedExercice?.code ? `Exercice ${selectedExercice.code}` : 'Périodes actives'}</small>
        </Card>
        <Card>
          <span className="ledger-summary-label">Contrôles en cours</span>
          <strong style={{ color: '#b45309' }}>{controlesEnCours}</strong>
          <small>Périodes à préparer</small>
        </Card>
        <Card>
          <span className="ledger-summary-label">Périodes clôturées</span>
          <strong style={{ color: '#16a34a' }}>{periodesCloturees}</strong>
          <small>{periodesCloturees > 0 ? `${periodesCloturees} clôture(s) finalisée(s)` : 'Aucune clôture finalisée'}</small>
        </Card>
      </div>

      {/* 3. Table des périodes */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card-heading" style={{ marginBottom: 16 }}>
          <div>
            <h2>Périodes comptables</h2>
            <p>Votre historique de clôture mensuelle</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="balance-table">
            <thead>
              <tr>
                <th>PÉRIODE</th>
                <th>STATUT</th>
                <th>AVANCEMENT</th>
                <th>RESPONSABLE</th>
                <th>CLÔTURÉE LE</th>
                <th className="text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {clotures.map((c) => {
                const p = progress[c.id] || { total: 0, faits: 0 };
                const pct = p.total ? Math.round((p.faits / p.total) * 100) : 0;
                return (
                  <tr
                    key={c.id}
                    className="clickable-row"
                    onClick={() => setSelectedCloture(c)}
                    title="Cliquer pour afficher les détails de la clôture"
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong style={{ color: 'var(--color-text)' }}>{c.periode}</strong>
                    </td>
                    <td>
                      <Badge tone={STATUT_TONE[c.statut]}>{STATUT_LABEL[c.statut]}</Badge>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <small className="page-subtitle">
                        {p.faits}/{p.total} contrôles ({pct}%)
                      </small>
                    </td>
                    <td>{profiles[c.responsable] || '—'}</td>
                    <td>{dateFr(c.cloturee_le)}</td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="table-action-link"
                        onClick={() => nav(`/clotures/${c.id}`)}
                      >
                        Ouvrir <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {clotures.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-muted)' }}>
                    Aucune période de clôture pour cet exercice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Guide / Onboarding banner */}
      <Card style={{ background: '#f5faf6', border: '1px solid #d8e8dc', padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1b4332' }}>
          Préparez votre clôture sereinement
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#47554d' }}>
          Ouvrez une période pour organiser les contrôles, suivre l'avancement et attribuer un responsable.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <strong style={{ display: 'block', color: '#275a43', fontSize: '13px', marginBottom: 4 }}>
              01 Définir les contrôles
            </strong>
            <small style={{ color: '#5d6e62', fontSize: '12px', lineHeight: 1.5 }}>
              Identifiez les vérifications à effectuer avant la clôture de la période.
            </small>
          </div>
          <div>
            <strong style={{ display: 'block', color: '#275a43', fontSize: '13px', marginBottom: 4 }}>
              02 Répartir les responsabilités
            </strong>
            <small style={{ color: '#5d6e62', fontSize: '12px', lineHeight: 1.5 }}>
              Attribuez les tâches et centralisez le suivi de votre équipe.
            </small>
          </div>
          <div>
            <strong style={{ display: 'block', color: '#275a43', fontSize: '13px', marginBottom: 4 }}>
              03 Revoir la période
            </strong>
            <small style={{ color: '#5d6e62', fontSize: '12px', lineHeight: 1.5 }}>
              Vérifiez les justificatifs et les soldes avant de finaliser la clôture.
            </small>
          </div>
        </div>
      </Card>

      {/* 5. Modal détail clôture */}
      {selectedCloture && (
        <Modal
          isOpen={Boolean(selectedCloture)}
          onClose={() => setSelectedCloture(null)}
          title={`Clôture mensuelle · ${selectedCloture.periode}`}
          subtitle="Suivi de la checklist et des contrôles de période"
          icon={Lock}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelectedCloture(null)}>
                Fermer
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const id = selectedCloture.id;
                  setSelectedCloture(null);
                  nav(`/clotures/${id}`);
                }}
              >
                Ouvrir la checklist complète →
              </Button>
            </>
          }
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Période</span>
              <span className="detail-value">{selectedCloture.periode}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Statut</span>
              <div>
                <Badge tone={STATUT_TONE[selectedCloture.statut]}>
                  {STATUT_LABEL[selectedCloture.statut]}
                </Badge>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Responsable</span>
              <span className="detail-value">{profiles[selectedCloture.responsable] || 'Non assigné'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Date de clôture</span>
              <span className="detail-value">{dateFr(selectedCloture.cloturee_le) || 'En cours'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Avancement des contrôles</span>
              <div style={{ marginTop: 6 }}>
                {(() => {
                  const p = progress[selectedCloture.id] || { total: 0, faits: 0 };
                  const pct = p.total ? Math.round((p.faits / p.total) * 100) : 0;
                  return (
                    <>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-muted)' }}>
                        <span>{p.faits} contrôles validés sur {p.total}</span>
                        <strong>{pct}%</strong>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
