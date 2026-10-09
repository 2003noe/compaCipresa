import { useEffect, useMemo, useState } from 'react';
import { Printer, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { ACTIF_SECTIONS, buildBilan, mergeGroup } from '../../lib/bilan';

// Montant : 0 => « - », négatif => (montant) selon l'usage comptable
const fmt = (v) => {
  const n = Math.round(Number(v || 0));
  if (n === 0) return '-';
  const txt = Math.abs(n).toLocaleString('fr-FR');
  return n < 0 ? `(${txt})` : txt;
};
const fmtN1 = (v) => (v === null || v === undefined ? '-' : fmt(v));
const frDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

// Informations légales affichées si elles existent dans parametres_entreprise
const COMPANY_FIELDS = [
  ['RCCM', ['rccm', 'numero_rccm', 'rc']],
  ['NIU', ['niu', 'nif', 'numero_contribuable']],
  ['Adresse', ['adresse', 'siege']],
];

export default function Bilan() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [soldesN, setSoldesN] = useState(null);
  const [soldesN1, setSoldesN1] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [notice, setNotice] = useState('');
  const [company, setCompany] = useState({ name: 'CIPRESA SARL', details: [] });

  // 1. Entreprise + exercices
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from('parametres_entreprise').select('*').limit(1).maybeSingle(),
      supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin,statut').order('annee', { ascending: false }),
    ]).then(([paramRes, exRes]) => {
      const p = paramRes.data;
      if (p) {
        const name = p.nom_entreprise || p.nom;
        const details = COMPANY_FIELDS
          .map(([label, keys]) => {
            const key = keys.find((k) => p[k]);
            return key ? `${label} : ${p[key]}` : null;
          })
          .filter(Boolean);
        setCompany({ name: name ? name.toUpperCase() : 'CIPRESA SARL', details });
      }

      if (exRes.error) {
        setNotice(`Impossible de charger les exercices : ${exRes.error.message}`);
        setLoading(false);
        return;
      }

      const exList = exRes.data || [];
      setExercises(exList);
      const openExercise = exList.find((e) => e.statut === 'OUVERT') || exList[0];
      if (openExercise) setExerciceId(openExercise.id);
      setLoading(false);
    });
  }, []);

  const selected = useMemo(() => exercises.find((e) => e.id === exerciceId), [exercises, exerciceId]);

  // Exercice précédent = celui qui se termine le plus récemment avant le début de l'exercice choisi
  const previous = useMemo(() => {
    if (!selected) return null;
    return exercises
      .filter((e) => e.date_fin < selected.date_debut)
      .sort((a, b) => (a.date_fin < b.date_fin ? 1 : -1))[0] || null;
  }, [exercises, selected]);

  // 2. Soldes calculés côté base (fonction SQL soldes_comptes)
  useEffect(() => {
    if (!supabaseConfigured || !selected) return undefined;
    let active = true;
    setLoadingData(true);
    setNotice('');

    const call = (ex) => supabase.rpc('soldes_comptes', { p_date_fin: ex.date_fin, p_date_debut: ex.date_debut });

    Promise.all([call(selected), previous ? call(previous) : Promise.resolve({ data: null, error: null })])
      .then(([n, n1]) => {
        if (!active) return;
        const err = n.error || n1.error;
        if (err) {
          const missing = /soldes_comptes|PGRST202|42883/.test(`${err.code} ${err.message}`);
          setNotice(
            missing
              ? "La fonction SQL « soldes_comptes » est introuvable : exécutez le script bilan_soldes_comptes.sql dans Supabase."
              : `Impossible de charger le bilan : ${err.message}`,
          );
          setSoldesN(null);
          setSoldesN1(null);
        } else {
          setSoldesN(n.data || []);
          setSoldesN1(n1.data);
        }
        setLoadingData(false);
      });

    return () => { active = false; };
  }, [selected, previous]);

  const bilanN = useMemo(() => (soldesN ? buildBilan(soldesN) : null), [soldesN]);
  const bilanN1 = useMemo(() => (soldesN1 ? buildBilan(soldesN1) : null), [soldesN1]);
  const showN1 = Boolean(previous && bilanN1);

  // 3. Lignes d'affichage ACTIF / PASSIF
  const { actifRows, passifRows } = useMemo(() => {
    if (!bilanN) return { actifRows: [], passifRows: [] };
    const t = bilanN.totals;
    const t1 = bilanN1?.totals;
    const v1 = (key) => (t1 ? t1[key] : null);

    const items = (key) =>
      mergeGroup(bilanN, bilanN1, key).map((r) => ({ isItem: true, num: r.numero, label: r.libelle, val: r.val, val1: r.val1 }));

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

  const maxRowsCount = Math.max(actifRows.length, passifRows.length);
  const cols = showN1 ? 4 : 3;
  const ecart = bilanN ? Math.abs(bilanN.ecart) : 0;
  const equilibre = ecart < 1;
  const nonClasses = bilanN ? [...bilanN.groups.NC.values()] : [];
  const provisoire = selected?.statut === 'OUVERT';

  const renderCell = (cell, withBorder) => {
    const bl = withBorder ? ' border-left' : '';
    if (!cell) {
      return (
        <>
          <td className={withBorder ? 'border-left' : undefined}></td>
          <td></td>
          <td></td>
          {showN1 && <td></td>}
        </>
      );
    }
    if (cell.isSection) {
      return <td colSpan={cols} className={`balance-class-row${bl}`}>{cell.label}</td>;
    }
    if (cell.isSubtotal) {
      return (
        <>
          <td colSpan={2} className={`balance-subtotal-row${bl}`}>{cell.label}</td>
          <td className="text-right balance-subtotal-row">{fmt(cell.val)}</td>
          {showN1 && <td className="text-right balance-subtotal-row">{fmtN1(cell.val1)}</td>}
        </>
      );
    }
    return (
      <>
        <td className={`account-cell${bl}`}>{cell.num}</td>
        <td>{cell.label}</td>
        <td className="text-right">{fmt(cell.val)}</td>
        {showN1 && <td className="text-right">{fmtN1(cell.val1)}</td>}
      </>
    );
  };

  return (
    <div className="page-content bilan-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Bilan comptable</h1>
          <p className="page-subtitle">
            Tableau de situation patrimoniale à la clôture (SYSCOHADA){loading || loadingData ? ' · Chargement…' : ''}
          </p>
        </div>
        <div>
          <Button icon={Printer} onClick={() => window.print()} disabled={loading || loadingData || !bilanN}>
            Imprimer le Bilan
          </Button>
        </div>
      </div>

      <Card className="ledger-toolbar no-print" style={{ marginBottom: '20px' }}>
        <Select label="Exercice comptable" value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
          {exercises.length === 0 && <option value="">Aucun exercice</option>}
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} ({e.annee}){e.statut === 'OUVERT' ? ' · ouvert' : ''}
            </option>
          ))}
        </Select>
      </Card>

      {notice && <div className="message error no-print">{notice}</div>}

      {!loading && !loadingData && selected && bilanN && (
        <>
          {/* Équilibre */}
          <div className="no-print" style={{ marginBottom: '12px' }}>
            {equilibre ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', color: '#065f46', padding: '10px 16px', borderRadius: '8px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>Bilan équilibré : Total Actif = Total Passif ({fmt(bilanN.totals.actif)} FCFA)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>Écart Actif / Passif : {fmt(ecart)} FCFA. Le bilan n'est pas équilibré : vérifiez les soldes d'ouverture et les comptes non classés ci-dessous.</span>
              </div>
            )}
          </div>

          {/* Comptes non classés */}
          {nonClasses.length > 0 && (
            <div className="message error no-print" style={{ marginBottom: '12px' }}>
              {nonClasses.length} compte(s) non classé(s) dans le bilan (exclus des totaux) :{' '}
              {nonClasses.map((c) => `${c.numero} ${c.libelle} (${fmt(c.value)})`).join(' ; ')}
            </div>
          )}

          {/* Situation provisoire */}
          {provisoire && (
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb', color: '#92400e', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '16px' }}>
              <Info size={18} />
              <span>Situation provisoire : l'exercice {selected.code} est encore ouvert. Le bilan reflète les écritures validées au {frDate(selected.date_fin)}.</span>
            </div>
          )}

          <Card>
            <div className="bilan-print-header" style={{ display: 'none', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>{company.name}</h2>
                  {company.details.map((d) => (
                    <p key={d} style={{ margin: '2px 0 0 0', fontSize: '11px' }}>{d}</p>
                  ))}
                  <p style={{ margin: '6px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>
                    BILAN COMPTABLE{provisoire ? ' PROVISOIRE' : ''} AU {frDate(selected.date_fin)}
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                  <p style={{ margin: 0 }}>Exercice : {selected.code}</p>
                  <p style={{ margin: 0 }}>Du {frDate(selected.date_debut)} au {frDate(selected.date_fin)}</p>
                  <p style={{ margin: 0 }}>Devise : FCFA</p>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="balance-table bilan-unified-table">
                <thead>
                  <tr>
                    <th colSpan={cols} className="text-center" style={{ background: 'var(--color-surface-muted)', color: 'var(--color-primary-dark)', fontSize: '13px', fontWeight: 800, padding: '10px' }}>
                      ACTIF
                    </th>
                    <th colSpan={cols} className="text-center border-left" style={{ background: 'var(--color-surface-muted)', color: '#4338ca', fontSize: '13px', fontWeight: 800, padding: '10px' }}>
                      PASSIF
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '70px' }}>Compte</th>
                    <th>Libellé de l'Actif</th>
                    <th className="text-right" style={{ width: '110px' }}>Net (N)</th>
                    {showN1 && <th className="text-right" style={{ width: '110px' }}>Net (N-1)</th>}
                    <th style={{ width: '70px' }} className="border-left">Compte</th>
                    <th>Libellé du Passif</th>
                    <th className="text-right" style={{ width: '110px' }}>Montant (N)</th>
                    {showN1 && <th className="text-right" style={{ width: '110px' }}>Montant (N-1)</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRowsCount }).map((_, idx) => (
                    <tr key={idx}>
                      {renderCell(actifRows[idx], false)}
                      {renderCell(passifRows[idx], true)}
                    </tr>
                  ))}

                  <tr className="balance-total-row">
                    <td colSpan={2}>TOTAL ACTIF</td>
                    <td className="text-right">{fmt(bilanN.totals.actif)}</td>
                    {showN1 && <td className="text-right">{fmtN1(bilanN1?.totals.actif)}</td>}
                    <td colSpan={2} className="border-left">TOTAL PASSIF</td>
                    <td className="text-right">{fmt(bilanN.totals.passif)}</td>
                    {showN1 && <td className="text-right">{fmtN1(bilanN1?.totals.passif)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="page-subtitle" style={{ marginTop: 12, fontSize: 12 }}>
              Les montants entre parenthèses sont négatifs (amortissements, dépréciations, pertes). Les comptes de tiers
              et de trésorerie sont classés à l'actif ou au passif selon le sens de leur solde.
            </p>
          </Card>
        </>
      )}

      <style>{`
        .border-left {
          border-left: 2px solid var(--color-border) !important;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          body { background: #fff !important; margin: 0; padding: 0; }
          .bilan-page { margin: 0; padding: 0; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .bilan-print-header { display: block !important; }
          .balance-table { width: 100% !important; border: 1px solid #000 !important; }
          .balance-table th, .balance-table td { border-color: #000 !important; padding: 4px 5px !important; font-size: 10px !important; }
          .border-left { border-left: 2px solid #000 !important; }
          .balance-total-row td { background-color: #f0fdf4 !important; color: #000 !important; border-top: 2px solid #000 !important; }
        }
      `}</style>
    </div>
  );
}