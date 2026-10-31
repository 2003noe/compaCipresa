import { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { ACTIF_SECTIONS, buildBilan, mergeGroup } from '../../lib/bilan';
import { exportBilanExcel, exportBilanPDF, BilanPDFDocument, PDFPreviewModal } from '../../lib/generateFile';

// Montant : 0 => « - », négatif => (montant) selon l'usage comptable
const fmt = (v) => {
  const n = Math.round(Number(v || 0));
  if (n === 0) return '-';
  const txt = Math.abs(n).toLocaleString('fr-FR');
  return n < 0 ? `(${txt})` : txt;
};
const fmtN1 = (v) => (v === null || v === undefined ? '-' : fmt(v));
const deltaValue = (current, previous) => Number(current || 0) - Number(previous || 0);
const deltaLabel = (current, previous) => {
  const delta = deltaValue(current, previous);
  if (Math.abs(delta) < 1) return 'Équilibré';
  const pct = Number(previous)
    ? ` · ${(delta / Math.abs(Number(previous)) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`
    : ' · nouveau';
  return `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}${pct}`;
};
const frDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

// Informations légales affichées si elles existent dans parametres_entreprise
const COMPANY_FIELDS = [
  ['RCCM', ['rccm', 'numero_rccm', 'rc']],
  ['NIU', ['niu', 'nif', 'numero_contribuable']],
  ['Adresse', ['adresse', 'siege']],
];

export default function Bilan() {
  const navigate = useNavigate();
  const { exercices: exercises, selectedExerciceId: exerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const { selectedEntrepriseId } = useAuth();
  const [soldesN, setSoldesN] = useState(null);
  const [soldesN1, setSoldesN1] = useState(null);
  const [comparisonExerciseId, setComparisonExerciseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [notice, setNotice] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [company, setCompany] = useState({ name: 'CIPRESA SARL', details: [] });

  // 1. Entreprise + exercices
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    if (!selectedEntrepriseId) return undefined;
    let active = true;
    supabase
      .from('parametres_entreprise')
      .select('*')
      .eq('entreprise_id', selectedEntrepriseId)
      .maybeSingle()
      .then((paramRes) => {
        if (!active) return;
        const p = paramRes.data;
        if (p) {
          const name = p.raison_sociale || p.nom_entreprise || p.nom;
          const details = COMPANY_FIELDS
            .map(([label, keys]) => {
              const key = keys.find((k) => p[k]);
              return key ? `${label} : ${p[key]}` : null;
            })
            .filter(Boolean);
          setCompany({ name: name ? name.toUpperCase() : 'CIPRESA SARL', details });
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedEntrepriseId]);

  const selected = useMemo(
    () => selectedExercice || exercises.find((e) => e.id === exerciceId) || null,
    [selectedExercice, exercises, exerciceId],
  );

  const comparisonExercises = useMemo(
    () =>
      selected
        ? exercises
            .filter((e) => e.id !== selected.id && e.date_fin < selected.date_debut)
            .sort((a, b) => b.date_fin.localeCompare(a.date_fin))
        : [],
    [exercises, selected],
  );
  const defaultComparisonId = comparisonExercises[0]?.id || '';
  const effectiveComparisonId = comparisonExercises.some((e) => e.id === comparisonExerciseId)
    ? comparisonExerciseId
    : defaultComparisonId;
  const comparison = useMemo(
    () => comparisonExercises.find((e) => e.id === effectiveComparisonId) || null,
    [comparisonExercises, effectiveComparisonId],
  );

  useEffect(() => {
    setComparisonExerciseId(defaultComparisonId);
  }, [selected?.id, defaultComparisonId]);

  // 2. Soldes calculés côté base et bornés à l'exercice exact sélectionné.
  useEffect(() => {
    if (!supabaseConfigured || !selected) {
      setSoldesN(null);
      setSoldesN1(null);
      setLoadingData(false);
      return undefined;
    }
    let active = true;
    setLoadingData(true);
    setNotice('');

    const fetchSoldesFallback = async (ex) => {
      try {
        const [accRes, linesRes] = await Promise.all([
          supabase.from('comptes_comptables').select('id,numero,libelle,classe,nature,solde_ouverture_debit,solde_ouverture_credit').order('numero'),
          supabase.from('lignes_ecritures')
            .select('compte_id,debit,credit,ecritures_comptables!ligne_ecriture_company_fk!inner(exercice_id,date_ecriture,statut)')
            .eq('ecritures_comptables.exercice_id', ex.id)
            .lte('ecritures_comptables.date_ecriture', ex.date_fin)
            .eq('ecritures_comptables.statut', 'VALIDEE'),
        ]);
        if (accRes.error) return { data: null, error: accRes.error };

        const d0 = ex.date_debut || '0001-01-01';
        const mouv = {};
        (linesRes.data || []).forEach((l) => {
          if (!mouv[l.compte_id]) mouv[l.compte_id] = { ant: 0, pdeb: 0, pcre: 0 };
          const d = Number(l.debit || 0);
          const c = Number(l.credit || 0);
          const dt = l.ecritures_comptables?.date_ecriture;
          if (dt && dt < d0) {
            mouv[l.compte_id].ant += (d - c);
          } else {
            mouv[l.compte_id].pdeb += d;
            mouv[l.compte_id].pcre += c;
          }
        });

        const list = (accRes.data || []).map((acc) => {
          const ouv = Number(acc.solde_ouverture_debit || 0) - Number(acc.solde_ouverture_credit || 0);
          const m = mouv[acc.id] || { ant: 0, pdeb: 0, pcre: 0 };
          const solde_fin = ouv + m.ant + m.pdeb - m.pcre;
          return {
            compte_id: acc.id,
            numero: acc.numero,
            libelle: acc.libelle,
            classe: acc.classe,
            nature: acc.nature,
            ouverture: ouv,
            anterieur: m.ant,
            periode_debit: m.pdeb,
            periode_credit: m.pcre,
            solde_fin,
          };
        }).filter((k) => k.ouverture !== 0 || k.anterieur !== 0 || k.periode_debit !== 0 || k.periode_credit !== 0);

        return { data: list, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    };

    const call = async (ex) => {
      const res = await supabase.rpc('soldes_comptes_exercice', {
        p_exercice_id: ex.id,
        p_date_fin: ex.date_fin,
        p_date_debut: ex.date_debut,
      });
      if (res.error && /exercice_id/i.test(res.error.message)) {
        return fetchSoldesFallback(ex);
      }
      return res;
    };

    Promise.all([call(selected), comparison ? call(comparison) : Promise.resolve({ data: null, error: null })]).then(
      ([n, n1]) => {
        if (!active) return;
        const err = n.error || n1.error;
        if (err) {
          const missing = /soldes_comptes|PGRST202|42883/.test(`${err.code} ${err.message}`);
          setNotice(
            missing
              ? "La fonction SQL « soldes_comptes_exercice » est introuvable : exécutez la migration bilan_soldes_comptes_exercice.sql dans Supabase."
              : `Impossible de charger le bilan : ${err.message}`,
          );
          setSoldesN(null);
          setSoldesN1(null);
        } else {
          setSoldesN(n.data || []);
          setSoldesN1(n1.data || null);
        }
        setLoadingData(false);
      },
    );

    return () => {
      active = false;
    };
  }, [selected, comparison]);

  const bilanN = useMemo(() => (soldesN ? buildBilan(soldesN) : null), [soldesN]);
  const bilanN1 = useMemo(() => (soldesN1 ? buildBilan(soldesN1) : null), [soldesN1]);
  const showN1 = Boolean(bilanN1);

  // 3. Lignes d'affichage ACTIF / PASSIF
  const { actifRows, passifRows } = useMemo(() => {
    if (!bilanN) return { actifRows: [], passifRows: [] };
    const t = bilanN.totals;
    const t1 = bilanN1?.totals;
    const v1 = (key) => (t1 ? t1[key] : null);

    const items = (key) =>
      mergeGroup(bilanN, bilanN1, key).map((r) => ({
        isItem: true,
        compte_id: r.compte_id,
        num: r.numero,
        label: r.libelle,
        val: r.val,
        val1: r.val1,
      }));

    const actif = [];
    ACTIF_SECTIONS.forEach(([key, label]) => {
      const list = items(key);
      if (list.length) {
        actif.push({ isSection: true, label });
        actif.push(...list);
      }
    });
    actif.push({ isSubtotal: true, label: 'Total Actif immobilisé', val: t.immo, val1: v1('immo') });

    actif.push({ isSection: true, label: 'Actif circulant' });
    actif.push(...items('AC'));
    actif.push({ isSubtotal: true, label: 'Total Actif circulant', val: t.AC, val1: v1('AC') });

    actif.push({ isSection: true, label: 'Trésorerie actif' });
    actif.push(...items('TA'));
    actif.push({ isSubtotal: true, label: 'Total Trésorerie actif', val: t.TA, val1: v1('TA') });

    const passif = [];
    passif.push({ isSection: true, label: 'Capitaux propres' });
    passif.push(...items('CP'));
    if (bilanN.resultatAnterieur !== 0 || (bilanN1 && bilanN1.resultatAnterieur !== 0)) {
      passif.push({
        isItem: true,
        num: '—',
        label: 'Résultats des exercices antérieurs non affectés',
        val: bilanN.resultatAnterieur,
        val1: bilanN1 ? bilanN1.resultatAnterieur : null,
      });
    }
    passif.push({
      isItem: true,
      num: '—',
      label: "Résultat net de l'exercice",
      val: bilanN.resultatPeriode,
      val1: bilanN1 ? bilanN1.resultatPeriode : null,
    });
    passif.push({ isSubtotal: true, label: 'Total Capitaux propres', val: t.CP, val1: v1('CP') });

    passif.push({ isSection: true, label: 'Dettes financières et ressources assimilées' });
    passif.push(...items('DF'));
    passif.push({ isSubtotal: true, label: 'Total Dettes financières', val: t.DF, val1: v1('DF') });

    passif.push({ isSection: true, label: 'Passif circulant' });
    passif.push(...items('PC'));
    passif.push({ isSubtotal: true, label: 'Total Passif circulant', val: t.PC, val1: v1('PC') });

    passif.push({ isSection: true, label: 'Trésorerie passif' });
    passif.push(...items('TP'));
    passif.push({ isSubtotal: true, label: 'Total Trésorerie passif', val: t.TP, val1: v1('TP') });

    return { actifRows: actif, passifRows: passif };
  }, [bilanN, bilanN1]);

  const cols = showN1 ? 5 : 3;
  const ecart = bilanN ? Math.abs(bilanN.ecart) : 0;
  const equilibre = ecart < 1;
  const nonClasses = bilanN ? [...bilanN.groups.NC.values()] : [];
  const provisoire = selected?.statut === 'OUVERT';

  const renderCell = (cell) => {
    if (!cell) {
      return (
        <>
          <td></td>
          <td></td>
          <td></td>
          {showN1 && <td></td>}
          {showN1 && <td></td>}
        </>
      );
    }
    if (cell.isSection) {
      return (
        <td colSpan={cols} className="balance-class-row">
          {cell.label}
        </td>
      );
    }
    if (cell.isSubtotal) {
      return (
        <>
          <td colSpan={2} className="balance-subtotal-row">
            {cell.label}
          </td>
          <td className="text-right balance-subtotal-row">{fmt(cell.val)}</td>
          {showN1 && <td className="text-right balance-subtotal-row">{fmtN1(cell.val1)}</td>}
          {showN1 && <td className="text-right balance-subtotal-row">{deltaLabel(cell.val, cell.val1)}</td>}
        </>
      );
    }
    return (
      <>
        <td className="account-cell">
          {cell.compte_id ? (
            <button
              type="button"
              className="report-account-link"
              title="Ouvrir le grand livre de ce compte"
              onClick={() => navigate(`/grand-livre?compte=${encodeURIComponent(cell.compte_id)}`)}
            >
              {cell.num}
            </button>
          ) : (
            cell.num
          )}
        </td>
        <td>{cell.label}</td>
        <td className="text-right">{fmt(cell.val)}</td>
        {showN1 && <td className="text-right">{fmtN1(cell.val1)}</td>}
        {showN1 && (
          <td
            className={`text-right ${
              deltaValue(cell.val, cell.val1) > 0
                ? 'report-delta-positive'
                : deltaValue(cell.val, cell.val1) < 0
                ? 'report-delta-negative'
                : ''
            }`}
          >
            {deltaLabel(cell.val, cell.val1)}
          </td>
        )}
      </>
    );
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportBilanPDF({
        actifRows,
        passifRows,
        bilan: bilanN,
        bilanN1,
        exercice: selected,
        exerciceN1: comparison,
      });
    } catch (err) {
      console.error('Erreur export PDF bilan:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportExcel = () => {
    exportBilanExcel({
      actifRows,
      passifRows,
      bilan: bilanN,
      bilanN1,
      exercice: selected,
      exerciceN1: comparison,
    });
  };

  const isPageBusy = loading || loadingData || exercicesLoading;

  // Rendu d'une table Actif ou Passif (disposition côte à côte sur écran large, empilée sur mobile/tablette)
  const renderSingleTable = (type) => {
    const isActif = type === 'actif';
    const rows = isActif ? actifRows : passifRows;
    const title = isActif ? 'ACTIF' : 'PASSIF';
    const totalVal = isActif ? bilanN?.totals.actif : bilanN?.totals.passif;
    const totalVal1 = isActif ? bilanN1?.totals.actif : bilanN1?.totals.passif;
    const sideClass = isActif ? 'actif' : 'passif';

    return (
      <Card className="bilan-table-card">
        <h2 className={`bilan-side-title ${sideClass}`}>
          <span>
            {title} — {isActif ? 'Avoirs, immobilisations et créances' : 'Capitaux propres et dettes'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            Total : {fmt(totalVal)} FCFA
          </span>
        </h2>
        <div className="table-wrap">
          <table className="balance-table bilan-single-table">
            <thead>
              <tr>
                <th style={{ width: '75px' }}>Compte</th>
                <th>Libellé de {isActif ? "l'Actif" : 'Passif'}</th>
                <th className="text-right" style={{ width: '120px' }}>Net (N)</th>
                {showN1 && <th className="text-right" style={{ width: '120px' }}>Net (N-1)</th>}
                {showN1 && <th className="text-right" style={{ width: '110px' }}>Écart / %</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>{renderCell(row)}</tr>
              ))}
              <tr className="balance-total-row">
                <td colSpan={2}>TOTAL {title}</td>
                <td className="text-right">{fmt(totalVal)}</td>
                {showN1 && <td className="text-right">{fmtN1(totalVal1)}</td>}
                {showN1 && <td className="text-right">{deltaLabel(totalVal, totalVal1)}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return (
    <div className="page-content bilan-page">
      {/* 1. En-tête standard et responsive */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Bilan comptable</h1>
          <p className="page-subtitle">
            Tableau de situation patrimoniale à la clôture (SYSCOHADA)
            {isPageBusy ? ' · Chargement…' : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => setShowPDFPreview(true)}
            disabled={isPageBusy || !bilanN}
          >
            Imprimer (PDF)
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={handleExportExcel}
            disabled={isPageBusy || !bilanN}
          >
            Exporter Excel
          </Button>
        </div>
      </div>

      {/* 2. Barre d'outils et sélecteurs dans une Card dédiée */}
      <Card className="bilan-toolbar ledger-toolbar no-print">
        <div className="bilan-toolbar-filters">
          <div className="field">
            <span className="field-label">Exercice actif</span>
            <div className="input" aria-live="polite">
              {selected
                ? `${selected.code || selected.annee} (${frDate(selected.date_debut)} – ${frDate(selected.date_fin)})`
                : isPageBusy
                ? 'Chargement…'
                : 'Aucun exercice'}
            </div>
          </div>

          <Select
            label="Comparer avec"
            value={effectiveComparisonId}
            onChange={(event) => setComparisonExerciseId(event.target.value)}
            disabled={!comparisonExercises.length || isPageBusy}
          >
            <option value="">
              {comparisonExercises.length ? 'Aucun exercice antérieur' : 'Aucun exercice antérieur disponible'}
            </option>
            {comparisonExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.code || exercise.annee} · {frDate(exercise.date_debut)} – {frDate(exercise.date_fin)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Messages d'erreur ou d'information */}
      {notice && <div className="message error no-print" role="alert">{notice}</div>}

      {/* État de chargement élégant */}
      {isPageBusy && (
        <Card className="bilan-loading-state no-print">
          <div className="bilan-loading-spinner" />
          <strong>Chargement du bilan comptable en cours…</strong>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Calcul des soldes et consolidation de la situation patrimoniale
          </p>
        </Card>
      )}

      {/* État vide : Aucun exercice */}
      {!isPageBusy && !selected && (
        <Card className="bilan-empty-state no-print">
          <Scale size={44} style={{ opacity: 0.35 }} />
          <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>Aucun exercice sélectionné</h3>
          <p className="page-subtitle" style={{ margin: 0, maxWidth: '420px' }}>
            Veuillez sélectionner ou créer un exercice comptable pour consulter le bilan.
          </p>
        </Card>
      )}

      {/* État vide : Données indisponibles */}
      {!isPageBusy && selected && !bilanN && (
        <Card className="bilan-empty-state no-print">
          <AlertTriangle size={44} style={{ color: '#d97706', opacity: 0.8 }} />
          <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>Données du bilan indisponibles</h3>
          <p className="page-subtitle" style={{ margin: 0, maxWidth: '460px' }}>
            {notice || "Aucun solde ou compte comptable n'a pu être chargé pour cet exercice."}
          </p>
        </Card>
      )}

      {/* Contenu principal du Bilan */}
      {!isPageBusy && selected && bilanN && (
        <>
          {/* 3. Cartes KPI synthétiques */}
          <div className="bilan-kpis no-print">
            <Card>
              <span className="ledger-summary-label">Total Actif Net</span>
              <strong>
                {fmt(bilanN.totals.actif)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>FCFA</span>
              </strong>
              <small>
                {showN1
                  ? `Écart N-1 : ${deltaLabel(bilanN.totals.actif, bilanN1?.totals.actif)}`
                  : 'Total des éléments positifs du patrimoine'}
              </small>
            </Card>

            <Card>
              <span className="ledger-summary-label">Total Passif</span>
              <strong>
                {fmt(bilanN.totals.passif)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>FCFA</span>
              </strong>
              <small>
                {showN1
                  ? `Écart N-1 : ${deltaLabel(bilanN.totals.passif, bilanN1?.totals.passif)}`
                  : 'Capitaux propres et ressources externes'}
              </small>
            </Card>

            <Card>
              <span className="ledger-summary-label">Résultat Net de l'exercice</span>
              <strong className={bilanN.resultatPeriode >= 0 ? 'positive' : 'report-delta-negative'}>
                {fmt(bilanN.resultatPeriode)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>FCFA</span>
              </strong>
              <small>
                {bilanN.resultatPeriode >= 0
                  ? "Bénéfice de l'exercice (ressource)"
                  : "Perte de l'exercice"}
              </small>
            </Card>

            <Card>
              <span className="ledger-summary-label">Équilibre du Bilan</span>
              <div>
                {equilibre ? (
                  <span className="bilan-kpi-badge success">
                    <CheckCircle2 size={14} /> Bilan équilibré
                  </span>
                ) : (
                  <span className="bilan-kpi-badge danger">
                    <AlertTriangle size={14} /> Écart : {fmt(bilanN.ecart)} FCFA
                  </span>
                )}
              </div>
              <small>
                {equilibre ? 'Total Actif = Total Passif' : "Vérifiez les soldes et comptes non classés"}
              </small>
            </Card>
          </div>

          {/* Comparaison info */}
          {comparison && (
            <div className="message no-print" style={{ marginBottom: 4 }} role="status">
              Comparaison avec l’exercice {comparison.code || comparison.annee}, arrêté au {frDate(comparison.date_fin)}.
            </div>
          )}

          {/* Comptes non classés */}
          {nonClasses.length > 0 && (
            <div className="message error no-print" style={{ marginBottom: 4 }}>
              {nonClasses.length} compte(s) non classé(s) dans le bilan (exclus des totaux) :{' '}
              {nonClasses.map((c) => `${c.numero} ${c.libelle} (${fmt(c.value)})`).join(' ; ')}
            </div>
          )}

          {/* Situation provisoire */}
          {provisoire && (
            <div
              className="no-print"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fffbeb',
                color: '#92400e',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #fde68a',
                marginBottom: '4px',
              }}
            >
              <Info size={18} />
              <span>
                Situation provisoire : l'exercice {selected.code} est encore ouvert. Le bilan reflète les écritures
                validées au {frDate(selected.date_fin)}.
              </span>
            </div>
          )}

          {/* En-tête visible à l'impression uniquement */}
          <div className="bilan-print-header" style={{ display: 'none', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{company.name}</h2>
                {company.details.map((d) => (
                  <p key={d} style={{ margin: '2px 0 0 0', fontSize: '11px' }}>{d}</p>
                ))}
                <p style={{ margin: '6px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>
                  BILAN COMPTABLE{provisoire ? ' PROVISOIRE' : ''} AU {frDate(selected.date_fin)}
                  {comparison ? ` · Comparaison ${comparison.code || comparison.annee}` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px' }}>
                <p style={{ margin: 0 }}>Exercice : {selected.code}</p>
                <p style={{ margin: 0 }}>Du {frDate(selected.date_debut)} au {frDate(selected.date_fin)}</p>
                <p style={{ margin: 0 }}>Devise : FCFA</p>
              </div>
            </div>
          </div>

          {/* 4. Tableaux Actif et Passif (côte à côte sur desktop, empilés sur mobile/tablette) */}
          <div className="bilan-columns">
            {renderSingleTable('actif')}
            {renderSingleTable('passif')}
          </div>

          <p className="page-subtitle no-print" style={{ marginTop: 8, fontSize: 12 }}>
            Les montants entre parenthèses sont négatifs (amortissements, dépréciations, pertes). Les comptes de tiers
            et de trésorerie sont classés à l'actif ou au passif selon le sens de leur solde.
          </p>
        </>
      )}

      {/* Impression dédiée A4 Paysage */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          body { background: #fff !important; margin: 0; padding: 0; }
          .bilan-page { margin: 0; padding: 0; }
          .bilan-columns { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .bilan-print-header { display: block !important; }
          .balance-table { width: 100% !important; border: 1px solid #000 !important; }
          .balance-table th, .balance-table td { border-color: #000 !important; padding: 4px 5px !important; font-size: 10px !important; }
          .balance-total-row td { background-color: #f0fdf4 !important; color: #000 !important; border-top: 2px solid #000 !important; }
        }
      `}</style>

      {/* Aperçu PDF interactif */}
      {showPDFPreview && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Bilan comptable (SYSCOHADA)"
          subtitle={`Exercice : ${selected?.code || ''}`}
          filename={`Bilan_Comptable_${selected?.code || 'exercice'}`}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <BilanPDFDocument
              actifRows={actifRows}
              passifRows={passifRows}
              bilan={bilanN}
              bilanN1={bilanN1}
              exercice={selected}
              exerciceN1={comparison}
              orientation={orientation}
            />
          )}
        />
      )}
    </div>
  );
}
