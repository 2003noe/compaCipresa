import { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => {
  const n = Number(v || 0);
  if (n === 0) return '-';
  return n.toLocaleString('fr-FR');
};

const dash = (v) => {
  const n = Number(v || 0);
  if (n === 0) return '-';
  return n.toLocaleString('fr-FR');
};

const isNumeroIn = (numero, prefixes) => prefixes.some((p) => (numero || '').startsWith(p));

export default function Bilan() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [companyName, setCompanyName] = useState('CIPRESA SARL');

  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from('parametres_entreprise').select('*').limit(1).maybeSingle(),
      supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin,statut').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,nature,solde_ouverture_debit,solde_ouverture_credit'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(date_ecriture,statut)'),
    ]).then(([paramRes, exRes, acRes, lineRes]) => {
      if (paramRes.data?.nom_entreprise) {
        setCompanyName(paramRes.data.nom_entreprise.toUpperCase());
      } else if (paramRes.data?.nom) {
        setCompanyName(paramRes.data.nom.toUpperCase());
      }

      if (exRes.error || acRes.error || lineRes.error) {
        setNotice(`Impossible de charger le bilan : ${(exRes.error || acRes.error || lineRes.error).message}`);
        setLoading(false);
        return;
      }

      const exList = exRes.data || [];
      setExercises(exList);
      const openExercise = exList.find((e) => e.statut === 'OUVERT') || exList[0];
      if (openExercise) setExerciceId(openExercise.id);
      setAccounts(acRes.data || []);
      setLines((lineRes.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
      setLoading(false);
    });
  }, []);

  const selected = exercises.find((e) => e.id === exerciceId);
  const previous = exercises.find((e) => e.annee === (selected?.annee ? selected.annee - 1 : null));

  const balanceAsOf = (account, cutoffDate) => {
    if (!cutoffDate) return 0;
    const base = Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0);
    const movement = lines
      .filter((l) => l.compte_id === account.id && l.ecritures_comptables.date_ecriture <= cutoffDate)
      .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
    return base + movement;
  };

  const resultNet = useMemo(() => {
    if (!selected) return 0;
    let produits = 0;
    let charges = 0;
    accounts.forEach((a) => {
      const net = lines
        .filter(
          (l) =>
            l.compte_id === a.id &&
            l.ecritures_comptables.date_ecriture >= selected.date_debut &&
            l.ecritures_comptables.date_ecriture <= selected.date_fin
        )
        .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
      if (a.nature === 'CHARGE') charges += net;
      if (a.nature === 'PRODUIT') produits += -net;
    });
    return produits - charges;
  }, [accounts, lines, selected]);

  const rows = useMemo(
    () =>
      accounts.map((a) => ({
        ...a,
        netN: balanceAsOf(a, selected?.date_fin),
        netN1: previous ? balanceAsOf(a, previous.date_fin) : null,
      })),
    [accounts, lines, selected, previous] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const actifImmoIncorp = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && isNumeroIn(r.numero, ['20', '21']));
  const actifImmoCorp = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && isNumeroIn(r.numero, ['22', '23', '24', '25']));
  const actifImmoFin = rows.filter((r) => r.nature === 'ACTIF' && r.classe?.startsWith('Classe 2') && !isNumeroIn(r.numero, ['20', '21', '22', '23', '24', '25']));
  const actifCirculant = rows.filter((r) => r.nature === 'ACTIF' && (r.classe?.startsWith('Classe 3') || r.classe?.startsWith('Classe 4')));
  const tresorerieActif = rows.filter((r) => r.nature === 'TRESORERIE' && (r.netN || 0) >= 0);

  const capitauxPropres = rows.filter((r) => r.nature === 'PASSIF' && r.classe?.startsWith('Classe 1') && !isNumeroIn(r.numero, ['16', '17', '18']));
  const dettes = rows.filter((r) => r.nature === 'PASSIF' && (isNumeroIn(r.numero, ['16', '17', '18']) || r.classe?.startsWith('Classe 4')));
  const tresoreriePassif = rows.filter((r) => r.nature === 'TRESORERIE' && (r.netN || 0) < 0);

  const sum = (list, key = 'netN') => list.reduce((acc, r) => acc + Math.abs(Number(r[key]) || 0), 0);

  const totalActifImmo = sum(actifImmoIncorp) + sum(actifImmoCorp) + sum(actifImmoFin);
  const totalActif = totalActifImmo + sum(actifCirculant) + sum(tresorerieActif);

  const totalCapitaux = sum(capitauxPropres) + Math.abs(resultNet);
  const totalPassif = totalCapitaux + sum(dettes) + sum(tresoreriePassif);
  const ecart = Math.abs(totalActif - totalPassif);

  // Build unified row elements for single side-by-side table
  const actifDisplayRows = useMemo(() => {
    const list = [];

    // Immobilisations Incorporelles
    if (actifImmoIncorp.length > 0) {
      list.push({ isSection: true, label: 'Immobilisations incorporelles' });
      actifImmoIncorp.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: r.netN }));
    }

    // Immobilisations Corporelles
    if (actifImmoCorp.length > 0) {
      list.push({ isSection: true, label: 'Immobilisations corporelles' });
      actifImmoCorp.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: r.netN }));
    }

    // Immobilisations Financières
    if (actifImmoFin.length > 0) {
      list.push({ isSection: true, label: 'Immobilisations financières' });
      actifImmoFin.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: r.netN }));
    }

    list.push({ isSubtotal: true, label: 'Total Actif immobilisé', val: totalActifImmo });

    // Actif circulant
    list.push({ isSection: true, label: 'Actif circulant' });
    actifCirculant.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: r.netN }));
    list.push({ isSubtotal: true, label: 'Total Actif circulant', val: sum(actifCirculant) });

    // Trésorerie actif
    list.push({ isSection: true, label: 'Trésorerie actif' });
    tresorerieActif.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: r.netN }));
    list.push({ isSubtotal: true, label: 'Total Trésorerie actif', val: sum(tresorerieActif) });

    return list;
  }, [actifImmoIncorp, actifImmoCorp, actifImmoFin, actifCirculant, tresorerieActif, totalActifImmo]);

  const passifDisplayRows = useMemo(() => {
    const list = [];

    // Capitaux propres
    list.push({ isSection: true, label: 'Capitaux propres' });
    capitauxPropres.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: Math.abs(r.netN) }));
    list.push({ isItem: true, num: '—', label: "Résultat net de l'exercice", val: resultNet });
    list.push({ isSubtotal: true, label: 'Total Capitaux propres', val: totalCapitaux });

    // Dettes
    list.push({ isSection: true, label: 'Dettes & Passif circulant' });
    dettes.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: Math.abs(r.netN) }));
    list.push({ isSubtotal: true, label: 'Total Dettes', val: sum(dettes) });

    // Trésorerie passif
    list.push({ isSection: true, label: 'Trésorerie passif' });
    tresoreriePassif.forEach((r) => list.push({ isItem: true, num: r.numero, label: r.libelle, val: Math.abs(r.netN) }));
    list.push({ isSubtotal: true, label: 'Total Trésorerie passif', val: sum(tresoreriePassif) });

    return list;
  }, [capitauxPropres, resultNet, totalCapitaux, dettes, tresoreriePassif]);

  const maxRowsCount = Math.max(actifDisplayRows.length, passifDisplayRows.length);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content bilan-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Bilan comptable</h1>
          <p className="page-subtitle">Tableau de situation patrimoniale à la clôture (SYSCOHADA){loading ? ' · Chargement…' : ''}</p>
        </div>
        <div>
          <Button icon={Printer} onClick={handlePrint} disabled={loading || !selected}>
            Imprimer le Bilan
          </Button>
        </div>
      </div>

      <Card className="ledger-toolbar no-print" style={{ marginBottom: '20px' }}>
        <Select label="Exercice comptable" value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
          {exercises.length === 0 && <option value="">Aucun exercice</option>}
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} ({e.annee})
            </option>
          ))}
        </Select>
      </Card>

      {notice && <div className="message error no-print">{notice}</div>}

      {!loading && selected && (
        <>
          {/* EQUILIBRE BADGE */}
          <div className="no-print" style={{ marginBottom: '16px' }}>
            {ecart === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', color: '#065f46', padding: '10px 16px', borderRadius: '8px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>Bilan parfaitement équilibré : Total Actif = Total Passif ({money(totalActif)} FCFA)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#991b1b', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>Écart Actif / Passif : {money(ecart)} FCFA — Le bilan n'est pas équilibré (Vérifiez la classification des comptes).</span>
              </div>
            )}
          </div>

          {/* SINGLE UNIFIED BILAN TABLE CARD */}
          <Card>
            <div className="bilan-print-header" style={{ display: 'none', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>{companyName}</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>BILAN COMPTABLE AU 31/12/{selected.annee}</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                  <p style={{ margin: 0 }}>Exercice : {selected.code}</p>
                  <p style={{ margin: 0 }}>Devise : FCFA</p>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="balance-table bilan-unified-table">
                <thead>
                  <tr>
                    <th colSpan={3} className="text-center" style={{ background: 'var(--color-surface-muted)', color: 'var(--color-primary-dark)', fontSize: '13px', fontWeight: 800, padding: '10px' }}>
                      ACTIF
                    </th>
                    <th colSpan={3} className="text-center border-left" style={{ background: 'var(--color-surface-muted)', color: '#4338ca', fontSize: '13px', fontWeight: 800, padding: '10px' }}>
                      PASSIF
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '80px' }}>Compte</th>
                    <th>Libellé de l'Actif</th>
                    <th className="text-right" style={{ width: '130px' }}>Net (N)</th>
                    <th style={{ width: '80px' }} className="border-left">Compte</th>
                    <th>Libellé du Passif</th>
                    <th className="text-right" style={{ width: '130px' }}>Montant (N)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRowsCount }).map((_, idx) => {
                    const actifCell = actifDisplayRows[idx];
                    const passifCell = passifDisplayRows[idx];

                    return (
                      <tr key={idx}>
                        {/* ACTIF CELL */}
                        {actifCell?.isSection ? (
                          <td colSpan={3} className="balance-class-row">
                            {actifCell.label}
                          </td>
                        ) : actifCell?.isSubtotal ? (
                          <>
                            <td colSpan={2} className="balance-subtotal-row">
                              {actifCell.label}
                            </td>
                            <td className="text-right balance-subtotal-row">{dash(actifCell.val)}</td>
                          </>
                        ) : actifCell?.isItem ? (
                          <>
                            <td className="account-cell">{actifCell.num}</td>
                            <td>{actifCell.label}</td>
                            <td className="text-right">{dash(actifCell.val)}</td>
                          </>
                        ) : (
                          <>
                            <td></td>
                            <td></td>
                            <td></td>
                          </>
                        )}

                        {/* PASSIF CELL */}
                        {passifCell?.isSection ? (
                          <td colSpan={3} className="balance-class-row border-left">
                            {passifCell.label}
                          </td>
                        ) : passifCell?.isSubtotal ? (
                          <>
                            <td colSpan={2} className="balance-subtotal-row border-left">
                              {passifCell.label}
                            </td>
                            <td className="text-right balance-subtotal-row">{dash(passifCell.val)}</td>
                          </>
                        ) : passifCell?.isItem ? (
                          <>
                            <td className="account-cell border-left">{passifCell.num}</td>
                            <td>{passifCell.label}</td>
                            <td className="text-right">{dash(passifCell.val)}</td>
                          </>
                        ) : (
                          <>
                            <td className="border-left"></td>
                            <td></td>
                            <td></td>
                          </>
                        )}
                      </tr>
                    );
                  })}

                  {/* UNIFIED FINAL TOTAL ROW */}
                  <tr className="balance-total-row">
                    <td colSpan={2}>TOTAL ACTIF</td>
                    <td className="text-right">{money(totalActif)}</td>
                    <td colSpan={2} className="border-left">TOTAL PASSIF</td>
                    <td className="text-right">{money(totalPassif)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* EMBEDDED STYLES FOR UNIFIED TABLE */}
      <style>{`
        .border-left {
          border-left: 2px solid var(--color-border) !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          body { background: #fff !important; margin: 0; padding: 0; }
          .bilan-page { margin: 0; padding: 0; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .bilan-print-header { display: block !important; }
          .balance-table { width: 100% !important; border: 1px solid #000 !important; }
          .balance-table th, .balance-table td { border-color: #000 !important; padding: 5px 6px !important; font-size: 11px !important; }
          .border-left { border-left: 2px solid #000 !important; }
          .balance-total-row td { background-color: #f0fdf4 !important; color: #000 !important; border-top: 2px solid #000 !important; }
        }
      `}</style>
    </div>
  );
}
